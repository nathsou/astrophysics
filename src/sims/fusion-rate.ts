// Secondary figure: energy generation rate epsilon_pp vs epsilon_CNO as a function of
// temperature (log-log), with the crossover marked and a draggable temperature line.
// Uses the same Gamow-peak machinery as the flagship, applied to the pp reaction and to the
// slowest CNO step (p+14N), which sets each cycle's overall rate.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { REACTIONS, reducedMassAmu, gamowEnergyEV, kTeV, gamowRate } from './fusion/physics';

const PP = REACTIONS.find((r) => r.id === 'pp')!;
const PN = REACTIONS.find((r) => r.id === 'pN')!;
const EG_pp = gamowEnergyEV(PP), mu_pp = reducedMassAmu(PP.A1, PP.A2);
const EG_pN = gamowEnergyEV(PN), mu_pN = reducedMassAmu(PN.A1, PN.A2);

// log10(epsilon) up to an arbitrary additive normalisation chosen so the two curves cross
// near 17-18 MK (the textbook crossover), with CNO's steeper density of catalysts folded in
// as a constant offset (real CNO also scales with metal abundance, which we hold fixed).
const OFFSET_CNO = 6.2;
function log10eps_pp(T_MK: number): number { return gamowRate(kTeV(T_MK), EG_pp, mu_pp).logRate / Math.LN10; }
function log10eps_cno(T_MK: number): number { return gamowRate(kTeV(T_MK), EG_pN, mu_pN).logRate / Math.LN10 + OFFSET_CNO; }

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 5, max: 40, label: 'core temperature (MK)' },
      y: { min: -6, max: 4, label: 'log₁₀ ε (arb. units)', format: (v) => fmt(v, 2) },
      title: 'Energy generation: pp-chain vs CNO cycle',
    });

    let T_MK = 15.7; // the Sun's core temperature

    // Find the crossover by bisection.
    let lo = 5, hi = 40;
    for (let i = 0; i < 60; i++) {
      const mid = Math.sqrt(lo * hi);
      if (log10eps_pp(mid) > log10eps_cno(mid)) hi = mid; else lo = mid;
    }
    const Tcross = Math.sqrt(lo * hi);

    function render() {
      plot.draw(() => {
        plot.fn(log10eps_pp, { color: pal.series[0], width: 2.25 });
        plot.fn(log10eps_cno, { color: pal.series[2], width: 2.25 });
        plot.vline(Tcross, { color: pal.muted, label: `crossover ≈ ${fmt(Tcross, 3)} MK` });
        plot.vline(15.7, { color: pal.accent2, label: 'the Sun' });
        plot.point(T_MK, log10eps_pp(T_MK), { color: pal.series[0], r: 5 });
        plot.point(T_MK, log10eps_cno(T_MK), { color: pal.series[2], r: 5 });
        plot.text('pp-chain  (ν ≈ 4)', plot.px(30), plot.py(log10eps_pp(30)) - 8, { color: pal.series[0] });
        plot.text('CNO cycle  (ν ≈ 17-20)', plot.px(30), plot.py(log10eps_cno(30)) + 14, { color: pal.series[2] });
      });
    }

    let dragging = false;
    const setFromPointer = (clientX: number) => {
      const r = stage.canvas.getBoundingClientRect();
      T_MK = Math.min(plot.o.x.max, Math.max(plot.o.x.min, plot.dx(clientX - r.left)));
      tSlider.set(T_MK);
      loop.invalidate();
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; setFromPointer(e.clientX); });
    window.addEventListener('pointermove', (e) => { if (dragging) setFromPointer(e.clientX); });
    window.addEventListener('pointerup', () => { dragging = false; });

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    const tSlider = panel.slider('Core temperature', { min: 5, max: 40, value: T_MK, unit: 'MK' }, (v) => { T_MK = v; loop.invalidate(); });
    panel.button('Snap to the Sun (15.7 MK)', () => { T_MK = 15.7; tSlider.set(T_MK); loop.invalidate(); });
    const roDom = panel.readout('Dominant process');
    const update = () => roDom.set(T_MK < Tcross ? 'pp-chain' : 'CNO cycle');
    update();
    stage.canvas.addEventListener('pointerdown', update);
    window.addEventListener('pointermove', () => { if (dragging) update(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
