// Chapter 20: matched filtering. White Gaussian noise (think "whitened detector data") hides a
// Newtonian chirp; a bank of templates in chirp mass is correlated against the data via FFT,
// maximising over arrival time and phase. SNR vs chirp mass peaks at the true value.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { fft, T_SUN, fISCO } from './gravitational-waves/physics';

const FS = 1024; // Hz
const N = 8192; // 8 s
const F_LOW = 35;
const NT = 90;
const MC_MIN = 5, MC_MAX = 50;
const bankMc = Float64Array.from({ length: NT }, (_, i) => MC_MIN * Math.pow(MC_MAX / MC_MIN, i / (NT - 1)));

/** Newtonian chirp for chirp mass Mc (equal masses assumed for the cut-off), merging at sample `end`. */
function chirp(Mc: number, end: number, phi0: number, out: Float64Array) {
  out.fill(0);
  const tMc = Mc * T_SUN;
  const fEnd = Math.min(0.45 * FS, fISCO(Mc * Math.pow(2, 6 / 5)));
  const tauStart = (5 / 256) * Math.pow(Math.PI * F_LOW, -8 / 3) * Math.pow(tMc, -5 / 3);
  const tauEnd = (5 / 256) * Math.pow(Math.PI * fEnd, -8 / 3) * Math.pow(tMc, -5 / 3);
  let norm = 0;
  for (let n = end; n >= 0; n--) {
    const tau = tauEnd + (end - n) / FS;
    if (tau > tauStart) break;
    // Φ(τ) = −2 (τ / 5 Mc)^{5/8}  (GW phase, Newtonian)
    const phase = phi0 - 2 * Math.pow(tau / (5 * tMc), 5 / 8);
    const f = (1 / Math.PI) * Math.pow(5 / (256 * tau), 3 / 8) * Math.pow(tMc, -5 / 8);
    const taper = Math.min(1, (tauStart - tau) / 0.15) * Math.min(1, (tau - tauEnd) * FS / 8 + 0.2);
    out[n] = Math.pow(f, 2 / 3) * Math.cos(phase) * taper;
    norm += out[n] * out[n];
  }
  return Math.sqrt(norm);
}

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));';
    host.append(grid);
    const sData = createStage(grid, { aspect: 1.7 });
    const sSnr = createStage(grid, { aspect: 1.7 });
    const dataPlot = new Plot(sData.canvas, { x: { min: 0, max: 8, label: 'time (s)' }, y: { min: -5, max: 5, label: 'whitened strain (σ)' }, title: 'Data = noise + hidden signal; blue: SNR(t) of best template' });
    const snrPlot = new Plot(sSnr.canvas, { x: { min: MC_MIN, max: MC_MAX, log: true, label: 'template chirp mass ℳ (M☉)', ticks: [5, 10, 20, 50], format: (v) => String(v) }, y: { min: 0, max: 20, label: 'peak SNR ρ' }, title: 'Template bank: SNR vs ℳ' });

    let trueMc = 20, rho = 10, showSig = false;
    const data = new Float64Array(N), sig = new Float64Array(N), tmp = new Float64Array(N);
    const Dre = new Float64Array(N), Dim = new Float64Array(N), Zre = new Float64Array(N), Zim = new Float64Array(N);
    const snr = new Float64Array(NT);
    let snrT = new Float64Array(N), bestIdx = 0, bestLag = 0, tMerge = 6;
    let noise = new Float64Array(N);
    const newNoise = () => { noise = Float64Array.from({ length: N }, gauss); };

    // template spectra cached once (bank is fixed): conj not stored, done in the product
    const bankRe: Float32Array[] = [], bankIm: Float32Array[] = [], bankNorm = new Float64Array(NT);
    const TEND = N - 32;
    for (let k = 0; k < NT; k++) {
      bankNorm[k] = chirp(bankMc[k], TEND, 0, tmp);
      const re = Float64Array.from(tmp), im = new Float64Array(N);
      fft(re, im);
      bankRe.push(Float32Array.from(re)); bankIm.push(Float32Array.from(im));
    }

    let phi0 = 0;
    function makeData() {
      const end = Math.round(tMerge * FS);
      const nrm = chirp(trueMc, end, phi0, sig);
      for (let i = 0; i < N; i++) { sig[i] *= rho / nrm; data[i] = noise[i] + sig[i]; }
      Dre.set(data); Dim.fill(0); fft(Dre, Dim);
      let best = -1;
      for (let k = 0; k < NT; k++) {
        const hr = bankRe[k], hi = bankIm[k];
        // one-sided product → analytic correlation (in-phase + quadrature template at once)
        for (let j = 0; j < N; j++) {
          if (j === 0 || j > N / 2) { Zre[j] = 0; Zim[j] = 0; continue; }
          Zre[j] = 2 * (Dre[j] * hr[j] + Dim[j] * hi[j]);
          Zim[j] = 2 * (Dim[j] * hr[j] - Dre[j] * hi[j]);
        }
        fft(Zre, Zim, true);
        let mx = 0, lag = 0;
        const s = 1 / (N * bankNorm[k]);
        for (let j = 0; j < N; j++) { const v = Math.hypot(Zre[j], Zim[j]) * s; if (v > mx) { mx = v; lag = j; } }
        snr[k] = mx;
        if (mx > best) {
          best = mx; bestIdx = k; bestLag = lag;
          for (let j = 0; j < N; j++) snrT[j] = Math.hypot(Zre[j], Zim[j]) * s;
        }
      }
      snrPlot.o.y.max = Math.max(12, Math.ceil(Math.max(...snr) * 1.25 / 2) * 2);
      loop.invalidate();
    }

    const loop = new Loop(null, render);

    loop.onDemand = true;
    onDestroy(onThemeChange(() => { pal = palette(); loop.invalidate(); }));
    const X = new Float64Array(N / 2), Y = new Float64Array(N / 2), Ys = new Float64Array(N / 2), Yt = new Float64Array(N / 2);

    function render() {
      for (let i = 0; i < N / 2; i++) {
        X[i] = (2 * i) / FS; Y[i] = data[2 * i]; Ys[i] = sig[2 * i] * 4;
        // SNR time series of the best template, placed at the template's merger time
        const lag = (2 * i - TEND + N) % N;
        Yt[i] = snrT[lag];
      }
      dataPlot.draw(() => {
        dataPlot.line(X, Y, { color: pal.faint, width: 0.8 });
        if (showSig) dataPlot.line(X, Ys, { color: pal.accent, width: 1.3 });
        const mx = Math.max(...snr);
        const scale = 4.5 / Math.max(mx, 8);
        dataPlot.line(X, Array.from(Yt, (v) => v * scale - 4.8), { color: pal.series[1], width: 1.3 });
        if (showSig) dataPlot.text('true signal ×4', dataPlot.m.l + 6, dataPlot.m.t + 14, { color: pal.accent });
      });
      snrPlot.draw(() => {
        snrPlot.hline(8, { label: 'detection threshold ρ ≈ 8', color: pal.bad });
        snrPlot.vline(trueMc, { label: `true ℳ = ${fmt(trueMc, 3)}`, color: pal.accent2 });
        snrPlot.line(bankMc, snr, { color: pal.accent, width: 1.8 });
        snrPlot.scatter(bankMc, snr, { size: 3, color: pal.accent });
        snrPlot.point(bankMc[bestIdx], snr[bestIdx], { r: 5, color: pal.good, label: `best ${fmt(bankMc[bestIdx], 3)} M☉, ρ = ${fmt(snr[bestIdx], 3)}` });
      });
      void bestLag;
    }

    sData.onResize((w, h, d) => { dataPlot.resize(w, h, d); loop.invalidate(); });
    sSnr.onResize((w, h, d) => { snrPlot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('True ℳ', { min: MC_MIN, max: MC_MAX, value: trueMc, log: true, step: 0.1, unit: 'M☉' }, (v) => { trueMc = v; makeData(); });
    panel.slider('Optimal SNR', { min: 2, max: 30, value: rho, step: 0.5 }, (v) => { rho = v; makeData(); });
    panel.button('New noise', () => { newNoise(); phi0 = Math.random() * 2 * Math.PI; tMerge = 5 + 2.5 * Math.random(); makeData(); });
    panel.toggle('Reveal signal', showSig, (v) => { showSig = v; loop.invalidate(); });

    newNoise();
    makeData();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
