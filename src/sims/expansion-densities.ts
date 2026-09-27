// Secondary figure: ρ_i(a) for radiation, matter and Λ on log–log axes, showing the
// matter–radiation and matter–Λ equality points and shading the three eras.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { aEqMR, aEqML, FLAT_LCDM, type OmegaParams } from './expansion/cosmology';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 10 });
    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1.1'; // taller on phones
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const plot = new Plot(stage.canvas, {
      x: { min: 1e-6, max: 10, log: true, label: 'scale factor a (log)' },
      y: { min: 1e-6, max: 1e12, log: true, label: 'ρ / ρcrit,0 (log)' },
      title: 'Energy density vs scale factor',
    });

    let p: OmegaParams = { ...FLAT_LCDM };
    const loop = new Loop(null, render, 1 / 30);
    loop.onDemand = true; // static figure: redraw only on invalidate()
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const N = 200;
    const as = new Float64Array(N);
    for (let i = 0; i < N; i++) as[i] = 1e-6 * Math.pow(10 / 1e-6, i / (N - 1));

    function render() {
      const rhoR = new Float64Array(N), rhoM = new Float64Array(N), rhoL = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        rhoR[i] = p.Or / (as[i] ** 4);
        rhoM[i] = p.Om / (as[i] ** 3);
        rhoL[i] = p.OL;
      }
      const aEq = aEqMR(p), aML = aEqML(p);
      plot.draw(() => {
        // era shading
        const shade = (a0: number, a1: number, color: string) => {
          const x0 = plot.px(Math.max(a0, plot.o.x.min)), x1 = plot.px(Math.min(a1, plot.o.x.max));
          plot.ctx.fillStyle = color;
          plot.ctx.fillRect(x0, plot.m.t, Math.max(0, x1 - x0), plot.ph);
        };
        shade(plot.o.x.min, aEq, 'rgba(120,150,255,0.07)');
        shade(aEq, aML, 'rgba(120,255,150,0.07)');
        shade(aML, plot.o.x.max, 'rgba(255,170,120,0.07)');

        plot.line(as, rhoR, { color: pal.series[2] });
        plot.line(as, rhoM, { color: pal.series[0] });
        plot.line(as, rhoL, { color: pal.series[1] });
        plot.vline(1, { color: pal.muted });
        plot.text('today', plot.px(1) + 4, plot.m.t + 12, { color: pal.muted });
        if (aEq > plot.o.x.min) {
          plot.vline(aEq, { color: pal.faint });
          plot.text(`a_eq ≈ ${fmt(aEq, 2)}`, plot.px(aEq) + 4, plot.m.t + 12, { color: pal.muted });
        }
        if (Number.isFinite(aML) && aML > plot.o.x.min && aML < plot.o.x.max) {
          plot.vline(aML, { color: pal.faint });
          plot.text(`a ≈ ${fmt(aML, 2)}`, plot.px(aML) - 4, plot.m.t + 12, { color: pal.muted, align: 'right' });
        }
        // line labels, placed where each line crosses a chosen density so they stay on screen
        const at = (rho: number, O: number, n: number) => (O / rho) ** (1 / n);
        const aR = at(1e-2, p.Or, 4), aM = at(1e4, p.Om, 3);
        plot.text('radiation ∝ a⁻⁴', plot.px(aR) + 8, plot.py(1e-2), { color: pal.series[2] });
        plot.text('matter ∝ a⁻³', plot.px(aM) + 8, plot.py(1e4), { color: pal.series[0] });
        plot.text('Λ (constant)', plot.px(1e-5), plot.py(p.OL) - 6, { color: pal.series[1] });
        // era names along the bottom
        const era = (a0: number, a1: number, name: string) => {
          const x0 = plot.px(Math.max(a0, plot.o.x.min)), x1 = plot.px(Math.min(a1, plot.o.x.max));
          if (x1 - x0 > 60) plot.text(name, (x0 + x1) / 2, plot.m.t + plot.ph - 8, { color: pal.muted, align: 'center' });
        };
        era(plot.o.x.min, aEq, 'radiation era');
        era(aEq, aML, 'matter era');
        era(aML, plot.o.x.max, 'Λ era');
      });
      eqOut.set(`a_eq = ${fmt(aEq, 4)}  (z_eq ≈ ${fmt(1 / aEq - 1, 4)})`);
      mlOut.set(Number.isFinite(aML) ? `a ≈ ${fmt(aML, 3)}  (z ≈ ${fmt(1 / aML - 1, 3)})` : 'never (ΩΛ = 0)');
    }

    const panel = new Panel(host);
    panel.slider('Ωm', { min: 0.05, max: 1, value: p.Om, step: 0.01 }, (v) => { p = { ...p, Om: v, OL: Math.max(0, 1 - v - p.Or) }; loop.invalidate(); });
    panel.slider('Ωr', { min: 1e-6, max: 1e-3, value: p.Or, log: true, step: 1e-6, format: (v) => v.toExponential(1) }, (v) => { p = { ...p, Or: v }; loop.invalidate(); });
    const eqOut = panel.readout('Matter–radiation equality');
    const mlOut = panel.readout('Matter–Λ equality');

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
