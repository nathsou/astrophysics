import type { GpuContext } from '@lm/core/gpu';

/**
 * Sum all n elements of x into out[0] using ONE workgroup of 256 threads:
 *  1. each thread adds up a strided slice: x[t], x[t + 256], x[t + 512], …
 *  2. the 256 partial sums are combined by a tree reduction in workgroup memory:
 *     at each step, the first half of the active threads add in the second half.
 */
export const sumKernel = /* wgsl */ `
struct P { n: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
var<workgroup> part: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3u) {
  // TODO 1: strided partial sum into part[lid.x], then a barrier.

  // TODO 2: tree reduction — stride = 128, 64, …, 1 — with a barrier after every step.

  if (lid.x == 0u) { out[0] = part[0]; }
}`;

/** Sum a vector on the GPU with a single workgroup, and read the total back. */
export async function gpuSum(gpu: GpuContext, x: Float32Array): Promise<number> {
  const input = gpu.upload(x);
  const out = gpu.alloc(4);
  gpu.run({ code: sumKernel, uniforms: { spec: 'u', values: [x.length] }, buffers: [input, out], groups: [1] });
  const [total] = await gpu.readFloat32(out, 1);
  gpu.release(input);
  gpu.release(out);
  return total!;
}
