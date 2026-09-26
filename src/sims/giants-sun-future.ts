// Secondary figure: the Sun's future radius vs time on the RGB/AGB, with the terrestrial
// planets' orbits — which expand as the Sun loses mass (angular momentum conservation:
// a ∝ 1/M for adiabatic mass loss) even as the Sun itself swells enormously.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const AU_PER_RSUN = 6.957e8 / 1.495978707e11;

// Time since now, in Gyr, at a handful of key waypoints (approximate, e.g. Schröder & Smith 2008 / Sackmann+ 1993).
const WAYPOINTS = [
  { t: 0, R: 1, T: 5772, M: 1.0, label: 'today' },
  { t: 6.0, R: 1.6, T: 5500, M: 1.0, label: 'end of MS' },
  { t: 7.0, R: 30, T: 4500, M: 0.98, label: 'subgiant' },
  { t: 7.5, R: 170, T: 3300, M: 0.86, label: 'RGB tip (engulfs Mercury, Venus)' },
  { t: 7.59, R: 10, T: 4700, M: 0.54, label: 'He flash → red clump' },
  { t: 7.6, R: 180, T: 3400, M: 0.54, label: 'AGB tip (Earth: ~50/50)' },
  { t: 7.62, R: 0.011, T: 60000, M: 0.53, label: 'white dwarf' },
];

function interp(t: number) {
  let i = 0;
  while (i < WAYPOINTS.length - 2 && WAYPOINTS[i + 1].t < t) i++;
  const a = WAYPOINTS[i], b = WAYPOINTS[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  return {
    R: a.R * Math.pow(b.R / a.R, f),
    T: a.T + (b.T - a.T) * f,
    M: a.M + (b.M - a.M) * f,
  };
}

const PLANETS = [
  { name: 'Mercury', a0: 0.387 },
  { name: 'Venus', a0: 0.723 },
  { name: 'Earth', a0: 1.0 },
  { name: 'Mars', a0: 1.524 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const rStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 });
    rStage.el.style.borderRight = '1px solid var(--rule)';

    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 7.62, label: 'time from today (Gyr)' },
      y: { min: -2.5, max: 2.4, log: false, label: 'log₁₀ (R / R☉)' },
      title: 'Solar radius vs time',
    });

    let t = 0; // Gyr from today

    function render() {
      const st = interp(t);
      // ---- rendered solar system ----
      const { width: W, height: H, dpr } = rStage;
      const ctx = rStage.canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const pxPerAU = Math.min(W, H) / 3.6;
      // planet orbits expand as a ∝ 1/M (present mass ratio)
      const massFactor = 1 / st.M;
      ctx.strokeStyle = pal.faint;
      for (const p of PLANETS) {
        const a = p.a0 * massFactor;
        ctx.beginPath(); ctx.arc(cx, cy, a * pxPerAU, 0, Math.PI * 2); ctx.stroke();
      }
      // Sun (log-zoomed radius so it stays visible from 1 to 180 Rsun)
      const rAU = st.R * AU_PER_RSUN;
      const pxR = Math.max(3, Math.min(rAU * pxPerAU, Math.min(W, H) * 0.46));
      const col = blackbodyCSS(st.T, 1), colFade = blackbodyCSS(st.T, 0);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pxR);
      g.addColorStop(0, '#fff'); g.addColorStop(0.2, col); g.addColorStop(1, colFade);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, pxR, 0, Math.PI * 2); ctx.fill();
      // planet markers, swallowed once inside the Sun
      ctx.font = '11px Inter, system-ui, sans-serif';
      for (const p of PLANETS) {
        const a = p.a0 * massFactor;
        const swallowed = a < rAU; // planet's orbital radius (AU) inside the Sun's surface (AU)
        const px = cx + a * pxPerAU, py = cy;
        if (!swallowed) {
          ctx.fillStyle = pal.fg;
          ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = pal.muted;
          ctx.fillText(p.name, px + 6, py - 6);
        }
      }
      ctx.fillStyle = pal.muted;
      ctx.fillText(`R☉ ≈ ${fmt(st.R, 4)} R☉ = ${fmt(rAU, 3)} AU`, 10, H - 26);
      ctx.fillText(`T_eff ≈ ${fmt(st.T, 4)} K,  M ≈ ${fmt(st.M, 3)} M☉`, 10, H - 10);

      // ---- radius vs time plot ----
      plot.resize(plotStage.width, plotStage.height, plotStage.dpr);
      plot.draw(() => {
        const N = 400;
        const xs = new Float64Array(N), ys = new Float64Array(N);
        for (let i = 0; i < N; i++) { const tt = (i / (N - 1)) * 7.62; xs[i] = tt; ys[i] = Math.log10(interp(tt).R); }
        plot.line(xs, ys, { color: pal.series[1], width: 2 });
        for (const w of WAYPOINTS) plot.point(w.t, Math.log10(w.R), { r: 3, color: pal.muted });
        const x = plot.px(t), y = plot.py(Math.log10(st.R));
        plot.ctx.fillStyle = pal.accent;
        plot.ctx.beginPath(); plot.ctx.arc(x, y, 5, 0, Math.PI * 2); plot.ctx.fill();
      });

      readWaypoint.set(labelAt(t));
    }
    function labelAt(tv: number): string {
      let closest = WAYPOINTS[0];
      for (const w of WAYPOINTS) if (Math.abs(w.t - tv) < Math.abs(closest.t - tv)) closest = w;
      return closest.label;
    }

    const loop = new Loop(() => {}, render, 1 / 20);
    rStage.onResize(() => loop.invalidate());
    plotStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Time from today', { min: 0, max: 7.62, value: 0, step: 0.001 }, (v) => { t = v; loop.invalidate(); });
    const readWaypoint = panel.readout('Nearest milestone');

    loop.invalidate();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
