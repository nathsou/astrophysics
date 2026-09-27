// Chapter 19: gravitational time dilation and redshift vs radius. Drag the marker (or the orange
// numbers in the text: the figure and prose share the page variable `rr` = r / r_s).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { vars } from '../lib/runtime/vars';

const staticRate = (r: number) => Math.sqrt(Math.max(0, 1 - 1 / r));
const orbitRate = (r: number) => (r > 1.5 ? Math.sqrt(1 - 1.5 / r) : NaN);

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const stage = createStage(host, { aspect: 16 / 8 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1, max: 100, log: true, label: 'r / r_s' },
      y: { min: 0, max: 1.02, label: 'clock rate dτ/dt (vs. far away)' },
    });
    let rr = vars.has('rr') ? vars.get('rr') : 1.5;

    const loop = new Loop(null, () => {
      plot.draw(() => {
        plot.hline(1, { color: pal.faint });
        plot.vline(1, { color: pal.bad, label: 'horizon' });
        plot.vline(1.5, { color: pal.accent, label: 'photon sphere' });
        plot.vline(3, { color: pal.accent3, label: 'ISCO' });
        plot.fn(staticRate, { color: pal.series[0], width: 2.2 });
        plot.fn(orbitRate, { color: pal.series[1], width: 2, dash: [6, 4] });
        plot.point(rr, staticRate(rr), { r: 6, color: pal.series[0], stroke: pal.fg });
        if (rr > 1.5) plot.point(rr, orbitRate(rr), { r: 4.5, color: pal.series[1] });
      });
      plot.text('hovering (static)', plot.px(40), plot.py(staticRate(40)) + 16, { color: pal.series[0] });
      plot.text('circular orbit', plot.px(6), plot.py(orbitRate(6)) + 16, { color: pal.series[1] });
      const a = staticRate(rr);
      rOut.set(`${fmt(rr, 4)} r_s`);
      rateOut.set(`${fmt(a, 4)} (1 h here = ${a > 1e-6 ? fmt(1 / a, 4) : '∞'} h far away)`);
      zOut.set(a > 1e-6 ? `z = ${fmt(1 / a - 1, 4)}; 500 nm → ${fmt(500 / a, 4)} nm` : '∞');
    });
    loop.onDemand = true;
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    const unsub = vars.subscribe('rr', (v) => { rr = v; loop.invalidate(); });

    const el = stage.canvas;
    el.style.touchAction = 'none'; el.style.cursor = 'ew-resize';
    let drag = false;
    const set = (e: PointerEvent) => {
      const x = plot.dx(e.clientX - el.getBoundingClientRect().left);
      rr = Math.max(1.0005, Math.min(100, x));
      vars.set('rr', Number(rr.toPrecision(4)));
      loop.invalidate();
    };
    el.addEventListener('pointerdown', (e) => { drag = true; el.setPointerCapture(e.pointerId); set(e); });
    el.addEventListener('pointermove', (e) => drag && set(e));
    el.addEventListener('pointerup', () => (drag = false));

    const panel = new Panel(host);
    const rOut = panel.readout('r =');
    const rateOut = panel.readout('Static clock rate:');
    const zOut = panel.readout('Redshift to infinity:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => { unsub(); loop.destroy(); } };
  },
});
