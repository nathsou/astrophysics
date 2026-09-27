/**
 * WGSL compute kernels for the GPU backend (Chapter 8). Each function returns shader source;
 * the context caches one pipeline per distinct source string.
 *
 * Conventions: all tensors are contiguous row-major f32 arrays; integer ids are u32. Kernels read
 * their sizes from a small uniform struct at @binding(0).
 */

export const WG = 256; // threads per workgroup for 1-D kernels

/** out[i] = f(a[i]) for an expression in `x` (and optionally the uniform scalar `p.s`). */
export const unaryKernel = (expr: string) => /* wgsl */ `
struct P { n: u32, s: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  let x = a[i];
  out[i] = ${expr};
}`;

/**
 * out[i] = f(a[i mod aLen], b[i mod bLen]) — covers equal shapes, an operand broadcast along the
 * trailing dimensions (e.g. a bias: length = columns) and a scalar (length 1), on either side.
 */
export const binaryKernel = (expr: string) => /* wgsl */ `
struct P { n: u32, aLen: u32, bLen: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read> b: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  let x = a[i % p.aLen];
  let y = b[i % p.bLen];
  out[i] = ${expr};
}`;

/** Column sums of a (rows × cols) matrix: out[j] = Σ_i a[i][j]. One thread per column. */
export const sumRowsKernel = /* wgsl */ `
struct P { rows: u32, cols: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let j = gid.x;
  if (j >= p.cols) { return; }
  var s = 0.0;
  for (var i = 0u; i < p.rows; i++) { s += a[i * p.cols + j]; }
  out[j] = s;
}`;

/** Sum of all elements into out[0], by one workgroup with a shared-memory tree reduction. */
export const sumAllKernel = /* wgsl */ `
struct P { n: u32, scale: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
var<workgroup> part: array<f32, ${WG}>;
@compute @workgroup_size(${WG})
fn main(@builtin(local_invocation_id) lid: vec3u) {
  var s = 0.0;
  for (var i = lid.x; i < p.n; i += ${WG}u) { s += a[i]; }   // each thread sums a strided slice
  part[lid.x] = s;
  workgroupBarrier();
  for (var stride = ${WG / 2}u; stride > 0u; stride >>= 1u) {  // then halve the active threads each step
    if (lid.x < stride) { part[lid.x] += part[lid.x + stride]; }
    workgroupBarrier();
  }
  if (lid.x == 0u) { out[0] = part[0] * p.scale; }
}`;

/**
 * Fused softmax cross-entropy. One workgroup per row: parallel max and sum-of-exponentials by
 * tree reduction, then per-row loss and the gradient (softmax − onehot) · scale.
 */
export const crossEntropyKernel = /* wgsl */ `
struct P { rows: u32, cols: u32, scale: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> z: array<f32>;
@group(0) @binding(2) var<storage, read> y: array<u32>;
@group(0) @binding(3) var<storage, read_write> loss: array<f32>;
@group(0) @binding(4) var<storage, read_write> grad: array<f32>;
var<workgroup> red: array<f32, ${WG}>;
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let r = wg.x + wg.y * nw.x;
  if (r >= p.rows) { return; }
  let base = r * p.cols;
  var m = -3.0e38;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { m = max(m, z[base + j]); }
  red[lid.x] = m;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid.x < s) { red[lid.x] = max(red[lid.x], red[lid.x + s]); } workgroupBarrier(); }
  m = red[0];
  workgroupBarrier();
  var e = 0.0;
  for (var j = lid.x; j < p.cols; j += ${WG}u) { e += exp(z[base + j] - m); }
  red[lid.x] = e;
  workgroupBarrier();
  for (var s = ${WG / 2}u; s > 0u; s >>= 1u) { if (lid.x < s) { red[lid.x] += red[lid.x + s]; } workgroupBarrier(); }
  let sum = red[0];
  let t = y[r];
  for (var j = lid.x; j < p.cols; j += ${WG}u) {
    let q = exp(z[base + j] - m) / sum;
    grad[base + j] = (q - select(0.0, 1.0, j == t)) * p.scale;
  }
  if (lid.x == 0u) { loss[r] = log(sum) + m - z[base + t]; }
}`;

/** Row gather: out[i][k] = w[ids[i]][k]. */
export const embeddingKernel = /* wgsl */ `
struct P { n: u32, d: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> w: array<f32>;
@group(0) @binding(2) var<storage, read> ids: array<u32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n * p.d) { return; }
  let row = i / p.d;
  out[i] = w[ids[row] * p.d + i % p.d];
}`;

/**
 * Embedding backward without float atomics (core WebGPU has none): one thread per (vocab row,
 * feature) scans every id and sums the matching gradient rows. O(V·d·n) — fine for small vocabularies.
 */
export const embeddingBackwardKernel = /* wgsl */ `
struct P { n: u32, d: u32, v: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> g: array<f32>;
@group(0) @binding(2) var<storage, read> ids: array<u32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.v * p.d) { return; }
  let row = i / p.d;
  let k = i % p.d;
  var s = 0.0;
  for (var t = 0u; t < p.n; t++) { if (ids[t] == row) { s += g[t * p.d + k]; } }
  out[i] = s;
}`;

/** w ← w + α · g, in place (α = −lr is an SGD step; α = 1 accumulates a gradient). */
export const axpyKernel = /* wgsl */ `
struct P { n: u32, alpha: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> w: array<f32>;
@group(0) @binding(2) var<storage, read> g: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  w[i] = w[i] + p.alpha * g[i];
}`;

// ───────────── matrix multiplication ─────────────

/** Matmul uniform layout, shared by all variants. */
export const MATMUL_UNIFORM = /* wgsl */ `
struct D { M: u32, N: u32, K: u32, transA: u32, transB: u32, strideA: u32, strideB: u32, strideC: u32 }
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var<storage, read> A: array<f32>;
@group(0) @binding(2) var<storage, read> B: array<f32>;
@group(0) @binding(3) var<storage, read_write> C: array<f32>;
// Element (i, k) of op(A) for batch b, with zero padding outside the matrix.
fn getA(b: u32, i: u32, k: u32) -> f32 {
  if (i >= d.M || k >= d.K) { return 0.0; }
  if (d.transA == 1u) { return A[b * d.strideA + k * d.M + i]; }
  return A[b * d.strideA + i * d.K + k];
}
fn getB(b: u32, k: u32, j: u32) -> f32 {
  if (k >= d.K || j >= d.N) { return 0.0; }
  if (d.transB == 1u) { return B[b * d.strideB + j * d.K + k]; }
  return B[b * d.strideB + k * d.N + j];
}`;

/** Version 1: one thread per output element, reading straight from global memory. */
export const matmulNaiveKernel = /* wgsl */ `
${MATMUL_UNIFORM}
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y; let j = gid.x; let b = gid.z;
  if (i >= d.M || j >= d.N) { return; }
  var s = 0.0;
  for (var k = 0u; k < d.K; k++) { s += getA(b, i, k) * getB(b, k, j); }
  C[b * d.strideC + i * d.N + j] = s;
}`;

/** Version 2: 16×16 tiles staged in workgroup (shared) memory; each value is reused 16 times. */
export const matmulTiledKernel = /* wgsl */ `
${MATMUL_UNIFORM}
var<workgroup> As: array<f32, 256>;
var<workgroup> Bs: array<f32, 256>;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let i = gid.y; let j = gid.x; let b = gid.z;
  var s = 0.0;
  for (var k0 = 0u; k0 < d.K; k0 += 16u) {
    As[lid.y * 16u + lid.x] = getA(b, i, k0 + lid.x);
    Bs[lid.y * 16u + lid.x] = getB(b, k0 + lid.y, j);
    workgroupBarrier();
    for (var k = 0u; k < 16u; k++) { s += As[lid.y * 16u + k] * Bs[k * 16u + lid.x]; }
    workgroupBarrier();
  }
  if (i < d.M && j < d.N) { C[b * d.strideC + i * d.N + j] = s; }
}`;

/**
 * Version 3 (used by the library): 64×64 output tiles per workgroup, each of the 256 threads
 * accumulating a 4×4 block in registers. Every value loaded into shared memory is reused 64 times.
 */
export const matmulKernel = /* wgsl */ `
${MATMUL_UNIFORM}
const TS = 64u;
const TK = 16u;
var<workgroup> As: array<f32, 1024>;   // TS × TK
var<workgroup> Bs: array<f32, 1024>;   // TK × TS
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let b = wg.z;
  let row0 = wg.y * TS;
  let col0 = wg.x * TS;
  let tid = lid.y * 16u + lid.x;
  var acc: array<f32, 16>;
  for (var k0 = 0u; k0 < d.K; k0 += TK) {
    for (var l = 0u; l < 4u; l++) {
      let idx = tid + l * 256u;
      As[idx] = getA(b, row0 + idx / TK, k0 + idx % TK);
      Bs[idx] = getB(b, k0 + idx / TS, col0 + idx % TS);
    }
    workgroupBarrier();
    for (var k = 0u; k < TK; k++) {
      var av: array<f32, 4>;
      var bv: array<f32, 4>;
      for (var r = 0u; r < 4u; r++) { av[r] = As[(lid.y * 4u + r) * TK + k]; }
      for (var c = 0u; c < 4u; c++) { bv[c] = Bs[k * TS + lid.x * 4u + c]; }
      for (var r = 0u; r < 4u; r++) {
        for (var c = 0u; c < 4u; c++) { acc[r * 4u + c] = fma(av[r], bv[c], acc[r * 4u + c]); }
      }
    }
    workgroupBarrier();
  }
  for (var r = 0u; r < 4u; r++) {
    let i = row0 + lid.y * 4u + r;
    for (var c = 0u; c < 4u; c++) {
      let j = col0 + lid.x * 4u + c;
      if (i < d.M && j < d.N) { C[b * d.strideC + i * d.N + j] = acc[r * 4u + c]; }
    }
  }
}`;

/** SGD with momentum, in place: v ← μ·v + g;  w ← w − lr·v. */
export const momentumKernel = /* wgsl */ `
struct P { n: u32, lr: f32, mu: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> w: array<f32>;
@group(0) @binding(2) var<storage, read_write> v: array<f32>;
@group(0) @binding(3) var<storage, read> g: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  v[i] = p.mu * v[i] + g[i];
  w[i] = w[i] - p.lr * v[i];
}`;

/** Scale every element of g in place by min(1, maxNorm / norm), reading norm from a 1-element buffer. */
export const clipKernel = /* wgsl */ `
struct P { n: u32, maxNorm: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> g: array<f32>;
@group(0) @binding(2) var<storage, read> norm: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  g[i] = g[i] * min(1.0, p.maxNorm / (norm[0] + 1e-6));
}`;

/**
 * AdamW, in place (Chapter 13): m ← β₁m + (1−β₁)g;  v ← β₂v + (1−β₂)g²;
 * w ← w − lr·(m̂ / (√v̂ + ε) + λw), with bias corrections c1 = 1 − β₁ᵗ, c2 = 1 − β₂ᵗ.
 */
export const adamwKernel = /* wgsl */ `
struct P { n: u32, lr: f32, b1: f32, b2: f32, eps: f32, wd: f32, c1: f32, c2: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> w: array<f32>;
@group(0) @binding(2) var<storage, read_write> m: array<f32>;
@group(0) @binding(3) var<storage, read_write> v: array<f32>;
@group(0) @binding(4) var<storage, read> g: array<f32>;
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n) { return; }
  let gi = g[i];
  m[i] = p.b1 * m[i] + (1.0 - p.b1) * gi;
  v[i] = p.b2 * v[i] + (1.0 - p.b2) * gi * gi;
  let mh = m[i] / p.c1;
  let vh = v[i] / p.c2;
  w[i] = w[i] - p.lr * (mh / (sqrt(vh) + p.eps) + p.wd * w[i]);
}`;
