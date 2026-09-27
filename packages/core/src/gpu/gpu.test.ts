/**
 * GPU kernels checked against the CPU Tensor library. Runs on Dawn through the `webgpu` package;
 * skipped where no adapter is available (e.g. CI without a GPU).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../util/random.ts';
import { Tensor, nn } from '../tensor/index.ts';
import { GpuContext, GpuIds, GpuSGD, GpuTensor, MATMUL_KERNELS, crossEntropy, embedding, matmulInto, scope, type MatmulVariant } from './index.ts';
import { nodeGpu } from './node.ts';

let ctx: GpuContext | null = null;
beforeAll(async () => {
  ctx = await nodeGpu();
});

const close = (a: Float32Array, b: Float32Array, tol = 1e-4) => {
  expect(a.length).toBe(b.length);
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i]! - b[i]!) / Math.max(1, Math.abs(b[i]!)));
  expect(worst).toBeLessThan(tol);
};

describe('GPU backend', () => {
  it('runs the matmul variants, with and without transposes', async (t) => {
    if (!ctx) return t.skip();
    const rng = mulberry32(1);
    for (const [M, K, N] of [[1, 1, 1], [17, 33, 5], [64, 64, 64], [70, 130, 90]] as const) {
      const A = Tensor.randn([M, K], { rng }), B = Tensor.randn([K, N], { rng });
      const ref = A.matmul(B).toFloat32Array();
      for (const variant of Object.keys(MATMUL_KERNELS) as MatmulVariant[]) {
        for (const [ta, tb] of [[false, false], [true, false], [false, true]]) {
          const a = GpuTensor.from(ctx, ta ? A.transpose(0, 1) : A);
          const b = GpuTensor.from(ctx, tb ? B.transpose(0, 1) : B);
          const c = GpuTensor.empty(ctx, [M, N]);
          matmulInto(ctx, a.buffer, b.buffer, c.buffer, { M, N, K, transA: ta, transB: tb }, variant);
          close(await c.read(), ref);
          [a, b, c].forEach((x) => x.dispose());
        }
      }
    }
  });

  it('batches matmuls along the z dimension', async (t) => {
    if (!ctx) return t.skip();
    const rng = mulberry32(2);
    const A = Tensor.randn([3, 5, 7], { rng }), B = Tensor.randn([3, 7, 4], { rng });
    const a = GpuTensor.from(ctx, A), b = GpuTensor.from(ctx, B), c = GpuTensor.empty(ctx, [3, 5, 4]);
    matmulInto(ctx, a.buffer, b.buffer, c.buffer, { M: 5, N: 4, K: 7, batch: 3 });
    close(await c.read(), A.matmul(B).toFloat32Array());
  });

  it('matches element-wise ops, reductions and their gradients', async (t) => {
    if (!ctx) return t.skip();
    const rng = mulberry32(3);
    const X = Tensor.randn([6, 5], { rng, requiresGrad: true, std: 3 }), b = Tensor.randn([5], { rng, requiresGrad: true });
    X.add(b).tanh().mul(X).relu().sum().backward();
    const gx = GpuTensor.from(ctx, X, undefined, { requiresGrad: true }), gb = GpuTensor.from(ctx, b, undefined, { requiresGrad: true });
    const loss = scope(() => {
      const l = gx.add(gb).tanh().mul(gx).relu().sum();
      l.backward();
      return l;
    });
    close(await loss.read(), X.add(b).tanh().mul(X).relu().sum().toFloat32Array());
    close(await gx.grad!.read(), X.grad!.toFloat32Array());
    close(await gb.grad!.read(), b.grad!.toFloat32Array());
  });

  it('trains the Chapter 7 MLP with the same gradients as the CPU', async (t) => {
    if (!ctx) return t.skip();
    const V = 11, n = 3, d = 4, h = 16, N = 20;
    const rng = mulberry32(4);
    const C = Tensor.randn([V, d], { rng, requiresGrad: true });
    const W1 = Tensor.randn([n * d, h], { rng, std: 0.3, requiresGrad: true }), b1 = Tensor.randn([h], { rng, requiresGrad: true });
    const W2 = Tensor.randn([h, V], { rng, std: 0.3, requiresGrad: true }), b2 = Tensor.randn([V], { rng, requiresGrad: true });
    const ctxIds = Array.from({ length: N * n }, () => Math.floor(rng() * V));
    const ys = Array.from({ length: N }, () => Math.floor(rng() * V));
    const cpuLoss = nn.crossEntropy(nn.embedding(C, ctxIds).reshape(N, n * d).matmul(W1).add(b1).tanh().matmul(W2).add(b2), ys);
    cpuLoss.backward();

    const cpuParams = [C, W1, b1, W2, b2];
    const params = cpuParams.map((p) => GpuTensor.from(ctx!, p, undefined, { requiresGrad: true }));
    const [gC, gW1, gb1, gW2, gb2] = params as [GpuTensor, GpuTensor, GpuTensor, GpuTensor, GpuTensor];
    const ids = new GpuIds(ctx, ctxIds), targets = new GpuIds(ctx, ys);
    const loss = scope(() => {
      const l = crossEntropy(embedding(gC, ids).reshape(N, n * d).matmul(gW1).add(gb1).tanh().matmul(gW2).add(gb2), targets);
      l.backward();
      return l;
    });
    expect(await loss.item()).toBeCloseTo(cpuLoss.item(), 4);
    for (let i = 0; i < params.length; i++) close(await params[i]!.grad!.read(), cpuParams[i]!.grad!.toFloat32Array());

    // One SGD step, then the loss must fall.
    const opt = new GpuSGD(params, { lr: 0.5 });
    opt.step();
    opt.zeroGrad();
    const after = scope(() => crossEntropy(embedding(gC, ids).reshape(N, n * d).matmul(gW1).add(gb1).tanh().matmul(gW2).add(gb2), targets));
    expect(await after.item()).toBeLessThan(cpuLoss.item());
  });

  it('frees intermediates at the end of a scope', async (t) => {
    if (!ctx) return t.skip();
    const x = GpuTensor.from(ctx, new Float32Array([1, 2, 3, 4]), [2, 2]);
    let inner: GpuTensor | undefined;
    const kept = scope(() => {
      inner = x.tanh();
      return inner.scale(2).reshape(4);
    });
    expect(inner!.disposed).toBe(true);
    expect(kept.disposed).toBe(false);
    expect(x.disposed).toBe(false);
    close(await kept.read(), Float32Array.from([1, 2, 3, 4], (v) => 2 * Math.tanh(v)));
  });
});
