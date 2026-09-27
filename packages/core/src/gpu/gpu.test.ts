/**
 * GPU kernels checked against the CPU Tensor library. Runs on Dawn through the `webgpu` package;
 * skipped where no adapter is available (e.g. CI without a GPU).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../util/random.ts';
import { Tensor, nn } from '../tensor/index.ts';
import { GpuContext, GpuIds, GpuSGD, GpuTensor, MATMUL_KERNELS, clipGradNorm, concatRows, crossEntropy, embedding, lstmCell, matmulInto, scope, sliceRows, type MatmulVariant } from './index.ts';
import { cat } from '../tensor/tensor.ts';
import { nodeGpu } from './node.ts';
import { bmm, multiHeadAttention, permute, softmax } from './attention.ts';
import { dropout, gelu, layerNorm, matmulT } from './layers.ts';
import { newtonSchulz } from './muon.ts';
import { svd } from '../util/svd.ts';

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

  it('back-propagates through time like the CPU library (gated RNN, concatenation, clipping)', async (t) => {
    if (!ctx) return t.skip();
    const V = 7, H = 6, B = 3, T = 5;
    const rng = mulberry32(8);
    // h_t = g_t * tanh(Wx[x_t] + h_{t-1} U) + (1 − g_t) * h_{t-1},  g_t = σ(Gx[x_t] + h_{t-1} R)
    const cpu = {
      Wx: Tensor.randn([V, H], { rng, std: 0.5, requiresGrad: true }),
      U: Tensor.randn([H, H], { rng, std: 0.4, requiresGrad: true }),
      Gx: Tensor.randn([V, H], { rng, std: 0.5, requiresGrad: true }),
      R: Tensor.randn([H, H], { rng, std: 0.4, requiresGrad: true }),
      Wy: Tensor.randn([H, V], { rng, std: 0.5, requiresGrad: true }),
    };
    const xs = Array.from({ length: T }, () => Array.from({ length: B }, () => Math.floor(rng() * V)));
    const ys = Array.from({ length: T * B }, () => Math.floor(rng() * V));
    let h = Tensor.zeros([B, H]);
    const hs: Tensor[] = [];
    for (let s = 0; s < T; s++) {
      const g = nn.embedding(cpu.Gx, xs[s]!).add(h.matmul(cpu.R)).sigmoid();
      const c = nn.embedding(cpu.Wx, xs[s]!).add(h.matmul(cpu.U)).tanh();
      h = g.mul(c).add(Tensor.scalar(1).sub(g).mul(h));
      hs.push(h);
    }
    const cpuLoss = nn.crossEntropy(cat(hs, 0).matmul(cpu.Wy), ys);
    cpuLoss.backward();

    const names = Object.keys(cpu) as (keyof typeof cpu)[];
    const gpu = Object.fromEntries(names.map((k) => [k, GpuTensor.from(ctx!, cpu[k], undefined, { requiresGrad: true })])) as Record<keyof typeof cpu, GpuTensor>;
    const ids = xs.map((x) => new GpuIds(ctx!, x));
    const targets = new GpuIds(ctx, ys);
    const one = GpuTensor.from(ctx, Float32Array.of(1), []);
    const { loss, norm } = scope(() => {
      let hg = GpuTensor.zeros(ctx!, [B, H]);
      const outs: GpuTensor[] = [];
      for (let s = 0; s < T; s++) {
        const g = embedding(gpu.Gx, ids[s]!).add(hg.matmul(gpu.R)).sigmoid();
        const c = embedding(gpu.Wx, ids[s]!).add(hg.matmul(gpu.U)).tanh();
        hg = g.mul(c).add(one.sub(g).mul(hg));
        outs.push(hg);
      }
      const loss = crossEntropy(concatRows(outs).matmul(gpu.Wy), targets);
      loss.backward();
      return { loss, norm: clipGradNorm(Object.values(gpu), Infinity) };
    });
    expect(await loss.item()).toBeCloseTo(cpuLoss.item(), 4);
    for (const k of names) close(await gpu[k].grad!.read(), cpu[k].grad!.toFloat32Array());
    const cpuNorm = nn.clipGradNorm(names.map((k) => cpu[k]));
    expect(await norm.item()).toBeCloseTo(cpuNorm, 3);
    // Clipping to half the norm halves every gradient.
    const before = await gpu.U.grad!.read();
    scope(() => clipGradNorm(Object.values(gpu), cpuNorm / 2));
    close(await gpu.U.grad!.read(), before.map((v) => v / 2), 1e-3);
  });

  it('runs a fused LSTM cell with the same gradients as its unfused CPU version', async (t) => {
    if (!ctx) return t.skip();
    const B = 3, H = 5, T = 4;
    const rng = mulberry32(21);
    const Z = Array.from({ length: T }, () => Tensor.randn([B, 4 * H], { rng, std: 1.5, requiresGrad: true }));
    const U = Tensor.randn([H, 4 * H], { rng, std: 0.5, requiresGrad: true });
    const w = Tensor.randn([B, H], { rng });
    // CPU reference: the LSTM equations written out with ordinary ops.
    let h = Tensor.zeros([B, H]), c = Tensor.zeros([B, H]);
    for (let s = 0; s < T; s++) {
      const z = Z[s]!.add(h.matmul(U));
      const i = z.slice(1, 0, H).sigmoid(), f = z.slice(1, H, 2 * H).sigmoid(), o = z.slice(1, 2 * H, 3 * H).sigmoid(), g = z.slice(1, 3 * H).tanh();
      c = f.mul(c).add(i.mul(g));
      h = o.mul(c.tanh());
    }
    const cpuLoss = h.mul(w).sum().add(c.sum());
    cpuLoss.backward();

    const Zg = Z.map((z) => GpuTensor.from(ctx!, z, undefined, { requiresGrad: true }));
    const Ug = GpuTensor.from(ctx, U, undefined, { requiresGrad: true });
    const wg = GpuTensor.from(ctx, w);
    const loss = scope(() => {
      let hg = GpuTensor.zeros(ctx!, [B, H]), cg = GpuTensor.zeros(ctx!, [B, H]);
      for (let s = 0; s < T; s++) {
        const st = lstmCell(Zg[s]!.add(hg.matmul(Ug)), cg);
        hg = sliceRows(st, 0, B);
        cg = sliceRows(st, B, B);
      }
      const l = hg.mul(wg).sum().add(cg.sum());
      l.backward();
      return l;
    });
    expect(await loss.item()).toBeCloseTo(cpuLoss.item(), 4);
    close(await Ug.grad!.read(), U.grad!.toFloat32Array());
    for (let s = 0; s < T; s++) close(await Zg[s]!.grad!.read(), Z[s]!.grad!.toFloat32Array());
  });

  it('computes multi-head causal self-attention and its gradients like the CPU library', async (t) => {
    if (!ctx) return t.skip();
    const B = 2, T = 5, C = 8, h = 2, d = C / h;
    const rng = mulberry32(31);
    const X = Tensor.randn([B, T, C], { rng, requiresGrad: true });
    const W = ['q', 'k', 'v', 'o'].map(() => Tensor.randn([C, C], { rng, std: 0.5, requiresGrad: true }));
    const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
    const heads = (x: Tensor) => x.reshape(B, T, h, d).permute(0, 2, 1, 3);
    const [q, k, v] = [0, 1, 2].map((i) => heads(X.matmul(W[i]!)));
    const att = q!.matmul(k!.transpose(-1, -2)).mul(1 / Math.sqrt(d)).add(mask).softmax(-1);
    const y = att.matmul(v!).permute(0, 2, 1, 3).reshape(B, T, C).matmul(W[3]!);
    const target = Tensor.randn([B, T, C], { rng });
    const cpuLoss = y.mul(target).sum();
    cpuLoss.backward();

    const Xg = GpuTensor.from(ctx, X, undefined, { requiresGrad: true });
    const Wg = W.map((w) => GpuTensor.from(ctx!, w, undefined, { requiresGrad: true }));
    const tg = GpuTensor.from(ctx, target);
    const { loss, probs } = scope(() => {
      const hg = (x: GpuTensor) => permute(x.reshape(B, T, h, d), [0, 2, 1, 3]);
      const [qg, kg, vg] = [0, 1, 2].map((i) => hg(Xg.matmul(Wg[i]!)));
      const p = softmax(bmm(qg!, kg!, { transB: true }), { scale: 1 / Math.sqrt(d), causal: true });
      const yg = permute(bmm(p, vg!), [0, 2, 1, 3]).reshape(B, T, C).matmul(Wg[3]!);
      const l = yg.mul(tg).sum();
      l.backward();
      return { loss: l, probs: p };
    });
    expect(await loss.item()).toBeCloseTo(cpuLoss.item(), 3);
    close(await probs.read(), att.toFloat32Array());
    close(await Xg.grad!.read(), X.grad!.toFloat32Array(), 1e-3);
    for (let i = 0; i < 4; i++) close(await Wg[i]!.grad!.read(), W[i]!.grad!.toFloat32Array(), 1e-3);
  });

  it('runs a pre-norm Transformer block with tied output weights like the CPU library', async (t) => {
    if (!ctx) return t.skip();
    const B = 2, T = 4, C = 8, h = 2, d = C / h, V = 5;
    const rng = mulberry32(41);
    const r = (shape: number[], std = 0.4) => Tensor.randn(shape, { rng, std, requiresGrad: true });
    const cpu = { X: r([B, T, C], 1), g1: r([C]), b1: r([C]), g2: r([C]), b2: r([C]), Wq: r([C, C]), Wk: r([C, C]), Wv: r([C, C]), Wo: r([C, C]), W1: r([C, 4 * C]), W2: r([4 * C, C]), E: r([V, C]) };
    const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
    const heads = (x: Tensor) => x.reshape(B, T, h, d).permute(0, 2, 1, 3);
    let x = cpu.X;
    const a = nn.layerNorm(x, cpu.g1, cpu.b1);
    const [q, k, v] = [cpu.Wq, cpu.Wk, cpu.Wv].map((w) => heads(a.matmul(w)));
    x = x.add(q!.matmul(k!.transpose(-1, -2)).mul(1 / Math.sqrt(d)).add(mask).softmax(-1).matmul(v!).permute(0, 2, 1, 3).reshape(B, T, C).matmul(cpu.Wo));
    x = x.add(nn.layerNorm(x, cpu.g2, cpu.b2).matmul(cpu.W1).gelu().matmul(cpu.W2));
    const ys = Array.from({ length: B * T }, () => Math.floor(rng() * V));
    const cpuLoss = nn.crossEntropy(x.reshape(B * T, C).matmul(cpu.E.T), ys);
    cpuLoss.backward();

    const names = Object.keys(cpu) as (keyof typeof cpu)[];
    const g = Object.fromEntries(names.map((n) => [n, GpuTensor.from(ctx!, cpu[n], undefined, { requiresGrad: true })])) as Record<keyof typeof cpu, GpuTensor>;
    const targets = new GpuIds(ctx, ys);
    const loss = scope(() => {
      let xg = g.X;
      xg = xg.add(multiHeadAttention(layerNorm(xg, g.g1, g.b1), { q: g.Wq, k: g.Wk, v: g.Wv, o: g.Wo }, h).y);
      xg = xg.add(gelu(layerNorm(xg, g.g2, g.b2).matmul(g.W1)).matmul(g.W2));
      const l = crossEntropy(matmulT(xg.reshape(B * T, C), g.E), targets);
      l.backward();
      return l;
    });
    expect(await loss.item()).toBeCloseTo(cpuLoss.item(), 4);
    for (const n of names) close(await g[n].grad!.read(), cpu[n].grad!.toFloat32Array(), 2e-3);
  });

  it('drops out the right fraction, rescales, and reuses its mask in the backward pass', async (t) => {
    if (!ctx) return t.skip();
    const x = GpuTensor.from(ctx, new Float32Array(100_000).fill(1), [100_000], { requiresGrad: true });
    const { y } = scope(() => {
      const y = dropout(x, 0.25, 1234);
      y.sum().backward();
      return { y };
    });
    const vals = await y.read();
    const kept = vals.filter((v) => v !== 0);
    expect(Math.abs(kept.length / vals.length - 0.75)).toBeLessThan(0.01);
    expect(kept.every((v) => Math.abs(v - 4 / 3) < 1e-6)).toBe(true);
    close(await x.grad!.read(), vals); // gradient = same mask and scale
  });

  it('orthogonalises matrices by Newton–Schulz (both orientations)', async (t) => {
    if (!ctx) return t.skip();
    for (const [m, n] of [[8, 20], [24, 6]] as const) {
      const G = GpuTensor.from(ctx, Tensor.randn([m, n], { rng: mulberry32(m) }));
      const X = scope(() => newtonSchulz(G));
      const { S } = svd(await X.read(), m, n);
      for (const s of S) {
        expect(s).toBeGreaterThan(0.6);
        expect(s).toBeLessThan(1.25);
      }
    }
  });
});
