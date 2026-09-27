import type { GpuContext } from '@lm/core/gpu';

const HEADER = /* wgsl */ `
struct D { M: u32, N: u32, K: u32 }
@group(0) @binding(0) var<uniform> d: D;
@group(0) @binding(1) var<storage, read> A: array<f32>;       // M × K, row-major
@group(0) @binding(2) var<storage, read> B: array<f32>;       // K × N
@group(0) @binding(3) var<storage, read_write> C: array<f32>; // M × N
// Elements of A and B, or 0 outside the matrices (so edge tiles need no special cases).
fn getA(i: u32, k: u32) -> f32 { if (i < d.M && k < d.K) { return A[i * d.K + k]; } return 0.0; }
fn getB(k: u32, j: u32) -> f32 { if (k < d.K && j < d.N) { return B[k * d.N + j]; } return 0.0; }
`;

/** For reference: one thread per element of C, every operand read from global memory. */
export const naiveKernel = /* wgsl */ `${HEADER}
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y; let j = gid.x;
  if (i >= d.M || j >= d.N) { return; }
  var s = 0.0;
  for (var k = 0u; k < d.K; k++) { s += getA(i, k) * getB(k, j); }
  C[i * d.N + j] = s;
}`;

/**
 * The same product, but the 256 threads of a workgroup cooperate: for each 16-wide slice of K,
 * they load a 16×16 tile of A and one of B into workgroup memory, then every thread reads its
 * 16 multiply–adds from there. Each global load now feeds 16 multiply–adds instead of one.
 */
export const tiledKernel = /* wgsl */ `${HEADER}
var<workgroup> As: array<f32, 256>;
var<workgroup> Bs: array<f32, 256>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let i = gid.y; let j = gid.x;
  let ly = lid.y; let lx = lid.x;
  var s = 0.0;
  for (var k0 = 0u; k0 < d.K; k0 += 16u) {
    // TODO: load one element of each tile, synchronise, accumulate 16 products, synchronise.
  }
  // TODO: write s — but only if (i, j) is inside C. (No early return above: every thread must reach every barrier.)
}`;

/** C = A · B for row-major A (M × K) and B (K × N). */
export async function matmul(gpu: GpuContext, A: Float32Array, B: Float32Array, M: number, K: number, N: number, code = tiledKernel): Promise<Float32Array> {
  const a = gpu.upload(A), b = gpu.upload(B), c = gpu.alloc(M * N * 4);
  gpu.run({ code, uniforms: { spec: 'uuu', values: [M, N, K] }, buffers: [a, b, c], groups: [Math.ceil(N / 16), Math.ceil(M / 16)] });
  const out = await gpu.readFloat32(c, M * N);
  for (const x of [a, b, c]) gpu.release(x);
  return out;
}
