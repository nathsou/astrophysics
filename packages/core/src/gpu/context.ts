/**
 * A thin layer over a WebGPU device (Chapter 8): pooled storage buffers, cached pipelines and a
 * command encoder that batches every dispatch until something needs the results.
 *
 * Ordering rules this class relies on:
 *  - Dispatches recorded in one encoder run in order, so a buffer released back to the pool can be
 *    handed to a later dispatch in the same encoder without a hazard.
 *  - `queue.writeBuffer` is ordered after all *previously submitted* work but before anything
 *    submitted later. So `upload` flushes the pending encoder first, and the uniform ring (below) is
 *    written just before the encoder that uses it is submitted.
 *
 * Recording a dispatch costs CPU time, which dominates for small kernels (an RNN step is dozens of
 * them). Three things keep it low: uniforms live in one ring buffer bound with dynamic offsets,
 * bind groups are cached, and consecutive dispatches share one compute pass.
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
  private pass: GPUComputePassEncoder | null = null;
  private transient: GPUBuffer[] = [];
  private layouts = new Map<GPUComputePipeline, { layout: GPUBindGroupLayout; uniform: boolean; id: number }>();
  private bindGroups = new Map<string, GPUBindGroup>();
  private bufferIds = new WeakMap<GPUBuffer, number>();
  private nextId = 1;
  // Uniform ring: one 256-byte slot per dispatch, copied to the GPU when the encoder is submitted.
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformStaging = new ArrayBuffer(UNIFORM_SLOTS * UNIFORM_SLOT);
  private uniformSlot = 0;
  /** Counters, for the chapter's "what did that cost?" displays. */
  readonly stats = { dispatches: 0, submits: 0, allocated: 0, allocatedBytes: 0, reused: 0 };

  constructor(device: GPUDevice, instance?: GPU) {
    this.device = device;
    this.instance = instance;
    this.uniformBuffer = device.createBuffer({ size: UNIFORM_SLOTS * UNIFORM_SLOT, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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
    this.flush();
    for (const list of this.pool.values()) for (const b of list) b.destroy();
    this.pool.clear();
    this.bindGroups.clear();
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
    this.endPass();
    this.enc().clearBuffer(buffer, 0, align4(bytes));
  }

  /** Copy `bytes` from one buffer to another (recorded in order with dispatches). */
  copy(src: GPUBuffer, dst: GPUBuffer, bytes: number, srcOffset = 0, dstOffset = 0): void {
    this.endPass();
    this.enc().copyBufferToBuffer(src, srcOffset, dst, dstOffset, align4(bytes));
  }

  /** Read `bytes` back to the host. Submits all pending work and waits for it. */
  async read(buffer: GPUBuffer, bytes = buffer.size, offset = 0): Promise<ArrayBuffer> {
    const size = align4(bytes);
    const staging = this.device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.endPass();
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
      const { layout, uniform } = bindingLayout(this.device, code);
      const module = this.device.createShaderModule({ code });
      p = this.device.createComputePipeline({ layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module, entryPoint: 'main' } });
      this.pipelines.set(code, p);
      this.layouts.set(p, { layout, uniform, id: this.pipelines.size });
    }
    return p;
  }

  /** Record one compute dispatch into the pending command encoder. */
  run({ code, uniforms, buffers, groups }: Dispatch): void {
    const pipeline = this.pipeline(code);
    const info = this.layouts.get(pipeline)!;
    if (info.uniform !== !!uniforms) throw new Error(info.uniform ? 'this kernel expects uniforms' : 'this kernel takes no uniforms');
    if (uniforms && this.uniformSlot >= UNIFORM_SLOTS) this.flush();
    // Bind groups are cached by pipeline and buffers; the pool hands out the same buffers step after step.
    let key = String(info.id);
    for (const b of buffers) key += ',' + this.idOf(b);
    let bindGroup = this.bindGroups.get(key);
    if (!bindGroup) {
      const entries: GPUBindGroupEntry[] = [];
      let binding = 0;
      if (info.uniform) entries.push({ binding: binding++, resource: { buffer: this.uniformBuffer, size: UNIFORM_SLOT } });
      for (const b of buffers) entries.push({ binding: binding++, resource: { buffer: b } });
      bindGroup = this.device.createBindGroup({ layout: info.layout, entries });
      if (this.bindGroups.size > 50_000) this.bindGroups.clear();
      this.bindGroups.set(key, bindGroup);
    }
    this.pass ??= this.enc().beginComputePass();
    this.pass.setPipeline(pipeline);
    if (uniforms) {
      this.writeUniforms(uniforms.spec, uniforms.values, this.uniformSlot * UNIFORM_SLOT);
      this.pass.setBindGroup(0, bindGroup, [this.uniformSlot * UNIFORM_SLOT]);
      this.uniformSlot++;
    } else {
      this.pass.setBindGroup(0, bindGroup);
    }
    this.pass.dispatchWorkgroups(groups[0], groups[1] ?? 1, groups[2] ?? 1);
    this.stats.dispatches++;
  }

  /** Submit everything recorded so far. */
  flush(): void {
    if (!this.encoder) return;
    this.endPass();
    if (this.uniformSlot > 0) this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformStaging, 0, this.uniformSlot * UNIFORM_SLOT);
    this.device.queue.submit([this.encoder.finish()]);
    this.encoder = null;
    this.uniformSlot = 0;
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
    this.endPass();
    this.enc().clearBuffer(probe);
    this.flush();
    await probe.mapAsync(GPUMapMode.READ);
    probe.destroy();
  }

  private endPass(): void {
    this.pass?.end();
    this.pass = null;
  }

  private idOf(b: GPUBuffer): number {
    let id = this.bufferIds.get(b);
    if (id === undefined) this.bufferIds.set(b, (id = this.nextId++));
    return id;
  }

  private enc(): GPUCommandEncoder {
    return (this.encoder ??= this.device.createCommandEncoder());
  }

  private writeUniforms(spec: UniformSpec, values: readonly number[], offset: number): void {
    if (spec.length !== values.length) throw new Error(`uniform spec "${spec}" has ${spec.length} fields but got ${values.length} values`);
    if (spec.length * 4 > UNIFORM_SLOT) throw new Error('uniform struct larger than 256 bytes');
    const u32 = new Uint32Array(this.uniformStaging, offset, spec.length);
    const i32 = new Int32Array(this.uniformStaging, offset, spec.length);
    const f32 = new Float32Array(this.uniformStaging, offset, spec.length);
    for (let k = 0; k < spec.length; k++) {
      const t = spec[k];
      if (t === 'u') u32[k] = values[k]!;
      else if (t === 'i') i32[k] = values[k]!;
      else if (t === 'f') f32[k] = values[k]!;
      else throw new Error(`unknown uniform type "${t}" in "${spec}"`);
    }
  }
}

const UNIFORM_SLOT = 256; // minUniformBufferOffsetAlignment
const UNIFORM_SLOTS = 4096;

/**
 * The bind-group layout a kernel needs, read off its declarations: an optional uniform at binding 0
 * (bound with a dynamic offset into the uniform ring), then read-only or read–write storage buffers.
 */
function bindingLayout(device: GPUDevice, code: string): { layout: GPUBindGroupLayout; uniform: boolean } {
  const entries: GPUBindGroupLayoutEntry[] = [];
  let uniform = false;
  const re = /@group\(0\)\s*@binding\((\d+)\)\s*var<(uniform|storage)(?:\s*,\s*(read_write|read))?>/g;
  for (const m of code.matchAll(re)) {
    const binding = Number(m[1]);
    if (m[2] === 'uniform') {
      uniform = true;
      entries.push({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } });
    } else {
      entries.push({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: m[3] === 'read_write' ? 'storage' : 'read-only-storage' } });
    }
  }
  return { layout: device.createBindGroupLayout({ entries }), uniform };
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
