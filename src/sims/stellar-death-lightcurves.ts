// Secondary figure: supernova light curves. Type Ia is powered by radioactive decay of freshly made
// ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe deep in the ejecta; Type II-P shows a "plateau" instead, powered by the shock's
// deposited energy re-emerging as the hydrogen recombination front recedes through the envelope.
// This is a compact toy model (Arnett-like for Ia, a leaky-box plateau for II-P), not a radiative-
// transfer calculation, but it reproduces the right shapes, timescales and the Phillips relation.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe: mean lifetimes (days) and specific heating rates (erg g⁻¹ s⁻¹), as in Arnett (1982).
const TAU_NI = 8.8, TAU_CO = 111.3;
const EPS_NI = 3.9e10, EPS_CO = 6.78e9;
const heating = (t: number, mNi: number) => mNi * ((EPS_NI - EPS_CO) * Math.exp(-t / TAU_NI) + EPS_CO * Math.exp(-t / TAU_CO));

/** Arnett's rule as an ODE: dL/dt = (2t/τ_m²)(Q − L). The photon diffusion time τ_m sets the width;
 *  late on, γ-rays leak out of the thinning ejecta (trapping fraction 1 − e^{−(T₀/t)²}, T₀ ≈ 35 d). */
function typeIaCurve(days: number[], mNi: number, tauM: number): number[] {
  let l = 0, tPrev = 0;
  return days.map((t) => {
    if (t <= 0) return 1e-9;
    const dt = t - tPrev; tPrev = t;
    const q = heating(t, mNi) * (1 - Math.exp(-((35 / t) ** 2)));
    const k = (2 * t) / (tauM * tauM);
    l = (l + dt * k * q) / (1 + dt * k); // implicit step: stable for any dt
    return l;
  });
}

/** II-P: a ~100-day plateau from the receding recombination front, a drop, then a fully trapped ⁵⁶Co tail. */
function typeIIpCurve(days: number[], Lplateau: number, tPlateau: number, mNi: number): number[] {
  return days.map((t) => {
    if (t <= 0) return 1e-9;
    const rise = 1 - Math.exp(-t / 4);
    const plateau = Lplateau * rise * (1 - 0.25 * (t / tPlateau)) / (1 + Math.exp((t - tPlateau) / 4));
    const tail = mNi * EPS_CO * Math.exp(-t / TAU_CO) * (1 - Math.exp(-t / 20));
    return plateau + tail;
  });
}

const tauMOf = (mNi: number) => 7 + 13 * mNi; // more ⁵⁶Ni ↔ more massive, slower-diffusing ejecta
const DAYS: number[] = [];
for (let t = -5; t <= 300; t += 0.25) DAYS.push(t);
// Normalisation: a Type Ia with 0.6 M☉ of ⁵⁶Ni peaks at L = 1.
const L_REF = Math.max(...typeIaCurve(DAYS, 0.6, tauMOf(0.6)));

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 200, label: 'days since explosion' },
      y: { min: 0.003, max: 3, log: true, label: 'bolometric luminosity (Ia peak with 0.6 M☉ ⁵⁶Ni = 1)' },
      title: 'Supernova light curves',
    });
    let mNi = 0.6; // Msun of 56Ni synthesised (Phillips relation driver)
    let type: 'Ia' | 'IIP' = 'Ia';
    const days = DAYS;

    const panel = new Panel(host);
    panel.select('Type', [{ value: 'Ia', label: 'Type Ia (thermonuclear)' }, { value: 'IIP', label: 'Type II-P (core collapse)' }], type, (v) => { type = v; mNi = v === 'Ia' ? 0.6 : 0.05; niCtl.set(mNi); draw(); });
    const roPeak = panel.readout('Peak (relative)');
    const roDm15 = panel.readout('Δm₁₅ (bolometric decline in 15 d)');
    const niCtl = panel.slider('⁵⁶Ni mass synthesised', { min: 0.01, max: 1.2, value: mNi, log: true, unit: 'M☉' }, (v) => { mNi = v; draw(); });

    function draw() {
      const raw = type === 'Ia' ? typeIaCurve(days, mNi, tauMOf(mNi)) : typeIIpCurve(days, 0.07 * L_REF, 105, mNi);
      const L = raw.map((v) => v / L_REF);

      const peakIdx = L.reduce((best, v, i) => (v > L[best] ? i : best), 0);
      const peak = L[peakIdx];
      const t15 = days[peakIdx] + 15;
      let L15 = peak;
      for (let i = peakIdx; i < days.length; i++) if (days[i] >= t15) { L15 = L[i]; break; }
      const dm15 = 2.5 * Math.log10(peak / Math.max(L15, 1e-9));
      roPeak.set(fmt(peak, 3));
      roDm15.set(type === 'Ia' ? `${fmt(dm15, 3)} mag` : '— (plateau, not a decliner)');

      plot.draw(() => {
        plot.line(days, L, { color: pal.series[type === 'Ia' ? 1 : 0], width: 2.25 });
        plot.vline(days[peakIdx], { color: pal.muted, label: 'peak' });
        if (type === 'Ia') {
          plot.vline(days[peakIdx] + 15, { color: pal.bad, label: '+15 d' });
          plot.text('Phillips relation: more ⁵⁶Ni gives a brighter peak', plot.px(45), plot.m.t + 16, { color: pal.muted, size: 11, align: 'left' });
          plot.text('and a slower decline (smaller Δm₁₅).', plot.px(45), plot.m.t + 31, { color: pal.muted, size: 11, align: 'left' });
          plot.text('tail: ⁵⁶Co decay, 77-day half-life', plot.px(120), plot.py(L[days.indexOf(120)]) - 10, { color: pal.muted, size: 11, align: 'left' });
        } else {
          plot.text('Plateau: the recombination front eats inward', plot.px(8), plot.py(0.07) - 18, { color: pal.muted, size: 11, align: 'left' });
          plot.text('through the H envelope at nearly constant L.', plot.px(8), plot.py(0.07) - 4, { color: pal.muted, size: 11, align: 'left' });
          plot.text('tail: ⁵⁶Co decay', plot.px(160), plot.py(L[days.indexOf(160)]) - 10, { color: pal.muted, size: 11, align: 'left' });
        }
      });
    }
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    onThemeChange(() => { pal = palette(); draw(); });

    return { setVisible() {}, destroy() {} };
  },
});
