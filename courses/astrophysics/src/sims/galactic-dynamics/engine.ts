// GPU plumbing shared by the Chapter 22 N-body figures: particle buffers, the leapfrog/force compute
// passes (nbody.wgsl), additive sprite rendering into an HDR target (render.wgsl) and tonemapping (tone.wgsl).

import nbodyCode from './nbody.wgsl?raw';
import renderCode from './render.wgsl?raw';
import toneCode from './tone.wgsl?raw';

export const MAXSUB = 8;
const UNI = 256; // uniform block stride (dynamic offsets must be 256-byte aligned)
const HDR: GPUTextureFormat = 'rgba16float';

/** Rigid potential description for one timestep: two Hernquist halo+bulge pairs at given centres. */
export interface Rigid {
  c0: ArrayLike<number>; c1: ArrayLike<number>;
  h0: [number, number, number, number]; // halo mass, halo scale, bulge mass, bulge scale
  h1: [number, number, number, number];
}

export interface Look {
  pointSize: number;  // world units
  minPx: number;      // device pixels
  brightness: number;
  colorMode: number;  // 0 galaxy, 1 population, 2 speed
  speedScale: number;
  exposure?: number;
  bg?: [number, number, number];
}

async function check(m: GPUShaderModule, name: string) {
  if (!import.meta.env.DEV) return;
  const info = await m.getCompilationInfo();
  for (const msg of info.messages) if (msg.type === 'error') console.error(`[${name}] ${msg.lineNum}:${msg.linePos} ${msg.message}`);
}

export class NBodyEngine {
  n = 0;
  nSrc = 0;
  eps = 0.1;
  private simBGL: GPUBindGroupLayout;
  private kickDrift: GPUComputePipeline;
  private forcePipe: GPUComputePipeline;
  private drawPipe: GPURenderPipeline;
  private tonePipe: GPURenderPipeline;
  private simUni: GPUBuffer;
  private viewUni: GPUBuffer;
  private toneUni: GPUBuffer;
  private simData = new ArrayBuffer(UNI * MAXSUB);
  private simF = new Float32Array(this.simData);
  private simU = new Uint32Array(this.simData);
  private viewData = new Float32Array(24);
  private pos: GPUBuffer | null = null;
  private vel: GPUBuffer | null = null;
  private acc: GPUBuffer | null = null;
  private attr: GPUBuffer | null = null;
  private simBG: GPUBindGroup | null = null;
  private drawBG: GPUBindGroup | null = null;
  private hdr: GPUTexture | null = null;
  private toneBG: GPUBindGroup | null = null;
  private allocated = 0;
  private pending = 0;

  constructor(private device: GPUDevice, format: GPUTextureFormat) {
    const nbodyMod = device.createShaderModule({ code: nbodyCode, label: 'gd-nbody' });
    const renderMod = device.createShaderModule({ code: renderCode, label: 'gd-render' });
    const toneMod = device.createShaderModule({ code: toneCode, label: 'gd-tone' });
    check(nbodyMod, 'nbody'); check(renderMod, 'render'); check(toneMod, 'tone');
    const st = (): GPUBindGroupLayoutEntry['buffer'] => ({ type: 'storage' });
    this.simBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 80 } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: st() },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: st() },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: st() },
      ],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.simBGL] });
    this.kickDrift = device.createComputePipeline({ layout, compute: { module: nbodyMod, entryPoint: 'kickDrift' } });
    this.forcePipe = device.createComputePipeline({ layout, compute: { module: nbodyMod, entryPoint: 'force' } });
    const add: GPUBlendComponent = { srcFactor: 'one', dstFactor: 'one', operation: 'add' };
    this.drawPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: renderMod, entryPoint: 'vs' },
      fragment: { module: renderMod, entryPoint: 'fs', targets: [{ format: HDR, blend: { color: add, alpha: add } }] },
      primitive: { topology: 'triangle-list' },
    });
    this.tonePipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: toneMod, entryPoint: 'vsFull' },
      fragment: { module: toneMod, entryPoint: 'fsTone', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.simUni = device.createBuffer({ size: UNI * MAXSUB, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.viewUni = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.toneUni = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  /** Upload particles (pos.w = gravitating mass; the first nSrc entries must be the sources). */
  upload(pos: Float32Array, vel: Float32Array, attr: Float32Array, nSrc: number, eps: number) {
    const n = pos.length / 4;
    const d = this.device;
    if (this.allocated !== n) {
      for (const b of [this.pos, this.vel, this.acc, this.attr]) b?.destroy();
      const mk = () => d.createBuffer({ size: n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
      this.pos = mk(); this.vel = mk(); this.acc = mk(); this.attr = mk();
      this.simBG = d.createBindGroup({
        layout: this.simBGL,
        entries: [
          { binding: 0, resource: { buffer: this.simUni, size: 80 } },
          { binding: 1, resource: { buffer: this.pos } },
          { binding: 2, resource: { buffer: this.vel } },
          { binding: 3, resource: { buffer: this.acc } },
        ],
      });
      this.drawBG = d.createBindGroup({
        layout: this.drawPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.viewUni } },
          { binding: 1, resource: { buffer: this.pos } },
          { binding: 2, resource: { buffer: this.vel } },
          { binding: 3, resource: { buffer: this.attr } },
        ],
      });
      this.allocated = n;
    }
    this.n = n; this.nSrc = nSrc; this.eps = eps;
    d.queue.writeBuffer(this.pos!, 0, pos);
    d.queue.writeBuffer(this.vel!, 0, vel);
    d.queue.writeBuffer(this.attr!, 0, attr);
  }

  /** Queue the rigid potential and timestep for substep k (k < MAXSUB) of the next `encode`. */
  setStep(k: number, dt: number, R: Rigid) {
    const o = (k * UNI) / 4, F = this.simF;
    F[o] = R.c0[0]; F[o + 1] = R.c0[1]; F[o + 2] = R.c0[2]; F[o + 3] = R.h0[0];
    F[o + 4] = R.c1[0]; F[o + 5] = R.c1[1]; F[o + 6] = R.c1[2]; F[o + 7] = R.h1[0];
    F[o + 8] = R.h0[1]; F[o + 9] = R.h0[2]; F[o + 10] = R.h0[3]; F[o + 11] = 0;
    F[o + 12] = R.h1[1]; F[o + 13] = R.h1[2]; F[o + 14] = R.h1[3]; F[o + 15] = 0;
    F[o + 16] = dt; F[o + 17] = this.eps * this.eps;
    this.simU[o + 18] = this.n; this.simU[o + 19] = this.nSrc;
    this.pending = Math.max(this.pending, k + 1);
  }

  /** Encode the queued substeps. If `primeOnly`, run only the force pass (dt = 0) to fill accelerations. */
  encode(enc: GPUCommandEncoder, primeOnly = false) {
    const steps = this.pending;
    if (!steps || !this.simBG) return;
    this.device.queue.writeBuffer(this.simUni, 0, this.simData, 0, UNI * steps);
    const pass = enc.beginComputePass();
    const wg = Math.ceil(this.n / 256);
    for (let k = 0; k < steps; k++) {
      pass.setBindGroup(0, this.simBG, [k * UNI]);
      if (!primeOnly) { pass.setPipeline(this.kickDrift); pass.dispatchWorkgroups(wg); }
      pass.setPipeline(this.forcePipe);
      pass.dispatchWorkgroups(wg);
    }
    pass.end();
    this.pending = 0;
  }

  resize(w: number, h: number) {
    this.hdr?.destroy();
    this.hdr = this.device.createTexture({ size: [Math.max(1, w), Math.max(1, h)], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.toneBG = this.device.createBindGroup({
      layout: this.tonePipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: this.hdr.createView() }, { binding: 1, resource: { buffer: this.toneUni } }],
    });
  }

  draw(enc: GPUCommandEncoder, target: GPUTextureView, viewProj: Float32Array, w: number, h: number, L: Look) {
    if (!this.drawBG || !this.hdr) return;
    const v = this.viewData;
    v.set(viewProj, 0);
    v[16] = w; v[17] = h; v[18] = L.pointSize; v[19] = L.minPx;
    v[20] = L.brightness; v[21] = L.colorMode; v[22] = L.speedScale; v[23] = 0;
    this.device.queue.writeBuffer(this.viewUni, 0, v);
    const bg = L.bg ?? [0.0012, 0.0016, 0.0035];
    this.device.queue.writeBuffer(this.toneUni, 0, new Float32Array([L.exposure ?? 1, ...bg]));
    const p1 = enc.beginRenderPass({ colorAttachments: [{ view: this.hdr.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
    p1.setPipeline(this.drawPipe);
    p1.setBindGroup(0, this.drawBG);
    p1.draw(6, this.n);
    p1.end();
    const p2 = enc.beginRenderPass({ colorAttachments: [{ view: target, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    p2.setPipeline(this.tonePipe);
    p2.setBindGroup(0, this.toneBG!);
    p2.draw(3);
    p2.end();
  }

  /** Copy positions back to the CPU (verification/debugging only). */
  async readPositions(): Promise<Float32Array> {
    const size = this.n * 16;
    const rb = this.device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = this.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.pos!, 0, rb, 0, size);
    this.device.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(rb.getMappedRange().slice(0));
    rb.destroy();
    return out;
  }

  destroy() {
    for (const b of [this.pos, this.vel, this.acc, this.attr, this.simUni, this.viewUni, this.toneUni]) b?.destroy();
    this.hdr?.destroy();
  }
}
