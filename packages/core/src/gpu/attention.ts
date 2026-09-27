/**
 * The operations attention needs (Chapter 10): batched matrix products, a 4-D permute for splitting
 * heads, and a fused scaled, causally masked softmax — each with its backward pass.
 */
import { groups1d } from './context.ts';
import { WG } from './kernels.ts';
import { GpuTensor, matmulInto, recordGpu } from './tensor.ts';

const sizeOf = (s: readonly number[]) => s.reduce((a, b) => a * b, 1);

/**
 * Batched matrix product over all leading dimensions: (…, M, K) @ (…, K, N) → (…, M, N), or with
 * `transB`, (…, M, K) @ (…, N, K)ᵀ → (…, M, N) — the form of the attention scores QKᵀ.
 */
export function bmm(a: GpuTensor, b: GpuTensor, opts: { transB?: boolean } = {}): GpuTensor {
  const transB = opts.transB ?? false;
  if (a.ndim < 3 || b.ndim !== a.ndim) throw new Error(`bmm expects equal-rank tensors of rank ≥ 3, got [${a.shape}] and [${b.shape}]`);
  const lead = a.shape.slice(0, -2);
  if (b.shape.slice(0, -2).some((d, i) => d !== lead[i])) throw new Error(`bmm batch dimensions differ: [${a.shape}] and [${b.shape}]`);
  const [M, K] = a.shape.slice(-2) as [number, number];
  const [b0, b1] = b.shape.slice(-2) as [number, number];
  const [Kb, N] = transB ? [b1, b0] : [b0, b1];
  if (K !== Kb) throw new Error(`bmm shape mismatch: [${a.shape}] @ [${b.shape}]${transB ? 'ᵀ' : ''}`);
  const batch = sizeOf(lead);
  const ctx = a.ctx;
  const out = GpuTensor.empty(ctx, [...lead, M, N]);
  matmulInto(ctx, a.buffer, b.buffer, out.buffer, { M, N, K, transB, batch });
  return recordGpu(out, 'bmm', [a, b], (g) => {
    const ga = a.requiresGrad ? GpuTensor.empty(ctx, a.shape) : null;
    const gb = b.requiresGrad ? GpuTensor.empty(ctx, b.shape) : null;
    if (!transB) {
      // C = A B:   dA = dC Bᵀ,   dB = Aᵀ dC
      if (ga) matmulInto(ctx, g.buffer, b.buffer, ga.buffer, { M, N: K, K: N, transB: true, batch });
      if (gb) matmulInto(ctx, a.buffer, g.buffer, gb.buffer, { M: K, N, K: M, transA: true, batch });
    } else {
      // C = A Bᵀ:  dA = dC B,    dB = dCᵀ A
      if (ga) matmulInto(ctx, g.buffer, b.buffer, ga.buffer, { M, N: K, K: N, batch });
      if (gb) matmulInto(ctx, g.buffer, a.buffer, gb.buffer, { M: N, N: K, K: M, transA: true, batch });
    }
    return [ga, gb];
  });
}

const permuteKernel = /* wgsl */ `
struct P { n: u32, s0: u32, s1: u32, s2: u32, s3: u32, d1: u32, d2: u32, d3: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  // Unravel the output index over the output shape (·, d1, d2, d3), then gather with the input's
  // strides, permuted into output order.
  let i3 = i % p.d3; let r3 = i / p.d3;
  let i2 = r3 % p.d2; let r2 = r3 / p.d2;
  let i1 = r2 % p.d1; let i0 = r2 / p.d1;
  out[i] = x[i0 * p.s0 + i1 * p.s1 + i2 * p.s2 + i3 * p.s3];
}`;

/** Reorder the dimensions of a tensor of rank ≤ 4 (copying), e.g. (B, T, h, d) → (B, h, T, d). */
export function permute(x: GpuTensor, perm: number[]): GpuTensor {
  const n = x.ndim;
  if (n > 4 || perm.length !== n || [...perm].sort().some((d, i) => d !== i)) throw new Error(`bad permutation [${perm}] for rank ${n}`);
  // Pad to rank 4 with leading 1s.
  const pad = 4 - n;
  const shape = [...Array(pad).fill(1), ...x.shape];
  const p4 = [...Array.from({ length: pad }, (_, i) => i), ...perm.map((d) => d + pad)];
  const strides = [0, 0, 0, 0];
  for (let d = 3, s = 1; d >= 0; d--) {
    strides[d] = s;
    s *= shape[d]!;
  }
  const outShape = p4.map((d) => shape[d]!);
  const ctx = x.ctx;
  const out = GpuTensor.empty(ctx, perm.map((d) => x.shape[d]!));
  ctx.run({
    code: permuteKernel,
    uniforms: { spec: 'uuuuuuuu', values: [x.size, ...p4.map((d) => strides[d]!), outShape[1]!, outShape[2]!, outShape[3]!] },
    buffers: [x.buffer, out.buffer],
    groups: groups1d(x.size),
  });
  const inverse = new Array<number>(n);
  perm.forEach((d, i) => (inverse[d] = i));
  return recordGpu(out, 'permute', [x], (g) => [permute(g, inverse)]);
}

const SOFTMAX_COMMON = /* wgsl */ `
struct P { rows: u32, cols: u32, tq: u32, scale: f32, causal: u32 }
@group(0) @binding(0) var<uniform> p: P;
var<workgroup> red: array<f32, ${WG}>;
// Key j is visible from query row r if not causal, or if j ≤ its position. Queries are the last
// tq positions of the cols keys (tq < cols when earlier keys come from a cache, Chapter 16).
fn visible(r: u32, j: u32) -> bool {
  if (p.causal == 0u) { return true; }
  return j <= (r % p.tq) + (p.cols - p.tq);
}`;

const softmaxForward = /* wgsl */ `${SOFTMAX_COMMON}
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let r = wg.x + wg.y * nw.x;
  if (r >= p.rows) { return; }
  let base = r * p.cols;
  var m = -3.0e38;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { if (visible(r, j)) { m = max(m, x[base + j] * p.scale); } }
  red[lid.x] = m;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid.x < s) { red[lid.x] = max(red[lid.x], red[lid.x + s]); } workgroupBarrier(); }
  m = red[0];
  workgroupBarrier();
  var e = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { if (visible(r, j)) { e += exp(x[base + j] * p.scale - m); } }
  red[lid.x] = e;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid.x < s) { red[lid.x] += red[lid.x + s]; } workgroupBarrier(); }
  let sum = red[0];
  for (var j = lid.x; j < p.cols; j += ${WG}u) {
    y[base + j] = select(0.0, exp(x[base + j] * p.scale - m) / sum, visible(r, j));
  }
}`;

const softmaxBackward = /* wgsl */ `${SOFTMAX_COMMON}
@group(0) @binding(1) var<storage, read> y: array<f32>;
@group(0) @binding(2) var<storage, read> gy: array<f32>;
@group(0) @binding(3) var<storage, read_write> gx: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let r = wg.x + wg.y * nw.x;
  if (r >= p.rows) { return; }
  let base = r * p.cols;
  var s = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { s += gy[base + j] * y[base + j]; }
  red[lid.x] = s;
  workgroupBarrier();
  for (var k = ${WG / 2}u; k > 0u; k >>= 1u) { if (lid.x < k) { red[lid.x] += red[lid.x + k]; } workgroupBarrier(); }
  let dot = red[0];
  // Appendix B: x̄ = y ⊙ (ȳ − ⟨ȳ, y⟩), times the scale applied before the softmax.
  for (var j = lid.x; j < p.cols; j += ${WG}u) { gx[base + j] = p.scale * y[base + j] * (gy[base + j] - dot); }
}`;

/**
 * softmax(scale · x) over the last dimension, one workgroup per row. With `causal`, entries above the
 * diagonal of each (…, Tq, Tk) matrix are excluded (probability 0).
 */
export function softmax(x: GpuTensor, opts: { scale?: number; causal?: boolean } = {}): GpuTensor {
  const scale = opts.scale ?? 1;
  const cols = x.shape.at(-1)!;
  const tq = x.ndim >= 2 ? x.shape.at(-2)! : 1;
  const rows = x.size / cols;
  const ctx = x.ctx;
  const y = GpuTensor.empty(ctx, x.shape);
  const uniforms = { spec: 'uuufu', values: [rows, cols, tq, scale, opts.causal ? 1 : 0] };
  const gx = Math.min(rows, 65535);
  const groups: [number, number] = [gx, Math.ceil(rows / gx)];
  ctx.run({ code: softmaxForward, uniforms, buffers: [x.buffer, y.buffer], groups });
  return recordGpu(y, 'softmax', [x], (g) => {
    const out = GpuTensor.empty(ctx, x.shape);
    ctx.run({ code: softmaxBackward, uniforms, buffers: [y.buffer, g.buffer, out.buffer], groups });
    return [out];
  });
}

/**
 * Multi-head causal self-attention on x (B, T, C) with projections Wq, Wk, Wv, Wo (C, C each).
 * Returns the output (B, T, C) and the attention probabilities (B, heads, T, T), for inspection.
 */
export function multiHeadAttention(x: GpuTensor, w: { q: GpuTensor; k: GpuTensor; v: GpuTensor; o: GpuTensor }, heads: number): { y: GpuTensor; probs: GpuTensor } {
  const [B, T, C] = x.shape as [number, number, number];
  if (C % heads !== 0) throw new Error(`model width ${C} is not divisible by ${heads} heads`);
  const d = C / heads;
  const split = (t: GpuTensor) => permute(t.reshape(B, T, heads, d), [0, 2, 1, 3]); // (B, h, T, d)
  const q = split(x.matmul(w.q)), k = split(x.matmul(w.k)), v = split(x.matmul(w.v));
  const probs = softmax(bmm(q, k, { transB: true }), { scale: 1 / Math.sqrt(d), causal: true });
  const y = permute(bmm(probs, v), [0, 2, 1, 3]).reshape(B, T, C).matmul(w.o);
  return { y, probs };
}
