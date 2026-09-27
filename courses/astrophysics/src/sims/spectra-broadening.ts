// Line-profile widget: natural, thermal-Doppler and pressure/collisional broadening combined
// into a pseudo-Voigt profile. Sliders control temperature, electron density (pressure proxy)
// and a natural-width multiplier; the plot overlays the pure Gaussian and Lorentzian limits.
import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { dopplerFWHM_nm, lorentzFWHM_nm, pseudoVoigt, voigtFWHM } from './spectra/physics';

const LAM0 = 500; // nm, generic line

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1.1 : 16 / 9 });
    const panel = new Panel(host);
    const readG = panel.readout('Doppler FWHM');
    const readL = panel.readout('Lorentz FWHM (natural + pressure)');
    const readV = panel.readout('Voigt FWHM');

    let T = 8000, ne = 1e20, natMult = 1;
    panel.slider('Temperature', { min: 1000, max: 40000, value: T, log: true, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => { T = v; draw(); });
    panel.slider('Electron density', { min: 1e18, max: 1e24, value: ne, log: true, format: (v) => v.toExponential(1), unit: 'm⁻³' }, (v) => { ne = v; draw(); });
    panel.slider('Natural width ×', { min: 0.1, max: 20, value: natMult, unit: '×' }, (v) => { natMult = v; draw(); });
    const massSel = panel.select('Atom', [
      { value: '1', label: 'H (1 u)' }, { value: '4', label: 'He (4 u)' }, { value: '56', label: 'Fe (56 u)' },
    ], '1', () => draw());

    const plot = new Plot(stage.canvas, {
      x: { min: -0.06, max: 0.06, label: 'Δλ (nm)' },
      y: { min: 0, max: 1.05, label: 'normalised absorption' },
    });
    stage.onResize((w, h, dpr) => plot.resize(w, h, dpr));

    function draw() {
      const mass = Number(massSel.get());
      const fG = dopplerFWHM_nm(LAM0, T, mass);
      // Lorentzian width = natural + pressure; the multiplier scales only the natural part
      const fL = lorentzFWHM_nm(LAM0, ne) + lorentzFWHM_nm(LAM0, 0) * (natMult - 1);
      const fV = voigtFWHM(fG, fL);
      readG.set(`${(fG * 1000).toFixed(2)} pm`);
      readL.set(`${(fL * 1000).toFixed(2)} pm`);
      readV.set(`${(fV * 1000).toFixed(2)} pm`);

      // keep the profile framed: the window spans ±2.5 FWHM of the widest component
      const half = 2.5 * Math.max(fV, fG, fL);
      plot.o.x.min = -half; plot.o.x.max = half;
      plot.draw(() => {
        plot.fn((dx) => gaussianOnly(dx, fG), { color: pal.series[2], dash: [3, 3], alpha: 0.7 });
        plot.fn((dx) => lorentzOnly(dx, fL), { color: pal.series[3], dash: [3, 3], alpha: 0.7 });
        plot.fn((dx) => pseudoVoigt(dx, fG, fL), { color: pal.series[0], width: 2.2 });
        const lx = plot.m.l + 10, ly = plot.m.t + 12;
        plot.text('— Voigt (both combined)', lx, ly, { color: pal.series[0] });
        plot.text('- - Doppler only (Gaussian)', lx, ly + 16, { color: pal.series[2] });
        plot.text('- - natural + pressure only (Lorentzian)', lx, ly + 32, { color: pal.series[3] });
      });
    }
    function gaussianOnly(dx: number, f: number) {
      const sigma = f / (2 * Math.sqrt(2 * Math.LN2));
      return Math.exp(-(dx * dx) / (2 * sigma * sigma));
    }
    function lorentzOnly(dx: number, f: number) {
      const g = f / 2;
      return (g * g) / (dx * dx + g * g);
    }

    draw();
    stage.onResize(() => draw());
    return { setVisible(v) { if (v) draw(); }, destroy() {} };
  },
});
