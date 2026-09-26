// Secondary figure: comoving, luminosity, angular-diameter distance and lookback time vs redshift,
// log-log, with a draggable redshift marker showing the angular-diameter turnover.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import {
  comovingDistanceMpc, luminosityDistanceMpc, angularDiameterDistanceMpc, lookbackTimeGyr,
  FLAT_LCDM, H0_PLANCK, type OmegaParams,
} from './expansion/cosmology';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 10 });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const plot = new Plot(stage.canvas, {
      x: { min: 0.01, max: 20, log: true, label: 'redshift z' },
      y: { min: 1, max: 3e5, log: true, label: 'distance (Mpc)' },
      title: 'Cosmological distances',
    });

    let p: OmegaParams = { ...FLAT_LCDM };
    let H0 = H0_PLANCK;
    let z = 1.5;

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const NZ = 160;
    const zs = new Float64Array(NZ);
    for (let i = 0; i < NZ; i++) zs[i] = 0.01 * Math.pow(20 / 0.01, i / (NZ - 1));

    function render() {
      const Dc = new Float64Array(NZ), DL = new Float64Array(NZ), DA = new Float64Array(NZ);
      for (let i = 0; i < NZ; i++) {
        Dc[i] = comovingDistanceMpc(zs[i], p, H0);
        DL[i] = luminosityDistanceMpc(zs[i], p, H0);
        DA[i] = angularDiameterDistanceMpc(zs[i], p, H0);
      }
      plot.draw(() => {
        plot.line(zs, Dc, { color: pal.series[0] });
        plot.line(zs, DL, { color: pal.series[1] });
        plot.line(zs, DA, { color: pal.series[2] });
        // mark angular-diameter turnover
        let turnZ = 0, turnD = 0;
        for (let i = 1; i < NZ - 1; i++) if (DA[i] > DA[i - 1] && DA[i] > DA[i + 1] && turnD === 0) { turnZ = zs[i]; turnD = DA[i]; }
        if (turnD > 0) plot.point(turnZ, turnD, { color: pal.series[2], r: 4, label: `turnover z≈${fmt(turnZ, 2)}` });

        const dc = comovingDistanceMpc(z, p, H0), dl = luminosityDistanceMpc(z, p, H0), da = angularDiameterDistanceMpc(z, p, H0);
        plot.vline(z, { color: pal.muted });
        plot.point(z, dc, { color: pal.series[0], r: 4 });
        plot.point(z, dl, { color: pal.series[1], r: 4 });
        plot.point(z, da, { color: pal.series[2], r: 4 });

        plot.text('comoving', plot.px(8), plot.py(comovingDistanceMpc(8, p, H0)) - 6, { color: pal.series[0] });
        plot.text('luminosity', plot.px(8), plot.py(luminosityDistanceMpc(8, p, H0)) - 6, { color: pal.series[1] });
        plot.text('angular diameter', plot.px(0.05), plot.py(angularDiameterDistanceMpc(0.05, p, H0)) + 14, { color: pal.series[2] });
      });
      lookback.set(`${fmt(lookbackTimeGyr(z, p, H0), 4)} Gyr`);
      dcOut.set(`${fmt(comovingDistanceMpc(z, p, H0) / 1000, 4)} Gpc`);
      dlOut.set(`${fmt(luminosityDistanceMpc(z, p, H0) / 1000, 4)} Gpc`);
      daOut.set(`${fmt(angularDiameterDistanceMpc(z, p, H0) / 1000, 4)} Gpc`);
    }

    const panel = new Panel(host);
    panel.slider('Redshift z', { min: 0.02, max: 15, value: z, log: true, step: 0.01 }, (v) => { z = v; loop.invalidate(); });
    panel.slider('H₀ (km/s/Mpc)', { min: 50, max: 90, value: H0, step: 0.1 }, (v) => { H0 = v; loop.invalidate(); });
    panel.slider('Ωm', { min: 0.05, max: 1, value: p.Om, step: 0.01 }, (v) => { p = { ...p, Om: v, OL: 1 - v - p.Or }; loop.invalidate(); });
    const lookback = panel.readout('Lookback time');
    const dcOut = panel.readout('Comoving distance');
    const dlOut = panel.readout('Luminosity distance');
    const daOut = panel.readout('Angular-diameter distance');

    // draggable vertical marker
    stage.canvas.style.touchAction = 'none';
    let dragging = false;
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; stage.canvas.setPointerCapture(e.pointerId); moveTo(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (dragging) moveTo(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
    function moveTo(e: PointerEvent) {
      const rect = stage.canvas.getBoundingClientRect();
      z = Math.min(Math.max(plot.dx(e.clientX - rect.left), 0.02), 15);
      loop.invalidate();
    }

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
