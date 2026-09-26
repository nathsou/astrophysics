// Chapter 8: midplane temperature of a protoplanetary disk (stellar irradiation + viscous
// accretion heating) and where the water, CO₂ and CO snow lines fall.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { AU_CM, G_CGS, MSUN_G, YR_S, SIGMA_SB, soundSpeed } from './planet-formation/disk-model';

const KAPPA = 5; // cm² g⁻¹, dust-dominated Rosseland opacity (order of magnitude)

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.1, max: 100, log: true, label: 'distance from star r (AU)' },
      y: { min: 10, max: 3000, log: true, label: 'midplane temperature (K)' },
      title: 'Disk temperature and snow lines',
    });
    let L = 1, mdot = 1e-8, alpha = 1e-3;

    const tIrr = (r: number) => 280 * L ** 0.25 * r ** -0.5;
    /** Viscous midplane temperature: T⁴ = (3τ/8 + ½) T_eff⁴, with Σ = Ṁ/(3πν) and τ = κΣ/2. Fixed-point in T. */
    function tMid(r: number) {
      if (mdot <= 1e-11) return tIrr(r);
      const R = r * AU_CM;
      const Om = Math.sqrt((G_CGS * MSUN_G) / R ** 3);
      const Md = (mdot * MSUN_G) / YR_S;
      const teff4 = (3 * G_CGS * MSUN_G * Md) / (8 * Math.PI * SIGMA_SB * R ** 3);
      let T = tIrr(r);
      for (let k = 0; k < 40; k++) {
        const cs = soundSpeed(T);
        const Sigma = Md / (3 * Math.PI * alpha * cs * cs / Om);
        const tau = (KAPPA * Sigma) / 2;
        const Tn = ((3 * tau / 8 + 0.5) * teff4 + tIrr(r) ** 4) ** 0.25;
        T = 0.5 * T + 0.5 * Tn;
      }
      return T;
    }
    const lineAt = (Tc: number) => {
      let lo = Math.log(0.05), hi = Math.log(1000);
      for (let k = 0; k < 50; k++) { const m = 0.5 * (lo + hi); if (tMid(Math.exp(m)) > Tc) lo = m; else hi = m; }
      return Math.exp(0.5 * (lo + hi));
    };

    let dirty = true;
    const loop = new Loop(null, render);
    const redraw = () => { dirty = true; loop.invalidate(); };
    stage.onResize((w, h, d) => { plot.resize(w, h, d); redraw(); });
    onThemeChange(() => { pal = palette(); redraw(); });

    function render() {
      if (!dirty) return;
      dirty = false;
      const rw = lineAt(160), rc = lineAt(70), rco = lineAt(25);
      plot.draw(() => {
        const { ctx } = plot;
        const y0 = plot.py(170), y1 = plot.py(150);
        ctx.fillStyle = pal.series[1]; ctx.globalAlpha = 0.15;
        ctx.fillRect(plot.m.l, y0, plot.pw, y1 - y0); ctx.globalAlpha = 1;
        plot.hline(160, { color: pal.series[1], label: 'H₂O ice 150–170 K' });
        plot.hline(70, { color: pal.series[4], label: 'CO₂ ice ~70 K' });
        plot.hline(25, { color: pal.series[3], label: 'CO ice ~25 K' });
        plot.fn(tIrr, { color: pal.muted, dash: [5, 4], width: 1.4 });
        plot.fn(tMid, { color: pal.series[0], width: 2.2 });
        plot.vline(rw, { color: pal.series[1], label: `snow line ${fmt(rw, 3)} AU` });
        plot.point(2.7, tMid(2.7), { r: 2.5, color: pal.fg, label: 'asteroid belt' });
        plot.point(5.2, tMid(5.2), { r: 2.5, color: pal.fg, label: 'Jupiter' });
      });
      rW.set(`${fmt(rw, 3)} AU`);
      rC.set(`${fmt(rc, 3)} AU`);
      rCO.set(`${fmt(rco, 3)} AU`);
    }

    const panel = new Panel(host);
    const sL = panel.slider('Luminosity', { min: 0.05, max: 100, value: L, log: true, unit: 'L☉' }, (v) => { L = v; redraw(); });
    const sM = panel.slider('Accretion rate', { min: 1e-11, max: 1e-6, value: mdot, log: true, unit: 'M☉/yr' }, (v) => { mdot = v; redraw(); });
    panel.slider('α', { min: 1e-4, max: 1e-2, value: alpha, log: true }, (v) => { alpha = v; redraw(); });
    const preset = (l: number, m: number) => () => { L = l; mdot = m; sL.set(l); sM.set(m); redraw(); };
    panel.button('Young (0.1 Myr)', preset(3, 1e-7));
    panel.button('T Tauri (1 Myr)', preset(1.5, 1e-8));
    panel.button('Passive (today’s Sun)', preset(1, 1e-11));
    const rW = panel.readout('H₂O');
    const rC = panel.readout('CO₂');
    const rCO = panel.readout('CO');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
