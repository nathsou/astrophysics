// Chapter 20: approximate detector sensitivity curves (characteristic noise strain h_n = √(f S_n))
// for pulsar timing arrays, LISA and LIGO, with sources as characteristic-strain tracks h_c = 2f|h̃(f)|.
// All curves are simple analytic approximations, good to a factor of ~2 — not official curves.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { T_SUN, L_SUN_GEOM, MPC, YR, fISCO, fFromTau } from './gravitational-waves/physics';

// aLIGO design (Ajith 2011 fit to the zero-detuned high-power curve), valid ~10 Hz – 5 kHz
function ligoS(f: number) {
  if (f < 9) return NaN;
  const x = f / 215;
  return 1e-49 * (Math.pow(x, -4.14) - 5 * Math.pow(x, -2) + (111 * (1 - x * x + 0.5 * x ** 4)) / (1 + 0.5 * x * x));
}
// LISA (Robson, Cornish & Liu 2019, sky-averaged, no confusion noise)
function lisaS(f: number) {
  if (f < 1e-5 || f > 1) return NaN;
  const L = 2.5e9, fs = 19.09e-3;
  const Poms = (1.5e-11) ** 2 * (1 + Math.pow(2e-3 / f, 4));
  const Pacc = (3e-15) ** 2 * (1 + Math.pow(4e-4 / f, 2)) * (1 + Math.pow(f / 8e-3, 4));
  return (10 / (3 * L * L)) * (Poms + (2 * (1 + Math.cos(f / fs) ** 2) * Pacc) / Math.pow(2 * Math.PI * f, 4)) * (1 + 0.6 * (f / fs) ** 2);
}
const hn = (S: (f: number) => number) => (f: number) => Math.sqrt(f * S(f));
// PTA: crude power law for a ~15-yr, ~70-pulsar array: white timing noise gives h_n ∝ f^{3/2},
// and sensitivity is lost below 1/T_obs.
function ptaHn(f: number) {
  const fT = 1 / (15 * YR);
  if (f < fT * 0.6 || f > 3e-7) return NaN;
  return 1.1e-15 * Math.pow(f / 1e-8, 1.5) + 2e-15 * Math.pow(fT / f, 4);
}

/** Characteristic strain of an inspiral (Newtonian, sky-averaged-ish): h_c(f) = √(2/3)/π^{2/3} · (Gℳ)^{5/6} f^{-1/6} / D. */
function hcInspiral(Mc: number, Dmpc: number, f: number) {
  const tMc = Mc * T_SUN, D = (Dmpc * MPC) / 2.99792458e8; // D in light-seconds
  return (Math.sqrt(2 / 3) / Math.pow(Math.PI, 2 / 3)) * Math.pow(tMc, 5 / 6) * Math.pow(f, -1 / 6) / D;
}

interface Src { name: string; Mc: number; M: number; D: number; tObs: number; col: number }
const SOURCES: Src[] = [
  { name: 'GW150914', Mc: 28.3, M: 65, D: 440, tObs: 1, col: 0 },
  { name: 'GW170817 (BNS)', Mc: 1.186, M: 2.74, D: 40, tObs: 100, col: 1 },
  { name: '10⁶ M☉ SMBH binary, z≈3', Mc: 4.4e5, M: 1e6 * 1.3, D: 26000, tObs: 4 * YR, col: 2 },
];

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 1.55 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1e-9, max: 1e4, log: true, label: 'frequency (Hz)' },
      y: { min: 1e-24, max: 1e-12, log: true, label: 'characteristic strain' },
      title: 'Approximate sensitivity curves and sources',
    });
    let myMc = 1e4, myD = 3000; // your source
    const loop = new Loop(null, render);
    onDestroy(onThemeChange(() => { pal = palette(); loop.invalidate(); }));

    function track(s: { Mc: number; M: number; D: number; tObs: number }, col: string, label?: string) {
      const f1 = Math.max(1e-9, fFromTau(s.Mc, s.tObs)), f2 = fISCO(s.M);
      const n = 80, xs = new Float64Array(n), ys = new Float64Array(n);
      for (let i = 0; i < n; i++) { xs[i] = f1 * Math.pow(f2 / f1, i / (n - 1)); ys[i] = hcInspiral(s.Mc, s.D, xs[i]); }
      plot.line(xs, ys, { color: col, width: 2.6 });
      if (label) plot.point(xs[n - 1], ys[n - 1], { r: 3, color: col, label });
    }

    function render() {
      plot.draw(() => {
        plot.fn(ptaHn, { color: pal.series[3], width: 2 });
        plot.fn(hn(lisaS), { color: pal.series[2], width: 2 });
        plot.fn(hn(ligoS), { color: pal.series[0], width: 2 });
        plot.text('PTA (~15 yr)', plot.px(2e-9), plot.py(3e-13), { color: pal.series[3] });
        plot.text('LISA', plot.px(3e-4), plot.py(6e-19), { color: pal.series[2] });
        plot.text('LIGO (design)', plot.px(15), plot.py(1e-20), { color: pal.series[0] });
        // NANOGrav 15-yr background: h_c = 2.4e-15 (f / 1 yr⁻¹)^{-2/3}
        const fyr = 1 / YR;
        const xs = [2e-9, 3e-8], ys = xs.map((f) => 2.4e-15 * Math.pow(f / fyr, -2 / 3));
        plot.line(xs, ys, { color: pal.accent2, width: 3 });
        plot.text('nHz background (NANOGrav 2023)', plot.px(3.5e-9), plot.py(ys[0] * 3), { color: pal.accent2 });
        // Galactic white-dwarf binaries (verification binaries) ~ mHz, h_c ~ h·√(f T_obs)
        const wd = [[1.9e-3, 1e-22], [6.2e-3, 6e-23], [3.5e-3, 2e-22]];
        for (const [f, h] of wd) plot.point(f, h * Math.sqrt(f * 4 * YR), { r: 3, color: pal.accent3 });
        plot.text('Galactic WD binaries', plot.px(1.2e-3), plot.py(4e-19), { color: pal.accent3 });
        for (const s of SOURCES) track(s, pal.series[s.col === 2 ? 4 : s.col === 1 ? 1 : 0], s.name);
        track({ Mc: myMc, M: myMc * Math.pow(2, 6 / 5), D: myD, tObs: 4 * YR }, pal.accent, 'your binary');
      });
    }
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    const ro = panel.readout('ISCO frequency');
    const upd = () => { ro.set(`${fmt(fISCO(myMc * Math.pow(2, 6 / 5)), 3)} Hz`); loop.invalidate(); };
    panel.slider('Your ℳ', { min: 0.5, max: 1e9, value: myMc, log: true, unit: 'M☉', format: (v) => fmt(v, 2) }, (v) => { myMc = v; upd(); });
    panel.slider('Distance', { min: 10, max: 50000, value: myD, log: true, unit: 'Mpc', format: (v) => fmt(v, 2) }, (v) => { myD = v; upd(); });
    upd();
    void L_SUN_GEOM;
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
