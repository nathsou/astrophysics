// Chapter 23: how fast can a black hole grow? Eddington-limited exponential growth
//   M(t) = M0 exp[ f_Edd (1−ε)/ε · (t − t_seed) / t_Edd ],  t_Edd = σ_T c / (4π G m_p) ≈ 0.45 Gyr,
// against the cosmic clock (flat ΛCDM), with some of the most distant known SMBHs overplotted.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { ageAt, redshiftAt } from './galaxy-formation/cosmo';

const T_EDD_GYR = (6.6524587e-29 * 2.99792458e8) / (4 * Math.PI * 6.6743e-11 * 1.67262192e-27) / 3.15576e16;

// Masses are uncertain by factors of ~3 (virial estimators); UHZ1's is inferred from X-rays + host mass.
const OBS: { name: string; z: number; M: number }[] = [
  { name: 'J0313−1806', z: 7.64, M: 1.6e9 },
  { name: 'J1342+0928', z: 7.54, M: 8e8 },
  { name: 'J1120+0641', z: 7.08, M: 1.35e9 },
  { name: 'CEERS 1019', z: 8.68, M: 9e6 },
  { name: 'UHZ1', z: 10.1, M: 4e7 },
  { name: 'GN-z11', z: 10.6, M: 1.6e6 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); inv(); });
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.1, max: 1.6, label: 'cosmic time (Gyr)   [redshift marked along the top]' },
      y: { min: 10, max: 1e11, log: true, label: 'black-hole mass (M☉)' },
      margin: { l: 58, r: 16, t: 30, b: 42 },
    });

    let M0 = 100, zSeed = 25, fEdd = 1, eps = 0.1;

    let dirty = true;
    const loop = new Loop(null, () => { if (dirty) { dirty = false; render(); } });
    const inv = () => { dirty = true; loop.invalidate(); };
    function growth(t: number, f = fEdd, e = eps) {
      const ts = ageAt(zSeed);
      if (t < ts) return NaN;
      return M0 * Math.exp((f * (1 - e) / e) * (t - ts) / T_EDD_GYR);
    }

    function render() {
      const salp = (eps / (1 - eps)) * T_EDD_GYR / fEdd; // e-folding time
      const tTo1e9 = ageAt(zSeed) + salp * Math.log(1e9 / M0);
      plot.draw(() => {
        // redshift ticks along the top
        for (const z of [30, 20, 15, 12, 10, 8, 7, 6, 5, 4]) {
          const t = ageAt(z);
          if (t < plot.o.x.min || t > plot.o.x.max) continue;
          const X = plot.px(t);
          plot.ctx.strokeStyle = pal.grid;
          plot.ctx.beginPath(); plot.ctx.moveTo(X, plot.m.t); plot.ctx.lineTo(X, plot.m.t + 6); plot.ctx.stroke();
          plot.text(`z=${z}`, X, plot.m.t + 16, { align: 'center', color: pal.muted, size: 10 });
        }
        plot.vline(ageAt(zSeed), { label: 'seed', color: pal.faint });
        // comparison curves
        plot.fn((t) => growth(t, fEdd, 0.3), { color: pal.series[2], dash: [4, 4], width: 1.2 });
        plot.fn((t) => growth(t, Math.min(fEdd * 3, 10), eps), { color: pal.series[3], dash: [2, 3], width: 1.2 });
        plot.fn((t) => growth(t), { color: pal.accent, width: 2.4 });
        plot.hline(1e9, { label: '10⁹ M☉ (luminous quasar)', color: pal.muted });
        for (const o of OBS) plot.point(ageAt(o.z), o.M, { r: 4, color: pal.series[1], label: o.name });
      });
      const c = plot.ctx;
      c.font = '11px Inter, system-ui, sans-serif'; c.textAlign = 'left';
      const lx = plot.m.l + 10; let ly = plot.m.t + 32;
      const item = (col: string, dash: number[], s: string) => {
        c.strokeStyle = col; c.setLineDash(dash); c.lineWidth = 2;
        c.beginPath(); c.moveTo(lx, ly - 4); c.lineTo(lx + 18, ly - 4); c.stroke(); c.setLineDash([]);
        c.fillStyle = pal.fg; c.fillText(s, lx + 24, ly); ly += 16;
      };
      item(pal.accent, [], `your black hole (ε = ${eps.toFixed(2)}, f_Edd = ${fmt(fEdd, 2)})`);
      item(pal.series[2], [4, 4], 'same, but ε = 0.3 (spinning BH)');
      item(pal.series[3], [2, 3], `same, but ${fmt(Math.min(fEdd * 3, 10), 2)}× Eddington`);
      tOut.set(`${fmt(salp * 1e3, 3)} Myr`);
      reach.set(tTo1e9 < ageAt(0) ? `t = ${fmt(tTo1e9, 3)} Gyr (z = ${fmt(redshiftAt(tTo1e9), 3)})` : 'never');
    }

    stage.onResize((w, h, d) => { plot.resize(w, h, d); inv(); });
    const panel = new Panel(host);
    panel.slider('Seed mass', { min: 10, max: 1e6, value: M0, log: true, unit: 'M☉', format: (v) => fmt(v, 2) }, (v) => { M0 = v; inv(); });
    panel.slider('Seed redshift', { min: 10, max: 30, value: zSeed, step: 0.5 }, (v) => { zSeed = v; inv(); });
    panel.slider('Eddington ratio', { min: 0.1, max: 10, value: fEdd, log: true, format: (v) => fmt(v, 2) }, (v) => { fEdd = v; inv(); });
    panel.slider('Efficiency ε', { min: 0.04, max: 0.42, value: eps, step: 0.01 }, (v) => { eps = v; inv(); });
    const tOut = panel.readout('e-folding (Salpeter) time');
    const reach = panel.readout('reaches 10⁹ M☉ at');
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
