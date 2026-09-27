// Chapter 20 flagship: a binary black hole inspiral, merger and ringdown.
// The waveform timeline (phase, amplitude, frequency, separation vs time) is precomputed on the CPU
// from the quadrupole formula (+ a stylised merger and a QNM ringdown), uploaded once as a storage
// buffer, and every vertex of a 320×320 grid evaluates the retarded-time h+ field from it on the GPU.
// Units on the GPU: G = c = 1, total mass M = 1 (lengths and times in M). f32 throughout.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { requireDevice, configureCanvas } from '../lib/runtime/gpu';
import { OrbitCamera } from '../lib/runtime/camera';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange, cssColor, currentTheme } from '../lib/ui/theme';
import shaderCode from './gravitational-waves/inspiral.wgsl?raw';
import {
  buildTimeline, sample, chirpMass, symMassRatio, T_SUN, L_SUN_GEOM, MPC, C5_OVER_G, type Timeline,
} from './gravitational-waves/physics';

const GRID_N = 320;
const GRID_HALF = 420; // M
const N_SAMPLES = 16384;
const BH_VIS = 3; // horizon radii are drawn 3× larger than 2m so they are visible at this zoom
const UNIFORM_SIZE = 256;

const PRESETS: Record<string, { m1: number; m2: number; D: number; inc: number }> = {
  GW150914: { m1: 36, m2: 29, D: 440, inc: 30 },
  'Equal 10+10': { m1: 10, m2: 10, D: 300, inc: 0 },
  'Unequal 30+8': { m1: 30, m2: 8, D: 800, inc: 45 },
};

export default defineSim({
  gpu: true,
  async mount({ host, onDestroy }) {
    const device = await requireDevice();
    let pal = palette();

    // ---------- layout ----------
    const stage = createStage(host, { aspect: 16 / 9 });
    const plots = document.createElement('div');
    plots.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));border-top:1px solid var(--rule);';
    host.append(plots);
    const waveStage = createStage(plots, { aspect: 2.1 });
    const chirpStage = createStage(plots, { aspect: 2.1 });
    const { ctx, format } = configureCanvas(stage.canvas, device);

    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;left:12px;top:10px;line-height:1.5;';
    stage.overlay.append(label);

    // ---------- GPU resources ----------
    const module = device.createShaderModule({ code: shaderCode });
    if (import.meta.env.DEV) module.getCompilationInfo().then((info) => { for (const m of info.messages) console[m.type === 'error' ? 'error' : 'warn']('inspiral.wgsl', m.lineNum, m.message); });
    const ubuf = device.createBuffer({ size: UNIFORM_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const tlbuf = device.createBuffer({ size: N_SAMPLES * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    // index buffer for the grid (two triangles per cell)
    const nIdx = (GRID_N - 1) * (GRID_N - 1) * 6;
    const idx = new Uint32Array(nIdx);
    for (let j = 0, k = 0; j < GRID_N - 1; j++)
      for (let i = 0; i < GRID_N - 1; i++) {
        const a = j * GRID_N + i, b = a + 1, c = a + GRID_N, d = c + 1;
        idx.set([a, b, d, a, d, c], k); k += 6;
      }
    const ibuf = device.createBuffer({ size: idx.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ibuf, 0, idx);
    onDestroy(() => { ubuf.destroy(); tlbuf.destroy(); ibuf.destroy(); });

    const blend: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const gridPipe = device.createRenderPipeline({
      layout: pipeLayout,
      vertex: { module, entryPoint: 'vsGrid' },
      fragment: { module, entryPoint: 'fsGrid', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' },
    });
    const bhPipe = device.createRenderPipeline({
      layout: pipeLayout,
      vertex: { module, entryPoint: 'vsBH' },
      fragment: { module, entryPoint: 'fsBH', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' },
    });
    const bind = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: tlbuf } }] });
    const U = new Float32Array(UNIFORM_SIZE / 4);

    const cam = new OrbitCamera(stage.canvas, { distance: 340, pitch: 0.62, yaw: -1.1, near: 1, far: 5000, minDistance: 30, maxDistance: 1200, autoRotate: 0.04 });

    // ---------- physics state ----------
    let m1 = 36, m2 = 29, Dmpc = 440, incDeg = 30;
    let tl: Timeline = buildTimeline(symMassRatio(m1, m2), 15, N_SAMPLES);
    let t = 0; // source time in M
    let holdTimer = 0;
    let w0 = 0;

    function rebuild() {
      const eta = symMassRatio(m1, m2);
      const r0 = Math.max(10, 15 * Math.pow(eta / 0.25, 0.4)); // keep the number of cycles (and play time) modest
      tl = buildTimeline(eta, r0, N_SAMPLES);
      device.queue.writeBuffer(tlbuf, 0, tl.data);
      w0 = tl.omega[0];
      t = tl.t0;
      holdTimer = 0;
      chirpCacheValid = false;
      updateReadouts();
    }

    const Mtot = () => m1 + m2;
    const Tm = () => Mtot() * T_SUN; // seconds per M
    const MoverD = () => (Mtot() * L_SUN_GEOM) / (Dmpc * MPC);
    const inc = () => (incDeg * Math.PI) / 180;
    /** Observed strain polarisations at source time ts. */
    const hObs = (ts: number) => {
      const A = ts < tl.t0 ? 0 : sample(tl, tl.amp, ts), Ph = sample(tl, tl.phase, ts);
      const ci = Math.cos(inc());
      return [A * MoverD() * 0.5 * (1 + ci * ci) * Math.cos(Ph), A * MoverD() * ci * Math.sin(Ph)];
    };

    // ---------- audio ----------
    let actx: AudioContext | null = null;
    let osc1: OscillatorNode | null = null, osc2: OscillatorNode | null = null, gain: GainNode | null = null;
    let listening = false;
    function startAudio() {
      if (!actx) {
        actx = new AudioContext();
        gain = actx.createGain(); gain.gain.value = 0;
        const g2 = actx.createGain(); g2.gain.value = 0.22;
        osc1 = actx.createOscillator(); osc1.type = 'sine';
        osc2 = actx.createOscillator(); osc2.type = 'sine';
        osc1.connect(gain); osc2.connect(g2); g2.connect(gain);
        gain.connect(actx.destination);
        osc1.start(); osc2.start();
      }
      actx.resume();
    }
    function updateAudio() {
      if (!actx || !gain || !osc1 || !osc2) return;
      const now = actx.currentTime;
      if (!listening || loop.paused || !visible) { gain.gain.setTargetAtTime(0, now, 0.03); return; }
      const w = sample(tl, tl.omega, t);
      // pitch: map the chirp's frequency ratio onto an audible sweep starting at 70 Hz
      const fa = Math.min(2000, 70 * (w / w0));
      const A = t < tl.t0 || t > tl.tEnd ? 0 : sample(tl, tl.amp, t) / tl.peakAmp;
      osc1.frequency.setTargetAtTime(fa, now, 0.015);
      osc2.frequency.setTargetAtTime(2 * fa, now, 0.015);
      gain.gain.setTargetAtTime(0.35 * A, now, 0.02);
    }
    onDestroy(() => { actx?.close(); });

    // ---------- time stepping ----------
    let visible = false;
    const loop = new Loop((dt) => {
      if (t > tl.tEnd) {
        holdTimer += dt;
        if (holdTimer > 1.5) { t = tl.t0; holdTimer = 0; }
        return;
      }
      const w = sample(tl, tl.omega, Math.max(t, tl.t0));
      const P = (2 * Math.PI) / w; // GW period in M
      const rate = Math.min(2500, Math.max(22, P / 0.32)); // ~0.32 s of wall time per GW cycle
      t += rate * dt;
    }, render, 1 / 120);

    // ---------- plots ----------
    const wavePlot = new Plot(waveStage.canvas, {
      x: { min: -1, max: 0, label: 't − t_merger (ms)' },
      y: { min: -1, max: 1, label: 'strain (10⁻²¹)' },
      title: 'Waveform at Earth: h₊ (solid), h× (dashed)',
      margin: { l: 44, r: 12, t: 26, b: 38 },
    });
    const chirpPlot = new Plot(chirpStage.canvas, {
      x: { min: -1, max: 0, label: 't − t_merger (s)' },
      y: { min: 10, max: 1000, log: true, label: 'f_GW (Hz)' },
      title: 'Chirp track (spectrogram ridge)',
      margin: { l: 44, r: 12, t: 26, b: 38 },
    });
    let chirpCacheValid = false;
    const CN = 600;
    const cT = new Float64Array(CN), cF = new Float64Array(CN), cA = new Float64Array(CN);
    const WN = 500;
    const wx = new Float64Array(WN), wp = new Float64Array(WN), wc = new Float64Array(WN);

    function drawPlots() {
      const tm = Tm();
      // waveform strip: the last ~8 GW cycles (or 150 M)
      const w = sample(tl, tl.omega, Math.max(t, tl.t0));
      const win = Math.max(150, (8 * 2 * Math.PI) / w);
      const tNow = Math.min(t, tl.tEnd);
      const hmax = tl.peakAmp * MoverD() * 1.05e21;
      wavePlot.o.x.min = (tNow - win) * tm * 1e3; wavePlot.o.x.max = tNow * tm * 1e3 + 1e-9;
      wavePlot.o.y.min = -hmax; wavePlot.o.y.max = hmax;
      for (let i = 0; i < WN; i++) {
        const ts = tNow - win + (win * i) / (WN - 1);
        const [hp, hc] = hObs(ts);
        wx[i] = ts * tm * 1e3; wp[i] = hp * 1e21; wc[i] = hc * 1e21;
      }
      wavePlot.draw(() => {
        wavePlot.line(wx, wc, { color: pal.series[1], dash: [4, 3], width: 1.2, alpha: 0.8 });
        wavePlot.line(wx, wp, { color: pal.accent, width: 1.6 });
      });
      // chirp track
      if (!chirpCacheValid) {
        for (let i = 0; i < CN; i++) {
          const ts = tl.t0 + ((tl.tEnd - tl.t0) * i) / (CN - 1);
          cT[i] = ts * tm; cF[i] = sample(tl, tl.omega, ts) / (2 * Math.PI * tm); cA[i] = sample(tl, tl.amp, ts) / tl.peakAmp;
        }
        chirpPlot.o.x.min = tl.t0 * tm; chirpPlot.o.x.max = tl.tEnd * tm;
        chirpPlot.o.y.min = Math.pow(10, Math.floor(Math.log10(cF[0] * 0.8) * 2) / 2);
        chirpPlot.o.y.max = Math.pow(10, Math.ceil(Math.log10(cF[CN - 1] * 1.3) * 2) / 2);
        chirpCacheValid = true;
      }
      const ctx2 = chirpPlot.ctx;
      chirpPlot.draw(() => {
        chirpPlot.line(cT, cF, { color: pal.faint, dash: [3, 3], width: 1 });
        // "spectrogram" ridge: thick glowing strokes whose opacity follows the amplitude
        ctx2.lineCap = 'round';
        for (let i = 1; i < CN && cT[i] <= t * tm; i++) {
          ctx2.strokeStyle = pal.accent;
          ctx2.globalAlpha = 0.15 + 0.85 * cA[i];
          ctx2.lineWidth = 2 + 7 * cA[i];
          ctx2.beginPath();
          ctx2.moveTo(chirpPlot.px(cT[i - 1]), chirpPlot.py(cF[i - 1]));
          ctx2.lineTo(chirpPlot.px(cT[i]), chirpPlot.py(cF[i]));
          ctx2.stroke();
        }
        ctx2.globalAlpha = 1;
        if (chirpPlot.o.y.min < 20 && chirpPlot.o.y.max > 20) chirpPlot.hline(20, { label: 'LIGO seismic wall ~20 Hz' });
        const tt = Math.min(Math.max(t, tl.t0), tl.tEnd);
        chirpPlot.point(tt * tm, sample(tl, tl.omega, tt) / (2 * Math.PI * tm), { r: 4, color: pal.accent2 });
      });
    }

    // ---------- render ----------
    let colsPos = cssColor('--accent'), colsNeg = cssColor('--series-2'), colLine = cssColor('--fg-muted');
    const readTheme = () => {
      pal = palette();
      colsPos = cssColor('--accent'); colsNeg = cssColor('--series-2'); colLine = cssColor('--fg-muted');
      loop.invalidate();
    };
    onDestroy(onThemeChange(readTheme));

    function render(_a: number, frameDt: number) {
      if (cam.update(frameDt)) { /* auto-rotate */ }
      const aspect = stage.width / stage.height;
      const vp = cam.viewProj(aspect);
      const view = cam.viewMatrix();
      const tt = Math.max(t, tl.t0);
      const sep = sample(tl, tl.sep, tt);
      const phiOrb = 0.5 * sample(tl, tl.phase, tt);
      const q1 = m2 / Mtot(), q2 = m1 / Mtot();
      const c = Math.cos(phiOrb), s = Math.sin(phiOrb);
      const eta = tl.eta;
      const fadeRem = Math.min(1, Math.max(0, 1 - Math.min(sep, 3) / 3));
      const gain = Math.min(400, Math.max(12, (22 / (0.5 * tl.peakAmp)) * Math.pow(440 / Dmpc, 0.5)));

      U.set(vp, 0);
      U.set([t, tl.t0, tl.dt, tl.n], 16);
      U.set([GRID_HALF, gain, 25, Math.max(sep, 2)], 20);
      U.set([sep * q1 * c, sep * q1 * s, -sep * q2 * c, -sep * q2 * s], 24);
      U.set([m1 / Mtot(), m2 / Mtot(), 26, t > 0 ? 1 : 0], 28);
      U.set(colsPos, 32); U.set(colsNeg, 36);
      U.set([colLine[0], colLine[1], colLine[2], currentTheme() === 'dark' ? 0.55 : 0.7], 40);
      U.set([GRID_N, 12, currentTheme() === 'dark' ? 1 : 0, tl.rem.Mf], 44);
      U.set([view[0], view[4], view[8], 0], 48);
      U.set([view[1], view[5], view[9], 0], 52);
      U.set([BH_VIS * 2 * (m1 / Mtot()), BH_VIS * 2 * (m2 / Mtot()), BH_VIS * 2 * tl.rem.Mf, fadeRem], 56);
      void eta;
      device.queue.writeBuffer(ubuf, 0, U);

      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      });
      pass.setBindGroup(0, bind);
      pass.setPipeline(gridPipe);
      pass.setIndexBuffer(ibuf, 'uint32');
      pass.drawIndexed(nIdx);
      pass.setPipeline(bhPipe);
      pass.draw(6, 3);
      pass.end();
      device.queue.submit([enc.finish()]);

      drawPlots();
      updateReadouts();
      updateAudio();
    }

    // ---------- readouts ----------
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => { loop.paused = p; updateAudio(); });
    panel.button('Restart', () => { t = tl.t0; holdTimer = 0; loop.invalidate(); });
    const listenBtn = panel.button('♪ Listen', () => {
      listening = !listening;
      if (listening) startAudio();
      listenBtn.textContent = listening ? '■ Mute' : '♪ Listen';
      updateAudio();
    }, true);
    const presetSel = panel.select('Preset', [{ value: '', label: 'custom' }, ...Object.keys(PRESETS).map((k) => ({ value: k, label: k }))], 'GW150914', (k) => {
      const p = PRESETS[k]; if (!p) return;
      m1 = p.m1; m2 = p.m2; Dmpc = p.D; incDeg = p.inc;
      s1.set(m1); s2.set(m2); sD.set(Dmpc); sI.set(incDeg);
      rebuild();
    });
    const custom = () => presetSel.set('');
    const s1 = panel.slider('m₁', { min: 3, max: 80, value: m1, step: 0.5, unit: 'M☉' }, (v) => { m1 = v; if (m1 / m2 > 10) { m2 = m1 / 10; s2.set(m2); } custom(); rebuild(); });
    const s2 = panel.slider('m₂', { min: 3, max: 80, value: m2, step: 0.5, unit: 'M☉' }, (v) => { m2 = v; if (m2 / m1 > 10) { m1 = m2 / 10; s1.set(m1); } custom(); rebuild(); });
    const sD = panel.slider('Distance', { min: 40, max: 5000, value: Dmpc, log: true, step: 1, unit: 'Mpc', format: (v) => String(Math.round(v)) }, (v) => { Dmpc = v; custom(); updateReadouts(); });
    const sI = panel.slider('Inclination ι', { min: 0, max: 90, value: incDeg, step: 1, unit: '°', format: (v) => String(Math.round(v)) }, (v) => { incDeg = v; custom(); loop.invalidate(); });
    const rMc = panel.readout('ℳ');
    const rF = panel.readout('f_GW');
    const rH = panel.readout('h₊');
    const rL = panel.readout('L_GW');

    function updateReadouts() {
      const tm = Tm();
      const tt = Math.min(Math.max(t, tl.t0), tl.tEnd);
      const w = sample(tl, tl.omega, tt), A = sample(tl, tl.amp, tt), sep = sample(tl, tl.sep, tt);
      rMc.set(`${fmt(chirpMass(m1, m2), 3)} M☉`);
      rF.set(`${fmt(w / (2 * Math.PI * tm), 3)} Hz`);
      const ci = Math.cos(inc());
      rH.set(fmt(A * MoverD() * 0.5 * (1 + ci * ci), 2));
      rL.set(`${fmt((A * A * w * w / 10) * C5_OVER_G, 2)} W`);
      const phase = t < tl.tISCO ? 'inspiral' : t < 0 ? 'merger' : t < tl.tEnd ? 'ringdown' : 'remnant';
      const tLeft = -tt * tm;
      label.innerHTML =
        `<b style="color:var(--fg)">${phase}</b><br>` +
        (t < 0 ? `t<sub>c</sub> − t = ${tLeft > 0.1 ? fmt(tLeft, 3) + ' s' : fmt(tLeft * 1e3, 3) + ' ms'}<br>` : `remnant ${fmt(tl.rem.Mf * Mtot(), 3)} M☉, χ = ${fmt(tl.rem.chi, 2)}<br>`) +
        `separation ${sep > 0 ? fmt((sep * Mtot() * L_SUN_GEOM) / 1e3, 3) + ' km' : '—'}<br>` +
        `<span style="opacity:.8">radiated: ${fmt((1 - tl.rem.Mf) * Mtot(), 2)} M☉c²</span>`;
    }

    stage.onResize(() => loop.invalidate());
    waveStage.onResize((w, h, d) => { wavePlot.resize(w, h, d); loop.invalidate(); });
    chirpStage.onResize((w, h, d) => { chirpPlot.resize(w, h, d); loop.invalidate(); });
    cam.onChange = () => loop.invalidate();

    rebuild();

    return {
      setVisible(v) { visible = v; loop.setVisible(v); updateAudio(); },
      destroy() { loop.destroy(); },
    };
  },
});
