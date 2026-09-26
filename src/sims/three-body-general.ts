// Chapter 3 secondary figure: the general (unrestricted) three-body problem.
// Three point masses, mutual gravity, G=1. Two presets: the Chenciner–Montgomery figure-eight
// (a stable, exactly periodic solution) and the Burrau "Pythagorean" problem (3-4-5 masses from
// rest — a classic chaotic close-encounter-and-ejection example). A "shadow" copy starting 1e-9
// away shows the butterfly effect: log-separation grows linearly, its slope the Lyapunov exponent.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

type Vec12 = Float64Array; // [x,y,vx,vy] × 3 bodies

const EPS2 = 1e-6; // softening

function accelAll(s: Vec12, m: [number, number, number], out: Float64Array) {
  for (let i = 0; i < 3; i++) {
    let ax = 0, ay = 0;
    const xi = s[i * 4], yi = s[i * 4 + 1];
    for (let j = 0; j < 3; j++) {
      if (j === i) continue;
      const dx = s[j * 4] - xi, dy = s[j * 4 + 1] - yi;
      const r2 = dx * dx + dy * dy + EPS2;
      const inv = m[j] / (r2 * Math.sqrt(r2));
      ax += dx * inv; ay += dy * inv;
    }
    out[i * 4] = ax; out[i * 4 + 1] = ay;
  }
}

function derivs(s: Vec12, m: [number, number, number], acc: Float64Array, out: Vec12) {
  accelAll(s, m, acc);
  for (let i = 0; i < 3; i++) {
    out[i * 4] = s[i * 4 + 2]; out[i * 4 + 1] = s[i * 4 + 3];
    out[i * 4 + 2] = acc[i * 4]; out[i * 4 + 3] = acc[i * 4 + 1];
  }
}

function rk4(s: Vec12, m: [number, number, number], h: number) {
  const n = 12;
  const acc = new Float64Array(n), k1 = new Float64Array(n), k2 = new Float64Array(n), k3 = new Float64Array(n), k4 = new Float64Array(n), tmp = new Float64Array(n);
  derivs(s, m, acc, k1);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + (h / 2) * k1[i];
  derivs(tmp, m, acc, k2);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + (h / 2) * k2[i];
  derivs(tmp, m, acc, k3);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + h * k3[i];
  derivs(tmp, m, acc, k4);
  for (let i = 0; i < n; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

interface Preset { label: string; m: [number, number, number]; ic: number[]; span: number; }

const FIGURE_EIGHT: Preset = {
  label: 'Figure-eight', m: [1, 1, 1], span: 1.4,
  ic: [
    0.97000436, -0.24308753, 0.4662036850, 0.4323657300,
    -0.97000436, 0.24308753, 0.4662036850, 0.4323657300,
    0, 0, -0.93240737, -0.86473146,
  ],
};
const PYTHAGOREAN: Preset = {
  label: 'Pythagorean (3-4-5)', m: [3, 4, 5], span: 4.2,
  ic: [1, 3, 0, 0, -2, -1, 0, 0, 1, -1, 0, 0],
};

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);';
    host.append(wrap);
    const orbitStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 / 0.92 });
    orbitStage.el.style.borderRight = '1px solid var(--rule)';
    const ctx = orbitStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 30, label: 't' },
      y: { min: 1e-10, max: 10, log: true, label: 'separation' },
      title: 'Butterfly effect: log-separation vs time',
    });

    let preset: Preset = FIGURE_EIGHT;
    let state = new Float64Array(12);
    let shadow = new Float64Array(12);
    let m: [number, number, number] = [1, 1, 1];
    let showShadow = true;
    let speed = 1, t = 0;
    const TRAIL = 6000;
    const trails = [0, 1, 2].map(() => ({ xs: new Float32Array(TRAIL), ys: new Float32Array(TRAIL), head: 0, n: 0 }));
    const sepSeries = new Series(4000);
    let reg = { sx: 0, sy: 0, sxx: 0, sxy: 0, n: 0 };
    let lambda = 0;

    function reset() {
      m = preset.m;
      state = new Float64Array(preset.ic);
      shadow = new Float64Array(preset.ic);
      shadow[0] += 1e-9; // the "butterfly": one coordinate nudged by 1e-9
      t = 0;
      trails.forEach((tr) => { tr.n = 0; tr.head = 0; });
      sepSeries.clear();
      reg = { sx: 0, sy: 0, sxx: 0, sxy: 0, n: 0 };
      lambda = 0;
      plot.o.x.max = 30;
      plot.o.y.min = 1e-10; plot.o.y.max = Math.max(10, preset.span * 3);
    }
    reset();

    const h0 = 1 / 4000;
    const loop = new Loop((dt) => {
      const n = Math.max(1, Math.round((dt * speed) / h0));
      for (let k = 0; k < n; k++) {
        rk4(state, m, h0);
        if (showShadow) rk4(shadow, m, h0);
        t += h0;
      }
      for (let i = 0; i < 3; i++) {
        const tr = trails[i];
        tr.xs[tr.head] = state[i * 4]; tr.ys[tr.head] = state[i * 4 + 1];
        tr.head = (tr.head + 1) % TRAIL; tr.n = Math.min(tr.n + 1, TRAIL);
      }
      if (showShadow) {
        let d2 = 0;
        for (let i = 0; i < 12; i++) { const dd = state[i] - shadow[i]; d2 += dd * dd; }
        const sep = Math.sqrt(d2);
        sepSeries.push(t, Math.max(sep, 1e-16));
        if (sep > 1e-9 && sep < preset.span * 0.5) {
          const ly = Math.log(sep);
          reg.sx += t; reg.sy += ly; reg.sxx += t * t; reg.sxy += t * ly; reg.n++;
          if (reg.n > 5) {
            const nD = reg.n * reg.sxx - reg.sx * reg.sx;
            if (Math.abs(nD) > 1e-12) lambda = (reg.n * reg.sxy - reg.sx * reg.sy) / nD;
          }
        }
      }
      if (t > plot.o.x.max) plot.o.x.max *= 1.5;
    }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = orbitStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) / (preset.span * 2.3);
      const cx = W / 2, cy = H / 2;
      const colors = [pal.series[0], pal.series[1], pal.series[2]];
      trails.forEach((tr, i) => {
        ctx.strokeStyle = colors[i]; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3;
        ctx.beginPath();
        const start = (tr.head - tr.n + TRAIL) % TRAIL;
        for (let k = 0; k < tr.n; k++) {
          const j = (start + k) % TRAIL;
          const X = cx + tr.xs[j] * scale, Y = cy - tr.ys[j] * scale;
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        const X = cx + state[i * 4] * scale, Y = cy - state[i * 4 + 1] * scale;
        ctx.fillStyle = colors[i];
        ctx.beginPath(); ctx.arc(X, Y, 4 + 2 * Math.cbrt(m[i]), 0, Math.PI * 2); ctx.fill();
        if (showShadow) {
          const Xs = cx + shadow[i * 4] * scale, Ys = cy - shadow[i * 4 + 1] * scale;
          ctx.strokeStyle = colors[i]; ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.arc(Xs, Ys, 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        }
      });
      ctx.fillStyle = pal.muted;
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(`t = ${fmt(t, 3)}`, 10, H - 10);
      if (showShadow) ctx.fillText(`ring = shadow copy (Δx₀ = 10⁻⁹)`, 10, H - 26);

      plot.draw(() => {
        const [xs, ys] = sepSeries.linear();
        plot.line(xs, ys, { color: pal.accent2 });
        if (reg.n > 5) plot.fn((x) => Math.exp(reg.sy / reg.n + lambda * (x - reg.sx / reg.n)), { color: pal.bad, dash: [4, 3] });
      });
    }

    orbitStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.select('Preset', [
      { value: 'eight', label: 'Figure-eight' },
      { value: 'pyth', label: 'Pythagorean (chaotic)' },
    ], 'eight', (v) => { preset = v === 'eight' ? FIGURE_EIGHT : PYTHAGOREAN; reset(); loop.invalidate(); });
    panel.toggle('Shadow copy (Δ=10⁻⁹)', showShadow, (v) => { showShadow = v; reset(); loop.invalidate(); });
    panel.slider('Speed', { min: 0.1, max: 4, value: speed, step: 0.05 }, (v) => { speed = v; });
    const ro = panel.readout('');
    let roRaf = 0;
    const roTick = () => { ro.set(showShadow && reg.n > 5 ? `measured Lyapunov exponent λ ≈ ${fmt(lambda, 3)} (e-fold time 1/λ ≈ ${fmt(1 / Math.abs(lambda), 2)})` : 'enable the shadow copy to measure λ'); roRaf = requestAnimationFrame(roTick); };
    roTick();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => { loop.destroy(); cancelAnimationFrame(roRaf); } };
  },
});
