/**
 * The remaining pieces of a Transformer block on the GPU (Chapter 11): fused layer normalisation,
 * GELU, dropout, and a product with a transposed weight (for tying the output layer to the
 * embedding table).
 */
import { groups1d } from './context.ts';
import { WG, unaryKernel } from './kernels.ts';
import { GpuTensor, matmulInto, recordGpu } from './tensor.ts';

const layerNormForward = /* wgsl */ `
struct P { rows: u32, cols: u32, eps: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> gamma: array<f32>;
@group(0) @binding(3) var<storage, read> beta: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
@group(0) @binding(5) var<storage, read_write> xhat: array<f32>;
@group(0) @binding(6) var<storage, read_write> rstd: array<f32>;
var<workgroup> red: array<f32, ${WG}>;
fn reduce(v: f32, lid: u32) -> f32 {
  red[lid] = v;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid < s) { red[lid] += red[lid + s]; } workgroupBarrier(); }
  let total = red[0];
  workgroupBarrier();
  return total;
}
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let r = wg.x + wg.y * nw.x;
  if (r >= p.rows) { return; }
  let base = r * p.cols;
  var s = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { s += x[base + j]; }
  let mean = reduce(s, lid.x) / f32(p.cols);
  var v = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { let c = x[base + j] - mean; v += c * c; }
  let inv = inverseSqrt(reduce(v, lid.x) / f32(p.cols) + p.eps);
  for (var j = lid.x; j < p.cols; j += ${WG}u) {
    let h = (x[base + j] - mean) * inv;
    xhat[base + j] = h;
    y[base + j] = h * gamma[j] + beta[j];
  }
  if (lid.x == 0u) { rstd[r] = inv; }
}`;

const layerNormBackward = /* wgsl */ `
struct P { rows: u32, cols: u32, eps: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> gy: array<f32>;
@group(0) @binding(2) var<storage, read> gamma: array<f32>;
@group(0) @binding(3) var<storage, read> xhat: array<f32>;
@group(0) @binding(4) var<storage, read> rstd: array<f32>;
@group(0) @binding(5) var<storage, read_write> gx: array<f32>;
var<workgroup> red: array<f32, ${WG}>;
fn reduce(v: f32, lid: u32) -> f32 {
  red[lid] = v;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid < s) { red[lid] += red[lid + s]; } workgroupBarrier(); }
  let total = red[0];
  workgroupBarrier();
  return total;
}
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let r = wg.x + wg.y * nw.x;
  if (r >= p.rows) { return; }
  let base = r * p.cols;
  // Appendix B: x̄ = (1/s)(g − mean(g) − x̂ · mean(g ⊙ x̂)), with g = ȳ ⊙ γ.
  var s1 = 0.0;
  var s2 = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) {
    let g = gy[base + j] * gamma[j];
    s1 += g;
    s2 += g * xhat[base + j];
  }
  let m1 = reduce(s1, lid.x) / f32(p.cols);
  let m2 = reduce(s2, lid.x) / f32(p.cols);
  for (var j = lid.x; j < p.cols; j += ${WG}u) {
    let g = gy[base + j] * gamma[j];
    gx[base + j] = rstd[r] * (g - m1 - xhat[base + j] * m2);
  }
}`;

/** Layer normalisation over the last dimension, fused into one kernel (and one for backward). */
export function layerNorm(x: GpuTensor, gamma: GpuTensor, beta: GpuTensor, eps = 1e-5): GpuTensor {
  const cols = x.shape.at(-1)!;
  const rows = x.size / cols;
  const ctx = x.ctx;
  const y = GpuTensor.empty(ctx, x.shape);
  const xhat = GpuTensor.empty(ctx, x.shape);
  const rstd = GpuTensor.empty(ctx, [rows]);
  const uniforms = { spec: 'uuf', values: [rows, cols, eps] };
  const gx = Math.min(rows, 65535);
  const groups: [number, number] = [gx, Math.ceil(rows / gx)];
  ctx.run({ code: layerNormForward, uniforms, buffers: [x.buffer, gamma.buffer, beta.buffer, y.buffer, xhat.buffer, rstd.buffer], groups });
  return recordGpu(y, 'layerNorm', [x, gamma, beta], (g) => {
    const dx = GpuTensor.empty(ctx, x.shape);
    ctx.run({ code: layerNormBackward, uniforms, buffers: [g.buffer, gamma.buffer, xhat.buffer, rstd.buffer, dx.buffer], groups });
    const flat = (t: GpuTensor) => t.reshape(rows, cols);
    return [dx, gamma.requiresGrad ? flat(g).mul(flat(xhat)).sumRows() : null, beta.requiresGrad ? flat(g).sumRows() : null];
  });
}

const GELU = '0.5 * x * (1.0 + (1.0 - 2.0 / (exp(2.0 * clamp(0.7978845608 * (x + 0.044715 * x * x * x), -15.0, 15.0)) + 1.0)))';

const geluBackward = /* wgsl */ `
struct P { n: u32, aLen: u32, bLen: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> g: array<f32>;
@group(0) @binding(2) var<storage, read> x: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  let v = x[i];
  let u = 0.7978845608 * (v + 0.044715 * v * v * v);
  let t = 1.0 - 2.0 / (exp(2.0 * clamp(u, -15.0, 15.0)) + 1.0);
  let du = 0.7978845608 * (1.0 + 3.0 * 0.044715 * v * v);
  out[i] = g[i] * (0.5 * (1.0 + t) + 0.5 * v * (1.0 - t * t) * du);
}`;

/** GELU, in the tanh approximation used by GPT-2: ½x(1 + tanh(√(2/π)(x + 0.044715x³))). */
export function gelu(x: GpuTensor): GpuTensor {
  const ctx = x.ctx;
  const y = GpuTensor.empty(ctx, x.shape);
  ctx.run({ code: unaryKernel(GELU), uniforms: { spec: 'uf', values: [x.size, 0] }, buffers: [x.buffer, y.buffer], groups: groups1d(x.size) });
  return recordGpu(y, 'gelu', [x], (g) => {
    const gx = GpuTensor.empty(ctx, x.shape);
    ctx.run({ code: geluBackward, uniforms: { spec: 'uuu', values: [x.size, x.size, x.size] }, buffers: [g.buffer, x.buffer, gx.buffer], groups: groups1d(x.size) });
    return [gx];
  });
}

const dropoutKernel = /* wgsl */ `
struct P { n: u32, seed: u32, keep: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
// A stateless hash (PCG output function): the same (seed, i) always gives the same mask bit, so the
// backward pass regenerates the mask instead of storing it.
fn hash(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  let u = f32(hash(i ^ hash(p.seed)) >> 8u) / 16777216.0;
  out[i] = select(0.0, x[i] / p.keep, u < p.keep);
}`;

/**
 * Dropout: zero each element with probability `rate` and scale the survivors by 1/(1 − rate), so
 * the expected value is unchanged. Use a fresh seed for every call during training.
 */
export function dropout(x: GpuTensor, rate: number, seed: number): GpuTensor {
  if (rate <= 0) return x;
  const ctx = x.ctx;
  const keep = 1 - rate;
  const run = (src: GpuTensor) => {
    const out = GpuTensor.empty(ctx, src.shape);
    ctx.run({ code: dropoutKernel, uniforms: { spec: 'uuf', values: [src.size, seed >>> 0, keep] }, buffers: [src.buffer, out.buffer], groups: groups1d(src.size) });
    return out;
  };
  const y = run(x);
  return recordGpu(y, 'dropout', [x], (g) => [run(g)]);
}

/** x @ Wᵀ for a (…, K) input and an (N, K) weight: the output layer tied to an (N = V, K = C) embedding. */
export function matmulT(x: GpuTensor, w: GpuTensor): GpuTensor {
  const [N, K] = w.shape as [number, number];
  if (x.shape.at(-1) !== K) throw new Error(`matmulT shape mismatch: [${x.shape}] @ [${w.shape}]ᵀ`);
  const M = x.size / K;
  const ctx = x.ctx;
  const out = GpuTensor.empty(ctx, [...x.shape.slice(0, -1), N]);
  matmulInto(ctx, x.buffer, w.buffer, out.buffer, { M, N, K, transB: true });
  return recordGpu(out, 'matmulT', [x, w], (g) => {
    // Y = X Wᵀ:  dX = dY W  (M×N · N×K),   dW = dYᵀ X  (N×M · M×K)
    const gx = x.requiresGrad ? GpuTensor.empty(ctx, x.shape) : null;
    const gw = w.requiresGrad ? GpuTensor.empty(ctx, w.shape) : null;
    if (gx) matmulInto(ctx, g.buffer, w.buffer, gx.buffer, { M, N: K, K: N });
    if (gw) matmulInto(ctx, g.buffer, x.buffer, gw.buffer, { M: N, N: K, K: M, transA: true });
    return [gx, gw];
  });
}
