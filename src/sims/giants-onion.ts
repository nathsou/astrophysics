// Secondary figure: onion-shell structure of a ~20 M☉ pre-supernova star, with the
// burning-stage durations on a log bar chart. Static illustrative figure (no physics loop
// needed) but built on the sim contract so it lazy-loads and matches the page chrome.
// Durations are the textbook rule-of-thumb values (e.g. Woosley, Heger & Weaver 2002)
// for a ~20-25 M☉ star, dominated by neutrino losses which shorten each successive stage.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { fmt } from '../lib/ui/controls';

const STAGES = [
  { fuel: 'H', product: 'He', T_GK: 0.02, duration_yr: 1.0e7, color: 0 },
  { fuel: 'He', product: 'C, O', T_GK: 0.2, duration_yr: 1.0e6, color: 1 },
  { fuel: 'C', product: 'Ne, Mg', T_GK: 0.8, duration_yr: 1.0e3, color: 2 },
  { fuel: 'Ne', product: 'O, Mg', T_GK: 1.5, duration_yr: 3.0, color: 3 },
  { fuel: 'O', product: 'Si, S', T_GK: 2.0, duration_yr: 0.8, color: 4 },
  { fuel: 'Si', product: 'Fe (core)', T_GK: 3.5, duration_yr: 1 / 365, color: 0 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    const stage = createStage(wrap, { aspect: 16 / 10 });
    host.append(wrap);
    const plot = new Plot(stage.canvas, {
      x: { min: 3e-3, max: 3e7, log: true, label: 'burning-stage duration' },
      y: { min: -0.7, max: STAGES.length - 0.3 },
      title: 'How long each fuel lasts in a ~20 M☉ star',
    });

    let hover = -1;

    function render() {
      plot.resize(stage.width, stage.height, stage.dpr);
      plot.draw(() => {
        const ctx = plot.ctx;
        STAGES.forEach((st, i) => {
          const y0 = plot.py(i - 0.32), y1 = plot.py(i + 0.32);
          const x0 = plot.px(plot.o.x.min), x1 = plot.px(st.duration_yr);
          ctx.fillStyle = pal.series[st.color];
          ctx.globalAlpha = i === hover ? 1 : 0.85;
          ctx.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
          ctx.globalAlpha = 1;
          ctx.fillStyle = pal.fg;
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${st.fuel} → ${st.product}  (T ≈ ${fmt(st.T_GK, 2)} GK)`, x0 + 8, (y0 + y1) / 2);
          ctx.textAlign = 'right';
          ctx.fillStyle = pal.muted;
          ctx.fillText(durLabel(st.duration_yr), x1 - 8, (y0 + y1) / 2);
          ctx.textAlign = 'left';
        });
      });
    }

    function durLabel(yr: number): string {
      if (yr < 1 / 300) return `${fmt(yr * 365.25 * 24, 2)} hr`;
      if (yr < 3) return `${fmt(yr * 365.25, 2)} d`;
      if (yr < 1e3) return `${fmt(yr, 3)} yr`;
      if (yr < 1e6) return `${fmt(yr / 1e3, 3)} kyr`;
      return `${fmt(yr / 1e6, 3)} Myr`;
    }

    const loop = new Loop(() => {}, render, 1 / 10);
    stage.onResize(() => loop.invalidate());
    stage.canvas.addEventListener('pointermove', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const py = e.clientY - r.top;
      const i = Math.round(plot.dy(py));
      hover = i >= 0 && i < STAGES.length ? i : -1;
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointerleave', () => { hover = -1; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
