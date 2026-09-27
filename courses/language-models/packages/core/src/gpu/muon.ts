/**
 * Muon (Jordan et al., 2024) for 2-D weight matrices (Chapter 13): momentum, then orthogonalise the
 * update with five Newton–Schulz iterations, so that every direction of the matrix moves by the same
 * amount. Other parameters (embeddings, norm gains) should use AdamW.
 */
import { groups1d } from './context.ts';
import { permute } from './attention.ts';
import { matmulT } from './layers.ts';
import { GpuTensor, noGradGpu, scope } from './tensor.ts';

const NS = { a: 3.4445, b: -4.775, c: 2.0315 };

/** Approximately U Vᵀ for a matrix G = U S Vᵀ, by the quintic Newton–Schulz iteration. No readback. */
export function newtonSchulz(G: GpuTensor, steps = 5): GpuTensor {
  return noGradGpu(() => {
    const [m, n] = G.shape as [number, number];
    const tall = m > n;
    let X = tall ? permute(G, [1, 0]) : G; // the wide orientation keeps X Xᵀ the smaller product
    const norm = X.mul(X).sum();
    X = X.binaryRaw(norm, 'x / (sqrt(y) + 1e-7)'); // every singular value now ≤ 1
    for (let i = 0; i < steps; i++) {
      const A = matmulT(X, X);
      const B = A.scale(NS.b).add(A.matmul(A).scale(NS.c));
      X = X.scale(NS.a).add(B.matmul(X));
    }
    return tall ? permute(X, [1, 0]) : X;
  });
}

const muonKernel = /* wgsl */ `
struct P { n: u32, lr: f32, wd: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> w: array<f32>;
@group(0) @binding(2) var<storage, read> o: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * 256u;
  if (i >= p.n) { return; }
  w[i] = w[i] * (1.0 - p.lr * p.wd) - p.lr * o[i];
}`;

const nesterovKernel = /* wgsl */ `
struct P { n: u32, mu: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read_write> buf: array<f32>;
@group(0) @binding(2) var<storage, read> g: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * 256u;
  if (i >= p.n) { return; }
  buf[i] = p.mu * buf[i] + g[i];
  out[i] = g[i] + p.mu * buf[i];   // Nesterov: look ahead along the momentum
}`;

export class GpuMuon {
  readonly params: GpuTensor[];
  lr: number;
  readonly momentum: number;
  weightDecay: number;
  private readonly buffers: GPUBuffer[];

  constructor(params: GpuTensor[], opts: { lr: number; momentum?: number; weightDecay?: number }) {
    for (const p of params) if (p.ndim !== 2) throw new Error(`Muon is for 2-D matrices; got [${p.shape}]`);
    this.params = params;
    this.lr = opts.lr;
    this.momentum = opts.momentum ?? 0.95;
    this.weightDecay = opts.weightDecay ?? 0;
    this.buffers = params.map((p) => {
      const b = p.ctx.alloc(p.size * 4);
      p.ctx.clear(b, p.size * 4);
      return b;
    });
  }

  step(): void {
    scope(() => {
      this.params.forEach((p, i) => {
        if (!p.grad) return;
        const ctx = p.ctx;
        const look = GpuTensor.empty(ctx, p.shape);
        ctx.run({ code: nesterovKernel, uniforms: { spec: 'uf', values: [p.size, this.momentum] }, buffers: [this.buffers[i]!, p.grad.buffer, look.buffer], groups: groups1d(p.size) });
        const O = newtonSchulz(look);
        // Scale so that updates have a similar size for any matrix shape (Jordan et al.).
        const [m, n] = p.shape as [number, number];
        const lr = this.lr * Math.sqrt(Math.max(1, m / n));
        ctx.run({ code: muonKernel, uniforms: { spec: 'uff', values: [p.size, lr, this.weightDecay] }, buffers: [p.buffer, O.buffer], groups: groups1d(p.size) });
      });
    });
  }

  zeroGrad(): void {
    for (const p of this.params) p.zeroGrad();
  }

  dispose(): void {
    this.buffers.forEach((b, i) => this.params[i]!.ctx.release(b));
  }
}
