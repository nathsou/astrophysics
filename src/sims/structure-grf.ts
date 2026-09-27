// Chapter 28: a 2D Gaussian random field built in Fourier space, with its measured power spectrum.
// White noise → FFT → multiply by √P(k) → inverse FFT. The right panel bins |δ_k|² in rings of |k|.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { fft2d, rng, Tbbks } from './structure/cosmo';

const N = 256;
const BOX = 3000; // Mpc/h, for the ΛCDM-shaped option (so the turnover at k_eq is on screen)

type Shape = 'power' | 'lcdm';

function colour(t: number): [number, number, number] {
  // diverging-ish "cosmic" map: deep blue (underdense) → near black → amber → white (overdense)
  t = Math.max(0, Math.min(1, t));
  const stops: [number, number, number, number][] = [
    [0, 40, 70, 170], [0.42, 16, 20, 40], [0.5, 30, 28, 36], [0.7, 210, 110, 40], [1, 255, 244, 225],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
    }
  }
  return [255, 244, 225];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const fieldStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 });
    const ctx = fieldStage.canvas.getContext('2d')!;
    const off = document.createElement('canvas');
    off.width = off.height = N;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(N, N);

    const plot = new Plot(plotStage.canvas, {
      x: { min: 1, max: 181, log: true, label: 'wavenumber k (cycles per box)' },
      y: { min: 1e-6, max: 1e2, log: true, label: 'P(k) (arbitrary units)' },
      title: 'Power spectrum: measured (dots) vs input (line)',
    });

    let n = -1.5, shape: Shape = 'power', seed = 3;
    const re = new Float64Array(N * N), im = new Float64Array(N * N);
    const white = new Float64Array(N * N * 2); // cached FFT of the white noise
    const NB = 28;
    const binK = new Float64Array(NB), binP = new Float64Array(NB), binN = new Float64Array(NB);
    let pNorm = 1;

    const kOf = (i: number) => (i <= N / 2 ? i : i - N);
    const lcdmK0 = 2 * Math.PI / BOX;
    const P = (k: number) => {
      if (k === 0) return 0;
      if (shape === 'power') return Math.pow(k, n);
      const kp = k * lcdmK0; // h/Mpc
      const T = Tbbks(kp);
      return kp * T * T;
    };

    function noise() {
      const r = rng(seed);
      for (let i = 0; i < N * N; i++) { re[i] = r.gauss(); im[i] = 0; }
      fft2d(re, im, N, -1);
      for (let i = 0; i < N * N; i++) { white[2 * i] = re[i]; white[2 * i + 1] = im[i]; }
    }

    function build() {
      // normalise P so the plotted curve peaks near 1
      pNorm = 0;
      for (let k = 1; k < 182; k++) pNorm = Math.max(pNorm, P(k));
      binP.fill(0); binN.fill(0); binK.fill(0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, k = Math.hypot(kOf(x), kOf(y));
        const a = Math.sqrt(P(k) / pNorm);
        re[i] = white[2 * i] * a; im[i] = white[2 * i + 1] * a;
        if (k >= 1) {
          const b = Math.min(NB - 1, Math.floor((Math.log(k) / Math.log(182)) * NB));
          binP[b] += (re[i] * re[i] + im[i] * im[i]) / (N * N); binK[b] += k; binN[b]++;
        }
      }
      fft2d(re, im, N, 1);
      let s2 = 0;
      for (let i = 0; i < N * N; i++) s2 += re[i] * re[i];
      const rms = Math.sqrt(s2 / (N * N)) || 1;
      for (let i = 0; i < N * N; i++) {
        const [r, g, b] = colour(0.5 + re[i] / rms / 5.0);
        img.data[4 * i] = r; img.data[4 * i + 1] = g; img.data[4 * i + 2] = b; img.data[4 * i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      loop.invalidate();
    }

    const loop = new Loop(null, render);

    function render() {
      const { width: W, height: H, dpr } = fieldStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, W, H);
      ctx.font = '12px Inter, system-ui, sans-serif';
      const lbl = shape === 'power' ? `P(k) ∝ k^${fmt(n, 3)}` : `ΛCDM-like, box ${BOX} Mpc/h`;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(4, 4, ctx.measureText(lbl).width + 12, 20);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(lbl, 10, 18);
      plot.draw(() => {
        plot.fn((k) => P(k) / pNorm, { color: pal.accent, width: 2, samples: 300 });
        for (let b = 0; b < NB; b++) if (binN[b]) plot.point(binK[b] / binN[b], binP[b] / binN[b], { r: 3, color: pal.series[1] });
        if (shape === 'lcdm') {
          const kEq = 0.015 / lcdmK0; // turnover ~ k_eq in cycles per box
          plot.vline(kEq, { color: pal.faint, dash: [3, 3], label: 'k_eq' });
        }
      });
    }

    fieldStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    const slope = panel.slider('Spectral index n', { min: -3, max: 1, value: n, step: 0.05 }, (v) => { n = v; build(); });
    panel.select<Shape>('Spectrum', [{ value: 'power', label: 'Power law kⁿ' }, { value: 'lcdm', label: 'ΛCDM-shaped (BBKS)' }], shape, (v) => {
      shape = v; slope.el.style.opacity = v === 'power' ? '1' : '0.4'; build();
    });
    panel.button('New seed', () => { seed = (seed * 48271) % 2147483647; noise(); build(); });

    noise();
    build();
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
