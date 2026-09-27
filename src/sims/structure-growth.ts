// Chapter 28: the linear growth factor D(a) for different Ωm, ΩΛ, integrated from the growth ODE.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { growth, type Growth } from './structure/cosmo';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const stage = createStage(host, { aspect: 16 / 9 });
    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1.2'; // taller on phones
    const plot = new Plot(stage.canvas, {
      x: { min: 0.01, max: 10, log: true, label: 'scale factor a  (today a = 1)' },
      y: { min: 0.01, max: 10, log: true, label: 'growth factor D(a)' },
    });

    let Om = 0.31, OL = 0.69;
    let G: Growth = growth(Om, OL);
    const lcdm = growth(0.31, 0.69), open = growth(0.3, 0);

    const loop = new Loop(null, render);
    function render() {
      const lg = pal;
      plot.draw(() => {
        plot.fn((a) => a, { color: lg.faint, dash: [5, 4], width: 1.5 });
        plot.fn((a) => open.D(a), { color: lg.series[2], width: 1.5, dash: [2, 3], samples: 300 });
        plot.fn((a) => lcdm.D(a), { color: lg.series[1], width: 1.5, samples: 300 });
        plot.fn((a) => G.D(a), { color: lg.accent, width: 3, samples: 300 });
        plot.vline(1, { color: lg.faint, dash: [2, 3], label: 'today' });
        plot.point(1, G.D(1), { r: 4, color: lg.accent });
        const L = plot.m.l + 12;
        [['Einstein–de Sitter, D = a', lg.faint], ['Open, Ωm = 0.3, ΩΛ = 0', lg.series[2]], ['Planck ΛCDM', lg.series[1]], [`Your universe`, lg.accent]].forEach(([t, c], i) => {
          plot.ctx.fillStyle = c; plot.ctx.fillRect(L, plot.m.t + 12 + i * 17, 14, 3);
          plot.text(t, L + 20, plot.m.t + 14 + i * 17, { color: lg.fg, baseline: 'middle' });
        });
      });
      supp.set(`${fmt(G.D(1), 3)} (vs 1 for D = a)`);
      rate.set(`${fmt(G.f(1), 3)} (Ωm^0.55 = ${fmt(Om ** 0.55, 3)})`);
      fut.set(`${fmt(G.D(10) / G.D(1), 3)}×`);
    }
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    const upd = () => { G = growth(Om, OL); loop.invalidate(); };
    panel.slider('Ωm', { min: 0.05, max: 1, value: Om, step: 0.01 }, (v) => { Om = v; upd(); });
    panel.slider('ΩΛ', { min: 0, max: 1, value: OL, step: 0.01 }, (v) => { OL = v; upd(); });
    const supp = panel.readout('D today');
    const rate = panel.readout('growth rate f today');
    const fut = panel.readout('further growth to a = 10');
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
