// Appendix A8 flagship: Fourier synthesis and analysis.
// Top: a signal sampled at fs = 256 Hz for 2 s (N = 512 samples). Bottom: its power spectrum,
// computed by an in-place radix-2 Cooley–Tukey FFT (below), optionally with a Hann window.
// Presets: square / sawtooth / triangle built from K harmonics (Gibbs ringing), a chirp,
// two tones buried in noise, and a single tone you can push past the Nyquist frequency to alias.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const N = 512;
const FS = 256; // Hz
const DUR = N / FS; // 2 s
const NYQ = FS / 2;

/** In-place iterative radix-2 FFT. re/im have length n = 2^m. O(n log n). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  // 1. bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // 2. log2(n) passes of butterflies; each combines two half-size DFTs
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0; // twiddle factor e^{-2πik/len}
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

type Sig = 'square' | 'saw' | 'triangle' | 'chirp' | 'tones' | 'alias';

// Deterministic Gaussian noise so the picture doesn't flicker when you move a slider.
function gaussNoise(n: number, seed = 12345) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  return out;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const timeStage = createStage(host, { aspect: 2.6 });
    const specStage = createStage(host, { aspect: 2.6 });
    specStage.el.style.borderTop = '1px solid var(--rule)';
    const tplot = new Plot(timeStage.canvas, { x: { min: 0, max: 1, label: 'time (s)' }, y: { min: -1.6, max: 1.6 }, title: 'Signal' });
    const splot = new Plot(specStage.canvas, {
      x: { min: 0, max: NYQ, label: 'frequency (Hz)' },
      y: { min: 1e-8, max: 3, log: true, label: 'power' },
      title: 'Power spectrum |X(f)|²',
    });

    let sig: Sig = 'square';
    let terms = 5, f1 = 60, ftone = 40, noise = 0, hann = false;
    const F0 = 2; // fundamental of the periodic presets (Hz)
    const white = gaussNoise(N);

    const x = new Float64Array(N), re = new Float64Array(N), im = new Float64Array(N);
    const power = new Float64Array(N / 2 + 1), freqs = new Float64Array(N / 2 + 1), times = new Float64Array(N);
    for (let i = 0; i < N; i++) times[i] = i / FS;
    for (let k = 0; k <= N / 2; k++) freqs[k] = (k * FS) / N;

    // Continuous-time signal (before sampling), so we can draw the "true" curve too.
    function signal(t: number): number {
      switch (sig) {
        case 'square': { let s = 0; for (let k = 1; k <= terms; k++) { const n = 2 * k - 1; s += Math.sin(2 * Math.PI * n * F0 * t) / n; } return (4 / Math.PI) * s; }
        case 'saw': { let s = 0; for (let k = 1; k <= terms; k++) s += ((k % 2 ? 1 : -1) * Math.sin(2 * Math.PI * k * F0 * t)) / k; return (2 / Math.PI) * s; }
        case 'triangle': { let s = 0; for (let k = 1; k <= terms; k++) { const n = 2 * k - 1; s += ((k % 2 ? 1 : -1) * Math.sin(2 * Math.PI * n * F0 * t)) / (n * n); } return (8 / (Math.PI * Math.PI)) * s; }
        case 'chirp': { const fa = 2; return Math.sin(2 * Math.PI * (fa * t + ((f1 - fa) * t * t) / (2 * DUR))); }
        case 'tones': return Math.sin(2 * Math.PI * 20 * t) + 0.3 * Math.sin(2 * Math.PI * 23 * t + 1) + 0.05 * Math.sin(2 * Math.PI * 71 * t);
        case 'alias': return Math.sin(2 * Math.PI * ftone * t + 0.3);
      }
    }
    function target(t: number): number {
      const ph = (t * F0) % 1;
      if (sig === 'square') return ph < 0.5 ? 1 : -1;
      if (sig === 'saw') return 2 * ((ph + 0.5) % 1) - 1;
      if (sig === 'triangle') return ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4;
      return NaN;
    }

    function analyse() {
      let wsum = 0;
      for (let i = 0; i < N; i++) {
        x[i] = signal(times[i]) + noise * white[i];
        const w = hann ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N) : 1;
        wsum += w;
        re[i] = x[i] * w; im[i] = 0;
      }
      fft(re, im);
      // normalise so a unit-amplitude sinusoid on a bin centre gives power 1
      const norm = 4 / (wsum * wsum);
      for (let k = 0; k <= N / 2; k++) power[k] = (re[k] * re[k] + im[k] * im[k]) * norm * (k === 0 || k === N / 2 ? 0.25 : 1);
    }

    let building = 0; // >0 while the "build it" animation runs
    let buildTimer = 0;
    // "Build it up" animation: add one harmonic every 0.35 s.
    const loop = new Loop((dt) => {
      if (!building) return;
      buildTimer += dt;
      if (buildTimer > 0.35) {
        buildTimer = 0;
        if (terms < 32) { terms++; termsCtl.set(terms); } else building = 0;
      }
    }, render, 1 / 60);

    function render() {
      analyse();
      const tmax = sig === 'alias' ? 0.25 : sig === 'chirp' || sig === 'tones' ? DUR : 1;
      tplot.o.x.max = tmax;
      tplot.o.y.min = sig === 'tones' ? -2.2 - 2 * noise : -1.6 - 2 * noise;
      tplot.o.y.max = -tplot.o.y.min;
      tplot.draw(() => {
        if (sig === 'square' || sig === 'saw' || sig === 'triangle') tplot.fn(target, { color: pal.faint, dash: [4, 4], width: 1.2, samples: 1200 });
        if (sig === 'alias') {
          tplot.fn(signal, { color: pal.faint, width: 1, samples: 1500 });
          // the lowest-frequency sinusoid through the same samples
          const fal = ftone - FS * Math.round(ftone / FS); // alias: same samples, |f| ≤ Nyquist
          if (ftone > NYQ) tplot.fn((t) => Math.sin(2 * Math.PI * fal * t + 0.3), { color: pal.accent3, dash: [5, 3], width: 1.4 });
          const nshow = Math.round(tmax * FS);
          tplot.scatter(times.subarray(0, nshow + 1), x.subarray(0, nshow + 1), { size: 5, color: pal.accent });
        } else {
          tplot.line(times, x, { color: pal.accent, width: 1.5 });
        }
      });
      splot.draw(() => {
        splot.line(freqs, power.map((p) => Math.max(p, 1e-12)), { color: pal.accent2, width: 1.4 });
        if (sig === 'alias') {
          splot.vline(Math.min(ftone, NYQ - 0.5), { color: ftone > NYQ ? pal.bad : pal.good, label: ftone > NYQ ? `true tone: ${fmt(ftone, 3)} Hz (beyond Nyquist)` : 'true tone' });
        }
      });
    }

    timeStage.onResize((w, h, d) => { tplot.resize(w, h, d); loop.invalidate(); });
    specStage.onResize((w, h, d) => { splot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.select<Sig>('Signal', [
      { value: 'square', label: 'Square wave' },
      { value: 'saw', label: 'Sawtooth' },
      { value: 'triangle', label: 'Triangle' },
      { value: 'chirp', label: 'Chirp (rising pitch)' },
      { value: 'tones', label: 'Two close tones' },
      { value: 'alias', label: 'Single tone (aliasing)' },
    ], sig, (v) => { sig = v; showControls(); loop.invalidate(); });
    const termsCtl = panel.slider('Harmonics', { min: 1, max: 32, value: terms, step: 1, format: (v) => String(Math.round(v)) }, (v) => { terms = Math.round(v); building = 0; loop.invalidate(); });
    const buildBtn = panel.button('Build it up', () => { terms = 1; termsCtl.set(1); building = 1; buildTimer = 0; loop.invalidate(); });
    const chirpCtl = panel.slider('Final frequency', { min: 5, max: 125, value: f1, step: 1, unit: 'Hz' }, (v) => { f1 = v; loop.invalidate(); });
    const toneCtl = panel.slider('Tone frequency', { min: 1, max: 400, value: ftone, step: 1, unit: 'Hz' }, (v) => { ftone = v; loop.invalidate(); });
    panel.slider('Noise', { min: 0, max: 2, value: noise, step: 0.01 }, (v) => { noise = v; loop.invalidate(); });
    panel.toggle('Hann window', hann, (v) => { hann = v; loop.invalidate(); });
    const info = panel.readout(`fs = ${FS} Hz · N = ${N} · Nyquist = ${NYQ} Hz · Δf =`);
    info.set(`${fmt(FS / N, 3)} Hz`);

    function showControls() {
      const periodic = sig === 'square' || sig === 'saw' || sig === 'triangle';
      termsCtl.el.style.display = periodic ? '' : 'none';
      buildBtn.style.display = periodic ? '' : 'none';
      chirpCtl.el.style.display = sig === 'chirp' ? '' : 'none';
      toneCtl.el.style.display = sig === 'alias' ? '' : 'none';
      if (!periodic) building = 0;
    }
    showControls();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
