// Chapter 28 flagship: a particle-mesh (PM) cosmological N-body simulation on the GPU.
// Gaussian initial conditions from a BBKS ΛCDM P(k) (optionally with a WDM cutoff), Zel'dovich start
// at z = 50, then cloud-in-cell deposit → 3D FFT → Poisson → inverse FFT → 4-point gradient →
// CIC force interpolation → kick-drift-kick leapfrog in a. Everything runs in compute shaders.
// Code units: mesh cells for length, 1/H0 for time, p = a² dx/dt.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { PLANCK, E, growth, normalise, wdmAlpha } from './structure/cosmo';
import pmSrc from './structure/pm.wgsl?raw';
import fftSrc from './structure/fft.wgsl?raw';
import renderSrc from './structure/render.wgsl?raw';

const BOX = 160; // Mpc/h
const A_START = 1 / 51;
const N_STEPS = 160;
const MSCALE = 1 << 15; // fixed-point mass units per particle (max ~131k particles per cell)
const { Om, OL } = PLANCK;

type Quality = '64' | '128';
type DM = 'cdm' | 'wdm1' | 'wdm05';
const DM_MASS: Record<DM, number> = { cdm: 0, wdm1: 0.1, wdm05: 0.05 };

function checkShader(device: GPUDevice, code: string, label: string) {
  const m = device.createShaderModule({ code, label });
  if (import.meta.env.DEV) {
    m.getCompilationInfo().then((info) => {
      for (const msg of info.messages) if (msg.type === 'error') console.error(`[${label}] ${msg.lineNum}:${msg.linePos} ${msg.message}`);
    });
  }
  return m;
}

/** Simpson integral of f over [a0, a1]. */
function simpson(f: (a: number) => number, a0: number, a1: number, n = 8) {
  const h = (a1 - a0) / n;
  let s = f(a0) + f(a1);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a0 + i * h);
  return (s * h) / 3;
}

export default defineSim({
  gpu: true,
  async mount({ host, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    const { ctx, format } = configureCanvas(stage.canvas, device);
    const G = growth(Om, OL);
    const D1 = G.D(1);
    const Dn = (a: number) => G.D(a) / D1; // normalised to D(1) = 1

    // ---------- state ----------
    let quality: Quality = host.clientWidth < 600 ? '64' : '128';
    let sigma8 = PLANCK.sigma8, ns = PLANCK.ns, dm: DM = 'cdm', seed = 7, colourMode = 0;
    let step = 0, aNow = A_START;
    const sStart = Math.sqrt(A_START), dS = (1 - sStart) / N_STEPS; // steps uniform in √a
    const aOf = (n: number) => (sStart + n * dS) ** 2;

    // ---------- pipelines ----------
    const pmModule = checkShader(device, pmSrc, 'structure-pm');
    const bgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ...[1, 2, 3, 4, 5, 6].map((b) => ({ binding: b, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' as const } })),
      ],
    });
    const pmLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
    const kernels = ['noise', 'shape', 'zeldo', 'setp', 'clear', 'deposit', 'toc', 'poisson', 'grad', 'kick', 'drift'] as const;
    const pipe = Object.fromEntries(kernels.map((k) => [k, device.createComputePipeline({ layout: pmLayout, compute: { module: pmModule, entryPoint: k } })])) as Record<(typeof kernels)[number], GPUComputePipeline>;

    const fftPipes = new Map<number, GPUComputePipeline>();
    const fftPipe = (ng: number) => {
      let p = fftPipes.get(ng);
      if (!p) {
        const code = fftSrc.replace('NGu', `${ng}u`).replace('LOGNu', `${Math.log2(ng)}u`);
        p = device.createComputePipeline({ layout: 'auto', compute: { module: checkShader(device, code, `structure-fft-${ng}`), entryPoint: 'main' } });
        fftPipes.set(ng, p);
      }
      return p;
    };

    const rModule = checkShader(device, renderSrc, 'structure-render');
    const additive: GPUBlendState = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
    const HDR: GPUTextureFormat = 'rgba16float';
    const ptsPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: rModule, entryPoint: 'vs' },
      fragment: { module: rModule, entryPoint: 'fs', targets: [{ format: HDR, blend: additive }] },
      primitive: { topology: 'triangle-strip' },
    });
    const boxPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: rModule, entryPoint: 'vsBox' },
      fragment: { module: rModule, entryPoint: 'fsBox', targets: [{ format: HDR, blend: additive }] },
      primitive: { topology: 'line-list' },
    });
    const tonePipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: rModule, entryPoint: 'vsFull' },
      fragment: { module: rModule, entryPoint: 'fsTone', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    // ---------- buffers (per quality) ----------
    const paramBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const renderBuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const pArr = new ArrayBuffer(80), pU = new Uint32Array(pArr), pF = new Float32Array(pArr);
    const rArr = new Float32Array(32);

    interface Res {
      ng: number; n: number; bufs: GPUBuffer[];
      pm: GPUBindGroup; fft: GPUBindGroup[]; fftUni: GPUBuffer[];
      pts: GPUBindGroup; box: GPUBindGroup;
    }
    let res: Res | null = null;

    function build(ng: number) {
      free();
      const n = ng ** 3;
      const S = GPUBufferUsage.STORAGE;
      const mk = (bytes: number) => device.createBuffer({ size: bytes, usage: S });
      const pos = mk(n * 16), vel = mk(n * 16), rho = mk(n * 4), cx = mk(n * 8), kb = mk(n * 8), frc = mk(n * 16);
      const pm = device.createBindGroup({
        layout: bgl,
        entries: [paramBuf, pos, vel, rho, cx, kb, frc].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      const fp = fftPipe(ng);
      const fftUni: GPUBuffer[] = [], fft: GPUBindGroup[] = [];
      for (const sign of [-1, 1]) for (let axis = 0; axis < 3; axis++) {
        const u = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const a = new ArrayBuffer(16);
        new Uint32Array(a)[0] = axis; new Float32Array(a)[1] = sign;
        device.queue.writeBuffer(u, 0, a);
        fftUni.push(u);
        fft.push(device.createBindGroup({ layout: fp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: { buffer: cx } }] }));
      }
      const pts = device.createBindGroup({
        layout: ptsPipe.getBindGroupLayout(0),
        entries: [renderBuf, pos, vel, rho].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      const box = device.createBindGroup({ layout: boxPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: renderBuf } }] });
      res = { ng, n, bufs: [pos, vel, rho, cx, kb, frc], pm, fft, fftUni, pts, box };
    }
    function free() {
      if (!res) return;
      for (const b of [...res.bufs, ...res.fftUni]) b.destroy();
      res = null;
    }

    // ---------- params ----------
    const P = {
      seed: 0, axis: 0, kick: 0, drift: 0, pois: 0, dScale: 0, vScale: 0, amp: 0,
      ns: 1, gamma: PLANCK.Gamma, wdm: 0, smooth: 0.5,
    };
    function writeParams() {
      const r = res!;
      pU[0] = r.ng; pU[1] = r.n; pU[2] = P.seed; pU[3] = P.axis;
      pF[4] = P.kick; pF[5] = P.drift; pF[6] = P.pois; pF[7] = P.dScale;
      pF[8] = P.vScale; pF[9] = P.amp; pF[10] = P.ns; pF[11] = P.gamma;
      pF[12] = BOX / r.ng; pF[13] = P.wdm; pF[14] = 1 / r.n; pF[15] = MSCALE;
      pF[16] = P.smooth; pU[17] = r.n; pF[18] = 0; pF[19] = 0;
      device.queue.writeBuffer(paramBuf, 0, pArr);
    }

    const groups = () => Math.ceil(res!.n / 256);
    function run(pass: GPUComputePassEncoder, k: keyof typeof pipe) {
      pass.setPipeline(pipe[k]);
      pass.setBindGroup(0, res!.pm);
      pass.dispatchWorkgroups(groups());
    }
    function fft3(pass: GPUComputePassEncoder, inverse: boolean) {
      const ng = res!.ng;
      pass.setPipeline(fftPipe(ng));
      for (let axis = 0; axis < 3; axis++) {
        pass.setBindGroup(0, res!.fft[(inverse ? 3 : 0) + axis]);
        pass.dispatchWorkgroups(ng, ng);
      }
    }
    // One gravity solve: particles → ρ → δ_k → φ_k → φ → g on the mesh.
    function encodeForce(pass: GPUComputePassEncoder) {
      run(pass, 'clear'); run(pass, 'deposit'); run(pass, 'toc');
      fft3(pass, false);
      run(pass, 'poisson');
      fft3(pass, true);
      run(pass, 'grad');
    }
    function submit(body: (pass: GPUComputePassEncoder) => void) {
      writeParams();
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      body(pass);
      pass.end();
      device.queue.submit([enc.finish()]);
    }

    function initialConditions() {
      const ng = quality === '64' ? 64 : 128;
      if (!res || res.ng !== ng) build(ng);
      const alpha = DM_MASS[dm] ? wdmAlpha(DM_MASS[dm]) : 0;
      Object.assign(P, {
        seed, ns, wdm: alpha, amp: normalise(sigma8, ns, PLANCK.Gamma, alpha),
        dScale: Dn(A_START),
        // p = a² dx/dt = a³ H dD/da ψ0, with dD/da = f D / a
        vScale: A_START ** 3 * E(A_START, Om, OL) * (G.f(A_START) * Dn(A_START)) / A_START,
      });
      submit((p) => { run(p, 'noise'); fft3(p, false); run(p, 'shape'); });
      for (let axis = 0; axis < 3; axis++) {
        P.axis = axis;
        submit((p) => { run(p, 'zeldo'); fft3(p, true); run(p, 'setp'); });
      }
      P.axis = 0;
      P.pois = (1.5 * Om) / A_START;
      submit(encodeForce);
      step = 0; aNow = A_START;
      done = false;
    }

    const kickInt = (a0: number, a1: number) => simpson((a) => 1 / (a * E(a, Om, OL)), a0, a1);
    const driftInt = (a0: number, a1: number) => simpson((a) => 1 / (a * a * a * E(a, Om, OL)), a0, a1);

    // Kick–drift–kick leapfrog in a (steps uniform in √a).
    function advance() {
      const a0 = aOf(step), a1 = aOf(step + 1), ah = (sStart + (step + 0.5) * dS) ** 2;
      P.kick = kickInt(a0, ah); P.drift = driftInt(a0, a1); P.pois = (1.5 * Om) / a1;
      submit((p) => { run(p, 'kick'); run(p, 'drift'); encodeForce(p); });
      P.kick = kickInt(ah, a1);
      submit((p) => run(p, 'kick'));
      step++; aNow = a1;
    }

    // ---------- rendering ----------
    const cam = new OrbitCamera(stage.canvas, { distance: 3.3, pitch: 0.42, yaw: 0.7, autoRotate: 0.06, minDistance: 0.4, maxDistance: 8 });
    let hdr: GPUTexture | null = null, toneBG: GPUBindGroup | null = null;
    function ensureHDR() {
      const w = stage.canvas.width, h = stage.canvas.height;
      if (hdr && hdr.width === w && hdr.height === h) return;
      hdr?.destroy();
      hdr = device.createTexture({ size: [w, h], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      toneBG = device.createBindGroup({ layout: tonePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: hdr.createView() }] });
    }

    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;left:12px;top:10px;font:13px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#dfe6f5;text-shadow:0 1px 3px #000;';
    stage.overlay.append(label);

    let done = false;
    function render(_alpha: number, frameDt: number) {
      if (!res) return;
      cam.update(frameDt || 1 / 60);
      ensureHDR();
      const aspect = stage.canvas.width / stage.canvas.height;
      const vp = cam.viewProj(aspect);
      const proj = cam.projMatrix(aspect);
      rArr.set(vp, 0);
      const ng = res.ng;
      rArr[16] = proj[0]; rArr[17] = proj[5];
      rArr[18] = (2 / ng) * 0.7;
      rArr[19] = 0.16 * (64 / ng) ** 1.5 * Math.min(1.4, 3.3 / cam.distance);
      rArr[20] = ng; rArr[21] = colourMode; rArr[22] = aNow; rArr[23] = BOX / ng;
      rArr[24] = MSCALE; rArr[25] = 2 / ng;
      device.queue.writeBuffer(renderBuf, 0, rArr);

      const enc = device.createCommandEncoder();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: hdr!.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
      rp.setPipeline(boxPipe); rp.setBindGroup(0, res.box); rp.draw(24);
      rp.setPipeline(ptsPipe); rp.setBindGroup(0, res.pts); rp.draw(4, res.n);
      rp.end();
      const tp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      tp.setPipeline(tonePipe); tp.setBindGroup(0, toneBG!); tp.draw(3);
      tp.end();
      device.queue.submit([enc.finish()]);

      const z = 1 / aNow - 1;
      label.innerHTML = `z = ${z < 10 ? z.toFixed(2) : z.toFixed(1)}&nbsp;&nbsp;a = ${aNow.toFixed(3)}<br>` +
        `<span style="opacity:.7">t ≈ ${fmt(ageGyr(aNow), 3)} Gyr · ${res.ng}³ particles · ${BOX} Mpc/h box</span>` +
        (done ? '<br><span style="opacity:.8">Today (z = 0). Reset or change a parameter.</span>' : '');
      zOut.set(z.toFixed(2));
      dOut.set(`${fmt(Dn(aNow) / Dn(A_START), 3)}×`);
    }

    // Cosmic time since the Big Bang (Gyr) for flat ΛCDM, H0 = 100h km/s/Mpc.
    const ageGyr = (a: number) => {
      const tH = 977.8 / (100 * PLANCK.h); // 1/H0 in Gyr
      return tH * (2 / (3 * Math.sqrt(OL))) * Math.asinh(Math.sqrt((OL / Om) * a * a * a));
    };

    const loop = new Loop(() => {
      if (done || !res) return;
      advance();
      if (step >= N_STEPS) { done = true; aNow = 1; }
    }, render, 1 / 26);
    loop.maxSteps = 2;
    cam.onChange = () => loop.invalidate();
    stage.onResize(() => loop.invalidate());

    // ---------- controls ----------
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const restart = () => { initialConditions(); loop.invalidate(); };
    panel.button('Reset', restart);
    panel.button('New seed', () => { seed = (seed * 16807 + 11) % 2147483647 % 100000; restart(); });
    panel.slider('σ₈', { min: 0.3, max: 1.4, value: sigma8, step: 0.01 }, (v) => { sigma8 = v; restart(); });
    panel.slider('Tilt nₛ', { min: 0.6, max: 1.4, value: ns, step: 0.005 }, (v) => { ns = v; restart(); });
    panel.select<DM>('Dark matter', [
      { value: 'cdm', label: 'Cold (CDM)' },
      { value: 'wdm1', label: 'Warm, 0.1 keV (toy)' },
      { value: 'wdm05', label: 'Warm, 0.05 keV (toy)' },
    ], dm, (v) => { dm = v; restart(); });
    panel.select<Quality>('Quality', [
      { value: '64', label: '64³ mesh, 262k particles' },
      { value: '128', label: '128³ mesh, 2.1M particles' },
    ], quality, (v) => { quality = v; restart(); });
    panel.select('Colour', [{ value: '0', label: 'Density' }, { value: '1', label: 'Speed' }], '0', (v) => { colourMode = +v; loop.invalidate(); });
    const zOut = panel.readout('z');
    const dOut = panel.readout('Linear growth since start');

    initialConditions();

    onDestroy(() => {
      loop.destroy();
      free();
      hdr?.destroy();
      paramBuf.destroy();
      renderBuf.destroy();
    });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
