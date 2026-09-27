/**
 * A small, readable tensor library with reverse-mode automatic differentiation (Chapters 4–7).
 *
 * Design (the same as PyTorch's, minus the performance engineering):
 *  - A tensor is a view: (shared Float32Array storage, offset, shape, strides). Reshapes of
 *    contiguous tensors, transposes, permutes, slices and broadcasts are free — no data is copied.
 *  - Operations produce new contiguous tensors and, when gradients are enabled and an input
 *    requires them, record a node in the computation graph: the inputs and a function that maps the
 *    output's gradient to the inputs' gradients (a vector–Jacobian product).
 *  - `backward()` walks the graph in reverse topological order, accumulating gradients.
 */
import { mulberry32, type Rng } from '../util/random.ts';
import { broadcastShapes, broadcastStrides, contiguousStrides, inferShape, normDim, sameShape, sizeOf, type Shape } from './shape.ts';

type NestedArray = number | NestedArray[];
type TensorLike = Tensor | number;

interface GradNode {
  op: string;
  parents: Tensor[];
  /** Map the output gradient to one gradient per parent (null where not needed). */
  backward: (grad: Tensor) => (Tensor | null)[];
}

let gradEnabled = true;

/** Run `fn` without recording operations for autograd (evaluation, optimiser updates). */
export function noGrad<T>(fn: () => T): T {
  const prev = gradEnabled;
  gradEnabled = false;
  try {
    return fn();
  } finally {
    gradEnabled = prev;
  }
}

export function isGradEnabled(): boolean {
  return gradEnabled;
}

export class Tensor {
  readonly storage: Float32Array;
  readonly shape: Shape;
  readonly strides: number[];
  readonly offset: number;
  requiresGrad: boolean;
  grad: Tensor | null = null;
  /** The operation that produced this tensor, if it was recorded for autograd. */
  node: GradNode | null = null;
  /** Optional label, used by graph visualisations. */
  label?: string;
  /** Keep `.grad` for this intermediate (non-leaf) tensor too — for inspection and visualisation. */
  retainsGrad = false;

  constructor(storage: Float32Array, shape: readonly number[], strides?: readonly number[], offset = 0, requiresGrad = false) {
    this.storage = storage;
    this.shape = [...shape];
    this.strides = strides ? [...strides] : contiguousStrides(shape);
    this.offset = offset;
    this.requiresGrad = requiresGrad;
  }

  // ───────────── creation ─────────────

  static from(values: NestedArray | ArrayLike<number>, shape?: readonly number[], opts: { requiresGrad?: boolean } = {}): Tensor {
    let flat: number[];
    let inferred: number[];
    if (typeof values === 'number') {
      flat = [values];
      inferred = [];
    } else if (Array.isArray(values)) {
      inferred = [];
      let v: NestedArray = values;
      while (Array.isArray(v)) {
        inferred.push(v.length);
        v = v[0] as NestedArray;
      }
      flat = (values as NestedArray[]).flat(Infinity as 1) as number[];
    } else {
      flat = Array.from(values as ArrayLike<number>);
      inferred = [flat.length];
    }
    const s = shape ? inferShape(shape, flat.length) : inferred;
    if (sizeOf(s) !== flat.length) throw new Error(`${flat.length} values do not fit shape [${s}] — ragged nested array?`);
    return new Tensor(Float32Array.from(flat), s, undefined, 0, opts.requiresGrad ?? false);
  }

  static scalar(x: number): Tensor {
    return new Tensor(Float32Array.of(x), []);
  }

  static full(shape: readonly number[], value: number, opts: { requiresGrad?: boolean } = {}): Tensor {
    return new Tensor(new Float32Array(sizeOf(shape)).fill(value), shape, undefined, 0, opts.requiresGrad ?? false);
  }

  static zeros(shape: readonly number[], opts: { requiresGrad?: boolean } = {}): Tensor {
    return Tensor.full(shape, 0, opts);
  }

  static ones(shape: readonly number[], opts: { requiresGrad?: boolean } = {}): Tensor {
    return Tensor.full(shape, 1, opts);
  }

  static arange(n: number): Tensor {
    return new Tensor(Float32Array.from({ length: n }, (_, i) => i), [n]);
  }

  static eye(n: number): Tensor {
    const t = Tensor.zeros([n, n]);
    for (let i = 0; i < n; i++) t.storage[i * n + i] = 1;
    return t;
  }

  /** Samples from N(0, std²) via Box–Muller, reproducibly from `rng`. */
  static randn(shape: readonly number[], opts: { rng?: Rng; std?: number; requiresGrad?: boolean } = {}): Tensor {
    const rng = opts.rng ?? mulberry32(0);
    const std = opts.std ?? 1;
    const n = sizeOf(shape);
    const data = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      const u = Math.max(rng(), 1e-12), v = rng();
      const r = Math.sqrt(-2 * Math.log(u));
      data[i] = r * Math.cos(2 * Math.PI * v) * std;
      if (i + 1 < n) data[i + 1] = r * Math.sin(2 * Math.PI * v) * std;
    }
    return new Tensor(data, shape, undefined, 0, opts.requiresGrad ?? false);
  }

  /** Uniform samples from [lo, hi). */
  static rand(shape: readonly number[], opts: { rng?: Rng; lo?: number; hi?: number; requiresGrad?: boolean } = {}): Tensor {
    const rng = opts.rng ?? mulberry32(0);
    const lo = opts.lo ?? 0, hi = opts.hi ?? 1;
    const data = Float32Array.from({ length: sizeOf(shape) }, () => lo + (hi - lo) * rng());
    return new Tensor(data, shape, undefined, 0, opts.requiresGrad ?? false);
  }

  // ───────────── basic properties ─────────────

  get ndim(): number {
    return this.shape.length;
  }

  get size(): number {
    return sizeOf(this.shape);
  }

  isContiguous(): boolean {
    let expected = 1;
    for (let i = this.ndim - 1; i >= 0; i--) {
      if (this.shape[i]! !== 1 && this.strides[i] !== expected) return false;
      expected *= this.shape[i]!;
    }
    return true;
  }

  /** Storage index of a multi-dimensional index. */
  index(...idx: number[]): number {
    if (idx.length !== this.ndim) throw new RangeError(`expected ${this.ndim} indices, got ${idx.length}`);
    let o = this.offset;
    for (let i = 0; i < idx.length; i++) {
      const k = idx[i]! < 0 ? idx[i]! + this.shape[i]! : idx[i]!;
      if (k < 0 || k >= this.shape[i]!) throw new RangeError(`index ${idx[i]} out of range for dimension ${i} of size ${this.shape[i]}`);
      o += k * this.strides[i]!;
    }
    return o;
  }

  get(...idx: number[]): number {
    return this.storage[this.index(...idx)]!;
  }

  set(value: number, ...idx: number[]): void {
    this.storage[this.index(...idx)] = value;
  }

  item(): number {
    if (this.size !== 1) throw new Error(`item() needs a single-element tensor, got shape [${this.shape}]`);
    return this.storage[this.offset]!;
  }

  /** Values in row-major order as a new contiguous Float32Array. */
  toFloat32Array(): Float32Array {
    if (this.isContiguous()) return this.storage.slice(this.offset, this.offset + this.size);
    const out = new Float32Array(this.size);
    forEachOffset(this.shape, this.strides, this.offset, (o, i) => (out[i] = this.storage[o]!));
    return out;
  }

  toArray(): NestedArray {
    const flat = this.toFloat32Array();
    if (this.ndim === 0) return flat[0]!;
    const build = (dim: number, start: number): NestedArray[] => {
      const n = this.shape[dim]!;
      const step = sizeOf(this.shape.slice(dim + 1));
      return Array.from({ length: n }, (_, i) => (dim === this.ndim - 1 ? flat[start + i]! : build(dim + 1, start + i * step)));
    };
    return build(0, 0);
  }

  /** A contiguous copy (or `this` if already contiguous with offset 0 and full storage). */
  contiguous(): Tensor {
    if (this.isContiguous() && this.offset === 0 && this.storage.length === this.size) return this;
    return unary(this, (x) => x, 'contiguous', (g) => [g]);
  }

  /** Detached copy of the values (no graph history). */
  clone(): Tensor {
    return new Tensor(this.toFloat32Array(), this.shape);
  }

  /** Same values, no autograd history. Shares storage. */
  detach(): Tensor {
    return new Tensor(this.storage, this.shape, this.strides, this.offset);
  }

  retainGrad(): this {
    this.retainsGrad = true;
    return this;
  }

  requiresGrad_(value = true): this {
    this.requiresGrad = value;
    return this;
  }

  toString(): string {
    return formatTensor(this);
  }

  // ───────────── views (no copy) ─────────────

  reshape(...shape: number[]): Tensor {
    const target = inferShape(shape, this.size);
    const src = this.isContiguous() ? this : this.contiguous();
    const out = new Tensor(src.storage, target, undefined, src.offset);
    return record(out, 'reshape', [this], (g) => [g.reshape(...this.shape)]);
  }

  view(...shape: number[]): Tensor {
    if (!this.isContiguous()) throw new Error('view() needs a contiguous tensor; use reshape()');
    return this.reshape(...shape);
  }

  flatten(): Tensor {
    return this.reshape(this.size);
  }

  permute(...dims: number[]): Tensor {
    if (dims.length !== this.ndim) throw new Error(`permute needs ${this.ndim} dims`);
    const d = dims.map((x) => normDim(x, this.ndim));
    const out = new Tensor(this.storage, d.map((i) => this.shape[i]!), d.map((i) => this.strides[i]!), this.offset);
    const inverse = new Array<number>(d.length);
    d.forEach((x, i) => (inverse[x] = i));
    return record(out, 'permute', [this], (g) => [g.permute(...inverse)]);
  }

  transpose(a = -2, b = -1): Tensor {
    const dims = [...this.shape.keys()];
    const x = normDim(a, this.ndim), y = normDim(b, this.ndim);
    [dims[x], dims[y]] = [dims[y]!, dims[x]!];
    return this.permute(...dims);
  }

  /** Matrix transpose of a 2-D tensor. */
  get T(): Tensor {
    return this.transpose(0, 1);
  }

  unsqueeze(dim: number): Tensor {
    const d = normDim(dim, this.ndim + 1);
    const shape = [...this.shape];
    shape.splice(d, 0, 1);
    return this.reshape(...shape);
  }

  squeeze(dim?: number): Tensor {
    const shape = dim === undefined ? this.shape.filter((s) => s !== 1) : this.shape.filter((s, i) => !(i === normDim(dim, this.ndim) && s === 1));
    return this.reshape(...shape);
  }

  /** Elements [start, end) along `dim` (a view). */
  slice(dim: number, start: number, end?: number): Tensor {
    const d = normDim(dim, this.ndim);
    const n = this.shape[d]!;
    const s = start < 0 ? start + n : start;
    const e = end === undefined ? n : end < 0 ? end + n : Math.min(end, n);
    if (s < 0 || s > e) throw new RangeError(`bad slice [${start}, ${end}) of dimension of size ${n}`);
    const shape = [...this.shape];
    shape[d] = e - s;
    const out = new Tensor(this.storage, shape, this.strides, this.offset + s * this.strides[d]!);
    return record(out, 'slice', [this], (g) => {
      const full = Tensor.zeros(this.shape);
      const region = new Tensor(full.storage, shape, full.strides, s * full.strides[d]!);
      forEachOffset2(shape, region.strides, region.offset, g.strides, g.offset, (o, go) => (full.storage[o] = g.storage[go]!));
      return [full];
    });
  }

  /** Broadcast to a larger shape without copying (stride 0 along repeated dims). */
  expand(...shape: number[]): Tensor {
    const target = shape.map((s, i) => (s === -1 ? this.shape[i - (shape.length - this.ndim)]! : s));
    const out = new Tensor(this.storage, target, broadcastStrides(this.shape, this.strides, target), this.offset);
    return record(out, 'expand', [this], (g) => [sumTo(g, this.shape)]);
  }

  // ───────────── element-wise arithmetic (broadcasting) ─────────────

  add(o: TensorLike): Tensor {
    const b = lift(o);
    return binary(this, b, (x, y) => x + y, 'add', (g) => [sumTo(g, this.shape), sumTo(g, b.shape)]);
  }

  sub(o: TensorLike): Tensor {
    const b = lift(o);
    return binary(this, b, (x, y) => x - y, 'sub', (g) => [sumTo(g, this.shape), sumTo(g.neg(), b.shape)]);
  }

  mul(o: TensorLike): Tensor {
    const b = lift(o);
    return binary(this, b, (x, y) => x * y, 'mul', (g) => [sumTo(g.mul(b), this.shape), sumTo(g.mul(this), b.shape)]);
  }

  div(o: TensorLike): Tensor {
    const b = lift(o);
    return binary(this, b, (x, y) => x / y, 'div', (g) => [sumTo(g.div(b), this.shape), sumTo(g.mul(this).neg().div(b.mul(b)), b.shape)]);
  }

  pow(p: number): Tensor {
    return unary(this, (x) => x ** p, 'pow', (g) => [g.mul(this.pow(p - 1).mul(p))]);
  }

  neg(): Tensor {
    return unary(this, (x) => -x, 'neg', (g) => [g.neg()]);
  }

  exp(): Tensor {
    const out: Tensor = unary(this, Math.exp, 'exp', (g) => [g.mul(out.detach())]);
    return out;
  }

  log(): Tensor {
    return unary(this, Math.log, 'log', (g) => [g.div(this)]);
  }

  sqrt(): Tensor {
    const out: Tensor = unary(this, Math.sqrt, 'sqrt', (g) => [g.div(out.detach().mul(2))]);
    return out;
  }

  tanh(): Tensor {
    const out: Tensor = unary(this, Math.tanh, 'tanh', (g) => {
      const y = out.detach();
      return [g.mul(Tensor.scalar(1).sub(y.mul(y)))];
    });
    return out;
  }

  sigmoid(): Tensor {
    const out: Tensor = unary(this, (x) => 1 / (1 + Math.exp(-x)), 'sigmoid', (g) => {
      const y = out.detach();
      return [g.mul(y.mul(Tensor.scalar(1).sub(y)))];
    });
    return out;
  }

  relu(): Tensor {
    return unary(this, (x) => (x > 0 ? x : 0), 'relu', (g) => [g.mul(unary(this.detach(), (x) => (x > 0 ? 1 : 0), 'step'))]);
  }

  /** GELU with the tanh approximation used by GPT-2. */
  gelu(): Tensor {
    const c = Math.sqrt(2 / Math.PI);
    const f = (x: number) => 0.5 * x * (1 + Math.tanh(c * (x + 0.044715 * x * x * x)));
    const df = (x: number) => {
      const u = c * (x + 0.044715 * x * x * x);
      const t = Math.tanh(u);
      return 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * c * (1 + 3 * 0.044715 * x * x);
    };
    return unary(this, f, 'gelu', (g) => [g.mul(unary(this.detach(), df, 'gelu_grad'))]);
  }

  // ───────────── reductions ─────────────

  /** Sum over `dim` (a number or list), or over everything when omitted. */
  sum(dim?: number | number[], keepdim = false): Tensor {
    const dims = dim === undefined ? [...this.shape.keys()] : (Array.isArray(dim) ? dim : [dim]).map((d) => normDim(d, this.ndim));
    const kept = this.shape.map((s, i) => (dims.includes(i) ? 1 : s));
    const src = this.contiguous();
    const out = new Float32Array(sizeOf(kept));
    const outStrides = contiguousStrides(kept).map((s, i) => (dims.includes(i) ? 0 : s));
    // Accumulate each input element into its output slot (stride 0 along reduced dims).
    forEachOffset2(src.shape, src.strides, src.offset, outStrides, 0, (i, o) => (out[o]! += src.storage[i]!));
    const shape = keepdim ? kept : this.shape.filter((_, i) => !dims.includes(i));
    const res = new Tensor(out, shape);
    return record(res, 'sum', [this], (g) => [g.reshape(...kept).expand(...this.shape).contiguous()]);
  }

  mean(dim?: number | number[], keepdim = false): Tensor {
    const dims = dim === undefined ? [...this.shape.keys()] : (Array.isArray(dim) ? dim : [dim]).map((d) => normDim(d, this.ndim));
    const n = dims.reduce((a, d) => a * this.shape[d]!, 1);
    return this.sum(dim, keepdim).div(n);
  }

  /** Maximum along one dimension. The gradient flows to the (first) arg-max. */
  max(dim: number, keepdim = false): Tensor {
    const d = normDim(dim, this.ndim);
    const { values, indices } = reduceAlong(this, d, (x, best) => x > best, -Infinity);
    const kept = this.shape.map((s, i) => (i === d ? 1 : s));
    const res = new Tensor(values, keepdim ? kept : this.shape.filter((_, i) => i !== d));
    return record(res, 'max', [this], (g) => [scatterAlong(g.reshape(...kept), indices, this.shape, d)]);
  }

  argmax(dim: number): Int32Array {
    return reduceAlong(this, normDim(dim, this.ndim), (x, best) => x > best, -Infinity).indices;
  }

  /** log Σ exp(x) along `dim`, computed stably by subtracting the maximum first. */
  logsumexp(dim: number, keepdim = false): Tensor {
    const m = noGrad(() => this.max(dim, true));
    const out = this.sub(m).exp().sum(dim, true).log().add(m);
    return keepdim ? out : out.squeeze(dim);
  }

  softmax(dim = -1): Tensor {
    const d = normDim(dim, this.ndim);
    const src = this.contiguous();
    const out = new Float32Array(src.size);
    const n = src.shape[d]!, inner = sizeOf(src.shape.slice(d + 1)), outer = sizeOf(src.shape.slice(0, d));
    for (let o = 0; o < outer; o++) {
      for (let i = 0; i < inner; i++) {
        const base = o * n * inner + i;
        let m = -Infinity;
        for (let j = 0; j < n; j++) m = Math.max(m, src.storage[src.offset + base + j * inner]!);
        let z = 0;
        for (let j = 0; j < n; j++) z += out[base + j * inner] = Math.exp(src.storage[src.offset + base + j * inner]! - m);
        for (let j = 0; j < n; j++) out[base + j * inner]! /= z;
      }
    }
    const res = new Tensor(out, this.shape);
    return record(res, 'softmax', [this], (g) => {
      // dx = y ⊙ (g − Σ_j g_j y_j)
      const y = res.detach();
      return [y.mul(g.sub(g.mul(y).sum(d, true)))];
    });
  }

  logSoftmax(dim = -1): Tensor {
    const d = normDim(dim, this.ndim);
    const lse = noGrad(() => this.logsumexp(d, true));
    const res = noGrad(() => this.sub(lse));
    return record(res.detach(), 'logSoftmax', [this], (g) => {
      // dx = g − softmax(x) · Σ_j g_j
      const p = res.detach().exp();
      return [g.sub(p.mul(g.sum(d, true)))];
    });
  }

  // ───────────── linear algebra ─────────────

  /** Matrix product with batch broadcasting: (…, m, k) @ (…, k, n) → (…, m, n). */
  matmul(other: Tensor): Tensor {
    const a = this.ndim === 1 ? this.unsqueeze(0) : this;
    const b = other.ndim === 1 ? other.unsqueeze(-1) : other;
    const [m, k] = [a.shape[a.ndim - 2]!, a.shape[a.ndim - 1]!];
    const [k2, n] = [b.shape[b.ndim - 2]!, b.shape[b.ndim - 1]!];
    if (k !== k2) throw new Error(`matmul shape mismatch: [${this.shape}] @ [${other.shape}]`);
    const batch = broadcastShapes(a.shape.slice(0, -2), b.shape.slice(0, -2));
    const A = a.expand(...batch, m, k).contiguous();
    const B = b.expand(...batch, k, n).contiguous();
    const nb = sizeOf(batch);
    const out = new Float32Array(nb * m * n);
    const As = A.storage, Bs = B.storage;
    for (let t = 0; t < nb; t++) {
      const ao = A.offset + t * m * k, bo = B.offset + t * k * n, oo = t * m * n;
      for (let i = 0; i < m; i++) {
        for (let p = 0; p < k; p++) {
          const aip = As[ao + i * k + p]!;
          if (aip === 0) continue;
          const brow = bo + p * n, orow = oo + i * n;
          for (let j = 0; j < n; j++) out[orow + j]! += aip * Bs[brow + j]!;
        }
      }
    }
    let res = new Tensor(out, [...batch, m, n]);
    if (this.ndim === 1) res = new Tensor(res.storage, res.shape.filter((_, i) => i !== res.ndim - 2));
    if (other.ndim === 1) res = new Tensor(res.storage, res.shape.slice(0, -1));
    return record(res, 'matmul', [this, other], (g) => {
      const g2 = g.reshape(...batch, m, n);
      const ga = g2.matmul(b.transpose(-1, -2));
      const gb = a.transpose(-1, -2).matmul(g2);
      return [sumTo(ga, a.shape).reshape(...this.shape), sumTo(gb, b.shape).reshape(...other.shape)];
    });
  }

  // ───────────── autograd ─────────────

  /**
   * Back-propagate from this tensor. For a scalar, the seed gradient is 1. Gradients accumulate
   * into `.grad` of every leaf tensor that requires them.
   */
  backward(grad?: Tensor): void {
    if (!this.requiresGrad) throw new Error('backward() on a tensor that does not require grad');
    const seed = grad ?? (this.size === 1 ? Tensor.ones(this.shape) : null);
    if (!seed) throw new Error('backward() on a non-scalar tensor needs an explicit gradient');

    // Topological order by depth-first search.
    const order: Tensor[] = [];
    const seen = new Set<Tensor>();
    const visit = (t: Tensor) => {
      if (seen.has(t)) return;
      seen.add(t);
      for (const p of t.node?.parents ?? []) if (p.requiresGrad) visit(p);
      order.push(t);
    };
    visit(this);

    const grads = new Map<Tensor, Tensor>([[this, seed]]);
    noGrad(() => {
      for (let i = order.length - 1; i >= 0; i--) {
        const t = order[i]!;
        const g = grads.get(t);
        if (!g) continue;
        if (!t.node) {
          t.grad = t.grad ? t.grad.add(g) : g.contiguous().clone();
          continue;
        }
        if (t.retainsGrad) t.grad = t.grad ? t.grad.add(g) : g.contiguous().clone();
        const pg = t.node.backward(g);
        t.node.parents.forEach((p, j) => {
          const gp = pg[j];
          if (!gp || !p.requiresGrad) return;
          const prev = grads.get(p);
          grads.set(p, prev ? prev.add(gp) : gp);
        });
      }
    });
  }

  zeroGrad(): void {
    this.grad = null;
  }
}

// ───────────── helpers ─────────────

function lift(x: TensorLike): Tensor {
  return typeof x === 'number' ? Tensor.scalar(x) : x;
}

/** Attach an autograd node if gradients are enabled and any input needs them. */
export function record(out: Tensor, op: string, parents: Tensor[], backward: GradNode['backward']): Tensor {
  if (gradEnabled && parents.some((p) => p.requiresGrad)) {
    out.requiresGrad = true;
    out.node = { op, parents, backward };
  }
  return out;
}

/** Sum a gradient over broadcast dimensions so it matches `shape` again. */
export function sumTo(g: Tensor, shape: readonly number[]): Tensor {
  if (sameShape(g.shape, shape)) return g;
  const lead = g.ndim - shape.length;
  const dims: number[] = [];
  for (let i = 0; i < g.ndim; i++) if (i < lead || (shape[i - lead] === 1 && g.shape[i] !== 1)) dims.push(i);
  return g.sum(dims, true).reshape(...shape);
}

/** Visit every element: calls fn(storage offset, flat row-major index). */
function forEachOffset(shape: readonly number[], strides: readonly number[], offset: number, fn: (o: number, i: number) => void): void {
  const n = sizeOf(shape);
  if (n === 0) return;
  const nd = shape.length;
  if (nd === 0) return fn(offset, 0);
  const idx = new Array<number>(nd).fill(0);
  let o = offset;
  for (let i = 0; i < n; i++) {
    fn(o, i);
    for (let d = nd - 1; d >= 0; d--) {
      idx[d]!++;
      o += strides[d]!;
      if (idx[d]! < shape[d]!) break;
      o -= strides[d]! * shape[d]!;
      idx[d] = 0;
    }
  }
}

/** Like forEachOffset but walks two strided layouts of the same shape in lock-step. */
function forEachOffset2(shape: readonly number[], sa: readonly number[], oa: number, sb: readonly number[], ob: number, fn: (a: number, b: number) => void): void {
  const n = sizeOf(shape);
  if (n === 0) return;
  const nd = shape.length;
  if (nd === 0) return fn(oa, ob);
  const idx = new Array<number>(nd).fill(0);
  let a = oa, b = ob;
  for (let i = 0; i < n; i++) {
    fn(a, b);
    for (let d = nd - 1; d >= 0; d--) {
      idx[d]!++;
      a += sa[d]!;
      b += sb[d]!;
      if (idx[d]! < shape[d]!) break;
      a -= sa[d]! * shape[d]!;
      b -= sb[d]! * shape[d]!;
      idx[d] = 0;
    }
  }
}

function unary(a: Tensor, f: (x: number) => number, op: string, backward?: GradNode['backward']): Tensor {
  const out = new Float32Array(a.size);
  if (a.isContiguous()) {
    const s = a.storage, o = a.offset;
    for (let i = 0; i < out.length; i++) out[i] = f(s[o + i]!);
  } else {
    forEachOffset(a.shape, a.strides, a.offset, (o, i) => (out[i] = f(a.storage[o]!)));
  }
  const res = new Tensor(out, a.shape);
  return backward ? record(res, op, [a], backward) : res;
}

function binary(a: Tensor, b: Tensor, f: (x: number, y: number) => number, op: string, backward: GradNode['backward']): Tensor {
  const shape = broadcastShapes(a.shape, b.shape);
  const out = new Float32Array(sizeOf(shape));
  if (sameShape(a.shape, b.shape) && a.isContiguous() && b.isContiguous()) {
    const as = a.storage, bs = b.storage, ao = a.offset, bo = b.offset;
    for (let i = 0; i < out.length; i++) out[i] = f(as[ao + i]!, bs[bo + i]!);
  } else if (b.size === 1 && a.isContiguous()) {
    const y = b.storage[b.offset]!, as = a.storage, ao = a.offset;
    for (let i = 0; i < out.length; i++) out[i] = f(as[ao + i]!, y);
  } else {
    const sa = broadcastStrides(a.shape, a.strides, shape);
    const sb = broadcastStrides(b.shape, b.strides, shape);
    let k = 0;
    forEachOffset2(shape, sa, a.offset, sb, b.offset, (i, j) => (out[k++] = f(a.storage[i]!, b.storage[j]!)));
  }
  return record(new Tensor(out, shape), op, [a, b], backward);
}

/** Reduce along one dimension keeping the best value and its index. */
function reduceAlong(t: Tensor, d: number, better: (x: number, best: number) => boolean, init: number): { values: Float32Array; indices: Int32Array } {
  const src = t.contiguous();
  const n = src.shape[d]!, inner = sizeOf(src.shape.slice(d + 1)), outer = sizeOf(src.shape.slice(0, d));
  const values = new Float32Array(outer * inner);
  const indices = new Int32Array(outer * inner);
  for (let o = 0; o < outer; o++) {
    for (let i = 0; i < inner; i++) {
      let best = init, bi = 0;
      for (let j = 0; j < n; j++) {
        const x = src.storage[src.offset + o * n * inner + j * inner + i]!;
        if (better(x, best)) {
          best = x;
          bi = j;
        }
      }
      values[o * inner + i] = best;
      indices[o * inner + i] = bi;
    }
  }
  return { values, indices };
}

/** Place g (reduced shape, keepdim) at the arg-max positions of a tensor of `shape`. */
function scatterAlong(g: Tensor, indices: Int32Array, shape: readonly number[], d: number): Tensor {
  const out = Tensor.zeros(shape);
  const gc = g.contiguous();
  const n = shape[d]!, inner = sizeOf(shape.slice(d + 1)), outer = sizeOf(shape.slice(0, d));
  for (let o = 0; o < outer; o++) for (let i = 0; i < inner; i++) out.storage[o * n * inner + indices[o * inner + i]! * inner + i] = gc.storage[gc.offset + o * inner + i]!;
  return out;
}

function formatTensor(t: Tensor): string {
  const fmt = (x: number) => (Number.isInteger(x) && Math.abs(x) < 1e6 ? x.toFixed(0) : Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(3) : x.toFixed(4));
  const body = (v: NestedArray, depth: number): string => {
    if (!Array.isArray(v)) return fmt(v);
    const items = v.length > 12 ? [...v.slice(0, 6), '…' as unknown as NestedArray, ...v.slice(-6)] : v;
    const parts = items.map((x) => (typeof x === 'string' ? '…' : body(x, depth + 1)));
    return depth === t.ndim - 1 ? `[${parts.join(', ')}]` : `[${parts.join(',\n' + ' '.repeat(depth + 8))}]`;
  };
  const grad = t.requiresGrad ? ', requiresGrad' : '';
  return `tensor(${body(t.toArray(), 0)}, shape=[${t.shape}]${grad})`;
}
