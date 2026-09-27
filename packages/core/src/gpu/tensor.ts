/**
 * GpuTensor: a contiguous float32 tensor living in a WebGPU buffer, with the same reverse-mode
 * autograd as the CPU Tensor (Chapter 8). Only what the MLP and, later, the Transformer need is
 * implemented; every op is one or two kernel dispatches.
 *
 * Memory: GPU buffers are not garbage-collected promptly, so intermediates are freed explicitly.
 * Run a training step inside `ctx`-bound `scope(() => …)`: every tensor created inside is returned
 * to the buffer pool at the end, except the ones you return and parameter gradients.
 */
import type { Tensor } from '../tensor/tensor.ts';
import { groups1d, type GpuContext } from './context.ts';
import * as K from './kernels.ts';

interface GradNode {
  op: string;
  parents: GpuTensor[];
  backward: (grad: GpuTensor) => (GpuTensor | null)[];
}

let gradEnabled = true;
const scopes: Set<GpuTensor>[] = [];

/** Run `fn` without recording autograd nodes. */
export function noGradGpu<T>(fn: () => T): T {
  const prev = gradEnabled;
  gradEnabled = false;
  try {
    return fn();
  } finally {
    gradEnabled = prev;
  }
}

/**
 * Run `fn`, then free every GpuTensor created during it except those reachable from its return
 * value (a tensor, an array or a plain object of tensors) and parameter gradients.
 */
export function scope<T>(fn: () => T): T {
  const created = new Set<GpuTensor>();
  scopes.push(created);
  let result: T;
  try {
    result = fn();
  } finally {
    scopes.pop();
  }
  const keep = new Set<GpuTensor>();
  const visit = (v: unknown) => {
    if (v instanceof GpuTensor) {
      keep.add(v);
      if (v.base) keep.add(v.base);
    }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) Object.values(v).forEach(visit);
  };
  visit(result);
  const outer = scopes.at(-1);
  for (const t of created) {
    if (keep.has(t)) outer?.add(t);
    else t.dispose();
  }
  return result;
}

const sizeOf = (shape: readonly number[]) => shape.reduce((a, b) => a * b, 1);

export class GpuTensor {
  readonly ctx: GpuContext;
  readonly shape: number[];
  readonly size: number;
  requiresGrad: boolean;
  grad: GpuTensor | null = null;
  node: GradNode | null = null;
  private buf: GPUBuffer | null;
  /** Views (reshapes) share their base's buffer and never free it. */
  readonly base: GpuTensor | null;

  constructor(ctx: GpuContext, buffer: GPUBuffer, shape: readonly number[], opts: { requiresGrad?: boolean; base?: GpuTensor } = {}) {
    this.ctx = ctx;
    this.buf = buffer;
    this.shape = [...shape];
    this.size = sizeOf(shape);
    this.requiresGrad = opts.requiresGrad ?? false;
    this.base = opts.base ?? null;
    scopes.at(-1)?.add(this);
  }

  get buffer(): GPUBuffer {
    if (!this.buf) throw new Error('GpuTensor used after dispose() — was it created inside a scope() that has ended?');
    return this.buf;
  }

  get disposed(): boolean {
    return this.buf === null;
  }

  get ndim(): number {
    return this.shape.length;
  }

  // ───────────── creation and transfer ─────────────

  /** Upload values (a Float32Array or a CPU Tensor) to the GPU. */
  static from(ctx: GpuContext, values: Float32Array | Tensor, shape?: readonly number[], opts: { requiresGrad?: boolean } = {}): GpuTensor {
    const data = values instanceof Float32Array ? values : values.toFloat32Array();
    const s = shape ?? (values instanceof Float32Array ? [values.length] : values.shape);
    if (sizeOf(s) !== data.length) throw new Error(`${data.length} values do not fit shape [${s}]`);
    return new GpuTensor(ctx, ctx.upload(data), s, opts);
  }

  static zeros(ctx: GpuContext, shape: readonly number[], opts: { requiresGrad?: boolean } = {}): GpuTensor {
    const t = GpuTensor.empty(ctx, shape, opts);
    ctx.clear(t.buffer, t.size * 4);
    return t;
  }

  /** Uninitialised storage — for kernel outputs. */
  static empty(ctx: GpuContext, shape: readonly number[], opts: { requiresGrad?: boolean } = {}): GpuTensor {
    return new GpuTensor(ctx, ctx.alloc(sizeOf(shape) * 4), shape, opts);
  }

  /** Copy back to the host. */
  async read(): Promise<Float32Array> {
    return this.ctx.readFloat32(this.buffer, this.size);
  }

  async item(): Promise<number> {
    if (this.size !== 1) throw new Error(`item() needs a single element, got shape [${this.shape}]`);
    return (await this.read())[0]!;
  }

  /** Overwrite the contents from the host (e.g. to load a checkpoint). */
  write(values: Float32Array): void {
    if (values.length !== this.size) throw new Error(`expected ${this.size} values, got ${values.length}`);
    this.ctx.upload(values, this.buffer);
  }

  /** Return the buffer to the pool. Safe to call twice; views never free their base's buffer. */
  dispose(): void {
    if (this.buf && !this.base) this.ctx.release(this.buf);
    this.buf = null;
    if (this.grad && !this.node) {
      this.grad.dispose();
      this.grad = null;
    }
  }

  // ───────────── shape ─────────────

  /** A view with a new shape (free: the data is already contiguous). One dimension may be −1. */
  reshape(...shape: number[]): GpuTensor {
    const known = shape.reduce((a, d) => (d === -1 ? a : a * d), 1);
    const s = shape.map((d) => (d === -1 ? this.size / known : d));
    if (sizeOf(s) !== this.size) throw new Error(`cannot reshape [${this.shape}] to [${shape}]`);
    const out = new GpuTensor(this.ctx, this.buffer, s, { base: this.base ?? this });
    return record(out, 'reshape', [this], (g) => [g.reshape(...this.shape)]);
  }

  // ───────────── element-wise ─────────────

  /** a + b, where b has the same shape or matches a trailing part of it (e.g. a bias). */
  add(b: GpuTensor): GpuTensor {
    return this.binary(b, 'x + y', 'add', (g) => [g, sumToSuffix(g, b)]);
  }

  sub(b: GpuTensor): GpuTensor {
    return this.binary(b, 'x - y', 'sub', (g) => [g, sumToSuffix(g, b).scale(-1)]);
  }

  mul(b: GpuTensor): GpuTensor {
    return this.binary(b, 'x * y', 'mul', (g) => [g.mul(b), sumToSuffix(g.mul(this), b)]);
  }

  scale(s: number): GpuTensor {
    const out = this.unary('x * p.s', s);
    return record(out, 'scale', [this], (g) => [g.scale(s)]);
  }

  tanh(): GpuTensor {
    // tanh(x) = 1 − 2 / (exp(2x) + 1), which is safe for large |x| (WGSL's tanh can return NaN there on some GPUs).
    const out = this.unary('1.0 - 2.0 / (exp(2.0 * clamp(x, -15.0, 15.0)) + 1.0)');
    return record(out, 'tanh', [this], (g) => [g.binaryRaw(out, 'x * (1.0 - y * y)')]);
  }

  relu(): GpuTensor {
    const out = this.unary('max(x, 0.0)');
    return record(out, 'relu', [this], (g) => [g.binaryRaw(this, 'select(0.0, x, y > 0.0)')]);
  }

  // ───────────── reductions ─────────────

  sum(): GpuTensor {
    const out = GpuTensor.empty(this.ctx, []);
    this.ctx.run({ code: K.sumAllKernel, uniforms: { spec: 'uf', values: [this.size, 1] }, buffers: [this.buffer, out.buffer], groups: [1] });
    return record(out, 'sum', [this], (g) => [broadcast(g, this.shape)]);
  }

  mean(): GpuTensor {
    return this.sum().scale(1 / this.size);
  }

  /** Sum over all leading dimensions: (…, n) → (n). */
  sumRows(): GpuTensor {
    const n = this.shape.at(-1) ?? 1;
    const rows = this.size / n;
    const out = GpuTensor.empty(this.ctx, [n]);
    this.ctx.run({ code: K.sumRowsKernel, uniforms: { spec: 'uu', values: [rows, n] }, buffers: [this.buffer, out.buffer], groups: [Math.ceil(n / K.WG)] });
    return record(out, 'sumRows', [this], (g) => [broadcast(g, this.shape)]);
  }

  // ───────────── matrix multiplication ─────────────

  /**
   * (…, K) @ (K, N) → (…, N). Leading dimensions of `this` are flattened into rows, so a batch of
   * sequences times a weight matrix is a single 2-D product.
   */
  matmul(w: GpuTensor): GpuTensor {
    if (w.ndim !== 2) throw new Error(`matmul expects a 2-D right operand, got [${w.shape}]`);
    const [Kw, N] = w.shape as [number, number];
    const Ka = this.shape.at(-1)!;
    if (Ka !== Kw) throw new Error(`matmul shape mismatch: [${this.shape}] @ [${w.shape}]`);
    const M = this.size / Ka;
    const out = GpuTensor.empty(this.ctx, [...this.shape.slice(0, -1), N]);
    matmulInto(this.ctx, this.buffer, w.buffer, out.buffer, { M, N, K: Ka });
    return record(out, 'matmul', [this, w], (g) => [
      // dA = dC · Wᵀ   (M×N · N×K)       dW = Aᵀ · dC   (K×M · M×N)
      this.requiresGrad ? product(g, w, { M, N: Ka, K: N, transB: true }, this.shape) : null,
      w.requiresGrad ? product(this, g, { M: Ka, N, K: M, transA: true }, w.shape) : null,
    ]);
  }

  // ───────────── autograd ─────────────

  /**
   * Back-propagate from this (scalar) tensor. Gradients of leaf tensors that require them are
   * accumulated into `.grad`, which lives outside any scope until `zeroGrad()`/`dispose()`.
   */
  backward(): void {
    if (this.size !== 1) throw new Error('backward() needs a scalar; reduce the output first');
    const order: GpuTensor[] = [];
    const seen = new Set<GpuTensor>();
    const visit = (t: GpuTensor) => {
      if (seen.has(t)) return;
      seen.add(t);
      for (const p of t.node?.parents ?? []) if (p.requiresGrad) visit(p);
      order.push(t);
    };
    visit(this);
    const grads = new Map<GpuTensor, GpuTensor>();
    grads.set(this, noGradGpu(() => fill(this.ctx, this.shape, 1)));
    noGradGpu(() => {
      for (let i = order.length - 1; i >= 0; i--) {
        const t = order[i]!;
        const g = grads.get(t);
        if (!g) continue;
        if (!t.node) {
          accumulateLeaf(t, g);
          continue;
        }
        const pg = t.node.backward(g);
        t.node.parents.forEach((p, k) => {
          const gp = pg[k];
          if (!gp || !p.requiresGrad) return;
          const prev = grads.get(p);
          grads.set(p, prev ? prev.add(gp) : gp);
        });
      }
    });
  }

  zeroGrad(): void {
    this.grad?.dispose();
    this.grad = null;
  }

  // ───────────── internals ─────────────

  private unary(expr: string, s = 0): GpuTensor {
    const out = GpuTensor.empty(this.ctx, this.shape);
    this.ctx.run({ code: K.unaryKernel(expr), uniforms: { spec: 'uf', values: [this.size, s] }, buffers: [this.buffer, out.buffer], groups: groups1d(this.size) });
    return out;
  }

  /** Element-wise kernel with suffix broadcasting of `b`; no autograd node. */
  binaryRaw(b: GpuTensor, expr: string): GpuTensor {
    if (!isSuffix(b.shape, this.shape) && b.size !== 1) throw new Error(`cannot broadcast [${b.shape}] against [${this.shape}]`);
    const out = GpuTensor.empty(this.ctx, this.shape);
    this.ctx.run({ code: K.binaryKernel(expr), uniforms: { spec: 'uu', values: [this.size, b.size] }, buffers: [this.buffer, b.buffer, out.buffer], groups: groups1d(this.size) });
    return out;
  }

  private binary(b: GpuTensor, expr: string, op: string, backward: GradNode['backward']): GpuTensor {
    return record(this.binaryRaw(b, expr), op, [this, b], backward);
  }
}

// ───────────── helpers ─────────────

function record(out: GpuTensor, op: string, parents: GpuTensor[], backward: GradNode['backward']): GpuTensor {
  if (gradEnabled && parents.some((p) => p.requiresGrad)) {
    out.requiresGrad = true;
    out.node = { op, parents, backward };
  }
  return out;
}

export { record as recordGpu };

function isSuffix(small: readonly number[], big: readonly number[]): boolean {
  if (small.length > big.length) return false;
  const off = big.length - small.length;
  return small.every((d, i) => d === big[off + i]);
}

/** Reduce a gradient of a's shape to b's shape (b a trailing part of a, or a scalar). */
function sumToSuffix(g: GpuTensor, b: GpuTensor): GpuTensor {
  if (g.size === b.size) return g.reshape(...b.shape);
  if (b.size === 1) return g.sum().reshape(...b.shape);
  return g.reshape(-1, b.size).sumRows().reshape(...b.shape);
}

/** Tile a tensor (scalar, or a trailing part of `shape`) to `shape`. */
function broadcast(g: GpuTensor, shape: readonly number[]): GpuTensor {
  const out = GpuTensor.empty(g.ctx, shape);
  g.ctx.run({ code: K.binaryKernel('y'), uniforms: { spec: 'uu', values: [out.size, g.size] }, buffers: [g.buffer, g.buffer, out.buffer], groups: groups1d(out.size) });
  return out;
}

function fill(ctx: GpuContext, shape: readonly number[], value: number): GpuTensor {
  return GpuTensor.from(ctx, new Float32Array(sizeOf(shape)).fill(value), shape);
}

function accumulateLeaf(t: GpuTensor, g: GpuTensor): void {
  if (!t.grad) {
    // Parameter gradients outlive the scope, so allocate them outside it.
    t.grad = GpuTensor.empty(t.ctx, t.shape);
    scopes.at(-1)?.delete(t.grad);
    t.ctx.copy(g.buffer, t.grad.buffer, t.size * 4);
  } else {
    t.ctx.run({ code: K.axpyKernel, uniforms: { spec: 'uf', values: [t.size, 1] }, buffers: [t.grad.buffer, g.buffer], groups: groups1d(t.size) });
  }
}

export interface MatmulDims {
  M: number;
  N: number;
  K: number;
  transA?: boolean;
  transB?: boolean;
  batch?: number;
  strideA?: number;
  strideB?: number;
  strideC?: number;
}

export type MatmulVariant = 'naive' | 'tiled' | 'blocked';

export const MATMUL_KERNELS: Record<MatmulVariant, { code: string; tile: number }> = {
  naive: { code: K.matmulNaiveKernel, tile: 16 },
  tiled: { code: K.matmulTiledKernel, tile: 16 },
  blocked: { code: K.matmulKernel, tile: 64 },
};

/** Record C = op(A) · op(B) into existing buffers. `variant` exists for the chapter's benchmarks. */
export function matmulInto(ctx: GpuContext, a: GPUBuffer, b: GPUBuffer, c: GPUBuffer, d: MatmulDims, variant: MatmulVariant = 'blocked'): void {
  const { code, tile } = MATMUL_KERNELS[variant];
  const batch = d.batch ?? 1;
  ctx.run({
    code,
    uniforms: {
      spec: 'uuuuuuuu',
      values: [d.M, d.N, d.K, d.transA ? 1 : 0, d.transB ? 1 : 0, d.strideA ?? d.M * d.K, d.strideB ?? d.K * d.N, d.strideC ?? d.M * d.N],
    },
    buffers: [a, b, c],
    groups: [Math.ceil(d.N / tile), Math.ceil(d.M / tile), batch],
    label: `matmul ${d.M}×${d.K}·${d.K}×${d.N}`,
  });
}

function product(a: GpuTensor, b: GpuTensor, d: MatmulDims, shape: readonly number[]): GpuTensor {
  const out = GpuTensor.empty(a.ctx, shape);
  matmulInto(a.ctx, a.buffer, b.buffer, out.buffer, d);
  return out;
}
