/**
 * Neural-network building blocks on top of Tensor (Chapters 5–7): fused losses, embeddings,
 * normalisation, a few modules and a plain SGD optimiser. AdamW arrives in Chapter 13.
 */
import { mulberry32, type Rng } from '../util/random.ts';
import { Tensor, noGrad, record } from './tensor.ts';

/**
 * Mean cross-entropy between logits (N, V) and integer targets (N), in nats.
 * Fused and numerically stable: loss = logsumexp(z) − z_target, and its gradient is
 * (softmax(z) − onehot(target)) / N — no explicit softmax tensor in the graph.
 */
export function crossEntropy(logits: Tensor, targets: ArrayLike<number>): Tensor {
  if (logits.ndim !== 2) throw new Error(`crossEntropy expects (N, V) logits, got [${logits.shape}]`);
  const [N, V] = logits.shape as [number, number];
  if (targets.length !== N) throw new Error(`expected ${N} targets, got ${targets.length}`);
  const z = logits.contiguous();
  const probs = new Float32Array(N * V);
  let loss = 0;
  for (let i = 0; i < N; i++) {
    const row = z.offset + i * V;
    let m = -Infinity;
    for (let j = 0; j < V; j++) m = Math.max(m, z.storage[row + j]!);
    let s = 0;
    for (let j = 0; j < V; j++) s += probs[i * V + j] = Math.exp(z.storage[row + j]! - m);
    for (let j = 0; j < V; j++) probs[i * V + j]! /= s;
    loss += Math.log(s) + m - z.storage[row + targets[i]!]!;
  }
  const out = Tensor.scalar(loss / N);
  return record(out, 'crossEntropy', [logits], (g) => {
    const grad = new Float32Array(probs);
    for (let i = 0; i < N; i++) grad[i * V + targets[i]!]! -= 1;
    const scale = g.item() / N;
    for (let k = 0; k < grad.length; k++) grad[k]! *= scale;
    return [new Tensor(grad, [N, V])];
  });
}

/** Look up rows of `weight` (V, d) for integer ids of any shape → (…ids.shape, d). */
export function embedding(weight: Tensor, ids: ArrayLike<number>, idsShape: number[] = [ids.length]): Tensor {
  const [V, d] = weight.shape as [number, number];
  const w = weight.contiguous();
  const out = new Float32Array(ids.length * d);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    if (id < 0 || id >= V) throw new RangeError(`token id ${id} out of range for vocabulary of ${V}`);
    out.set(w.storage.subarray(w.offset + id * d, w.offset + (id + 1) * d), i * d);
  }
  return record(new Tensor(out, [...idsShape, d]), 'embedding', [weight], (g) => {
    // Scatter-add: rows used several times accumulate several gradients.
    const gw = new Float32Array(V * d);
    const gc = g.contiguous();
    for (let i = 0; i < ids.length; i++) {
      const row = ids[i]! * d;
      for (let k = 0; k < d; k++) gw[row + k]! += gc.storage[gc.offset + i * d + k]!;
    }
    return [new Tensor(gw, [V, d])];
  });
}

/** Layer normalisation over the last dimension, composed from differentiable primitives. */
export function layerNorm(x: Tensor, gamma: Tensor, beta: Tensor, eps = 1e-5): Tensor {
  const mu = x.mean(-1, true);
  const xc = x.sub(mu);
  const variance = xc.mul(xc).mean(-1, true);
  return xc.div(variance.add(eps).sqrt()).mul(gamma).add(beta);
}

// ───────────── modules ─────────────

export abstract class Module {
  /** All trainable tensors, in a stable order. */
  abstract parameters(): Tensor[];

  zeroGrad(): void {
    for (const p of this.parameters()) p.zeroGrad();
  }

  get numParameters(): number {
    return this.parameters().reduce((a, p) => a + p.size, 0);
  }
}

export class Linear extends Module {
  readonly weight: Tensor;
  readonly bias: Tensor | null;

  /** Weights ~ N(0, gain²/fan_in) — Kaiming/Xavier-style scaling (Chapter 7). */
  constructor(inFeatures: number, outFeatures: number, opts: { bias?: boolean; rng?: Rng; gain?: number } = {}) {
    super();
    const std = (opts.gain ?? 1) / Math.sqrt(inFeatures);
    this.weight = Tensor.randn([inFeatures, outFeatures], { rng: opts.rng ?? mulberry32(1), std, requiresGrad: true });
    this.bias = opts.bias === false ? null : Tensor.zeros([outFeatures], { requiresGrad: true });
  }

  forward(x: Tensor): Tensor {
    const y = x.matmul(this.weight);
    return this.bias ? y.add(this.bias) : y;
  }

  parameters(): Tensor[] {
    return this.bias ? [this.weight, this.bias] : [this.weight];
  }
}

export class Embedding extends Module {
  readonly weight: Tensor;

  constructor(vocabSize: number, dim: number, opts: { rng?: Rng; std?: number } = {}) {
    super();
    this.weight = Tensor.randn([vocabSize, dim], { rng: opts.rng ?? mulberry32(2), std: opts.std ?? 1, requiresGrad: true });
  }

  forward(ids: ArrayLike<number>, shape?: number[]): Tensor {
    return embedding(this.weight, ids, shape);
  }

  parameters(): Tensor[] {
    return [this.weight];
  }
}

export class LayerNorm extends Module {
  readonly gamma: Tensor;
  readonly beta: Tensor;
  readonly eps: number;

  constructor(dim: number, eps = 1e-5) {
    super();
    this.gamma = Tensor.ones([dim], { requiresGrad: true });
    this.beta = Tensor.zeros([dim], { requiresGrad: true });
    this.eps = eps;
  }

  forward(x: Tensor): Tensor {
    return layerNorm(x, this.gamma, this.beta, this.eps);
  }

  parameters(): Tensor[] {
    return [this.gamma, this.beta];
  }
}

// ───────────── optimisation ─────────────

/** Plain stochastic gradient descent, optionally with momentum and weight decay. */
export class SGD {
  readonly params: Tensor[];
  lr: number;
  readonly momentum: number;
  readonly weightDecay: number;
  private readonly velocity: Float32Array[];

  constructor(params: Tensor[], opts: { lr: number; momentum?: number; weightDecay?: number }) {
    this.params = params;
    this.lr = opts.lr;
    this.momentum = opts.momentum ?? 0;
    this.weightDecay = opts.weightDecay ?? 0;
    this.velocity = params.map((p) => new Float32Array(p.size));
  }

  step(): void {
    noGrad(() => {
      this.params.forEach((p, i) => {
        if (!p.grad) return;
        if (!p.isContiguous() || p.offset !== 0) throw new Error('parameters must be contiguous');
        const g = p.grad.contiguous();
        const v = this.velocity[i]!;
        const w = p.storage;
        for (let k = 0; k < w.length; k++) {
          const grad = g.storage[g.offset + k]! + this.weightDecay * w[k]!;
          v[k] = this.momentum * v[k]! + grad;
          w[k]! -= this.lr * v[k]!;
        }
      });
    });
  }

  zeroGrad(): void {
    for (const p of this.params) p.zeroGrad();
  }
}

/** Total gradient L2 norm, and optionally clip all gradients so it is at most maxNorm. */
export function clipGradNorm(params: Tensor[], maxNorm = Infinity): number {
  let sq = 0;
  for (const p of params) if (p.grad) for (const x of p.grad.toFloat32Array()) sq += x * x;
  const norm = Math.sqrt(sq);
  if (norm > maxNorm) {
    const s = maxNorm / (norm + 1e-6);
    for (const p of params) if (p.grad) p.grad = noGrad(() => p.grad!.mul(s));
  }
  return norm;
}
