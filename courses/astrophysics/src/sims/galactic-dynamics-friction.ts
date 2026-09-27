// Chapter 22: dynamical friction. A satellite of mass M orbits inside a singular isothermal dark halo
// (flat rotation curve v_c) and feels the Chandrasekhar drag
//   a = −4π G² M lnΛ ρ(r) [erf X − 2X/√π e^(−X²)] v / v³,   ρ = v_c² / (4πG r²),  X = v / (√2 σ),  σ = v_c/√2.
// Left: the sinking orbit. Right: r(t) against the analytic circular-orbit result
//   r(t) = r₀ √(1 − t/t_fric),  t_fric = 1.17 r₀² v_c / (G M lnΛ)   (Binney & Tremaine eq. 8.13).
// Units: kpc, km/s, and kpc/(km/s) = 0.9778 Gyr. CPU, f64.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const G = 4.30091e-6;   // kpc (km/s)² / M☉
const VC = 220;
const TU = 0.9778;      // Gyr per kpc/(km/s)

function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);';
    host.append(wrap);
    const orb = createStage(wrap, { aspect: 1 });
    const pst = createStage(wrap, { aspect: 1.15 });
    orb.el.style.borderRight = '1px solid var(--rule)';
    const ctx = orb.canvas.getContext('2d')!;
    const plot = new Plot(pst.canvas, { x: { min: 0, max: 10, label: 'time (Gyr)' }, y: { min: 0, max: 60, label: 'orbital radius (kpc)' }, title: 'Sinking satellite' });

    let M = 2e10, lnL = 3, r0 = 50, ecc = 0;
    const s = new Float64Array(4);
    let t = 0, done = false;
    const trail = new Series(6000), rt = new Series(6000);
    const tfric = () => (1.17 * r0 * r0 * VC) / (G * M * lnL);   // kpc/(km/s)

    function accel(x: number, y: number, vx: number, vy: number): [number, number] {
      const r2 = x * x + y * y, r = Math.sqrt(r2);
      let ax = (-VC * VC * x) / r2, ay = (-VC * VC * y) / r2;
      const v = Math.hypot(vx, vy) + 1e-9;
      const X = v / VC; // v / (√2 σ) with σ = v_c/√2
      const rho = (VC * VC) / (4 * Math.PI * G * r2);
      const f = (4 * Math.PI * G * G * M * lnL * rho * (erf(X) - (2 * X / Math.sqrt(Math.PI)) * Math.exp(-X * X))) / (v * v * v);
      ax -= f * vx; ay -= f * vy;
      return [ax, ay];
    }

    function reset() {
      s.set([r0, 0, 0, VC * (1 - ecc)]);
      t = 0; done = false; trail.clear(); rt.clear();
      const tf = tfric() * TU;
      plot.o.x.max = Math.max(0.5, Math.min(14, tf * 1.3));
      plot.o.y.max = r0 * 1.15;
      loop.invalidate();
    }

    function step() {
      if (done) return;
      // advance ~ 1/400 of the plot window per tick, with ≥ 150 substeps per local orbit
      const target = t + plot.o.x.max / TU / 400;
      while (t < target && !done) {
        const r = Math.hypot(s[0], s[1]);
        const h = Math.min((2 * Math.PI * r) / VC / 150, target - t + 1e-12);
        let [ax, ay] = accel(s[0], s[1], s[2], s[3]);
        s[2] += 0.5 * h * ax; s[3] += 0.5 * h * ay;
        s[0] += h * s[2]; s[1] += h * s[3];
        [ax, ay] = accel(s[0], s[1], s[2], s[3]);
        s[2] += 0.5 * h * ax; s[3] += 0.5 * h * ay;
        t += h;
        if (r < 0.5) done = true;
      }
      trail.push(s[0], s[1]);
      rt.push(t * TU, Math.hypot(s[0], s[1]));
      if (t * TU > plot.o.x.max) done = true;
    }

    function render() {
      const { width: W, height: H, dpr } = orb;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, sc = (Math.min(W, H) / 2 - 12) / (r0 * 1.1);
      // halo glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r0 * sc * 1.1);
      g.addColorStop(0, 'rgba(140,120,255,0.25)'); g.addColorStop(1, 'rgba(140,120,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const [xs, ys] = trail.linear();
      ctx.strokeStyle = pal.series[0]; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.8;
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) { const X = cx + xs[i] * sc, Y = cy - ys[i] * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = pal.fg;
      ctx.beginPath(); ctx.arc(cx + s[0] * sc, cy - s[1] * sc, 4 + Math.log10(M / 1e8), 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 2 * Math.PI); ctx.fill();
      ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = pal.muted; ctx.textBaseline = 'bottom';
      ctx.fillText(`halo: v_c = ${VC} km/s (isothermal)`, 10, H - 8);

      const tf = tfric() * TU;
      plot.draw(() => {
        plot.fn((x) => (x < tf ? r0 * Math.sqrt(1 - x / tf) : NaN), { color: pal.muted, dash: [5, 4], width: 1.5 });
        const [a, b] = rt.linear();
        plot.line(a, b, { color: pal.series[0] });
        if (tf < plot.o.x.max) plot.vline(tf, { label: 't_fric', color: pal.accent2 });
      });
      rTf.set(`${fmt(tf, 3)} Gyr`);
    }

    const loop = new Loop(step, render, 1 / 60);
    orb.onResize(() => loop.invalidate());
    pst.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', reset);
    panel.slider('Satellite mass', { min: 1e8, max: 3e11, value: M, log: true, unit: 'M☉' }, (v) => { M = v; reset(); });
    panel.slider('Start radius', { min: 10, max: 100, value: r0, step: 1, unit: 'kpc' }, (v) => { r0 = v; reset(); });
    panel.slider('ln Λ', { min: 1, max: 10, value: lnL, step: 0.1, format: (v) => fmt(v, 2) }, (v) => { lnL = v; reset(); });
    panel.slider('Eccentric start', { min: 0, max: 0.6, value: ecc, step: 0.05, format: (v) => `v = ${Math.round(VC * (1 - v))} km/s` }, (v) => { ecc = v; reset(); });
    const rTf = panel.readout('t_fric (analytic):');
    reset();
    // Side by side when there is room, stacked on phones.
    const twoCol = wrap.style.gridTemplateColumns;
    const cols = () => {
      const narrow = host.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : twoCol;
      const first = wrap.firstElementChild as HTMLElement;
      first.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      first.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    };
    cols();
    new ResizeObserver(cols).observe(host);
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
