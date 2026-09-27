/**
 * A fused LSTM cell (Chapter 9): one kernel computes all four gates, the new cell state and the
 * new hidden state; one kernel computes the backward pass, recomputing the gates rather than
 * storing them. This is the same kernel fusion as Chapter 8’s softmax cross-entropy.
 */
import { groups1d } from './context.ts';
import { WG } from './kernels.ts';
import { GpuTensor, recordGpu } from './tensor.ts';

const GATES = /* wgsl */ `
fn sig(x: f32) -> f32 { return 1.0 / (1.0 + exp(-clamp(x, -30.0, 30.0))); }
fn th(x: f32) -> f32 { return 1.0 - 2.0 / (exp(2.0 * clamp(x, -15.0, 15.0)) + 1.0); }
struct P { B: u32, H: u32 }
@group(0) @binding(0) var<uniform> p: P;
`;

const forwardKernel = /* wgsl */ `${GATES}
@group(0) @binding(1) var<storage, read> z: array<f32>;       // (B, 4H): pre-activations of i, f, o, g
@group(0) @binding(2) var<storage, read> c: array<f32>;       // (B, H): previous cell state
@group(0) @binding(3) var<storage, read_write> s: array<f32>; // (2B, H): new h (rows 0..B), new c (rows B..2B)
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let k = gid.x + gid.y * nw.x * ${WG}u;
  if (k >= p.B * p.H) { return; }
  let b = k / p.H; let j = k % p.H; let r = b * 4u * p.H;
  let i = sig(z[r + j]); let f = sig(z[r + p.H + j]); let o = sig(z[r + 2u * p.H + j]); let g = th(z[r + 3u * p.H + j]);
  let cn = f * c[k] + i * g;
  s[k] = o * th(cn);
  s[p.B * p.H + k] = cn;
}`;

const backwardKernel = /* wgsl */ `${GATES}
@group(0) @binding(1) var<storage, read> z: array<f32>;
@group(0) @binding(2) var<storage, read> c: array<f32>;
@group(0) @binding(3) var<storage, read> gs: array<f32>;       // gradient of s: (2B, H)
@group(0) @binding(4) var<storage, read_write> gz: array<f32>;  // (B, 4H)
@group(0) @binding(5) var<storage, read_write> gc: array<f32>;  // (B, H)
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let k = gid.x + gid.y * nw.x * ${WG}u;
  if (k >= p.B * p.H) { return; }
  let b = k / p.H; let j = k % p.H; let r = b * 4u * p.H;
  let i = sig(z[r + j]); let f = sig(z[r + p.H + j]); let o = sig(z[r + 2u * p.H + j]); let g = th(z[r + 3u * p.H + j]);
  let cn = f * c[k] + i * g;
  let tc = th(cn);
  let dh = gs[k];
  let dc = gs[p.B * p.H + k] + dh * o * (1.0 - tc * tc);   // through h = o·tanh(c′), plus c′’s own gradient
  gz[r + j] = dc * g * i * (1.0 - i);
  gz[r + p.H + j] = dc * c[k] * f * (1.0 - f);
  gz[r + 2u * p.H + j] = dh * tc * o * (1.0 - o);
  gz[r + 3u * p.H + j] = dc * i * (1.0 - g * g);
  gc[k] = dc * f;
}`;

/**
 * One LSTM step. `z` holds the gate pre-activations [i | f | o | g] for each row (B, 4H), `c` the
 * previous cell state (B, H). Returns (2B, H): the new hidden state in rows 0..B and the new cell
 * state in rows B..2B (split them with `sliceRows`).
 */
export function lstmCell(z: GpuTensor, c: GpuTensor): GpuTensor {
  const [B, H4] = z.shape as [number, number];
  const H = H4 / 4;
  if (c.shape[0] !== B || c.shape[1] !== H) throw new Error(`lstmCell: z [${z.shape}] and c [${c.shape}] do not match`);
  const ctx = z.ctx;
  const s = GpuTensor.empty(ctx, [2 * B, H]);
  ctx.run({ code: forwardKernel, uniforms: { spec: 'uu', values: [B, H] }, buffers: [z.buffer, c.buffer, s.buffer], groups: groups1d(B * H) });
  return recordGpu(s, 'lstmCell', [z, c], (gs) => {
    const gz = GpuTensor.empty(ctx, z.shape);
    const gc = GpuTensor.empty(ctx, c.shape);
    ctx.run({ code: backwardKernel, uniforms: { spec: 'uu', values: [B, H] }, buffers: [z.buffer, c.buffer, gs.buffer, gz.buffer, gc.buffer], groups: groups1d(B * H) });
    return [gz, gc];
  });
}
