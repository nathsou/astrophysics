/**
 * GPU versions of the neural-network pieces from Chapters 5–7: fused cross-entropy, embedding
 * lookup and SGD. Integer ids live in their own u32 buffers.
 */
import { groups1d, type GpuContext } from './context.ts';
import * as K from './kernels.ts';
import { GpuTensor, noGradGpu, recordGpu } from './tensor.ts';

/** A vector of token ids (u32) on the GPU. */
export class GpuIds {
  readonly ctx: GpuContext;
  readonly length: number;
  private buf: GPUBuffer | null;

  constructor(ctx: GpuContext, ids: ArrayLike<number>) {
    this.ctx = ctx;
    this.length = ids.length;
    this.buf = ctx.upload(ids instanceof Uint32Array ? ids : Uint32Array.from(ids));
  }

  get buffer(): GPUBuffer {
    if (!this.buf) throw new Error('GpuIds used after dispose()');
    return this.buf;
  }

  /** Replace the contents with ids of the same length (reuses the buffer). */
  write(ids: ArrayLike<number>): void {
    if (ids.length !== this.length) throw new Error(`expected ${this.length} ids, got ${ids.length}`);
    this.ctx.upload(ids instanceof Uint32Array ? ids : Uint32Array.from(ids), this.buffer);
  }

  dispose(): void {
    if (this.buf) this.ctx.release(this.buf);
    this.buf = null;
  }
}

/** Rows of `weight` (V, d) for each id → (ids.length, d). */
export function embedding(weight: GpuTensor, ids: GpuIds): GpuTensor {
  const [V, d] = weight.shape as [number, number];
  const n = ids.length;
  const out = GpuTensor.empty(weight.ctx, [n, d]);
  weight.ctx.run({ code: K.embeddingKernel, uniforms: { spec: 'uu', values: [n, d] }, buffers: [weight.buffer, ids.buffer, out.buffer], groups: groups1d(n * d) });
  return recordGpu(out, 'embedding', [weight], (g) => {
    const gw = GpuTensor.empty(weight.ctx, [V, d]);
    weight.ctx.run({ code: K.embeddingBackwardKernel, uniforms: { spec: 'uuu', values: [n, d, V] }, buffers: [g.buffer, ids.buffer, gw.buffer], groups: groups1d(V * d) });
    return [gw];
  });
}

/**
 * Mean cross-entropy (nats) of logits (N, V) against targets. One workgroup per row computes the
 * row's log-sum-exp and, in the same pass, the gradient (softmax − onehot) / N, kept for backward.
 */
export function crossEntropy(logits: GpuTensor, targets: GpuIds): GpuTensor {
  const V = logits.shape.at(-1)!;
  const N = logits.size / V;
  if (targets.length !== N) throw new Error(`expected ${N} targets, got ${targets.length}`);
  const ctx = logits.ctx;
  const rowLoss = GpuTensor.empty(ctx, [N]);
  const grad = GpuTensor.empty(ctx, logits.shape);
  const gx = Math.min(N, 65535);
  ctx.run({
    code: K.crossEntropyKernel,
    uniforms: { spec: 'uuf', values: [N, V, 1 / N] },
    buffers: [logits.buffer, targets.buffer, rowLoss.buffer, grad.buffer],
    groups: [gx, Math.ceil(N / gx)],
  });
  const loss = GpuTensor.empty(ctx, []);
  ctx.run({ code: K.sumAllKernel, uniforms: { spec: 'uf', values: [N, 1 / N] }, buffers: [rowLoss.buffer, loss.buffer], groups: [1] });
  // Upstream gradient is a scalar: scale the saved gradient by it.
  return recordGpu(loss, 'crossEntropy', [logits], (g) => [grad.binaryRaw(g, 'x * y')]);
}

/** SGD on the GPU, optionally with momentum: one dispatch per parameter, no host round trip. */
export class GpuSGD {
  readonly params: GpuTensor[];
  lr: number;
  readonly momentum: number;
  private readonly velocity: GPUBuffer[] = [];

  constructor(params: GpuTensor[], opts: { lr: number; momentum?: number }) {
    this.params = params;
    this.lr = opts.lr;
    this.momentum = opts.momentum ?? 0;
    if (this.momentum) {
      for (const p of params) {
        const v = p.ctx.alloc(p.size * 4);
        p.ctx.clear(v, p.size * 4);
        this.velocity.push(v);
      }
    }
  }

  step(): void {
    noGradGpu(() => {
      this.params.forEach((p, i) => {
        if (!p.grad) return;
        if (this.momentum) {
          p.ctx.run({ code: K.momentumKernel, uniforms: { spec: 'uff', values: [p.size, this.lr, this.momentum] }, buffers: [p.buffer, this.velocity[i]!, p.grad.buffer], groups: groups1d(p.size) });
        } else {
          p.ctx.run({ code: K.axpyKernel, uniforms: { spec: 'uf', values: [p.size, -this.lr] }, buffers: [p.buffer, p.grad.buffer], groups: groups1d(p.size) });
        }
      });
    });
  }

  zeroGrad(): void {
    for (const p of this.params) p.zeroGrad();
  }

  /** Free the momentum buffers. */
  dispose(): void {
    this.params[0]?.ctx && this.velocity.forEach((v) => this.params[0]!.ctx.release(v));
    this.velocity.length = 0;
  }
}
