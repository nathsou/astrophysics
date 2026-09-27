import type { GpuContext } from '@lm/core/gpu';

/**
 * WGSL for out[i] = a · x[i] + y[i] ("saxpy", the hello-world of GPU computing).
 * Bindings: 0 = uniforms { n, a }, 1 = x, 2 = y, 3 = out. One thread per element.
 */
export const saxpyKernel = /* wgsl */ `
struct P { n: u32, a: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> y: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  // TODO: compute this thread's element — and do nothing if it is past the end of the arrays.
}`;

/** Run the kernel on the GPU and read the result back. */
export async function saxpy(gpu: GpuContext, a: number, x: Float32Array, y: Float32Array): Promise<Float32Array> {
  const n = x.length;
  // TODO: upload x and y, allocate the output, dispatch enough workgroups of 256 threads, read back.
  return new Float32Array(n);
}
