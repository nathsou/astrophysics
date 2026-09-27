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

// log10 of each cycle's rate from the Gamow integral alone (S-factor held constant). The two
// cycles' S-factors and compositions differ by ~20 orders of magnitude (S_pp ≈ 4×10⁻²² keV b is a
// weak-interaction rate; S(¹⁴N) ≈ 3.5 keV b), so we fold that into one constant, calibrated so the
// curves cross at 17.5 MK, the textbook crossover for solar composition. Both are then expressed
// relative to the pp rate at the Sun's centre.
const rawPP = (T_MK: number) => gamowRate(kTeV(T_MK), EG_pp, mu_pp).logRate / Math.LN10;
const rawCNO = (T_MK: number) => gamowRate(kTeV(T_MK), EG_pN, mu_pN).logRate / Math.LN10;
const T_CROSS = 17.5, T_SUN = 15.7;
const OFFSET_CNO = rawPP(T_CROSS) - rawCNO(T_CROSS);
const ZERO = rawPP(T_SUN);
function log10eps_pp(T_MK: number): number { return rawPP(T_MK) - ZERO; }
function log10eps_cno(T_MK: number): number { return rawCNO(T_MK) + OFFSET_CNO - ZERO; }

// Tabulate once: each point is a full numerical Gamow integral, far too slow to redo every frame.
const NT = 240;
const TS = new Float64Array(NT), PPS = new Float64Array(NT), CNOS = new Float64Array(NT);
for (let i = 0; i < NT; i++) {
  TS[i] = 5 + (35 * i) / (NT - 1);
  PPS[i] = log10eps_pp(TS[i]);
  CNOS[i] = log10eps_cno(TS[i]);
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); redraw(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 5, max: 40, label: 'core temperature (MK)' },
      y: { min: -8, max: 8, label: 'log₁₀ ε  (relative to pp at the Sun’s centre)', format: (v) => fmt(v, 2) },
      title: 'Energy generation: pp-chain vs CNO cycle',
    });

    let T_MK = 15.7; // the Sun's core temperature

    const Tcross = T_CROSS;
    let dirty = true;
    const redraw = () => { dirty = true; loop.invalidate(); };

    function render() {
      if (!dirty) return;
      dirty = false;
      update();
      plot.draw(() => {
        plot.line(TS, PPS, { color: pal.series[0], width: 2.25 });
        plot.line(TS, CNOS, { color: pal.series[2], width: 2.25 });
        plot.vline(Tcross, { color: pal.muted, label: `crossover ≈ ${fmt(Tcross, 3)} MK` });
        plot.vline(15.7, { color: pal.accent2, label: 'the Sun' });
        plot.point(T_MK, log10eps_pp(T_MK), { color: pal.series[0], r: 5 });
        plot.point(T_MK, log10eps_cno(T_MK), { color: pal.series[2], r: 5 });
        plot.text('pp-chain  (ν ≈ 4)', plot.px(30), plot.py(log10eps_pp(30)) + 16, { color: pal.series[0] });
        plot.text('CNO cycle  (ν ≈ 17–20)', plot.px(24), plot.py(log10eps_cno(24)) - 10, { color: pal.series[2], align: 'right' });
      });
    }

    let dragging = false;
    const setFromPointer = (clientX: number) => {
      const r = stage.canvas.getBoundingClientRect();
      T_MK = Math.min(plot.o.x.max, Math.max(plot.o.x.min, plot.dx(clientX - r.left)));
      tSlider.set(T_MK);
      redraw();
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; setFromPointer(e.clientX); });
    window.addEventListener('pointermove', (e) => { if (dragging) setFromPointer(e.clientX); });
    window.addEventListener('pointerup', () => { dragging = false; });

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); redraw(); });

    const panel = new Panel(host);
    const tSlider = panel.slider('Core temperature', { min: 5, max: 40, value: T_MK, unit: 'MK' }, (v) => { T_MK = v; redraw(); });
    panel.button('Snap to the Sun (15.7 MK)', () => { T_MK = 15.7; tSlider.set(T_MK); redraw(); });
    const roDom = panel.readout('Dominant process');
    function update() {
      const d = log10eps_pp(T_MK) - log10eps_cno(T_MK);
      roDom.set(`${d > 0 ? 'pp-chain' : 'CNO cycle'} (ε_pp / ε_CNO ≈ ${fmt(Math.pow(10, d), 2)})`);
    }

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
