// Secondary figure: supernova light curves. Type Ia is powered by radioactive decay of freshly made
// ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe deep in the ejecta; Type II-P shows a "plateau" instead, powered by the shock's
// deposited energy re-emerging as the hydrogen recombination front recedes through the envelope.
// This is a compact toy model (Arnett-like for Ia, a leaky-box plateau for II-P), not a radiative-
// transfer calculation, but it reproduces the right shapes, timescales and the Phillips relation.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const LN2 = Math.LN2;
const T_HALF_NI = 6.075; // days
const T_HALF_CO = 77.236; // days
const LAM_NI = LN2 / T_HALF_NI;
const LAM_CO = LN2 / T_HALF_CO;

/** Energy release rate per unit ⁵⁶Ni mass from the decay chain Ni->Co->Fe, in arbitrary power units. */
function decayLuminosity(t: number, mNi: number): number {
  // Number of remaining Ni nuclei ~ exp(-lam_Ni t); Co grows from Ni decay and itself decays.
  const nNi = Math.exp(-LAM_NI * t);
  const nCo = (LAM_NI / (LAM_NI - LAM_CO)) * (Math.exp(-LAM_CO * t) - Math.exp(-LAM_NI * t));
  // Energy per decay: Co-56 releases much more energy per decay than Ni-56 (gamma+positron cascade).
  const eNi = 1.0, eCo = 3.7; // relative energy scales (illustrative, ratio ~ observed)
  return mNi * (LAM_NI * eNi * nNi + LAM_CO * eCo * nCo);
}

/** Arnett-style diffusion: the escaping luminosity lags energy deposition by the diffusion time tau_d,
 *  peaking near maximum light (~ Δm15's rise time) then tracking the decay tail once optically thin. */
function typeIaCurve(days: number[], mNi: number, tauD: number): number[] {
  const dt = days[1] - days[0];
  const L: number[] = [];
  let store = 0;
  for (const t of days) {
    const heat = decayLuminosity(Math.max(t, 0), mNi);
    store += (heat - store / tauD) * dt;
    L.push(Math.max(store / tauD, 1e-6));
  }
  return L;
}

function typeIIpCurve(days: number[], Lplateau: number, tPlateau: number, mNi: number): number[] {
  return days.map((t) => {
    if (t < 0) return 0;
    if (t < tPlateau) return Lplateau * (1 - 0.15 * Math.exp(-t / 8));
    const tail = decayLuminosity(t - tPlateau, mNi) * 25; // tail luminosity set by Co-56 in the ejecta
    const drop = Math.exp(-(((t - tPlateau) / 6) ** 2)); // the "plateau cliff" as recombination front hits core
    return Lplateau * drop * 0.3 + tail;
  });
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 200, label: 'days since explosion' },
      y: { min: 0.03, max: 30, log: true, label: 'relative luminosity' },
      title: 'Supernova light curves',
    });
    let mNi = 0.6; // Msun of 56Ni synthesised (Phillips relation driver)
    let type: 'Ia' | 'IIP' = 'Ia';
    const days: number[] = [];
    for (let t = -5; t <= 300; t += 0.5) days.push(t);

    const panel = new Panel(host);
    panel.select('Type', [{ value: 'Ia', label: 'Type Ia (thermonuclear)' }, { value: 'IIP', label: 'Type II-P (core collapse)' }], type, (v) => { type = v; draw(); });
    const roPeak = panel.readout('Peak (relative)');
    const roDm15 = panel.readout('Δm₁₅ (decline in 15 d)');
    panel.slider('⁵⁶Ni mass synthesised', { min: 0.1, max: 1.2, value: mNi, unit: 'M☉', step: 0.01 }, (v) => { mNi = v; draw(); });

    function draw() {
      const tauD = 12 + 6 * Math.sqrt(mNi); // more ejecta mass -> longer diffusion time -> broader, brighter peak
      let L: number[];
      if (type === 'Ia') L = typeIaCurve(days, mNi, tauD);
      else L = typeIIpCurve(days, 30 * mNi + 8, 100, mNi);

      const peakIdx = L.reduce((best, v, i) => (v > L[best] ? i : best), 0);
      const peak = L[peakIdx];
      const t15 = days[peakIdx] + 15;
      let L15 = peak;
      for (let i = peakIdx; i < days.length; i++) if (days[i] >= t15) { L15 = L[i]; break; }
      const dm15 = 2.5 * Math.log10(peak / Math.max(L15, 1e-9));
      roPeak.set(fmt(peak, 3));
      roDm15.set(type === 'Ia' ? `${fmt(dm15, 3)} mag` : '— (plateau, not a decliner)');

      plot.o.y.max = Math.max(3, peak * 1.8);
      plot.draw(() => {
        plot.line(days, L, { color: pal.series[type === 'Ia' ? 1 : 0], width: 2.25 });
        plot.vline(days[peakIdx], { color: pal.muted, label: 'peak' });
        if (type === 'Ia') {
          plot.vline(days[peakIdx] + 15, { color: pal.bad, label: '+15 d' });
          plot.text(`Phillips relation: brighter Ia decline more slowly (higher ⁵⁶Ni ⇒ higher peak, smaller Δm₁₅).`, plot.m.l + 8, plot.m.t + 14, { color: pal.muted, size: 10.5 });
        } else {
          plot.text('Plateau: recombination front eats through the H envelope at ~constant L, then the tail is powered by ⁵⁶Co.', plot.m.l + 8, plot.m.t + 14, { color: pal.muted, size: 10.5 });
        }
      });
    }
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    onThemeChange(() => { pal = palette(); draw(); });

    return { setVisible() {}, destroy() {} };
  },
});
