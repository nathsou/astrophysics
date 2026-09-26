// Chapter 12 flagship: the Gamow peak built live from its two competing factors, plus a
// schematic of the tunnelling event that makes it possible.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt, superscript } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import {
  REACTIONS, reducedMassAmu, gamowEnergyEV, kTeV, gamowPeakE0, gamowWidth,
  lnIntegrand, gamowRate, rateExponent, KEV_FM, type Reaction,
} from './fusion/physics';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:0;';
    host.append(wrap);

    const leftCol = document.createElement('div');
    const rightCol = document.createElement('div');
    rightCol.style.borderLeft = '1px solid var(--rule)';
    wrap.append(leftCol, rightCol);

    const mainStage = createStage(leftCol, { aspect: 16 / 10 });
    const insetStage = createStage(leftCol, { aspect: 16 / 6 });
    const barrierStage = createStage(rightCol, { aspect: 16 / 12 });

    const mainPlot = new Plot(mainStage.canvas, {
      x: { min: 0, max: 100, label: 'E (keV)' },
      y: { min: 1e-6, max: 1, log: true, label: 'factor' },
      title: 'Maxwell–Boltzmann × tunnelling',
    });
    const insetPlot = new Plot(insetStage.canvas, {
      x: { min: 0, max: 100, label: 'E (keV)' },
      y: { min: 0, max: 1.15, label: 'Gamow peak (norm.)' },
    });
    const barrierPlot = new Plot(barrierStage.canvas, {
      x: { min: 0.5, max: 100, log: true, label: 'r (fm)' },
      y: { min: 0, max: 1, label: 'V (keV)' },
      title: 'Coulomb barrier & tunnelling',
    });

    let T_MK = 15;
    let reaction: Reaction = REACTIONS[0];
    let phase = 0;

    // Cached derived quantities, recomputed on parameter change (integration is not cheap enough for 60fps).
    let EG = 0, kT = 0, E0 = 0, width = 0, logRate = 0, nu = 0, muAmu = 0;

    function recompute() {
      muAmu = reducedMassAmu(reaction.A1, reaction.A2);
      EG = gamowEnergyEV(reaction);
      kT = kTeV(T_MK);
      E0 = gamowPeakE0(EG, kT);
      width = gamowWidth(E0, kT);
      const r = gamowRate(kT, EG, muAmu);
      logRate = r.logRate;
      nu = rateExponent(T_MK, EG, muAmu);
      updateReadouts();
      // Frame the plots around the peak.
      const hiKeV = (E0 + 9 * width) / 1e3;
      mainPlot.o.x.max = Math.max(hiKeV, 1);
      insetPlot.o.x.min = Math.max((E0 - 5 * width) / 1e3, 0);
      insetPlot.o.x.max = (E0 + 6 * width) / 1e3;
      const rc = (KEV_FM * reaction.Z1 * reaction.Z2) / (E0 / 1e3); // fm, V(rc) = E0
      barrierPlot.o.x.min = rc / 40;
      barrierPlot.o.x.max = rc * 6;
      barrierPlot.o.y.max = (E0 / 1e3) * 3.2;
    }

    function draw() {
      const peakVal = Math.exp(lnIntegrand(E0, kT, EG)); // normalises the product curve to 1 at its max

      mainPlot.draw(() => {
        mainPlot.fn((EkeV) => Math.exp(-(EkeV * 1e3) / kT), { color: pal.series[2] });
        mainPlot.fn((EkeV) => Math.exp(-Math.sqrt(EG / (EkeV * 1e3))), { color: pal.series[1] });
        mainPlot.fn((EkeV) => Math.exp(lnIntegrand(EkeV * 1e3, kT, EG)) / peakVal, { color: pal.series[0], width: 2.25 });
        mainPlot.vline(E0 / 1e3, { color: pal.muted, label: 'E₀' });
        mainPlot.text('e^(−E/kT)  Maxwell–Boltzmann tail', mainPlot.px(mainPlot.o.x.max * 0.55), mainPlot.py(0.55), { color: pal.series[2], align: 'left' });
        mainPlot.text('e^(−√(E_G/E))  tunnelling probability', mainPlot.px(mainPlot.o.x.max * 0.02), mainPlot.py(1.6e-6), { color: pal.series[1], align: 'left', baseline: 'bottom' });
        mainPlot.text('product = Gamow peak', mainPlot.px(E0 / 1e3), mainPlot.py(1.3), { color: pal.series[0], align: 'center', baseline: 'bottom' });
      });

      insetPlot.draw(() => {
        insetPlot.fn((EkeV) => Math.exp(lnIntegrand(EkeV * 1e3, kT, EG)) / peakVal, { color: pal.series[0], width: 2, fill: pal.series[0] + '26' });
        insetPlot.vline(E0 / 1e3, { color: pal.fg, label: 'E₀' });
        insetPlot.vline((E0 - width / 2) / 1e3, { color: pal.muted });
        insetPlot.vline((E0 + width / 2) / 1e3, { color: pal.muted, label: 'width Δ' });
      });

      // --- Coulomb barrier + tunnelling wavefunction schematic ---
      const A1cbrt = Math.cbrt(reaction.A1), A2cbrt = Math.cbrt(reaction.A2);
      const rn = 1.2 * (A1cbrt + A2cbrt); // fm, nuclear touching radius
      const rc = (KEV_FM * reaction.Z1 * reaction.Z2) / (E0 / 1e3); // fm, classical turning point at E0
      const V = (r: number) => (KEV_FM * reaction.Z1 * reaction.Z2) / r;

      barrierPlot.draw(() => {
        barrierPlot.fn((r) => Math.min(V(r), barrierPlot.o.y.max * 1.3), { color: pal.muted, samples: 300 });
        barrierPlot.hline(E0 / 1e3, { color: pal.series[0], label: 'E₀ (particle energy)' });
        barrierPlot.vline(rn, { color: pal.faint, label: 'nuclear radius' });
        barrierPlot.vline(rc, { color: pal.faint, label: 'classical turning point' });

        // Wavefunction amplitude, schematic: oscillating outside, exponentially damped under the barrier.
        const { ctx, m, ph } = barrierPlot;
        const band = ph * 0.28, y0 = m.t + band + 8;
        const k = 10; // arbitrary oscillation wavenumber for the cartoon, in 1/fm
        const kappa = Math.log(30) / Math.max(rc - rn, 1e-6); // decays ~30x across the barrier
        const amp = (r: number) => {
          if (r < rn) return Math.cos(k * r + phase);
          if (r < rc) return Math.exp(-kappa * (r - rn)) * Math.cos(k * rn + phase);
          const transmitted = Math.exp(-kappa * (rc - rn));
          return transmitted * Math.cos(k * (r - rc) * 0.3 + phase * 0.6);
        };
        ctx.save();
        ctx.beginPath();
        ctx.rect(m.l, m.t, barrierPlot.pw, band + 8);
        ctx.clip();
        ctx.strokeStyle = pal.accent2;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        const N = 240;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const r = barrierPlot.o.x.min * Math.pow(barrierPlot.o.x.max / barrierPlot.o.x.min, t);
          const X = barrierPlot.px(r), Y = y0 - amp(r) * band * 0.9;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke();
        ctx.restore();
        barrierPlot.text('ψ(r) amplitude (schematic)', m.l + 4, m.t + 10, { color: pal.accent2, baseline: 'top' });
      });
    }

    // Readouts + panel.
    const panel = new Panel(host);
    const reactionCtl = panel.select(
      'Reaction',
      REACTIONS.map((r) => ({ value: r.id, label: r.label })),
      reaction.id,
      (id) => { reaction = REACTIONS.find((r) => r.id === id)!; recompute(); loop.invalidate(); },
    );
    panel.slider('Temperature', { min: 1, max: 1000, value: T_MK, log: true, unit: 'MK' }, (v) => { T_MK = v; recompute(); loop.invalidate(); });
    const roE0 = panel.readout('E₀');
    const roW = panel.readout('Width Δ');
    const roRate = panel.readout('Relative rate');
    const roNu = panel.readout('ν = d ln rate / d ln T');

    function updateReadouts() {
      roE0.set(`${fmt(E0 / 1e3, 3)} keV`);
      roW.set(`${fmt(width / 1e3, 3)} keV`);
      const log10 = logRate / Math.LN10;
      const e = Math.floor(log10), m = 10 ** (log10 - e);
      roRate.set(`${fmt(m, 3)}×10${superscript(String(e))} (arb. units)`);
      roNu.set(fmt(nu, 3));
    }
    recompute();
    void reactionCtl; // selection handled via closure above

    const loop = new Loop((dt) => { phase += dt * 3; }, draw, 1 / 30);
    mainStage.onResize((w, h, d) => { mainPlot.resize(w, h, d); loop.invalidate(); });
    insetStage.onResize((w, h, d) => { insetPlot.resize(w, h, d); loop.invalidate(); });
    barrierStage.onResize((w, h, d) => { barrierPlot.resize(w, h, d); loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
