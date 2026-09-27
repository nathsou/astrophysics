/**
 * Inference for the GPT of Chapter 11 (Chapter 16): a KV cache, so each new token costs one position's
 * work instead of the whole context's, and optional int8 weight-only quantisation.
 *
 *   const run = await GptRunner.create(model, { int8: true });
 *   const cache = run.cache();
 *   let logits = run.forward(cache, promptIds);   // prefill: the whole prompt at once
 *   logits = run.forward(cache, [nextId]);        // decode: one token at a time
 *
 * The cache stores every layer's keys and values for the positions seen so far. Rolling it back
 * (speculative decoding) is just `cache.length = n`: later entries are overwritten when reused.
 */
import { groups1d, type GpuContext } from './context.ts';
import type { Gpt } from './gpt.ts';
import { WG } from './kernels.ts';
import { GpuIds, embedding } from './nn.ts';
import { gelu, layerNorm, matmulT } from './layers.ts';
import { GpuTensor, noGradGpu, scope, sliceRows } from './tensor.ts';

/** Longest context the cached-attention kernel supports (its scores live in workgroup memory). */
export const MAX_CACHED_CONTEXT = 2048;

const attendCachedKernel = /* wgsl */ `
struct P { tq: u32, len: u32, C: u32, d: u32, heads: u32, scale: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> q: array<f32>;
@group(0) @binding(2) var<storage, read> K: array<f32>;
@group(0) @binding(3) var<storage, read> V: array<f32>;
@group(0) @binding(4) var<storage, read_write> out: array<f32>;
var<workgroup> s: array<f32, ${MAX_CACHED_CONTEXT}>;
var<workgroup> red: array<f32, ${WG}>;
// One workgroup per (new token r, head h). Token r sits at position len − tq + r and attends to
// positions 0 … that position, whose keys and values are rows of the cache (row stride C).
@compute @workgroup_size(${WG})
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let job = wg.x + wg.y * nw.x;
  if (job >= p.tq * p.heads) { return; }
  let r = job / p.heads;
  let h = job % p.heads;
  let n = p.len - p.tq + r + 1u;
  let qb = r * p.C + h * p.d;
  // 1. Scores q·kⱼ / √d.
  for (var j = lid.x; j < n; j += ${WG}u) {
    var dot = 0.0;
    for (var c = 0u; c < p.d; c++) { dot += q[qb + c] * K[j * p.C + h * p.d + c]; }
    s[j] = dot * p.scale;
  }
  workgroupBarrier();
  // 2. Their maximum…
  var m = -3.0e38;
  for (var j = lid.x; j < n; j += ${WG}u) { m = max(m, s[j]); }
  red[lid.x] = m;
  workgroupBarrier();
  for (var k = ${WG / 2}u; k > 0u; k >>= 1u) { if (lid.x < k) { red[lid.x] = max(red[lid.x], red[lid.x + k]); } workgroupBarrier(); }
  m = red[0];
  workgroupBarrier();
  // 3. …exponentials and their sum…
  var e = 0.0;
  for (var j = lid.x; j < n; j += ${WG}u) { let w = exp(s[j] - m); s[j] = w; e += w; }
  red[lid.x] = e;
  workgroupBarrier();
  for (var k = ${WG / 2}u; k > 0u; k >>= 1u) { if (lid.x < k) { red[lid.x] += red[lid.x + k]; } workgroupBarrier(); }
  let sum = red[0];
  // 4. …and the weighted sum of values, one output dimension per thread.
  for (var c = lid.x; c < p.d; c += ${WG}u) {
    var acc = 0.0;
    for (var j = 0u; j < n; j++) { acc += s[j] * V[j * p.C + h * p.d + c]; }
    out[qb + c] = acc / sum;
  }
}`;

/** Attention of `q` (tq, C) — the newest tq positions — over the first `len` rows of the caches. */
export function attendCached(q: GpuTensor, K: GpuTensor, V: GpuTensor, len: number, heads: number): GpuTensor {
  const [tq, C] = q.shape as [number, number];
  if (len > MAX_CACHED_CONTEXT) throw new Error(`cached attention supports at most ${MAX_CACHED_CONTEXT} positions`);
  const d = C / heads;
  const out = GpuTensor.empty(q.ctx, [tq, C]);
  const jobs = tq * heads, gx = Math.min(jobs, 65535);
  q.ctx.run({
    code: attendCachedKernel,
    uniforms: { spec: 'uuuuuf', values: [tq, len, C, d, heads, 1 / Math.sqrt(d)] },
    buffers: [q.buffer, K.buffer, V.buffer, out.buffer],
    groups: [gx, Math.ceil(jobs / gx)],
  });
  return out;
}

// Weight-only int8 matmuls, organised for decoding (few rows): each output's sum over K is split across
// threads and combined in workgroup memory, and neighbouring threads read neighbouring bytes of the weights.
const INT8_COMMON = /* wgsl */ `
struct P { M: u32, N: u32, K: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> w: array<u32>;
@group(0) @binding(3) var<storage, read> scale: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
var<workgroup> part: array<f32, 256>;
// Byte i of the packed weights, sign-extended: four signed bytes per u32, byte j of word k is element 4k + j.
fn q8(i: u32) -> f32 {
  let word = w[i >> 2u];
  return f32(i32(word << (24u - 8u * (i & 3u))) >> 24u);
}`;

/** W stored (K, N): 32 output columns × 8 slices of K per workgroup; row m of x is workgroup y. */
const int8MatmulKernel = /* wgsl */ `${INT8_COMMON}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let col = lid.x % 32u;
  let lane = lid.x / 32u;
  let n = wg.x * 32u + col;
  let m = wg.y;
  var acc = 0.0;
  if (n < p.N) {
    for (var k = lane; k < p.K; k += 8u) { acc += x[m * p.K + k] * q8(k * p.N + n); }
  }
  part[lid.x] = acc;
  workgroupBarrier();
  if (lane == 0u && n < p.N) {
    var s = 0.0;
    for (var l = 0u; l < 8u; l++) { s += part[l * 32u + col]; }
    y[m * p.N + n] = s * scale[n];
  }
}`;

/** W stored (N, K) — the tied embedding used as h·Wᵀ: 8 outputs × 32 lanes, each lane reading whole words. */
const int8MatmulTKernel = /* wgsl */ `${INT8_COMMON}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let lane = lid.x % 32u;
  let n = wg.x * 8u + lid.x / 32u;
  let m = wg.y;
  var acc = 0.0;
  if (n < p.N) {
    let words = p.K / 4u;
    for (var j = lane; j < words; j += 32u) {
      let word = w[n * words + j];
      let k = 4u * j;
      acc += x[m * p.K + k] * f32(i32(word << 24u) >> 24u)
           + x[m * p.K + k + 1u] * f32(i32(word << 16u) >> 24u)
           + x[m * p.K + k + 2u] * f32(i32(word << 8u) >> 24u)
           + x[m * p.K + k + 3u] * f32(i32(word) >> 24u);
    }
  }
  part[lid.x] = acc;
  workgroupBarrier();
  for (var s = 16u; s > 0u; s >>= 1u) {
    if (lane < s) { part[lid.x] += part[lid.x + s]; }
    workgroupBarrier();
  }
  if (lane == 0u && n < p.N) { y[m * p.N + n] = part[lid.x] * scale[n]; }
}`;

// The same two layouts in float32: matrix–vector products for decoding, where the general tiled matmul
// (built for large matrices) would launch too few workgroups to keep the GPU busy.
const F32_COMMON = /* wgsl */ `
struct P { M: u32, N: u32, K: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read> w: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
var<workgroup> part: array<f32, 256>;`;

const gemvKernel = /* wgsl */ `${F32_COMMON}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let col = lid.x % 32u;
  let lane = lid.x / 32u;
  let n = wg.x * 32u + col;
  let m = wg.y;
  var acc = 0.0;
  if (n < p.N) {
    for (var k = lane; k < p.K; k += 8u) { acc += x[m * p.K + k] * w[k * p.N + n]; }
  }
  part[lid.x] = acc;
  workgroupBarrier();
  if (lane == 0u && n < p.N) {
    var s = 0.0;
    for (var l = 0u; l < 8u; l++) { s += part[l * 32u + col]; }
    y[m * p.N + n] = s;
  }
}`;

const gemvTKernel = /* wgsl */ `${F32_COMMON}
@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) lid: vec3u) {
  let lane = lid.x % 32u;
  let n = wg.x * 8u + lid.x / 32u;
  let m = wg.y;
  var acc = 0.0;
  if (n < p.N) {
    for (var k = lane; k < p.K; k += 32u) { acc += x[m * p.K + k] * w[n * p.K + k]; }
  }
  part[lid.x] = acc;
  workgroupBarrier();
  for (var s = 16u; s > 0u; s >>= 1u) {
    if (lane < s) { part[lid.x] += part[lid.x + s]; }
    workgroupBarrier();
  }
  if (lane == 0u && n < p.N) { y[m * p.N + n] = part[lid.x]; }
}`;

/** Rows up to which decoding uses the matrix–vector kernels instead of the general matmul. */
const GEMV_ROWS = 16;

/** x (M, K) times w (K, N), or times wᵀ for w (N, K) with `transB`, for small M. */
function gemv(x: GpuTensor, w: GpuTensor, transB: boolean): GpuTensor {
  const [M, K] = x.shape as [number, number];
  const N = transB ? w.shape[0]! : w.shape[1]!;
  const y = GpuTensor.empty(x.ctx, [M, N]);
  x.ctx.run({
    code: transB ? gemvTKernel : gemvKernel,
    uniforms: { spec: 'uuu', values: [M, N, K] },
    buffers: [x.buffer, w.buffer, y.buffer],
    groups: [Math.ceil(N / (transB ? 8 : 32)), M],
  });
  return y;
}

const int8EmbeddingKernel = /* wgsl */ `
struct P { n: u32, C: u32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> ids: array<u32>;
@group(0) @binding(2) var<storage, read> w: array<u32>;
@group(0) @binding(3) var<storage, read> scale: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<f32>;
fn q8(i: u32) -> f32 {
  let word = w[i >> 2u];
  return f32(i32(word << (24u - 8u * (i & 3u))) >> 24u);
}
@compute @workgroup_size(${WG})
fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = gid.x + gid.y * nw.x * ${WG}u;
  if (i >= p.n * p.C) { return; }
  let row = ids[i / p.C];
  y[i] = q8(row * p.C + i % p.C) * scale[row];
}`;

/**
 * A matrix quantised to int8 with one float32 scale per output: for a (K, N) weight used as x·W, per
 * column; for the (V, C) token embedding, used as h·Wᵀ and looked up by row, per row.
 */
export class Int8Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly perRow: boolean;
  readonly packed: GPUBuffer;
  readonly scales: GPUBuffer;
  readonly ctx: GpuContext;

  constructor(ctx: GpuContext, values: Float32Array, rows: number, cols: number, perRow: boolean) {
    this.ctx = ctx;
    this.rows = rows;
    this.cols = cols;
    this.perRow = perRow;
    const { q, scale } = quantiseInt8(values, rows, cols, perRow);
    this.packed = ctx.upload(new Uint32Array(q.buffer, q.byteOffset, q.length / 4));
    this.scales = ctx.upload(scale);
  }

  get bytes(): number {
    return this.rows * this.cols + 4 * (this.perRow ? this.rows : this.cols);
  }

  dispose(): void {
    this.ctx.release(this.packed);
    this.ctx.release(this.scales);
  }
}

/**
 * Symmetric absmax quantisation: each group (a column, or a row with `perRow`) is scaled so its
 * largest magnitude maps to 127, then rounded. Returns the int8 values (row-major) and the scales.
 */
export function quantiseInt8(w: Float32Array, rows: number, cols: number, perRow: boolean): { q: Int8Array; scale: Float32Array } {
  const groups = perRow ? rows : cols;
  const scale = new Float32Array(groups);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const g = perRow ? r : c;
    scale[g] = Math.max(scale[g]!, Math.abs(w[r * cols + c]!));
  }
  for (let g = 0; g < groups; g++) scale[g] = scale[g]! / 127 || 1;
  const q = new Int8Array(rows * cols + ((4 - ((rows * cols) % 4)) % 4));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) q[r * cols + c] = Math.round(w[r * cols + c]! / scale[perRow ? r : c]!);
  return { q, scale };
}

function int8Matmul(x: GpuTensor, w: Int8Matrix): GpuTensor {
  const [M, K] = x.shape as [number, number];
  const transB = w.perRow; // the embedding: (V, C) used as h·Wᵀ
  const N = transB ? w.rows : w.cols;
  if (K !== (transB ? w.cols : w.rows)) throw new Error(`int8 matmul: [${x.shape}] against a ${w.rows}×${w.cols} matrix`);
  if (M > 65535 || (transB && K % 4 !== 0)) throw new Error('int8 matmul: unsupported shape');
  const y = GpuTensor.empty(x.ctx, [M, N]);
  x.ctx.run({
    code: transB ? int8MatmulTKernel : int8MatmulKernel,
    uniforms: { spec: 'uuu', values: [M, N, K] },
    buffers: [x.buffer, w.packed, w.scales, y.buffer],
    groups: [Math.ceil(N / (transB ? 8 : 32)), M],
  });
  return y;
}

function int8Embedding(w: Int8Matrix, ids: GpuIds): GpuTensor {
  const y = GpuTensor.empty(w.ctx, [ids.length, w.cols]);
  w.ctx.run({ code: int8EmbeddingKernel, uniforms: { spec: 'uu', values: [ids.length, w.cols] }, buffers: [ids.buffer, w.packed, w.scales, y.buffer], groups: groups1d(ids.length * w.cols) });
  return y;
}

/** Every layer's keys and values for the positions processed so far. */
export class KvCache {
  readonly k: GpuTensor[];
  readonly v: GpuTensor[];
  readonly capacity: number;
  /** Number of valid positions. Set it lower to discard the most recent ones. */
  length = 0;

  constructor(ctx: GpuContext, layers: number, capacity: number, width: number) {
    this.capacity = capacity;
    this.k = Array.from({ length: layers }, () => noGradGpu(() => GpuTensor.zeros(ctx, [capacity, width])));
    this.v = Array.from({ length: layers }, () => noGradGpu(() => GpuTensor.zeros(ctx, [capacity, width])));
  }

  get bytes(): number {
    return 2 * this.k.length * this.capacity * (this.k[0]?.shape[1] ?? 0) * 4;
  }

  dispose(): void {
    [...this.k, ...this.v].forEach((t) => t.dispose());
  }
}

/** Runs a trained `Gpt` for generation: cached, optionally with int8 weights (`GptRunner.create`). */
export class GptRunner {
  readonly model: Gpt;
  private readonly q = new Map<string, Int8Matrix>();
  private readonly ctx: GpuContext;

  constructor(model: Gpt) {
    this.model = model;
    this.ctx = model.named.get('tok')!.ctx;
  }

  /**
   * A runner whose 2-D matrices (including the tied embedding) are int8; norms and position embeddings
   * stay float32, being tiny. The weights are read back from the GPU to be quantised on the CPU.
   */
  static async create(model: Gpt, opts: { int8?: boolean } = {}): Promise<GptRunner> {
    const runner = new GptRunner(model);
    if (!opts.int8) return runner;
    for (const [name, { shape, data }] of await model.state()) {
      if (name === 'pos' || shape.length !== 2) continue;
      runner.q.set(name, new Int8Matrix(runner.ctx, data, shape[0]!, shape[1]!, name === 'tok'));
    }
    return runner;
  }

  get int8(): boolean {
    return this.q.size > 0;
  }

  /** Bytes of weights read per token: what bounds decoding speed. */
  get weightBytes(): number {
    let total = 0;
    for (const [name, p] of this.model.named) total += this.q.get(name)?.bytes ?? p.size * 4;
    return total;
  }

  cache(capacity = this.model.cfg.T): KvCache {
    return new KvCache(this.ctx, this.model.cfg.layers, capacity, this.model.cfg.C);
  }

  private p(name: string): GpuTensor {
    return this.model.named.get(name)!;
  }

  private linear(x: GpuTensor, name: string): GpuTensor {
    const q = this.q.get(name);
    if (q) return int8Matmul(x, q);
    return x.shape[0]! <= GEMV_ROWS ? gemv(x, this.p(name), false) : x.matmul(this.p(name));
  }

  /**
   * Feed `ids` (the next tokens) through the model, appending their keys and values to the cache.
   * Returns the logits for the last position (1, V), or for every new position with `all`.
   */
  forward(cache: KvCache, ids: number[], opts: { all?: boolean } = {}): GpuTensor {
    const { C, layers, heads, mlp, norm } = this.model.cfg;
    const t0 = cache.length, n = ids.length;
    if (t0 + n > cache.capacity) throw new Error(`the cache holds ${cache.capacity} positions; ${t0 + n} needed`);
    const idBuf = new GpuIds(this.ctx, ids);
    const posBuf = new GpuIds(this.ctx, Array.from({ length: n }, (_, i) => t0 + i));
    const ln = (x: GpuTensor, name: string) => (norm ? layerNorm(x, this.p(`${name}.g`), this.p(`${name}.b`)) : x);
    try {
      return noGradGpu(() =>
        scope(() => {
          const tok = this.q.get('tok');
          let x = (tok ? int8Embedding(tok, idBuf) : embedding(this.p('tok'), idBuf)).add(embedding(this.p('pos'), posBuf));
          for (let l = 0; l < layers; l++) {
            const a = ln(x, `h${l}.ln1`);
            const q = this.linear(a, `h${l}.attn.q`), k = this.linear(a, `h${l}.attn.k`), v = this.linear(a, `h${l}.attn.v`);
            this.ctx.copy(k.buffer, cache.k[l]!.buffer, n * C * 4, 0, t0 * C * 4);
            this.ctx.copy(v.buffer, cache.v[l]!.buffer, n * C * 4, 0, t0 * C * 4);
            x = x.add(this.linear(attendCached(q, cache.k[l]!, cache.v[l]!, t0 + n, heads), `h${l}.attn.o`));
            if (mlp) x = x.add(this.linear(gelu(this.linear(ln(x, `h${l}.ln2`), `h${l}.mlp.fc`)), `h${l}.mlp.proj`));
          }
          const h = ln(x, 'lnf');
          const last = opts.all ? h : sliceRows(h, n - 1, 1);
          if (tok) return int8Matmul(last, tok);
          return last.shape[0]! <= GEMV_ROWS ? gemv(last, this.p('tok'), true) : matmulT(last, this.p('tok'));
        }),
      );
    } finally {
      cache.length = t0 + n;
      idBuf.dispose();
      posBuf.dispose();
    }
  }

  dispose(): void {
    this.q.forEach((m) => m.dispose());
  }
}
