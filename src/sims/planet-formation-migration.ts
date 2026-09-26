// Chapter 8: planet migration timescales vs planet mass.
// Type I (Tanaka et al. 2002) below the gap-opening mass (Crida et al. 2006 criterion),
// Type II (viscous, slowed when the planet outweighs the local disk) above it.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { aspect, omega, sigmaGas, AU_CM, MSUN_G, MEARTH_G, YR_S, type Disk } from './planet-formation/disk-model';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.01, max: 3000, log: true, label: 'planet mass (M⊕)' },
      y: { min: 1e3, max: 1e10, log: true, label: 'inward migration time a/|ȧ| (yr)' },
      title: 'How fast do planets migrate?',
    });
    const disk: Disk = { sigmaScale: 1, L: 1, M: 1 };
    let r = 5.2, alpha = 1e-3;

    const typeI = (mE: number) => {
      const q = (mE * MEARTH_G) / MSUN_G, h = aspect(disk, r);
      const discMass = (sigmaGas(disk, r) * (r * AU_CM) ** 2) / MSUN_G;
      return (1 / (2.7 + 1.1 * 1.5)) * (1 / q) * (1 / discMass) * h * h / omega(disk, r) / YR_S;
    };
    const typeII = (mE: number) => {
      const h = aspect(disk, r);
      const tv = 1 / (alpha * h * h * omega(disk, r)) / YR_S;
      const mLocal = (4 * Math.PI * sigmaGas(disk, r) * (r * AU_CM) ** 2) / MEARTH_G;
      return tv * Math.max(1, mE / mLocal);
    };
    /** Crida criterion: ¾ H/R_H + 50/(q Re) ≤ 1, Re = 1/(α h²). */
    const gapMass = () => {
      const h = aspect(disk, r);
      let lo = -8, hi = -1;
      for (let k = 0; k < 60; k++) {
        const m = 0.5 * (lo + hi), q = 10 ** m;
        const crit = 0.75 * h / Math.cbrt(q / 3) + 50 * alpha * h * h / q;
        if (crit > 1) lo = m; else hi = m;
      }
      return (10 ** hi * MSUN_G) / MEARTH_G;
    };

    let dirty = true;
    const loop = new Loop(null, render);
    const redraw = () => { dirty = true; loop.invalidate(); };
    stage.onResize((w, h, d) => { plot.resize(w, h, d); redraw(); });
    onThemeChange(() => { pal = palette(); redraw(); });

    function render() {
      if (!dirty) return;
      dirty = false;
      const mg = gapMass();
      plot.draw(() => {
        plot.hline(3e6, { color: pal.bad, label: 'disk lifetime ~3 Myr' });
        plot.fn((m) => (m < mg ? typeI(m) : NaN), { color: pal.series[0], width: 2.2 });
        plot.fn((m) => (m >= mg ? typeII(m) : NaN), { color: pal.series[1], width: 2.2 });
        plot.fn(typeI, { color: pal.series[0], width: 1, dash: [3, 4], alpha: 0.5 });
        plot.vline(mg, { color: pal.accent2, label: `gap opens ≈ ${fmt(mg, 2)} M⊕` });
        plot.point(1, typeI(1), { color: pal.series[0], label: 'Earth: Type I' });
        plot.point(318, typeII(318), { color: pal.series[1], label: 'Jupiter: Type II' });
      });
      rGap.set(`${fmt(mg, 3)} M⊕`);
      rE.set(`${fmt(typeI(1), 2)} yr`);
      rJ.set(`${fmt(typeII(318), 2)} yr`);
    }

    const panel = new Panel(host);
    panel.slider('Orbit', { min: 0.1, max: 50, value: r, log: true, unit: 'AU' }, (v) => { r = v; redraw(); });
    panel.slider('Gas Σ', { min: 0.1, max: 10, value: 1, log: true, format: (v) => `${fmt(v, 2)}× MMSN` }, (v) => { disk.sigmaScale = v; redraw(); });
    panel.slider('α', { min: 1e-5, max: 1e-2, value: alpha, log: true }, (v) => { alpha = v; redraw(); });
    const rGap = panel.readout('gap-opening mass');
    const rE = panel.readout('Earth');
    const rJ = panel.readout('Jupiter');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
