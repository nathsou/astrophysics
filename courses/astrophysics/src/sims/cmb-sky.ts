// Chapter 27 flagship: a CMB sky generator. A Gaussian random temperature field on the sphere is
// synthesised on the GPU from an approximate ΛCDM power spectrum (src/sims/cmb/model.ts):
//   T(θ,φ) = Σ_ℓm a_ℓm Y_ℓm(θ,φ),  a_ℓm = sqrt(C_ℓ) g_ℓm,  g_ℓm fixed unit Gaussians (same "phases").
// Pass A (legendre.wgsl): F_m(θ_j) = Σ_ℓ a_ℓm λ_ℓm(cos θ_j)   — O(L² · N_lat)
// Pass B (synth.wgsl):    T_ij = Re Σ_m F_m(θ_j) e^{imφ_i}     — O(L · N_lat · N_lon)
// Render (render.wgsl):   globe (ray-cast sphere) or Mollweide projection.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { spectrum, PLANCK, PLANCK_POINTS, type CosmoParams } from './cmb/model';
import legendreCode from './cmb/legendre.wgsl?raw';
import synthCode from './cmb/synth.wgsl?raw';
import renderCode from './cmb/render.wgsl?raw';

const QUALITY = {
  low: { lmax: 128, nlat: 256, nlon: 512 },
  mid: { lmax: 256, nlat: 512, nlon: 1024 },
  high: { lmax: 512, nlat: 768, nlon: 1536 },
} as const;
type Quality = keyof typeof QUALITY;
type Band = 'all' | 'low' | 'peak1' | 'high';
const BANDS: Record<Band, [number, number]> = { all: [2, 1e9], low: [2, 30], peak1: [120, 350], high: [350, 1e9] };

/** Deterministic unit Gaussian pair for (seed, ℓ, m): the same "random phases" at every quality. */
function gauss2(seed: number, l: number, m: number): [number, number] {
  let h = (seed * 0x9e3779b1) ^ (l * 0x85ebca6b) ^ (m * 0xc2b2ae35);
  const next = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const u1 = Math.max(next(), 1e-12), u2 = next();
  const r = Math.sqrt(-2 * Math.log(u1));
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
}

function bandWeight(l: number, band: Band) {
  const [a, b] = BANDS[band];
  const taper = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
  return taper((l - a * 0.85) / (a * 0.15 + 1e-9) ) * (b > 1e8 ? 1 : taper((b * 1.15 - l) / (b * 0.15)));
}

export default defineSim({
  gpu: true,
  async mount({ host, params, onDestroy }) {
    const device = await requireDevice();
    let pal = palette();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;gap:0;align-items:start;';
    host.append(wrap);
    const skyStage = createStage(wrap, { aspect: 1.65 });
    const plotStage = createStage(wrap, { aspect: 1.02 });
    const layout = () => {
      const wide = host.clientWidth >= 640;
      wrap.style.gridTemplateColumns = wide ? 'minmax(0,1.55fr) minmax(0,1fr)' : 'minmax(0,1fr)';
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(host);
    onDestroy(() => ro.disconnect());

    const { ctx: gctx, format } = configureCanvas(skyStage.canvas, device);
    const cam = new OrbitCamera(skyStage.canvas, { distance: 3.4, minDistance: 1.6, maxDistance: 8, yaw: 0.4, pitch: 0.35, fov: 0.7, autoRotate: 0.12 });

    // legend overlay
    const legend = document.createElement('div');
    legend.style.cssText = 'position:absolute;left:10px;bottom:8px;font:11px JetBrains Mono, ui-monospace, monospace;color:var(--fg-muted);display:flex;align-items:center;gap:6px;';
    const bar = document.createElement('span');
    bar.style.cssText = 'display:inline-block;width:110px;height:8px;border-radius:2px;background:linear-gradient(90deg,#0000ff,#0070ff,#00ddff,#ffedd9,#ffb500,#ff4a00,#640000)';
    const lo = document.createElement('span'), hi = document.createElement('span');
    legend.append(lo, bar, hi);
    skyStage.overlay.append(legend);

    // ---- GPU resources -------------------------------------------------------------------------
    const mods = [legendreCode, synthCode, renderCode].map((code) => {
      const m = device.createShaderModule({ code });
      if (import.meta.env.DEV) m.getCompilationInfo().then((i) => i.messages.forEach((msg) => console.error('cmb-sky WGSL:', msg.lineNum, msg.message)));
      return m;
    });
    const pipeA = device.createComputePipeline({ layout: 'auto', compute: { module: mods[0], entryPoint: 'main' } });
    const pipeB = device.createComputePipeline({ layout: 'auto', compute: { module: mods[1], entryPoint: 'main' } });
    const pipeR = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: mods[2], entryPoint: 'vs' },
      fragment: { module: mods[2], entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const params32 = new ArrayBuffer(32);
    const paramBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const uni = new Float32Array(20), uniU = new Uint32Array(uni.buffer);
    const uniBuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    let q: Quality = (params.quality as Quality) in QUALITY ? (params.quality as Quality) : 'mid';
    let seed = 1;
    let res: { alm: GPUBuffer; amp: GPUBuffer; mlog: GPUBuffer; F: GPUBuffer; map: GPUBuffer; bgA: GPUBindGroup; bgB: GPUBindGroup; bgR: GPUBindGroup } | null = null;

    function freeRes() {
      if (!res) return;
      for (const b of [res.alm, res.amp, res.mlog, res.F, res.map]) b.destroy();
      res = null;
    }
    function uploadAlm() {
      if (!res) return;
      const { lmax } = QUALITY[q];
      const n = ((lmax + 1) * (lmax + 2)) / 2;
      const a = new Float32Array(2 * n);
      let k = 0;
      for (let m = 0; m <= lmax; m++)
        for (let l = m; l <= lmax; l++, k++) {
          const [g1, g2] = gauss2(seed, l, m);
          if (m === 0) { a[2 * k] = g1; a[2 * k + 1] = 0; }
          else { a[2 * k] = g1 * Math.SQRT1_2; a[2 * k + 1] = g2 * Math.SQRT1_2; }
        }
      device.queue.writeBuffer(res.alm, 0, a);
    }
    function buildRes() {
      freeRes();
      const { lmax, nlat, nlon } = QUALITY[q];
      const n = ((lmax + 1) * (lmax + 2)) / 2;
      const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
      const alm = device.createBuffer({ size: 8 * n, usage: S });
      const amp = device.createBuffer({ size: 4 * (lmax + 1), usage: S });
      const mlog = device.createBuffer({ size: 4 * (lmax + 1), usage: S });
      const F = device.createBuffer({ size: 8 * (lmax + 1) * nlat, usage: GPUBufferUsage.STORAGE });
      const map = device.createBuffer({ size: 4 * nlat * nlon, usage: GPUBufferUsage.STORAGE });
      // log2 of sqrt((2m+1)/4π · Π_{k≤m} (2k−1)/2k), in double precision on the CPU
      const ml = new Float32Array(lmax + 1);
      let acc = 0;
      for (let m = 0; m <= lmax; m++) {
        if (m > 0) acc += Math.log2((2 * m - 1) / (2 * m));
        ml[m] = 0.5 * (Math.log2((2 * m + 1) / (4 * Math.PI)) + acc);
      }
      device.queue.writeBuffer(mlog, 0, ml);
      const bg = (p: GPUComputePipeline | GPURenderPipeline, bufs: GPUBuffer[]) =>
        device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: bufs.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      res = {
        alm, amp, mlog, F, map,
        bgA: bg(pipeA, [paramBuf, alm, amp, mlog, F]),
        bgB: bg(pipeB, [paramBuf, F, map]),
        bgR: bg(pipeR, [uniBuf, map]),
      };
      uploadAlm();
    }
    onDestroy(() => { freeRes(); paramBuf.destroy(); uniBuf.destroy(); });

    // ---- model state ---------------------------------------------------------------------------
    const cosmo: CosmoParams = { ...PLANCK };
    let band: Band = 'all';
    let dipole = false;
    let projection: 'globe' | 'mollweide' = params.projection === 'mollweide' ? 'mollweide' : 'globe';
    const LPLOT = 2500;
    const Dl = new Float64Array(LPLOT + 1);
    const Dref = new Float64Array(LPLOT + 1);
    spectrum(PLANCK, LPLOT, Dref);
    let derived = spectrum(cosmo, LPLOT, Dl);
    let sigma = 0, scale = 300, dirty = true, busy = false, genMs = 0;

    function updateSpectrum() {
      derived = spectrum(cosmo, LPLOT, Dl);
      dirty = true;
      loop.invalidate();
    }

    function generate(enc: GPUCommandEncoder) {
      if (!res) buildRes();
      const r = res!;
      const { lmax, nlat, nlon } = QUALITY[q];
      const amp = new Float32Array(lmax + 1);
      let var_ = 0;
      for (let l = 2; l <= lmax; l++) {
        const Cl = (2 * Math.PI * Dl[l]) / (l * (l + 1));
        const w = bandWeight(l, band);
        amp[l] = Math.sqrt(Cl) * w;
        var_ += ((2 * l + 1) / (4 * Math.PI)) * Cl * w * w;
      }
      sigma = Math.sqrt(var_);
      const D = 3362; // μK, kinematic dipole amplitude (Planck 2018)
      scale = 3 * Math.sqrt(var_ + (dipole ? (D * D) / 3 : 0));
      device.queue.writeBuffer(r.amp, 0, amp);
      const u = new Uint32Array(params32), f = new Float32Array(params32);
      u[0] = lmax; u[1] = nlat; u[2] = nlon;
      // dipole towards galactic (l, b) = (264°, 48°)
      const lg = (264 * Math.PI) / 180, bg = (48 * Math.PI) / 180;
      f[4] = Math.cos(bg) * Math.cos(lg); f[5] = Math.cos(bg) * Math.sin(lg); f[6] = Math.sin(bg); f[7] = dipole ? D : 0;
      device.queue.writeBuffer(paramBuf, 0, params32);
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeA);
      pass.setBindGroup(0, r.bgA);
      pass.dispatchWorkgroups(Math.ceil((lmax + 1) / 64), nlat / 2);
      pass.setPipeline(pipeB);
      pass.setBindGroup(0, r.bgB);
      pass.dispatchWorkgroups(Math.ceil(nlon / 256), nlat);
      pass.end();
    }

    // ---- power spectrum plot -------------------------------------------------------------------
    const plot = new Plot(plotStage.canvas, {
      x: { min: 2, max: 2500, log: true, label: 'multipole ℓ', ticks: [2, 10, 30, 100, 300, 1000, 2500], format: (v) => String(v) },
      y: { min: 0, max: 7000, label: 'D_ℓ = ℓ(ℓ+1)C_ℓ/2π  (μK²)' },
      title: 'Temperature power spectrum',
      margin: { l: 58, r: 12, t: 28, b: 42 },
    });
    const xs = new Float64Array(LPLOT - 1);
    for (let i = 0; i < xs.length; i++) xs[i] = i + 2;
    const sub = (a: Float64Array) => a.subarray(2);

    function drawPlot() {
      const { lmax } = QUALITY[q];
      plot.draw(() => {
        const ctx = plot.ctx;
        // shade the band actually synthesised
        const [a, b] = BANDS[band];
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.08;
        const x0 = plot.px(Math.max(2, a)), x1 = plot.px(Math.min(lmax, b));
        ctx.fillRect(x0, plot.m.t, Math.max(0, x1 - x0), plot.ph);
        ctx.globalAlpha = 1;
        plot.vline(lmax);
        plot.text(`ℓ_max = ${lmax}`, plot.px(lmax) - 4, plot.m.t + plot.ph - 8, { align: 'right', color: pal.muted });
        // Planck-like reference points with error bars
        ctx.strokeStyle = pal.muted;
        ctx.lineWidth = 1;
        for (const [l, D, s] of PLANCK_POINTS) {
          ctx.beginPath();
          ctx.moveTo(plot.px(l), plot.py(D - s));
          ctx.lineTo(plot.px(l), plot.py(D + s));
          ctx.stroke();
        }
        plot.scatter(PLANCK_POINTS.map((p) => p[0]), PLANCK_POINTS.map((p) => p[1]), { size: 4, color: pal.fg });
        plot.line(xs, sub(Dref), { color: pal.faint, dash: [4, 4], width: 1.2 });
        plot.line(xs, sub(Dl), { color: pal.accent, width: 2 });
        plot.text('● Planck 2018 (approx.)', plot.m.l + 8, plot.m.t + 14, { color: pal.muted });
        plot.text('— your model', plot.m.l + 8, plot.m.t + 28, { color: pal.accent });
        plot.text('- - Planck best fit', plot.m.l + 8, plot.m.t + 42, { color: pal.faint });
      });
    }

    // ---- render loop ---------------------------------------------------------------------------
    function render(_a: number, frameDt: number) {
      cam.update(frameDt); // auto-rotation (yaw also shifts the Mollweide longitude)
      const enc = device.createCommandEncoder();
      const regen = dirty && !busy;
      if (regen) { dirty = false; generate(enc); }
      if (!res) buildRes();
      const W = skyStage.canvas.width, H = skyStage.canvas.height;
      const aspect = W / H;
      const eye = cam.eye;
      const fwd = [-eye[0], -eye[1], -eye[2]];
      const fl = Math.hypot(fwd[0], fwd[1], fwd[2]);
      fwd.forEach((v, i) => (fwd[i] = v / fl));
      let right = [fwd[1], -fwd[0], 0];
      const rl = Math.hypot(right[0], right[1]) || 1;
      right = right.map((v) => v / rl);
      const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      uni.set([...right, Math.tan(cam.fov / 2), ...up, aspect, ...fwd, scale, ...eye, -cam.yaw]);
      const { nlat, nlon } = QUALITY[q];
      uniU[16] = projection === 'globe' ? 0 : 1; uniU[17] = nlat; uniU[18] = nlon;
      device.queue.writeBuffer(uniBuf, 0, uni);
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: gctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      });
      pass.setPipeline(pipeR);
      pass.setBindGroup(0, res!.bgR);
      pass.draw(3);
      pass.end();
      const t0 = performance.now();
      device.queue.submit([enc.finish()]);
      if (regen) {
        busy = true;
        device.queue.onSubmittedWorkDone().then(() => {
          genMs = performance.now() - t0;
          busy = false;
          readouts();
          if (dirty) loop.invalidate();
        });
        drawPlot();
        readouts();
      }
    }

    const loop = new Loop(null, render);
    cam.onChange = () => loop.invalidate();
    skyStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); drawPlot(); });
    onThemeChange(() => { pal = palette(); drawPlot(); });

    // ---- controls ------------------------------------------------------------------------------
    const panel = new Panel(host);
    panel.slider('Ω_b h²', { min: 0.005, max: 0.05, value: cosmo.ombh2, step: 0.0005, format: (v) => v.toFixed(4) }, (v) => { cosmo.ombh2 = v; updateSpectrum(); });
    panel.slider('Ω_c h²', { min: 0.05, max: 0.3, value: cosmo.omch2, step: 0.002, format: (v) => v.toFixed(3) }, (v) => { cosmo.omch2 = v; updateSpectrum(); });
    panel.slider('Ω_k (curvature)', { min: -0.1, max: 0.1, value: 0, step: 0.002, format: (v) => (v > 0 ? '+' : '') + v.toFixed(3) }, (v) => { cosmo.omk = v; updateSpectrum(); });
    panel.slider('n_s', { min: 0.8, max: 1.1, value: cosmo.ns, step: 0.005, format: (v) => v.toFixed(3) }, (v) => { cosmo.ns = v; updateSpectrum(); });
    panel.slider('A_s', { min: 0.5, max: 5, value: cosmo.As, step: 0.05, unit: '×10⁻⁹', format: (v) => v.toFixed(2) }, (v) => { cosmo.As = v; updateSpectrum(); });
    panel.select('ℓ band', [
      { value: 'all', label: 'All ℓ' }, { value: 'low', label: 'ℓ ≤ 30 (Sachs–Wolfe)' },
      { value: 'peak1', label: '120–350 (1st peak)' }, { value: 'high', label: 'ℓ ≥ 350' },
    ], band, (v) => { band = v; dirty = true; loop.invalidate(); });
    panel.select('View', [{ value: 'globe', label: 'Globe' }, { value: 'mollweide', label: 'Mollweide' }], projection, (v) => { projection = v; loop.invalidate(); });
    panel.select('Quality', [
      { value: 'low', label: 'ℓ ≤ 128' }, { value: 'mid', label: 'ℓ ≤ 256' }, { value: 'high', label: 'ℓ ≤ 512' },
    ], q, (v) => { q = v; freeRes(); dirty = true; loop.invalidate(); });
    panel.toggle('Add our dipole', dipole, (v) => { dipole = v; dirty = true; loop.invalidate(); });
    panel.button('New sky', () => { seed++; uploadAlm(); dirty = true; loop.invalidate(); });
    panel.button('Planck values', () => { Object.assign(cosmo, PLANCK); ctlReset(); updateSpectrum(); });
    const rPeak = panel.readout('1st peak ℓ ≈');
    const rTheta = panel.readout('θ* =');
    const rRs = panel.readout('r_s =');
    const rSig = panel.readout('σ_T =');
    const rMs = panel.readout('synthesis');

    function ctlReset() {
      // reflect preset in sliders: rebuild slider values (index order matches creation)
      const inputs = panel.el.querySelectorAll<HTMLInputElement>('input[type=range]');
      const vals = [
        (PLANCK.ombh2 - 0.005) / 0.045, (PLANCK.omch2 - 0.05) / 0.25, 0.5, (PLANCK.ns - 0.8) / 0.3, (PLANCK.As - 0.5) / 4.5,
      ];
      inputs.forEach((inp, i) => { if (vals[i] !== undefined) { inp.value = String(vals[i] * 1000); inp.dispatchEvent(new Event('input')); } });
    }

    function readouts() {
      let lp = 0, best = 0;
      for (let l = 100; l < 400; l++) if (Dl[l] > best) { best = Dl[l]; lp = l; }
      rPeak.set(String(lp));
      rTheta.set(`${fmt((derived.theta * 180) / Math.PI, 3)}°`);
      rRs.set(`${fmt(derived.rs, 3)} Mpc`);
      rSig.set(`${fmt(sigma, 3)} μK`);
      rMs.set(genMs ? `${genMs.toFixed(1)} ms` : '…');
      lo.textContent = `−${fmt(scale, 2)} μK`;
      hi.textContent = `+${fmt(scale, 2)} μK`;
    }

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
