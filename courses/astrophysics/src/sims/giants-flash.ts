// Secondary figure: the helium-flash "thermostat" toy. A minimal 2-variable ODE contrasts
// an ideal-gas core (self-regulating: heat it, it expands, cools, stable) with a
// degenerate core (pressure doesn't care about temperature, so heating cannot relieve
// itself by expanding — a thermal runaway). Not a real stellar model: it is deliberately
// the simplest system that shows the qualitative difference that makes the He flash violent.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// Natural units: T0 = rho0 = 1 at equilibrium. Reaction rate ~ rho^2 * T^n (n mimics the
// ferocious temperature sensitivity of triple-alpha, n ~ 40 near flash conditions).
const N_POWER = 18; // softened from ~40 so the toy stays numerically tame at this dt
const H0 = 1;
const COOL = 1.1; // Newtonian cooling toward ambient
let mode: 'ideal' | 'degenerate' = 'degenerate';
let expansionRate = 2.5; // how fast an ideal-gas core relieves pressure by expanding

function derivs(T: number, rho: number): [number, number] {
  const heating = H0 * rho * rho * Math.pow(Math.max(T, 1e-6), N_POWER / 10); // T^(n/10) keeps exponents sane with T~O(1..3)
  const cooling = COOL * (T - 1);
  const dT = heating - cooling;
  let dRho = 0;
  if (mode === 'ideal') {
    const P = rho * T; // ideal gas: P ~ rho T
    dRho = -expansionRate * (P - 1) * rho; // expands (rho falls) when P exceeds equilibrium
  } // degenerate: pressure ~ rho^(5/3), independent of T -> core does not expand on this timescale
  return [dT, dRho];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);';
    host.append(wrap);
    const stage = createStage(wrap, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 8, label: 'time (arbitrary thermal units)' },
      y: { min: 0, max: 6, label: 'T / T₀ , ρ / ρ₀' },
      title: 'Perturb the core: ideal gas self-regulates, degenerate gas runs away',
      margin: { l: 56, r: 16, t: 78, b: 42 },
    });

    let T = 1, rho = 1, t = 0;
    const seriesT = new Series(3000);
    const seriesRho = new Series(3000);
    let blown = false;

    function reset() { T = 1; rho = 1; t = 0; blown = false; seriesT.clear(); seriesRho.clear(); seriesT.push(0, T); seriesRho.push(0, rho); }
    reset();

    const loop = new Loop((dt) => {
      const h = Math.min(dt, 0.02);
      const steps = Math.max(1, Math.round(dt / h));
      for (let i = 0; i < steps; i++) {
        const [dT, dRho] = derivs(T, rho);
        T += dT * h; rho += dRho * h;
        T = Math.max(0.05, Math.min(T, 50));
        rho = Math.max(0.02, Math.min(rho, 3));
        if (T > 20) blown = true;
        t += h;
      }
      seriesT.push(t, T);
      seriesRho.push(t, rho);
      if (t > plot.o.x.max) plot.o.x.max += 4;
    }, render, 1 / 60);

    function render() {
      plot.resize(stage.width, stage.height, stage.dpr);
      plot.draw(() => {
        const [xt, yt] = seriesT.linear();
        const [xr, yr] = seriesRho.linear();
        plot.line(xt, yt, { color: pal.series[2], width: 2 });
        plot.line(xr, yr, { color: pal.series[0], width: 2 });
        plot.hline(1, { color: pal.faint, dash: [3, 4] });
      });
      const ctx = plot.ctx;
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = pal.series[2]; ctx.fillText('— T / T₀', 60, 36);
      ctx.fillStyle = pal.series[0]; ctx.fillText('— ρ / ρ₀', 130, 36);
      ctx.fillStyle = pal.muted;
      const narrow = stage.width < 620;
      ctx.fillText(mode === 'degenerate'
        ? (narrow ? 'Degenerate: P ∝ ρ^(5/3), no T feedback' : 'Degenerate core: P ∝ ρ^(5/3), independent of T: no expansion, no relief.')
        : (narrow ? 'Ideal gas: P ∝ ρT, self-regulating' : 'Ideal-gas core: P ∝ ρT. It heats, expands, cools and restabilises.'), 60, 54);
      if (blown) { ctx.fillStyle = pal.bad; ctx.fillText(narrow ? 'Runaway: the helium flash' : 'Runaway: this is the helium flash (in a real core it stops once T is high enough to lift the degeneracy).', 60, 70); }
    }

    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.select('Core', [{ value: 'degenerate', label: 'Degenerate (He flash)' }, { value: 'ideal', label: 'Ideal gas (thermostat)' }], mode, (v) => { mode = v as any; reset(); loop.invalidate(); });
    panel.button('Perturb (add heat)', () => { T += 0.6; loop.invalidate(); }, true);
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Expansion rate (ideal only)', { min: 0.5, max: 8, value: expansionRate, step: 0.1 }, (v) => { expansionRate = v; });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
