// Chapter 23: the cosmic star-formation history (Madau & Dickinson 2014 fit)
//   ψ(z) = 0.015 (1+z)^2.7 / (1 + [(1+z)/2.9]^5.6)  M☉ yr⁻¹ Mpc⁻³  (Salpeter IMF)
// plotted against redshift or cosmic time, with the cumulative stellar mass formed.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { ageAt, redshiftAt, AGE_NOW } from './galaxy-formation/cosmo';

const psi = (z: number) => (0.015 * (1 + z) ** 2.7) / (1 + ((1 + z) / 2.9) ** 5.6);

// cumulative stars formed (no recycling) on a cosmic-time grid
const NT = 1400;
const tGrid = new Float64Array(NT), cum = new Float64Array(NT);
{
  const t0 = ageAt(20);
  let acc = 0;
  for (let i = 0; i < NT; i++) {
    const t = t0 + ((AGE_NOW - t0) * i) / (NT - 1);
    tGrid[i] = t;
    if (i) acc += psi(redshiftAt(t)) * (t - tGrid[i - 1]) * 1e9;
    cum[i] = acc;
  }
}
const cumAt = (t: number) => {
  const i = Math.max(0, Math.min(NT - 1, Math.round(((t - tGrid[0]) / (AGE_NOW - tGrid[0])) * (NT - 1))));
  return cum[i] / cum[NT - 1];
};

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let dirty = true;
    const loop = new Loop(null, () => { if (dirty) { dirty = false; render(); } });
    const inv = () => { dirty = true; loop.invalidate(); };
    onThemeChange(() => { pal = palette(); inv(); });
    const stage = createStage(host, { aspect: 16 / 9 });
    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1.25'; // taller on phones
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 10, label: 'redshift z' },
      y: { min: 0, max: 0.2, label: 'ψ  (M☉ yr⁻¹ Mpc⁻³)' },
      margin: { l: 56, r: 46, t: 14, b: 42 },
    });
    let mode: 'z' | 't' = 'z';
    let zSel = 2;

    function render() {
      const X = (z: number) => (mode === 'z' ? z : ageAt(z));
      plot.o.x = mode === 'z' ? { min: 0, max: 10, label: 'redshift z' } : { min: 0, max: AGE_NOW, label: 'cosmic time (Gyr)' };
      plot.draw(() => {
        const c = plot.ctx;
        // fill under ψ
        c.beginPath();
        c.moveTo(plot.px(X(0)), plot.py(0));
        for (let i = 0; i <= 400; i++) { const z = (10 * i) / 400; c.lineTo(plot.px(X(z)), plot.py(psi(z))); }
        c.lineTo(plot.px(X(10)), plot.py(0));
        c.closePath();
        c.fillStyle = pal.accent; c.globalAlpha = 0.14; c.fill(); c.globalAlpha = 1;
        const xs: number[] = [], ys: number[] = [], ys2: number[] = [];
        for (let i = 0; i <= 400; i++) { const z = (10 * i) / 400; xs.push(X(z)); ys.push(psi(z)); ys2.push(0.2 * cumAt(ageAt(z))); }
        plot.line(xs, ys, { color: pal.accent, width: 2.4 });
        plot.line(xs, ys2, { color: pal.series[1], width: 1.5, dash: [5, 4] });
        if (plot.pw > 480) plot.text('cumulative fraction of today’s stars (right-hand scale)', plot.px(X(mode === 'z' ? 9.8 : 0.3)), plot.py(0.192), { color: pal.series[1], align: mode === 'z' ? 'right' : 'left', size: 10 });
        const zp = 1.86; // peak of the fit
        plot.vline(X(zp), { label: plot.pw > 480 ? 'peak z ≈ 1.9 (“cosmic noon”)' : 'z ≈ 1.9', color: pal.muted });
        plot.point(X(zSel), psi(zSel), { r: 5, color: pal.fg, stroke: pal.accent });
      });
      // right-hand axis for the cumulative curve
      const c = plot.ctx, xr = plot.m.l + plot.pw;
      c.strokeStyle = pal.series[1]; c.globalAlpha = 0.6; c.lineWidth = 1;
      c.beginPath(); c.moveTo(xr + 0.5, plot.m.t); c.lineTo(xr + 0.5, plot.m.t + plot.ph); c.stroke(); c.globalAlpha = 1;
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const Y = plot.py(0.2 * f);
        c.beginPath(); c.moveTo(xr, Y); c.lineTo(xr + 4, Y); c.stroke();
        plot.text(`${f * 100}%`, xr + 7, Y, { color: pal.series[1], baseline: 'middle', size: 10 });
      }
      const t = ageAt(zSel);
      rz.set(`z = ${fmt(zSel, 3)} · age ${fmt(t, 3)} Gyr · lookback ${fmt(AGE_NOW - t, 3)} Gyr`);
      rp.set(`${fmt(psi(zSel), 3)} M☉/yr/Mpc³ (${fmt(psi(zSel) / psi(0), 3)}× today)`);
      rc.set(`${(100 * cumAt(t)).toFixed(0)}% formed by then`);
    }
    stage.onResize((w, h, d) => { plot.resize(w, h, d); inv(); });
    const setFromPointer = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      const x = plot.dx(e.clientX - r.left);
      zSel = mode === 'z' ? Math.max(0, Math.min(10, x)) : Math.max(0, Math.min(10, redshiftAt(Math.max(0.47, Math.min(AGE_NOW, x)))));
      inv();
    };
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'ew-resize';
    stage.canvas.addEventListener('pointerdown', (e) => { stage.canvas.setPointerCapture(e.pointerId); setFromPointer(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (stage.canvas.hasPointerCapture(e.pointerId)) setFromPointer(e); });

    const panel = new Panel(host);
    panel.select('x axis', [{ value: 'z', label: 'redshift' }, { value: 't', label: 'cosmic time' }], mode, (v) => { mode = v; inv(); });
    const rz = panel.readout('');
    const rp = panel.readout('ψ =');
    const rc = panel.readout('stars:');
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
