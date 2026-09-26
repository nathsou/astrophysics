// Secondary figure: hydrostatic equilibrium as a stack of gas layers.
// Each layer's weight (its mass times g, integrated inward) must be held up by the pressure
// difference across it: dP/dr = -G m(r) rho(r) / r^2. We draw N discrete shells of a uniform-density
// ball (n = 0 polytrope) and let the user drag the star's mass and radius, showing that every layer's
// pressure step exactly matches the weight of everything above it — the bars always balance.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { G, Msun, Rsun } from '../lib/physics/constants';

const NLAYERS = 10;

export default defineSim({
  mount({ host }) {
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 1, label: 'r / R (layer boundary)' },
      y: { min: 0, max: 1, label: 'pressure P / P_c' },
    });
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    let M = 1, R = 1; // Msun, Rsun
    const panel = new Panel(host);
    panel.slider('Mass M', { min: 0.2, max: 10, value: M, log: true, unit: 'M☉' }, (v) => { M = v; draw(); });
    panel.slider('Radius R', { min: 0.2, max: 5, value: R, log: true, unit: 'R☉' }, (v) => { R = v; draw(); });
    const roPc = panel.readout('Central pressure (uniform-density estimate)');
    const roG = panel.readout('Surface gravity g');

    // Uniform density sphere: rho = const, m(r) = M (r/R)^3, dP/dr = -G rho m(r)/r^2 = -G rho (M/R^3) r
    // Integrating from the surface (P=0) inward: P(r) = (2/3) pi G rho^2 (R^2 - r^2)
    function pressureProfile(x: number, rho: number, Rm: number) {
      return ((2 / 3) * Math.PI * G * rho * rho * (Rm * Rm - (x * Rm) ** 2));
    }

    function draw() {
      const Mkg = M * Msun, Rm = R * Rsun;
      const rho = Mkg / ((4 / 3) * Math.PI * Rm ** 3);
      const Pc = pressureProfile(0, rho, Rm);
      const g = G * Mkg / (Rm * Rm);
      roPc.set(`${fmt(Pc, 3)} Pa`);
      roG.set(`${fmt(g, 3)} m/s²`);

      plot.o.y.max = 1;
      plot.draw(() => {
        // continuous curve
        plot.fn((x) => pressureProfile(x, rho, Rm) / Pc, { color: pal.faint, width: 1.25 });
        // discrete layers: bars showing pressure at each boundary, and weight-per-layer as bar height delta
        const xs: number[] = [], ps: number[] = [];
        for (let i = 0; i <= NLAYERS; i++) { const x = i / NLAYERS; xs.push(x); ps.push(pressureProfile(x, rho, Rm) / Pc); }
        for (let i = 0; i < NLAYERS; i++) {
          const x0 = xs[i], x1 = xs[i + 1];
          const p0 = ps[i], p1 = ps[i + 1];
          const cx0 = plot.px(x0), cx1 = plot.px(x1);
          const cy0 = plot.py(p0), cy1 = plot.py(p1);
          plot.ctx.fillStyle = pal.series[i % 5];
          plot.ctx.globalAlpha = 0.28;
          plot.ctx.fillRect(cx0, cy1, cx1 - cx0, plot.py(0) - cy1);
          plot.ctx.globalAlpha = 1;
          plot.point(x0, p0, { r: 3, color: pal.series[i % 5] });
        }
        plot.point(1, 0, { r: 3, color: pal.muted });
        plot.text('Each shaded step = ΔP across a shell = weight of the gas above it, per unit area.', plot.m.l + 6, 16, { color: pal.muted, size: 11 });
      });
    }

    draw();
    return { setVisible() {}, destroy() {} };
  },
});
