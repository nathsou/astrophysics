// Chapter 8 flagship: a protoplanetary disk of planetesimals and embryos on the GPU.
//
// Heliocentric Kepler-drift + kick integrator (Wisdom–Holman style): every step each body is
// kicked by the embryos/giants (direct sum, plus the indirect term and gas drag), then drifted
// along its exact Kepler orbit around the Sun. Embryos (≤ 254) interact with each other and
// merge on contact; planetesimal tracers feel the embryos and giants and are accreted when they
// hit one. Units: AU, yr, M☉ (G = 4π²). See disk.wgsl for the physics.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { onThemeChange, currentTheme } from '../lib/ui/theme';
import computeCode from './planet-formation/disk.wgsl?raw';
import renderCode from './planet-formation/render.wgsl?raw';
import compositeCode from './planet-formation/composite.wgsl?raw';

const TAU = Math.PI * 2;
const G = 4 * Math.PI * Math.PI;
const MEARTH = 3.0035e-6; // M☉
const MJUP = 9.546e-4;
const MSAT = 2.858e-4;
const NB = 256; // body slots
const N_EMBRYO = 200;
const R_IN_DISK = 0.35, R_OUT_DISK = 8.0, SNOW = 2.7, ICE_BOOST = 4.2;
const DT = 0.01; // yr
const MMSN_SOLIDS = 20; // M⊕ of solids between 0.35 and 8 AU in the Hayashi MMSN

// Mulberry32: small seeded RNG so "Reset" is reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function checkShader(device: GPUDevice, code: string, label: string) {
  const mod = device.createShaderModule({ code, label });
  if (import.meta.env.DEV) {
    const info = await mod.getCompilationInfo();
    for (const m of info.messages) if (m.type === 'error') console.error(`[${label}] ${m.lineNum}:${m.linePos} ${m.message}`);
  }
  return mod;
}

/** Sample a radius from Σ ∝ r^{-3/2} (×ICE_BOOST beyond the snow line), i.e. dN ∝ r^{-1/2} dr. */
function sampleRadius(u: number) {
  const wIn = 2 * (Math.sqrt(SNOW) - Math.sqrt(R_IN_DISK));
  const wOut = ICE_BOOST * 2 * (Math.sqrt(R_OUT_DISK) - Math.sqrt(SNOW));
  const t = u * (wIn + wOut);
  if (t < wIn) { const s = Math.sqrt(R_IN_DISK) + t / 2; return s * s; }
  const s = Math.sqrt(SNOW) + (t - wIn) / (2 * ICE_BOOST);
  return s * s;
}

export default defineSim({
  gpu: true,
  async mount({ host, onDestroy }) {
    const device = await requireDevice();

    const stage = createStage(host, { aspect: 16 / 10 });
    stage.el.style.background = '#05060a';
    const { ctx, format } = configureCanvas(stage.canvas, device);

    // ---------- state / parameters
    let nParticles = 131072;
    let diskScale = 1; // × MMSN
    let drag = true;
    let colourMode = 0;
    let stepsPerTick = 4;
    let simYears = 0;
    const giants = [false, false];

    // ---------- buffers
    const S = GPUBufferUsage.STORAGE, C = GPUBufferUsage.COPY_DST, CS = GPUBufferUsage.COPY_SRC;
    const params = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | C });
    const bodies = device.createBuffer({ size: NB * 32, usage: S | C | CS });
    const aux = device.createBuffer({ size: NB * 16, usage: S | C | CS });
    const counts = device.createBuffer({ size: NB * 8, usage: S | C });
    const glob = device.createBuffer({ size: 32, usage: S | C | CS });
    const camBuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | C });
    const ringBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | C });
    const compBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | C });
    const readBuf = device.createBuffer({ size: NB * 32 + NB * 16 + 32, usage: GPUBufferUsage.MAP_READ | C });
    let particles: GPUBuffer | null = null;
    let hdr: GPUTexture | null = null;

    // ---------- pipelines
    const [cmod, rmod, pmod] = await Promise.all([
      checkShader(device, computeCode, 'pf-disk'),
      checkShader(device, renderCode, 'pf-render'),
      checkShader(device, compositeCode, 'pf-composite'),
    ]);
    const vis = GPUShaderStage.COMPUTE;
    const cLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: vis, buffer: { type: 'uniform' } },
        ...[1, 2, 3, 4, 5].map((b) => ({ binding: b, visibility: vis, buffer: { type: 'storage' as const } })),
      ],
    });
    const cPL = device.createPipelineLayout({ bindGroupLayouts: [cLayout] });
    const cp = (entryPoint: string) => device.createComputePipeline({ layout: cPL, compute: { module: cmod, entryPoint } });
    const pKickP = cp('kickParticles'), pKickB = cp('kickBodies'), pDriftP = cp('driftParticles'), pDriftB = cp('driftBodies'), pFinish = cp('finish');

    const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const rLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: VF, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });
    const rPL = device.createPipelineLayout({ bindGroupLayouts: [rLayout] });
    const additive: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    };
    const HDR: GPUTextureFormat = 'rgba16float';
    const sprite = (vs: string) => device.createRenderPipeline({
      layout: rPL,
      vertex: { module: rmod, entryPoint: vs },
      fragment: { module: rmod, entryPoint: 'fsSprite', targets: [{ format: HDR, blend: additive }] },
      primitive: { topology: 'triangle-list' },
    });
    const pParticles = sprite('vsParticle'), pBodies = sprite('vsBody');
    const pRings = device.createRenderPipeline({
      layout: rPL,
      vertex: { module: rmod, entryPoint: 'vsRing' },
      fragment: { module: rmod, entryPoint: 'fsRing', targets: [{ format: HDR, blend: additive }] },
      primitive: { topology: 'line-list' },
    });
    const pComp = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pmod, entryPoint: 'vsFull' },
      fragment: { module: pmod, entryPoint: 'fsComposite', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    let cBind: GPUBindGroup, rBind: GPUBindGroup, compBind: GPUBindGroup | null = null;

    function writeParams() {
      const mSolid = MMSN_SOLIDS * diskScale * MEARTH;
      const buf = new ArrayBuffer(48);
      const f = new Float32Array(buf), u = new Uint32Array(buf);
      f[0] = DT; u[1] = nParticles; u[2] = NB; f[3] = drag ? 1 : 0;
      f[4] = 0.004;          // η: gas headwind (a few × 10⁻³ in the MMSN)
      f[5] = 300;            // planetesimal Stokes number (km-ish bodies: weak drag)
      f[6] = 3000;           // embryo damping (stand-in for tidal / gas-drag damping)
      f[7] = (0.7 * mSolid) / nParticles;
      f[8] = SNOW; f[9] = 0.2; f[10] = 40; f[11] = 120; // rIn, rOut, radius inflation
      device.queue.writeBuffer(params, 0, buf);
    }

    function rebuild() {
      particles?.destroy();
      particles = device.createBuffer({ size: nParticles * 32, usage: S | C });
      cBind = device.createBindGroup({
        layout: cLayout,
        entries: [params, particles, bodies, aux, counts, glob].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      rBind = device.createBindGroup({
        layout: rLayout,
        entries: [camBuf, particles, bodies, aux, ringBuf].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      reset();
    }

    function circular(r: number, th: number) {
      const v = Math.sqrt(G / r);
      return [r * Math.cos(th), r * Math.sin(th), 0, -v * Math.sin(th), v * Math.cos(th), 0];
    }

    function reset() {
      const rand = rng(12345);
      const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(TAU * rand());
      const eSig = 0.01, iSig = 0.005;
      // Epicyclic initial conditions: circular orbit + small random e, i.
      const epi = (r: number, out: Float32Array, o: number) => {
        const th = TAU * rand(), vk = Math.sqrt(G / r), e = eSig * Math.abs(gauss()), ph = TAU * rand();
        const inc = iSig * Math.abs(gauss()), phz = TAU * rand();
        const rr = r * (1 - e * Math.cos(ph));
        const vr = vk * e * Math.sin(ph), vt = vk * (1 + 0.5 * e * Math.cos(ph));
        const c = Math.cos(th), s = Math.sin(th);
        out[o] = rr * c; out[o + 1] = rr * s; out[o + 2] = r * inc * Math.sin(phz);
        out[o + 4] = vr * c - vt * s; out[o + 5] = vr * s + vt * c; out[o + 6] = vk * inc * Math.cos(phz);
      };
      const P = new Float32Array(nParticles * 8);
      for (let i = 0; i < nParticles; i++) {
        const r = sampleRadius(rand());
        epi(r, P, i * 8);
        P[i * 8 + 3] = r; // formation radius → composition
        P[i * 8 + 7] = 1;
      }
      device.queue.writeBuffer(particles!, 0, P);

      // Embryos: log-spaced, mass ∝ local Σ r² (so ∝ r^{1/2}, ×4.2 beyond the snow line); 30% of the solids.
      const B = new Float32Array(NB * 8), A = new Float32Array(NB * 4);
      const mSolid = MMSN_SOLIDS * diskScale * MEARTH;
      const w: number[] = [], rs: number[] = [];
      for (let k = 0; k < N_EMBRYO; k++) {
        const r = 0.4 * Math.pow(7 / 0.4, (k + rand() * 0.8) / N_EMBRYO);
        rs.push(r); w.push(Math.sqrt(r) * (r > SNOW ? ICE_BOOST : 1));
      }
      const wsum = w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < N_EMBRYO; k++) {
        const slot = k + 2, r = rs[k], m = (0.3 * mSolid * w[k]) / wsum;
        epi(r, B, slot * 8);
        B[slot * 8 + 3] = m; B[slot * 8 + 7] = 1;
        A[slot * 4] = r > SNOW ? 0.5 * m : 0; // ice mass: ~50% water beyond the snow line
      }
      placeGiants(B, A);
      device.queue.writeBuffer(bodies, 0, B);
      device.queue.writeBuffer(aux, 0, A);
      device.queue.writeBuffer(counts, 0, new Uint32Array(NB * 2));
      device.queue.writeBuffer(glob, 0, new Uint32Array(8));
      writeParams();
      // one "finish" pass sets collision radii and the indirect term before the first kick
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, cBind);
      pass.setPipeline(pFinish); pass.dispatchWorkgroups(1);
      pass.end();
      device.queue.submit([enc.finish()]);
      simYears = 0;
      stats = null;
      pending = 0;
      loop.invalidate();
    }

    function placeGiants(B: Float32Array, A: Float32Array) {
      const defs = [{ r: 5.2, m: MJUP, th: 0.3 }, { r: 9.5, m: MSAT, th: 2.4 }];
      defs.forEach((d, s) => {
        if (!giants[s]) { B.fill(0, s * 8, s * 8 + 8); A.fill(0, s * 4, s * 4 + 4); return; }
        B.set(circular(d.r, d.th).slice(0, 3), s * 8); B[s * 8 + 3] = d.m;
        B.set(circular(d.r, d.th).slice(3), s * 8 + 4); B[s * 8 + 7] = 1;
        A[s * 4] = 0; A[s * 4 + 1] = 0; A[s * 4 + 2] = 1;
      });
    }

    /** Drop a giant into (or remove it from) the running simulation. */
    function setGiant(s: number, on: boolean) {
      giants[s] = on;
      const B = new Float32Array(8), A = new Float32Array(4);
      const tmpB = new Float32Array(NB * 8), tmpA = new Float32Array(NB * 4);
      placeGiants(tmpB, tmpA);
      B.set(tmpB.subarray(s * 8, s * 8 + 8)); A.set(tmpA.subarray(s * 4, s * 4 + 4));
      device.queue.writeBuffer(bodies, s * 32, B);
      device.queue.writeBuffer(aux, s * 16, A);
      // recompute radii + indirect term for the new configuration
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, cBind); pass.setPipeline(pFinish); pass.dispatchWorkgroups(1);
      pass.end();
      device.queue.submit([enc.finish()]);
      writeRings();
      loop.invalidate();
    }

    function writeRings() {
      const R = new Float32Array(16);
      R.set([SNOW, 0.25, 0.55, 0.9], 0);
      R.set([1, 0.12, 0.12, 0.14], 4);
      R.set([giants[0] ? 5.2 : 0, 0.3, 0.22, 0.12], 8);
      R.set([giants[1] ? 9.5 : 0, 0.3, 0.22, 0.12], 12);
      device.queue.writeBuffer(ringBuf, 0, R);
    }
    writeRings();

    // ---------- camera + overlay labels
    const cam = new OrbitCamera(stage.canvas, { distance: 17, pitch: 1.05, yaw: -1.2, minDistance: 1.5, maxDistance: 60, autoRotate: 0.02, fov: (40 * Math.PI) / 180 });
    const snowLabel = document.createElement('div');
    snowLabel.textContent = 'snow line';
    const labels: HTMLDivElement[] = [];
    for (let k = 0; k < 4; k++) labels.push(document.createElement('div'));
    for (const el of [snowLabel, ...labels]) {
      el.style.cssText = 'position:absolute;transform:translate(-50%,-140%);white-space:nowrap;font-size:11px;color:#cfd6e4;text-shadow:0 0 3px #000;';
      stage.overlay.append(el);
    }
    snowLabel.style.color = '#8fc0ff';
    const info = document.createElement('div');
    info.style.cssText = 'position:absolute;left:10px;top:8px;font-size:11px;line-height:1.45;color:#cfd6e4;text-shadow:0 0 3px #000;font-family:var(--font-mono);';
    stage.overlay.append(info);

    function project(x: number, y: number, z: number): [number, number] | null {
      const m = cam.viewProj(stage.width / stage.height);
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 0) return null;
      return [(cx / cw * 0.5 + 0.5) * stage.width, (0.5 - cy / cw * 0.5) * stage.height];
    }

    // ---------- readback of the massive bodies for the readouts
    interface Stats { pos: Float32Array; aux: Float32Array; eaten: number; dead: number; merges: number }
    let stats: Stats | null = null;
    let reading = false, frame = 0;
    async function readback() {
      reading = true;
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(bodies, 0, readBuf, 0, NB * 32);
      enc.copyBufferToBuffer(aux, 0, readBuf, NB * 32, NB * 16);
      enc.copyBufferToBuffer(glob, 0, readBuf, NB * 48, 32);
      device.queue.submit([enc.finish()]);
      try {
        await readBuf.mapAsync(GPUMapMode.READ);
        const all = readBuf.getMappedRange().slice(0);
        readBuf.unmap();
        const u = new Uint32Array(all, NB * 48, 8);
        stats = { pos: new Float32Array(all, 0, NB * 8), aux: new Float32Array(all, NB * 32, NB * 4), dead: u[4], eaten: u[5], merges: u[6] };
        updateReadouts();
      } catch { /* destroyed while mapping */ }
      reading = false;
    }

    // ---------- the loop: fixed-rate ticks queue GPU steps, render dispatches them
    let pending = 0;
    const loop = new Loop(() => { pending += stepsPerTick; }, render, 1 / 60);
    stage.onResize(() => { hdr?.destroy(); hdr = null; loop.invalidate(); });
    cam.onChange = () => loop.invalidate();

    const camData = new Float32Array(24);
    function render(_a: number, frameDt: number) {
      if (!particles) return;
      cam.update(frameDt);
      const W = stage.canvas.width, H = stage.canvas.height;
      if (!hdr || hdr.width !== W || hdr.height !== H) {
        hdr?.destroy();
        hdr = device.createTexture({ size: [W, H], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        compBind = device.createBindGroup({ layout: pComp.getBindGroupLayout(0), entries: [{ binding: 0, resource: hdr.createView() }, { binding: 1, resource: { buffer: compBuf } }] });
      }
      camData.set(cam.viewProj(stage.width / stage.height), 0);
      camData.set([W, H, stage.dpr, colourMode], 16);
      camData.set([SNOW, NB, 1, Math.min(0.5, 0.18 * Math.sqrt(131072 / nParticles))], 20);
      device.queue.writeBuffer(camBuf, 0, camData);
      const light = currentTheme() === 'light';
      device.queue.writeBuffer(compBuf, 0, new Float32Array(light ? [0.035, 0.04, 0.065, 1, 1.1, 0, 0, 0] : [0.012, 0.014, 0.024, 1, 1.1, 0, 0, 0]));

      const enc = device.createCommandEncoder();
      const n = Math.min(pending, 48);
      pending = 0;
      if (n > 0) {
        const pass = enc.beginComputePass();
        pass.setBindGroup(0, cBind);
        const wg = Math.ceil(nParticles / 256);
        for (let s = 0; s < n; s++) {
          pass.setPipeline(pKickB); pass.dispatchWorkgroups(1);
          pass.setPipeline(pKickP); pass.dispatchWorkgroups(wg);
          pass.setPipeline(pDriftB); pass.dispatchWorkgroups(1);
          pass.setPipeline(pDriftP); pass.dispatchWorkgroups(wg);
          pass.setPipeline(pFinish); pass.dispatchWorkgroups(1);
        }
        pass.end();
        simYears += n * DT;
      }
      const rp = enc.beginRenderPass({
        colorAttachments: [{ view: hdr.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      });
      rp.setBindGroup(0, rBind);
      rp.setPipeline(pRings); rp.draw(384, 4);
      rp.setPipeline(pParticles); rp.draw(6, nParticles);
      rp.setPipeline(pBodies); rp.draw(6, NB + 1);
      rp.end();
      const cpass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      cpass.setPipeline(pComp); cpass.setBindGroup(0, compBind!); cpass.draw(3);
      cpass.end();
      device.queue.submit([enc.finish()]);

      if (!reading && frame++ % 10 === 0) readback();
      placeLabels();
    }

    // ---------- readouts
    const top: { m: number; x: number; y: number; z: number; ice: number; giant: boolean }[] = [];
    function updateReadouts() {
      if (!stats) return;
      top.length = 0;
      let alive = 0, embryoMass = 0;
      for (let i = 0; i < NB; i++) {
        if (stats.pos[i * 8 + 7] === 0) continue;
        const m = stats.pos[i * 8 + 3];
        const giant = stats.aux[i * 4 + 2] > 0.5;
        if (!giant) { alive++; embryoMass += m; }
        top.push({ m, x: stats.pos[i * 8], y: stats.pos[i * 8 + 1], z: stats.pos[i * 8 + 2], ice: stats.aux[i * 4] / m, giant });
      }
      const emb = top.filter((b) => !b.giant).sort((a, b) => b.m - a.m);
      const big = emb.slice(0, 3);
      rTime.set(`${fmt(simYears, 3)} yr`);
      rEmb.set(`${alive} (${fmt(embryoMass / MEARTH, 3)} M⊕)`);
      rBig.set(big.map((b) => `${fmt(b.m / MEARTH, 2)} M⊕ @ ${fmt(Math.hypot(b.x, b.y), 2)} AU`).join(' · '));
      rLost.set(`${stats.eaten.toLocaleString()} accreted · ${stats.dead.toLocaleString()} lost · ${stats.merges} mergers`);
      info.innerHTML = `t = ${fmt(simYears, 4)} yr<br>embryos: ${alive}<br>largest: ${big[0] ? fmt(big[0].m / MEARTH, 3) : '–'} M⊕`;
      top.splice(0, top.length, ...big, ...top.filter((b) => b.giant));
    }

    function placeLabels() {
      const sp = project(0, -SNOW, 0);
      if (sp) { snowLabel.style.left = `${sp[0]}px`; snowLabel.style.top = `${sp[1] + 14}px`; snowLabel.style.display = ''; }
      else snowLabel.style.display = 'none';
      labels.forEach((el, k) => {
        const b = top[k];
        const p = b && project(b.x, b.y, b.z);
        if (!b || !p) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.left = `${p[0]}px`; el.style.top = `${p[1]}px`;
        el.textContent = b.giant ? (b.m > 5e-4 ? 'Jupiter' : 'Saturn') : `${fmt(b.m / MEARTH, 2)} M⊕`;
      });
    }

    // ---------- controls
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => { loop.paused = p; loop.invalidate(); });
    panel.button('Reset', () => rebuild());
    panel.select('Particles', [
      { value: '32768', label: '32k' }, { value: '131072', label: '131k' },
      { value: '262144', label: '262k' }, { value: '524288', label: '524k' },
    ], String(nParticles), (v) => { nParticles = +v; rebuild(); });
    panel.slider('Solid mass', { min: 0.25, max: 5, value: diskScale, log: true, format: (v) => `${fmt(v, 2)}× MMSN` }, (v) => { diskScale = v; rebuild(); });
    panel.select('Speed', [
      { value: '1', label: '0.6 yr/s' }, { value: '4', label: '2.4 yr/s' },
      { value: '12', label: '7 yr/s' }, { value: '32', label: '19 yr/s' },
    ], String(stepsPerTick), (v) => { stepsPerTick = +v; });
    panel.select('Colour', [{ value: '0', label: 'composition' }, { value: '1', label: 'eccentricity' }], '0', (v) => { colourMode = +v; loop.invalidate(); });
    panel.toggle('Gas drag', drag, (v) => { drag = v; writeParams(); });
    const bJ = panel.button('Add Jupiter', () => { setGiant(0, !giants[0]); bJ.textContent = giants[0] ? 'Remove Jupiter' : 'Add Jupiter'; });
    const bS = panel.button('Add Saturn', () => { setGiant(1, !giants[1]); bS.textContent = giants[1] ? 'Remove Saturn' : 'Add Saturn'; });
    panel.button('Face-on', () => { cam.pitch = 1.5; cam.autoRotate = 0; loop.invalidate(); });
    panel.button('Tilted', () => { cam.pitch = 0.55; loop.invalidate(); });
    const rTime = panel.readout('t');
    const rEmb = panel.readout('Embryos');
    const rBig = panel.readout('Largest');
    const rLost = panel.readout('Planetesimals');

    onDestroy(onThemeChange(() => loop.invalidate()) as () => void);
    rebuild();

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy() {
        loop.destroy();
        for (const b of [params, bodies, aux, counts, glob, camBuf, ringBuf, compBuf, readBuf]) b.destroy();
        particles?.destroy();
        hdr?.destroy();
      },
    };
  },
});
