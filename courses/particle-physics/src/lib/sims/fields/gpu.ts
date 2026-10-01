/**
 * OPTIONAL WebGPU backend for the 2D U(1) lattice gauge Monte Carlo. The CPU path in `hep/fields/u1lattice.ts` is complete and
 * is what the widget uses unless the reader asks for the GPU; this lets the same Metropolis update run on a 256 × 256 lattice.
 *
 * The links of one direction μ and one parity of the transverse coordinate never share a plaquette, so all of them can be updated
 * at once: one sweep is four dispatches (μ = x or y, parity even or odd). Random numbers come from a PCG hash of
 * (link, sweep, class, try, seed). The update is the same Metropolis step as on the CPU, in single precision.
 *
 * Nothing here runs at import time; `gpuAvailable()` is safe on the server.
 */

// Minimal structural types so that no WebGPU typings are needed.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export function gpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Any).gpu;
}

const WGSL = /* wgsl */ `
struct Params { L: u32, cls: u32, sweep: u32, hits: u32, beta: f32, delta: f32, seed: u32, pad: u32 };
@group(0) @binding(0) var<storage, read_write> th: array<f32>;
@group(0) @binding(1) var<uniform> P: Params;

fn pcg(v: u32) -> u32 {
  let state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
fn at(x: i32, y: i32, mu: u32) -> f32 {
  let L = i32(P.L);
  let xx = u32(((x % L) + L) % L);
  let yy = u32(((y % L) + L) % L);
  return th[(yy * P.L + xx) * 2u + mu];
}
const PI: f32 = 3.14159265358979;

@compute @workgroup_size(64)
fn update(@builtin(global_invocation_id) gid: vec3<u32>) {
  let L = P.L;
  let half = L / 2u;
  let id = gid.x;
  if (id >= L * half) { return; }
  let mu = P.cls >> 1u;
  let par = P.cls & 1u;
  let a = id % L;
  let k = id / L;
  let b = 2u * k + par;
  var x: i32;
  var y: i32;
  if (mu == 0u) { x = i32(a); y = i32(b); } else { x = i32(b); y = i32(a); }
  let nu = 1u - mu;
  let mvx = i32(1u - mu);
  let mvy = i32(mu);
  let nvx = i32(mu);
  let nvy = i32(1u - mu);
  let s1 = at(x + mvx, y + mvy, nu) - at(x + nvx, y + nvy, mu) - at(x, y, nu);
  let s2 = at(x - nvx, y - nvy, mu) + at(x + mvx - nvx, y + mvy - nvy, nu) - at(x - nvx, y - nvy, nu);
  let zr = cos(s1) + cos(s2);
  let zi = sin(s1) - sin(s2);
  let R = sqrt(zr * zr + zi * zi);
  let psi = atan2(zi, zr);
  let idx = (u32(y) * L + u32(x)) * 2u + mu;
  var t = th[idx];
  var e = cos(t + psi);
  var state = pcg(idx ^ pcg(P.sweep * 4u + P.cls + pcg(P.seed)));
  for (var h = 0u; h < P.hits; h = h + 1u) {
    state = pcg(state);
    let u1 = f32(state >> 8u) * (1.0 / 16777216.0);
    state = pcg(state);
    let u2 = f32(state >> 8u) * (1.0 / 16777216.0);
    let tn = t + P.delta * (2.0 * u1 - 1.0);
    let en = cos(tn + psi);
    let dS = P.beta * R * (en - e);
    if (dS >= 0.0 || u2 < exp(dS)) { t = tn; e = en; }
  }
  // wrap to (−π, π]
  if (t > PI) { t = t - 2.0 * PI; }
  if (t <= -PI) { t = t + 2.0 * PI; }
  th[idx] = t;
}
`;

export class GpuU1 {
  readonly L: number;
  private device: Any;
  private pipeline: Any;
  private links: Any;
  private staging: Any;
  private uniforms: Any[] = [];
  private bind: Any[] = [];
  private sweepCount = 0;
  private seed: number;
  private busy = false;

  private constructor(L: number, seed: number) {
    this.L = L;
    this.seed = seed >>> 0;
  }

  /** Create a GPU lattice (L even, at least 4) with a cold start, or throw if WebGPU is not usable. */
  static async create(L: number, seed = 1): Promise<GpuU1> {
    if (!gpuAvailable()) throw new Error('WebGPU is not available');
    if (L % 2 || L < 4) throw new Error('GpuU1: L must be even');
    const gpu = (navigator as Any).gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    const g = new GpuU1(L, seed);
    g.device = device;
    const module = device.createShaderModule({ code: WGSL });
    g.pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'update' } });
    const bytes = 2 * L * L * 4;
    // GPUBufferUsage flags: STORAGE 0x80, COPY_SRC 0x4, COPY_DST 0x8, UNIFORM 0x40, MAP_READ 0x1
    g.links = device.createBuffer({ size: bytes, usage: 0x80 | 0x4 | 0x8 });
    g.staging = device.createBuffer({ size: bytes, usage: 0x1 | 0x8 });
    device.queue.writeBuffer(g.links, 0, new Float32Array(2 * L * L));
    for (let c = 0; c < 4; c++) {
      const u = device.createBuffer({ size: 32, usage: 0x40 | 0x8 });
      g.uniforms.push(u);
      g.bind.push(
        device.createBindGroup({
          layout: g.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: g.links } },
            { binding: 1, resource: { buffer: u } },
          ],
        }),
      );
    }
    return g;
  }

  /** Set all links to zero (cold start). */
  cold(): void {
    this.device.queue.writeBuffer(this.links, 0, new Float32Array(2 * this.L * this.L));
    this.sweepCount = 0;
  }

  /** Run `n` Metropolis sweeps (each link gets `hits` proposals of size δ). Submitted to the queue; returns immediately. */
  sweeps(n: number, beta: number, delta: number, hits = 2): void {
    const { device, L } = this;
    const groups = Math.ceil((L * (L / 2)) / 64);
    for (let s = 0; s < n; s++) {
      const buf = new ArrayBuffer(32);
      const u = new Uint32Array(buf);
      const f = new Float32Array(buf);
      for (let c = 0; c < 4; c++) {
        u[0] = L; u[1] = c; u[2] = this.sweepCount; u[3] = hits; f[4] = beta; f[5] = delta; u[6] = this.seed; u[7] = 0;
        device.queue.writeBuffer(this.uniforms[c], 0, buf);
      }
      // the four classes must see one another's updates: separate passes in one encoder, all with this sweep's parameters
      const enc = device.createCommandEncoder();
      for (let c = 0; c < 4; c++) {
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bind[c]);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }
      device.queue.submit([enc.finish()]);
      this.sweepCount++;
    }
  }

  /** Read the link angles back (single precision). Only one read-back may be in flight. */
  async read(): Promise<Float32Array | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      const { device } = this;
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(this.links, 0, this.staging, 0, 2 * this.L * this.L * 4);
      device.queue.submit([enc.finish()]);
      await this.staging.mapAsync(0x1);
      const out = new Float32Array(this.staging.getMappedRange().slice(0));
      this.staging.unmap();
      return out;
    } finally {
      this.busy = false;
    }
  }

  destroy(): void {
    try {
      this.links?.destroy();
      this.staging?.destroy();
      for (const u of this.uniforms) u.destroy();
      this.device?.destroy();
    } catch {
      /* already gone */
    }
  }
}
