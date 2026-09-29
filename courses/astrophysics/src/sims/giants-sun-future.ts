// Secondary figure: the Sun's future radius on the RGB/AGB, with the terrestrial planets' orbits,
// which expand as the Sun loses mass (a ∝ 1/M for slow, isotropic mass loss) even as the Sun
// itself swells enormously. Waypoints follow Schröder & Smith (2008); tidal drag, which they find
// probably drags the Earth in at the RGB tip, is not modelled.
//
// The late phases last ~1% of the remaining time, so both the slider and the plot use a log scale
// in the time remaining before the white dwarf forms.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const AU_PER_RSUN = 6.957e8 / 1.495978707e11;

// Time from today (Gyr), radius (R☉), T_eff (K), mass (M☉).
const WAYPOINTS = [
  { t: 0, R: 1, T: 5772, M: 1.0, label: 'today' },
  { t: 6.4, R: 1.7, T: 5600, M: 1.0, label: 'end of the main sequence' },
  { t: 7.0, R: 2.6, T: 4900, M: 1.0, label: 'subgiant' },
  { t: 7.45, R: 20, T: 4300, M: 0.97, label: 'red giant branch' },
  { t: 7.59, R: 256, T: 2600, M: 0.67, label: 'RGB tip: Mercury and Venus engulfed' },
  { t: 7.5901, R: 11, T: 4700, M: 0.67, label: 'helium flash → red clump' },
  { t: 7.70, R: 13, T: 4600, M: 0.66, label: 'core helium burning (~110 Myr)' },
  { t: 7.7199, R: 149, T: 3150, M: 0.54, label: 'AGB tip: thermal pulses, mass loss' },
  { t: 7.72, R: 0.012, T: 100000, M: 0.54, label: 'white dwarf (+ planetary nebula)' },
];
const T_END = 7.72;
const EPS = 1e-4; // Gyr (0.1 Myr): the right-hand end of the log time axis
const U_MAX = Math.log10(T_END + EPS), U_MIN = Math.log10(EPS);
const tOfU = (u: number) => T_END + EPS - 10 ** u; // u = log10(time remaining + ε)
const uOfT = (t: number) => Math.log10(Math.max(T_END + EPS - t, EPS));

function interp(t: number) {
  let i = 0;
  while (i < WAYPOINTS.length - 2 && WAYPOINTS[i + 1].t < t) i++;
  const a = WAYPOINTS[i], b = WAYPOINTS[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  return {
    R: a.R * Math.pow(b.R / a.R, f),
    T: a.T * Math.pow(b.T / a.T, f),
    M: a.M + (b.M - a.M) * f,
  };
}

const PLANETS = [
  { name: 'Mercury', a0: 0.387 },
  { name: 'Venus', a0: 0.723 },
  { name: 'Earth', a0: 1.0 },
  { name: 'Mars', a0: 1.524 },
];

function remainingLabel(u: number): string {
  const g = 10 ** u; // Gyr
  if (g >= 1) return `${fmt(g, 2)} Gyr`;
  if (g >= 1e-3) return `${fmt(g * 1e3, 2)} Myr`;
  return `${fmt(g * 1e6, 2)} kyr`;
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const rStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 });
    const ro = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)';
      rStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      rStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    ro.observe(wrap);
    onDestroy(() => ro.disconnect());

    const plot = new Plot(plotStage.canvas, {
      // reversed log axis of time remaining: today on the left, the white dwarf on the right
      x: { min: U_MAX, max: U_MIN, label: 'time left before the white dwarf (log scale)', ticks: [0.699, 0, -1, -2, -3], format: remainingLabel },
      y: { min: -2.5, max: 2.7, label: 'log₁₀ (R / R☉)' },
      title: 'Solar radius vs time',
    });

    let t = 0; // Gyr from today

    function render() {
      const st = interp(t);
      // ---- rendered solar system (to scale) ----
      const { width: W, height: H, dpr } = rStage;
      const ctx = rStage.canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const pxPerAU = Math.min(W, H) / 2 / 3.0;
      const massFactor = 1 / st.M; // orbits expand as a ∝ 1/M
      ctx.strokeStyle = pal.faint; ctx.lineWidth = 1;
      for (const p of PLANETS) {
        ctx.beginPath(); ctx.arc(cx, cy, p.a0 * massFactor * pxPerAU, 0, Math.PI * 2); ctx.stroke();
      }
      const rAU = st.R * AU_PER_RSUN;
      const pxR = Math.max(2.5, rAU * pxPerAU);
      const col = blackbodyCSS(st.T, 1), colFade = blackbodyCSS(st.T, 0);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pxR * 1.15);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(0.87, col); g.addColorStop(1, colFade);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, pxR * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.textBaseline = 'alphabetic';
      const engulfed: string[] = [];
      PLANETS.forEach((p, i) => {
        const a = p.a0 * massFactor;
        if (a < rAU) { engulfed.push(p.name); return; }
        const ang = -0.5 - 0.55 * i; // spread the planets round their orbits so labels never collide
        const px = cx + a * pxPerAU * Math.cos(ang), py = cy + a * pxPerAU * Math.sin(ang);
        ctx.fillStyle = pal.fg;
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.muted; ctx.textAlign = 'left';
        ctx.fillText(p.name, px + 6, py - 6);
      });
      ctx.fillStyle = pal.muted; ctx.textAlign = 'left';
      ctx.fillText(`R ≈ ${fmt(st.R, 3)} R☉ = ${fmt(rAU, 3)} AU`, 10, H - 42);
      ctx.fillText(`T_eff ≈ ${fmt(st.T, 3)} K,  M ≈ ${fmt(st.M, 3)} M☉`, 10, H - 26);
      ctx.fillStyle = engulfed.length ? pal.bad : pal.muted;
      ctx.fillText(engulfed.length ? `engulfed: ${engulfed.join(', ')}` : 'orbits to scale; the Sun is drawn to scale too', 10, H - 10);

      // ---- radius vs time plot ----
      plot.resize(plotStage.width, plotStage.height, plotStage.dpr);
      plot.draw(() => {
        const N = 600;
        const xs = new Float64Array(N), ys = new Float64Array(N);
        for (let i = 0; i < N; i++) { const u = U_MAX + ((U_MIN - U_MAX) * i) / (N - 1); xs[i] = u; ys[i] = Math.log10(interp(tOfU(u)).R); }
        plot.line(xs, ys, { color: pal.series[1], width: 2 });
        for (const w of WAYPOINTS) plot.point(uOfT(w.t), Math.log10(w.R), { r: 2.5, color: pal.muted });
        plot.hline(Math.log10(1 / AU_PER_RSUN), { color: pal.faint, dash: [3, 4], label: '1 AU' });
        plot.point(uOfT(t), Math.log10(st.R), { r: 5, color: pal.accent, stroke: pal.fg });
      });

      readWaypoint.set(labelAt(t));
    }
    function labelAt(tv: number): string {
      let cur = WAYPOINTS[0];
      for (const w of WAYPOINTS) if (w.t <= tv + 1e-9) cur = w;
      return cur.label;
    }

    const loop = new Loop(null, render);
    loop.onDemand = true;
    rStage.onResize(() => loop.invalidate());
    plotStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    // slider position s ∈ [0, 1] ↦ log time remaining
    panel.slider('Time from today', { min: 0, max: 1, value: 0, step: 0.0005, format: (s) => { const tt = tOfU(U_MAX + (U_MIN - U_MAX) * s); return `${fmt(tt < 1e-6 ? 0 : tt, 4)} Gyr`; } }, (s) => {
      t = Math.min(T_END, tOfU(U_MAX + (U_MIN - U_MAX) * s)); loop.invalidate();
    });
    const readWaypoint = panel.readout('Phase');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
