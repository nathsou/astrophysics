// Chapter 17 flagship: a relativistic flight through a starfield (WebGPU).
//
// Every star is a blackbody at infinity; an optional lattice of lamp posts sits at finite distance.
// Per source, the vertex shader applies aberration (direction), Doppler (temperature δT → colour via
// a visible-band LUT) and beaming (bolometric point-source flux × δ²). A composite pass adds the CMB
// per pixel (T = 2.7255 K × δ) and tonemaps. Speed is controlled by rapidity φ (β = tanh φ), and 1 − β
// is computed in f64 from φ so the shader never forms it by cancellation.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { Panel, fmt } from '../lib/ui/controls';
import { bandLUT, rng, fmtBeta, oneMinusBetaOfRapidity } from './relativity/physics';
import shaderCode from './relativity/flight.wgsl?raw';

const QUALITY = [
  { label: '32k', n: 32768 },
  { label: '131k', n: 131072 },
  { label: '524k', n: 524288 },
];

// Spectral classes: [T (K), fraction, relative bolometric flux multiplier]
const CLASSES: [number, number, number][] = [
  [3300, 0.40, 0.5], [4400, 0.24, 0.8], [5700, 0.14, 1], [6700, 0.1, 1.6],
  [9000, 0.07, 3], [16000, 0.04, 8], [32000, 0.01, 25],
];

function makeStars(n: number): Float32Array {
  const r = rng(1717);
  const out = new Float32Array(n * 8);
  // Galactic plane: a tilted great circle so it crosses the forward view.
  const gz = [0.25, -0.45, 0.86];
  const gl = Math.hypot(...gz);
  const nz = gz.map((x) => x / gl);
  // basis in the plane
  let ax = [1, 0, 0];
  const dp = ax[0] * nz[0];
  ax = [ax[0] - dp * nz[0], -dp * nz[1], -dp * nz[2]];
  const al = Math.hypot(...ax); ax = ax.map((x) => x / al);
  const ay = [nz[1] * ax[2] - nz[2] * ax[1], nz[2] * ax[0] - nz[0] * ax[2], nz[0] * ax[1] - nz[1] * ax[0]];
  const fmin = 0.05 * (131072 / n) ** (2 / 3);
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (r() < 0.45) {
      // isotropic
      z = 2 * r() - 1;
      const ph = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z);
      x = s * Math.cos(ph); y = s * Math.sin(ph);
    } else {
      // disc: Laplace-distributed latitude, with a mild bulge toward one longitude
      const ph = r() < 0.3 ? (r() - 0.5) * 1.2 + 0.4 : 2 * Math.PI * r();
      const b = -Math.log(1 - r()) * 0.09 * (r() < 0.5 ? -1 : 1);
      const cb = Math.cos(b), sb = Math.sin(b);
      const c = Math.cos(ph) * cb, s = Math.sin(ph) * cb;
      x = c * ax[0] + s * ay[0] + sb * nz[0];
      y = c * ax[1] + s * ay[1] + sb * nz[1];
      z = c * ax[2] + s * ay[2] + sb * nz[2];
    }
    let u = r(), k = 0;
    while (k < CLASSES.length - 1 && u > CLASSES[k][1]) { u -= CLASSES[k][1]; k++; }
    const T = CLASSES[k][0] * (0.85 + 0.3 * r());
    // Euclidean source counts N(>F) ∝ F^(−3/2)  ⇒  F = F_min u^(−2/3)
    const F = Math.min(fmin * Math.pow(1 - r(), -2 / 3), 60) * CLASSES[k][2];
    out.set([x, y, z, 0, T, F, 0, 0], i * 8);
  }
  return out;
}

const LAT_HALF = 4; // cells each side
function makeLattice(): Float32Array {
  const P = 2 * LAT_HALF + 1, S = 20; // samples per cell edge
  const pts: number[] = [];
  for (let axis = 0; axis < 3; axis++)
    for (let a = 0; a < P; a++)
      for (let b = 0; b < P; b++)
        for (let s = 0; s < P * S; s++) {
          const t = s / S - LAT_HALF - 0.5 + 0.5;
          const q = [0, 0, 0];
          q[axis] = t; q[(axis + 1) % 3] = a - LAT_HALF + 0.5; q[(axis + 2) % 3] = b - LAT_HALF + 0.5;
          pts.push(q[0], q[1], q[2], 1, 5200, 2.5, 0, 0);
        }
  return new Float32Array(pts);
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    const stage = createStage(host, { aspect: 16 / 9 });
    stage.el.style.background = '#000';
    const { ctx, format } = configureCanvas(stage.canvas, device, 'opaque');

    const module = device.createShaderModule({ code: shaderCode });
    if (import.meta.env.DEV) module.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`flight.wgsl:${m.lineNum}: ${m.message}`)));

    const HDR: GPUTextureFormat = 'rgba16float';
    const starPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsStar' },
      fragment: {
        module, entryPoint: 'fsStar',
        targets: [{ format: HDR, blend: { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }],
      },
      primitive: { topology: 'triangle-strip' },
    });
    const compPipe = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsFull' },
      fragment: { module, entryPoint: 'fsComposite', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const ubuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const lut = bandLUT();
    const lutBuf = device.createBuffer({ size: lut.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(lutBuf, 0, lut);
    const lattice = makeLattice();
    const nLat = lattice.length / 8;

    let starBuf: GPUBuffer | null = null, nStars = 0, starBG: GPUBindGroup | null = null;
    function setQuality(n: number) {
      starBuf?.destroy();
      const stars = makeStars(n);
      starBuf = device.createBuffer({ size: (n + nLat) * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(starBuf, 0, stars);
      device.queue.writeBuffer(starBuf, n * 32, lattice);
      nStars = n;
      starBG = device.createBindGroup({
        layout: starPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: starBuf } }, { binding: 2, resource: { buffer: lutBuf } }],
      });
      dirty = true;
    }

    let hdrTex: GPUTexture | null = null, compBG: GPUBindGroup | null = null;
    function resizeTargets() {
      hdrTex?.destroy();
      hdrTex = device.createTexture({
        size: [Math.max(1, stage.canvas.width), Math.max(1, stage.canvas.height)],
        format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      compBG = device.createBindGroup({
        layout: compPipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 2, resource: { buffer: lutBuf } }, { binding: 3, resource: hdrTex.createView() }],
      });
    }

    // ---------------- state ----------------
    let phi = params.phi ? +params.phi : 0; // rapidity
    let yaw = 0, pitch = 0, fovDeg = 90;
    let aberration = true, doppler = true, beaming = true, cmb = true, showLattice = false;
    let ev = 0;
    const obs = [0, 0, 0];
    let dirty = true;

    const U = new Float32Array(32);
    const Uu = new Uint32Array(U.buffer);

    // HTML overlay: direction-of-motion markers
    const mkMarker = (txt: string) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;transform:translate(-50%,-50%);color:rgba(255,255,255,.55);font:11px var(--font-ui, system-ui);pointer-events:none;white-space:nowrap;';
      d.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:1px solid rgba(255,255,255,.45);border-radius:50%;vertical-align:middle"></span> ${txt}`;
      stage.overlay.append(d);
      return d;
    };
    const markFwd = mkMarker('ahead');
    const markBack = mkMarker('behind');
    const hud = document.createElement('div');
    hud.style.cssText = 'position:absolute;left:10px;top:8px;color:rgba(255,255,255,.8);font:12px var(--font-mono, monospace);line-height:1.45;pointer-events:none;text-shadow:0 0 3px #000;';
    stage.overlay.append(hud);

    function basis() {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const f = [cp * cy, cp * sy, sp];
      const r = [sy, -cy, 0];
      const up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      return { f, r, up };
    }

    function project(d: number[], b: ReturnType<typeof basis>, focal: number, aspect: number) {
      const z = d[0] * b.f[0] + d[1] * b.f[1] + d[2] * b.f[2];
      if (z < 0.05) return null;
      const x = (d[0] * b.r[0] + d[1] * b.r[1] + d[2] * b.r[2]) / z * focal / aspect;
      const y = (d[0] * b.up[0] + d[1] * b.up[1] + d[2] * b.up[2]) / z * focal;
      if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) return null;
      return [(x * 0.5 + 0.5) * stage.width, (0.5 - y * 0.5) * stage.height];
    }

    function render(_a: number, frameDt: number) {
      if (!starBG || !hdrTex || !compBG) return;
      const beta = Math.tanh(phi), gamma = Math.cosh(phi), omb = oneMinusBetaOfRapidity(phi);
      if (showLattice) {
        obs[0] += beta * 1.2 * frameDt;
        obs[0] -= Math.floor(obs[0]); // lattice is periodic with period 1 along x
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;

      const b = basis();
      const focal = 1 / Math.tan((fovDeg * Math.PI) / 360);
      const aspect = stage.width / stage.height;
      const W = stage.canvas.width, H = stage.canvas.height;
      U.set([b.r[0], b.r[1], b.r[2], focal], 0);
      U.set([b.up[0], b.up[1], b.up[2], aspect], 4);
      U.set([b.f[0], b.f[1], b.f[2], stage.dpr], 8);
      U.set([1, 0, 0, beta], 12);
      U.set([gamma, omb, 2.2 * 2 ** ev, 0.9], 16);
      U.set([obs[0], obs[1], obs[2], 2 * LAT_HALF + 1], 20);
      U.set([2 / W, 2 / H, LAT_HALF + 0.5, 0.85 * stage.dpr], 24);
      Uu.set([+aberration, +doppler, +beaming, +cmb], 28);
      device.queue.writeBuffer(ubuf, 0, U);

      const enc = device.createCommandEncoder();
      const p1 = enc.beginRenderPass({ colorAttachments: [{ view: hdrTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
      p1.setPipeline(starPipe);
      p1.setBindGroup(0, starBG);
      p1.draw(4, nStars, 0, 0);
      if (showLattice) p1.draw(4, nLat, 0, nStars);
      p1.end();
      const p2 = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      p2.setPipeline(compPipe);
      p2.setBindGroup(0, compBG);
      p2.draw(3);
      p2.end();
      device.queue.submit([enc.finish()]);

      // markers and HUD
      const place = (el: HTMLElement, d: number[]) => {
        const p = project(d, b, focal, aspect);
        el.style.display = p ? '' : 'none';
        if (p) { el.style.left = `${p[0]}px`; el.style.top = `${p[1]}px`; }
      };
      place(markFwd, [1, 0, 0]);
      place(markBack, [-1, 0, 0]);
      const dF = gamma * (1 + beta), dB = 1 / dF;
      const half = (Math.atan2(1 / gamma, beta) * 180) / Math.PI;
      hud.innerHTML = `β = ${fmtBeta(beta)}<br>γ = ${fmt(gamma, 4)}<br>δ ahead = ${fmt(dF, 4)} · behind = ${fmt(dB, 3)}<br>front hemisphere → cone of ${fmt(half, 3)}°`;
      readG.set(fmt(gamma, 4));
      readD.set(`${fmt(dF, 3)} / ${fmt(dB, 3)}`);
      readT.set(`${fmt(2.7255 * dF, 3)} K`);
    }

    const loop = new Loop(null, render);
    stage.onResize(() => { resizeTargets(); dirty = true; loop.invalidate(); });
    setQuality(QUALITY[1].n);

    // ---------------- look controls (drag = turn your head) ----------------
    const cv = stage.canvas;
    cv.style.touchAction = 'none';
    cv.style.cursor = 'grab';
    const ptrs = new Map<number, { x: number; y: number }>();
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const k = ((fovDeg * Math.PI) / 180) / stage.height;
      yaw += (e.clientX - p.x) * k;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - p.y) * k));
      p.x = e.clientX; p.y = e.clientY;
      dirty = true;
    });
    const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    // ---------------- panel ----------------
    const panel = new Panel(host);
    const PHI_MAX = Math.acosh(1000);
    const speed = panel.slider('Rapidity φ', { min: 0, max: PHI_MAX, value: phi, step: 0.001, format: (v) => `${v.toFixed(2)} (β = ${fmtBeta(Math.tanh(v))})` }, (v) => { phi = v; dirty = true; });
    const fov = panel.slider('Field of view', { min: 0.5, max: 140, value: fovDeg, log: true, format: (v) => `${fmt(v, 3)}°` }, (v) => { fovDeg = v; dirty = true; });
    panel.slider('Exposure', { min: -6, max: 8, value: ev, step: 0.5, format: (v) => `${v > 0 ? '+' : ''}${v} EV` }, (v) => { ev = v; dirty = true; });
    const setPhi = (g: number) => { phi = Math.acosh(g); speed.set(phi); dirty = true; };
    const look = (y: number, p: number, f?: number) => { yaw = y; pitch = p; if (f) { fovDeg = f; fov.set(f); } dirty = true; };
    panel.button('At rest', () => setPhi(1));
    panel.button('β = 0.5', () => setPhi(1 / Math.sqrt(0.75)));
    panel.button('Muon γ = 10', () => setPhi(10));
    panel.button('GRB jet γ = 100', () => setPhi(100));
    panel.button('γ = 1000: CMB glows', () => { setPhi(1000); look(0, 0, 1); });
    panel.button('Look ahead', () => look(0, 0));
    panel.button('Wide view', () => look(yaw, pitch, 90));
    panel.button('Look sideways', () => look(Math.PI / 2, 0));
    panel.button('Look behind', () => look(Math.PI, 0));
    panel.toggle('Aberration', aberration, (v) => { aberration = v; dirty = true; });
    panel.toggle('Doppler colour', doppler, (v) => { doppler = v; dirty = true; });
    panel.toggle('Beaming', beaming, (v) => { beaming = v; dirty = true; });
    panel.toggle('CMB', cmb, (v) => { cmb = v; dirty = true; });
    panel.toggle('Lamp-post lattice', showLattice, (v) => { showLattice = v; dirty = true; });
    panel.select('Stars', QUALITY.map((q) => ({ value: String(q.n), label: q.label })), String(QUALITY[1].n), (v) => setQuality(+v));
    const readG = panel.readout('γ');
    const readD = panel.readout('δ ahead / behind');
    const readT = panel.readout('CMB ahead');

    onDestroy(() => { starBuf?.destroy(); hdrTex?.destroy(); ubuf.destroy(); lutBuf.destroy(); });
    return {
      setVisible: (v) => { if (v) dirty = true; loop.setVisible(v); },
      destroy: () => loop.destroy(),
    };
  },
});
