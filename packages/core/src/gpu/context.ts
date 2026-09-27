/**
 * A thin layer over a WebGPU device (Chapter 8): pooled storage buffers, cached pipelines and a
 * command encoder that batches every dispatch until something needs the results.
 *
 * Ordering rules this class relies on:
 *  - Dispatches recorded in one encoder run in order, so a buffer released back to the pool can be
 *    handed to a later dispatch in the same encoder without a hazard.
 *  - `queue.writeBuffer` is ordered against *submitted* work only, so `upload` flushes the pending
 *    encoder first. Uniforms avoid the queue entirely: each uses a small buffer mapped at creation.
 */

export const STORAGE = 0x80 | 0x4 | 0x8; // GPUBufferUsage.STORAGE | COPY_SRC | COPY_DST

/** Uniform field types: `u` = u32, `i` = i32, `f` = f32. */
export type UniformSpec = string;

export interface Dispatch {
  /** Kernel source; pipelines are cached per distinct string. */
  code: string;
  /** Uniform struct values at @binding(0), packed according to `spec` (padded to 16 bytes). */
  uniforms?: { spec: UniformSpec; values: readonly number[] };
  /** Storage buffers bound at @binding(1), @binding(2), … in order. */
  buffers: GPUBuffer[];
  /** Workgroup counts. */
  groups: [number, number?, number?];
  label?: string;
}

export class GpuContext {
  readonly device: GPUDevice;
  /** Held so the GPU instance is not garbage-collected while its device is in use (matters in Node). */
  private readonly instance: GPU | undefined;
  private pipelines = new Map<string, GPUComputePipeline>();
  private pool = new Map<number, GPUBuffer[]>();
  private encoder: GPUCommandEncoder | null = null;
  private transient: GPUBuffer[] = [];
  /** Counters, for the chapter's "what did that cost?" displays. */
  readonly stats = { dispatches: 0, submits: 0, allocated: 0, allocatedBytes: 0, reused: 0 };

  constructor(device: GPUDevice, instance?: GPU) {
    this.device = device;
    this.instance = instance;
  }

  /** Request an adapter and device from `gpu` (navigator.gpu in browsers; the `webgpu` package in Node). */
  static async create(gpu: GPU | undefined = globalThis.navigator?.gpu): Promise<GpuContext | null> {
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    });
    return new GpuContext(device, gpu);
  }

  // ───────────── buffers ─────────────

  /** A storage buffer of at least `bytes`, recycled from the pool when possible. Contents are undefined. */
  alloc(bytes: number): GPUBuffer {
    const size = bucket(bytes);
    const free = this.pool.get(size);
    const reused = free?.pop();
    if (reused) {
      this.stats.reused++;
      return reused;
    }
    this.stats.allocated++;
    this.stats.allocatedBytes += size;
    return this.device.createBuffer({ size, usage: STORAGE });
  }

  /** Return a buffer to the pool. Safe even if already-recorded dispatches still use it. */
  release(buffer: GPUBuffer): void {
    const list = this.pool.get(buffer.size);
    if (list) list.push(buffer);
    else this.pool.set(buffer.size, [buffer]);
  }

  /** Destroy every pooled buffer (frees GPU memory). */
  trim(): void {
    for (const list of this.pool.values()) for (const b of list) b.destroy();
    this.pool.clear();
  }

  /** Copy host data into a new (or given) storage buffer. */
  upload(data: Float32Array | Uint32Array | Int32Array, target?: GPUBuffer): GPUBuffer {
    this.flush();
    const buffer = target ?? this.alloc(data.byteLength);
    this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    return buffer;
  }

  /** Fill the first `bytes` of a buffer with zeros (recorded in order with dispatches). */
  clear(buffer: GPUBuffer, bytes = buffer.size): void {
    this.enc().clearBuffer(buffer, 0, align4(bytes));
  }

  /** Copy `bytes` from one buffer to another (recorded in order with dispatches). */
  copy(src: GPUBuffer, dst: GPUBuffer, bytes: number, srcOffset = 0, dstOffset = 0): void {
    this.enc().copyBufferToBuffer(src, srcOffset, dst, dstOffset, align4(bytes));
  }

  /** Read `bytes` back to the host. Submits all pending work and waits for it. */
  async read(buffer: GPUBuffer, bytes = buffer.size, offset = 0): Promise<ArrayBuffer> {
    const size = align4(bytes);
    const staging = this.device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.enc().copyBufferToBuffer(buffer, offset, staging, 0, size);
    this.flush();
    await staging.mapAsync(GPUMapMode.READ);
    const out = staging.getMappedRange().slice(0, bytes);
    staging.destroy();
    return out;
  }

  async readFloat32(buffer: GPUBuffer, length: number, offset = 0): Promise<Float32Array> {
    return new Float32Array(await this.read(buffer, length * 4, offset * 4));
  }

  // ───────────── kernels ─────────────

  pipeline(code: string): GPUComputePipeline {
    let p = this.pipelines.get(code);
    if (!p) {
      const module = this.device.createShaderModule({ code });
      p = this.device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      this.pipelines.set(code, p);
    }
    return p;
  }

  /** Record one compute dispatch into the pending command encoder. */
  run({ code, uniforms, buffers, groups, label }: Dispatch): void {
    const pipeline = this.pipeline(code);
    const entries: GPUBindGroupEntry[] = [];
    let binding = 0;
    if (uniforms) {
      const u = this.uniform(uniforms.spec, uniforms.values);
      entries.push({ binding: binding++, resource: { buffer: u } });
    }
    for (const b of buffers) entries.push({ binding: binding++, resource: { buffer: b } });
    const bindGroup = this.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
    const pass = this.enc().beginComputePass(label ? { label } : undefined);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(groups[0], groups[1] ?? 1, groups[2] ?? 1);
    pass.end();
    this.stats.dispatches++;
  }

  /** Submit everything recorded so far. */
  flush(): void {
    if (!this.encoder) return;
    this.device.queue.submit([this.encoder.finish()]);
    this.encoder = null;
    this.stats.submits++;
    // Destroying a buffer after submission is valid: the GPU frees it once the work completes.
    for (const b of this.transient) b.destroy();
    this.transient = [];
  }

  /** Submit pending work and resolve when the GPU has finished it. */
  async sync(): Promise<void> {
    // Mapping a buffer waits for all previously submitted work. (Equivalent to
    // queue.onSubmittedWorkDone(), which Dawn's Node bindings don't keep the process alive for.)
    const probe = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.enc().clearBuffer(probe);
    this.flush();
    await probe.mapAsync(GPUMapMode.READ);
    probe.destroy();
  }

  private enc(): GPUCommandEncoder {
    return (this.encoder ??= this.device.createCommandEncoder());
  }

  private uniform(spec: UniformSpec, values: readonly number[]): GPUBuffer {
    if (spec.length !== values.length) throw new Error(`uniform spec "${spec}" has ${spec.length} fields but got ${values.length} values`);
    const size = Math.max(16, Math.ceil((spec.length * 4) / 16) * 16);
    const buffer = this.device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM, mappedAtCreation: true });
    const range = buffer.getMappedRange();
    const u32 = new Uint32Array(range);
    const i32 = new Int32Array(range);
    const f32 = new Float32Array(range);
    for (let k = 0; k < spec.length; k++) {
      const t = spec[k];
      if (t === 'u') u32[k] = values[k]!;
      else if (t === 'i') i32[k] = values[k]!;
      else if (t === 'f') f32[k] = values[k]!;
      else throw new Error(`unknown uniform type "${t}" in "${spec}"`);
    }
    buffer.unmap();
    this.transient.push(buffer);
    return buffer;
  }
}

/** Workgroup counts for `n` threads of a 1-D kernel, split over x and y when n exceeds 65 535 groups. */
export function groups1d(n: number, workgroupSize = 256): [number, number] {
  const g = Math.max(1, Math.ceil(n / workgroupSize));
  const x = Math.min(g, 65535);
  return [x, Math.ceil(g / x)];
}

/** Pool buckets: powers of two up to 1 MiB, then multiples of 1 MiB. */
function bucket(bytes: number): number {
  const b = Math.max(16, align4(bytes));
  if (b <= 1 << 20) return 2 ** Math.ceil(Math.log2(b));
  return Math.ceil(b / (1 << 20)) * (1 << 20);
}

const align4 = (n: number) => Math.ceil(n / 4) * 4;
