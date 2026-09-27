// Chapter 14 figure: mass–luminosity and mass–radius relations. Approximate detached
// eclipsing-binary measurements (points, from the well-known DEB compilations, rounded for
// display) against adjustable power-law fits L ∝ M^a, R ∝ M^b that the reader can drag to
// match the data — the point being that a ≈ 3.5–4 and b ≈ 0.6–0.9 are empirical, not exact.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { zamsL, zamsR } from './main-sequence/zams';

// Approximate (M☉, L/L☉) and (M☉, R/R☉) for well-known detached eclipsing binaries / benchmark stars.
const BINARIES: { name: string; M: number; L: number; R: number }[] = [
  { name: 'Proxima Cen', M: 0.12, L: 0.0017, R: 0.15 },
  { name: '61 Cyg B', M: 0.63, L: 0.085, R: 0.60 },
  { name: 'Sun', M: 1.0, L: 1.0, R: 1.0 },
  { name: 'α Cen A', M: 1.1, L: 1.52, R: 1.22 },
  { name: 'Sirius A', M: 2.06, L: 25.4, R: 1.71 },
  { name: 'Regulus', M: 3.8, L: 288, R: 3.1 },
  { name: 'Spica', M: 11.4, L: 20500, R: 7.5 },
  { name: 'ζ Ori A', M: 33, L: 250000, R: 20 },
  { name: 'R136a1', M: 196, L: 4.7e6, R: 32 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;';
    host.append(wrap);
    const s1 = createStage(wrap, { aspect: 1.15 });
    const s2 = createStage(wrap, { aspect: 1.15 });
    s1.el.style.borderRight = '1px solid var(--rule)';
    const ro = new ResizeObserver(() => { wrap.style.gridTemplateColumns = host.clientWidth < 560 ? '1fr' : '1fr 1fr'; });
    ro.observe(host);

    const plotL = new Plot(s1.canvas, {
      x: { min: 0.08, max: 250, log: true, label: 'M / M☉' },
      y: { min: 1e-4, max: 1e7, log: true, label: 'L / L☉' },
      title: 'Mass–luminosity',
    });
    const plotR = new Plot(s2.canvas, {
      x: { min: 0.08, max: 250, log: true, label: 'M / M☉' },
      y: { min: 0.08, max: 40, log: true, label: 'R / R☉' },
      title: 'Mass–radius',
    });

    let a = 3.5, b = 0.8; // adjustable fit exponents (normalised to pass through the Sun)

    // Label placement: most names sit up and to the right; a few are moved to avoid clashes/clipping.
    const LEFT = new Set(['R136a1', 'ζ Ori A']);
    const BELOW = new Set(['α Cen A']);
    function labelled(plot: Plot, x: number, y: number, name: string) {
      plot.point(x, y, { r: 3.5, color: pal.fg });
      const X = plot.px(x), Y = plot.py(y);
      if (LEFT.has(name)) plot.text(name, X - 7, Y - 4, { color: pal.fg, align: 'right' });
      else if (BELOW.has(name)) plot.text(name, X + 7, Y + 13, { color: pal.fg });
      else plot.text(name, X + 7, Y - 4, { color: pal.fg });
    }
    function render() {
      plotL.draw(() => {
        plotL.fn((M) => M ** a, { color: pal.accent });
        plotL.fn((M) => zamsL(M), { color: pal.series[0], dash: [4, 3] });
        for (const s of BINARIES) labelled(plotL, s.M, s.L, s.name);
      });
      plotR.draw(() => {
        plotR.fn((M) => M ** b, { color: pal.accent });
        plotR.fn((M) => zamsR(M), { color: pal.series[0], dash: [4, 3] });
        for (const s of BINARIES) labelled(plotR, s.M, s.R, s.name);
      });
    }
    const loop = new Loop(null, render);
    s1.onResize((w, h, d) => { plotL.resize(w, h, d); loop.invalidate(); });
    s2.onResize((w, h, d) => { plotR.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('L ∝ Mᵃ, a =', { min: 2, max: 5, value: a, step: 0.05 }, (v) => { a = v; loop.invalidate(); });
    panel.slider('R ∝ Mᵇ, b =', { min: 0.3, max: 1.2, value: b, step: 0.02 }, (v) => { b = v; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => { loop.destroy(); ro.disconnect(); } };
  },
});
