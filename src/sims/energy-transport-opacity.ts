// Secondary figure: opacity vs. temperature, from textbook analytic fits.
// Components: electron scattering (flat), Kramers free-free + bound-free (κ ∝ ρ T^-3.5) and the
// H⁻ ion (κ ∝ ρ^½ T^9, the cool-star regime). They combine the way simple stellar codes do,
//     κ = κ_mol + 1 / (1/κ_H⁻ + 1/(κ_es + κ_Kr)),
// so H⁻ caps the opacity at low T, where hydrogen recombines and Kramers' free electrons vanish.
// The thick curve follows the Sun's actual (ρ, T) track from core to photosphere; the thin one
// holds the density fixed at the slider value. Drag along the Sun's track to read off κ.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const Z = 0.02;
// Approximate Standard Solar Model track: (T in K, ρ in g/cm³), photosphere → core.
const SUN: [number, number][] = [
  [5800, 2.5e-7], [1.2e4, 3e-6], [3e4, 1.5e-4], [1e5, 1.8e-3], [1e6, 5.8e-2], [2.2e6, 0.19],
  [3.3e6, 0.45], [4.1e6, 1.4], [5.2e6, 4.5], [6.8e6, 12.5], [9.4e6, 35], [1.33e7, 87], [1.57e7, 150],
];
const T_MIN = SUN[0][0], T_MAX = SUN[SUN.length - 1][0];
function sunRho(T: number) {
  const x = Math.log(Math.min(Math.max(T, T_MIN), T_MAX));
  for (let i = 1; i < SUN.length; i++) {
    const xa = Math.log(SUN[i - 1][0]), xb = Math.log(SUN[i][0]);
    if (x <= xb) {
      const f = (x - xa) / (xb - xa);
      return Math.exp(Math.log(SUN[i - 1][1]) + f * (Math.log(SUN[i][1]) - Math.log(SUN[i - 1][1])));
    }
  }
  return SUN[SUN.length - 1][1];
}

export default defineSim({
  mount({ host, onDestroy }) {
    const stage = createStage(host, { aspect: 16 / 9, maxDpr: 2 });
    const plot = new Plot(stage.canvas, {
      x: { min: 3000, max: 3e7, log: true, label: 'temperature T (K)' },
      y: { min: 1e-2, max: 1e7, log: true, label: 'opacity κ (cm² g⁻¹)' },
      title: 'Opacity vs. temperature (analytic fits) — drag along the Sun',
    });
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { rho: 1e-3, X: 0.7, T: 2.2e6 };

    const kES = () => 0.2 * (1 + s.X);
    const kKr = (T: number, rho: number) => (4.34e25 * Z + 3.68e22 * (1 - Z)) * (1 + s.X) * rho * Math.pow(T, -3.5);
    const kH = (T: number, rho: number) => 2.5e-31 * (Z / 0.02) * Math.sqrt(rho) * Math.pow(T, 9);
    const kappa = (T: number, rho: number) => 0.1 * Z + 1 / (1 / kH(T, rho) + 1 / (kES() + kKr(T, rho)));

    function render() {
      plot.draw(() => {
        const r = s.rho;
        plot.fn(() => kES(), { color: pal.series[1], width: 1.25, dash: [3, 3] });
        plot.fn((T) => kKr(T, r), { color: pal.series[2], width: 1.25, dash: [3, 3] });
        plot.fn((T) => kH(T, r), { color: pal.series[4], width: 1.25, dash: [2, 4] });
        plot.fn((T) => kappa(T, r), { color: pal.muted, width: 1.5 });
        plot.fn((T) => (T >= T_MIN && T <= T_MAX ? kappa(T, sunRho(T)) : NaN), { color: pal.accent, width: 3 });
        const k = kappa(s.T, sunRho(s.T));
        plot.point(s.T, Math.min(plot.o.y.max, Math.max(plot.o.y.min, k)), { color: pal.accent, r: 6, stroke: pal.bg });
        plot.text('electron scattering', plot.px(5e6), plot.py(kES()) + 14, { color: pal.series[1] });
        plot.text('Kramers', plot.px(3.2e3) + 4, plot.py(Math.min(3e6, kKr(3.2e3, r))) + 14, { color: pal.series[2] });
        plot.text('H⁻', plot.px(3300), plot.py(Math.max(0.03, kH(3300, r))) - 6, { color: pal.series[4] });
        plot.text(`fixed ρ = ${fmt(r, 2)} g/cm³`, plot.px(1.5e7), plot.py(kappa(1.5e7, r)) - 8, { color: pal.muted, align: 'right' });
        plot.text('the Sun, core → surface', plot.px(3e5), plot.py(kappa(3e5, sunRho(3e5))) - 10, { color: pal.accent });
      });
    }

    let dragging = false;
    stage.canvas.style.touchAction = 'none';
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; move(e); });
    const onMove = (e: PointerEvent) => { if (dragging) move(e); };
    const onUp = () => (dragging = false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    function move(e: PointerEvent) {
      const r = stage.canvas.getBoundingClientRect();
      s.T = Math.min(T_MAX, Math.max(T_MIN, plot.dx(e.clientX - r.left)));
      loop.invalidate();
      updateReadout();
    }

    const panel = new Panel(host);
    panel.slider('Fixed density ρ', { min: 1e-8, max: 100, value: s.rho, log: true, unit: 'g/cm³' }, (v) => { s.rho = v; loop.invalidate(); });
    panel.slider('Hydrogen fraction X', { min: 0, max: 0.9, value: s.X, step: 0.01 }, (v) => { s.X = v; loop.invalidate(); updateReadout(); });
    const rKappa = panel.readout('In the Sun at the marker');
    function updateReadout() {
      const rho = sunRho(s.T);
      rKappa.set(`T = ${fmt(s.T, 3)} K, ρ = ${fmt(rho, 2)} g/cm³ → κ = ${fmt(kappa(s.T, rho), 3)} cm² g⁻¹`);
    }
    updateReadout();

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); loop.invalidate(); });
    onDestroy(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
