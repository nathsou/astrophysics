// Secondary figure: opacity vs. temperature at fixed density, with a draggable (rho, T) point.
// Shows the three regimes that dominate stellar opacity: electron scattering (flat), Kramers
// free-free/bound-free (kappa ~ rho T^-3.5), and the H- minimum-opacity dip near the solar
// photosphere (~6000-8000 K) before the "Z-bump" of bound-bound lines at higher T.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host, onDestroy }) {
    const stage = createStage(host, { aspect: 16 / 9, maxDpr: 2 });
    const plot = new Plot(stage.canvas, {
      x: { min: 3000, max: 3e7, log: true, label: 'T (K)' },
      y: { min: 1e-4, max: 1e3, log: true, label: 'κ (cm² g⁻¹)' },
      title: 'Rosseland-mean opacity, schematic',
    });
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { rho: 1, X: 0.7, T: 1.5e6 };

    const kappaES = () => 0.2 * (1 + s.X);
    const kappaKramers = (T: number) => 4e24 * s.rho * Math.pow(T, -3.5); // schematic free-free/bound-free
    const kappaHminus = (T: number) => {
      // crude bump centred near 5000-9000 K representing the H- opacity dip's edges plus lines
      const x = Math.log10(T);
      return 2.5e-31 * s.rho * Math.pow(T, 9) * Math.exp(-(((x - 3.85) / 0.5) ** 2)) + 1e-6;
    };
    const kappaTotal = (T: number) => kappaES() + kappaKramers(T) + kappaHminus(T);

    function render() {
      plot.draw(() => {
        plot.fn((T) => kappaES(), { color: pal.series[1], width: 1.5, dash: [3, 3] });
        plot.fn((T) => kappaKramers(T), { color: pal.series[2], width: 1.5, dash: [3, 3] });
        plot.fn((T) => kappaHminus(T), { color: pal.series[4], width: 1.5, dash: [2, 4] });
        plot.fn((T) => kappaTotal(T), { color: pal.fg, width: 2.5 });
        plot.point(s.T, Math.min(plot.o.y.max, Math.max(plot.o.y.min, kappaTotal(s.T))), { color: pal.accent, r: 6 });
        plot.text('electron scattering', plot.px(2e4), plot.py(kappaES()) - 8, { color: pal.series[1] });
        plot.text('Kramers (free-free / bound-free)', plot.px(5e5), plot.py(kappaKramers(5e5)) - 8, { color: pal.series[2] });
        plot.text('H⁻ + bound-bound "Z-bump"', plot.px(6000), plot.py(1) , { color: pal.series[4] });
      });
    }

    let dragging = false;
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; move(e); });
    window.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    window.addEventListener('pointerup', () => (dragging = false));
    function move(e: PointerEvent) {
      const r = stage.canvas.getBoundingClientRect();
      const T = plot.dx(((e.clientX - r.left)));
      s.T = Math.min(plot.o.x.max, Math.max(plot.o.x.min, T));
      loop.invalidate();
      updateReadout();
    }

    const panel = new Panel(host);
    panel.slider('Density ρ (g/cm³, relative)', { min: 0.01, max: 100, value: s.rho, log: true }, (v) => { s.rho = v; loop.invalidate(); updateReadout(); });
    panel.slider('Hydrogen fraction X', { min: 0, max: 0.9, value: s.X, step: 0.01 }, (v) => { s.X = v; loop.invalidate(); updateReadout(); });
    const rKappa = panel.readout('κ at the dragged point');
    function updateReadout() { rKappa.set(`${fmt(kappaTotal(s.T), 4)} cm² g⁻¹  at  T = ${fmt(s.T, 3)} K`); }
    updateReadout();

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); loop.invalidate(); });
    onDestroy(() => {});
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
