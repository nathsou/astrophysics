// Chapter 7 figure: approximate pre-main-sequence tracks on the HR diagram (Hayashi → Henyey → ZAMS).
// Tracks are hand-tabulated control points loosely following published models (Palla & Stahler 1999,
// Baraffe et al. 2015); ages along each track come from Kelvin–Helmholtz contraction, dt = dE/L with
// E = −(3/7) G M² / R (an n = 3/2 polytrope). Good to a factor ~2; clearly *not* a stellar-evolution code.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const G = 6.6743e-11, MSUN = 1.98847e30, RSUN = 6.957e8, LSUN = 3.828e26, YR = 3.15576e7, TSUN = 5772;
const T0 = 1e5; // yr: rough age at which a star becomes optically visible on the birthline

// [log10 Teff, log10 L/L☉] control points from birthline to ZAMS
const TRACKS: { M: number; pts: [number, number][] }[] = [
  { M: 0.1, pts: [[3.47, -0.9], [3.468, -1.6], [3.463, -2.3], [3.46, -2.8], [3.46, -3.0]] },
  { M: 0.5, pts: [[3.585, -0.2], [3.58, -0.7], [3.578, -1.1], [3.58, -1.35], [3.585, -1.42]] },
  { M: 1, pts: [[3.63, 0.55], [3.632, 0.15], [3.638, -0.2], [3.65, -0.35], [3.69, -0.25], [3.73, -0.18], [3.755, -0.15]] },
  { M: 2, pts: [[3.66, 1.25], [3.665, 0.95], [3.68, 0.82], [3.76, 0.9], [3.87, 1.05], [3.96, 1.2]] },
  { M: 3, pts: [[3.69, 1.8], [3.7, 1.58], [3.76, 1.55], [3.88, 1.7], [4.08, 1.9]] },
  { M: 5, pts: [[3.8, 2.55], [3.9, 2.58], [4.05, 2.66], [4.23, 2.8]] },
];

interface Track { M: number; lt: Float64Array; ll: Float64Array; age: Float64Array; tZams: number }

function build(): Track[] {
  return TRACKS.map(({ M, pts }) => {
    const S = 240, lt = new Float64Array(S), ll = new Float64Array(S), age = new Float64Array(S);
    // Catmull–Rom through the control points
    for (let s = 0; s < S; s++) {
      const u = (s / (S - 1)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), f = u - i;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
      lt[s] = cr(p0[0], p1[0], p2[0], p3[0]); ll[s] = cr(p0[1], p1[1], p2[1], p3[1]);
    }
    const R = (k: number) => (Math.sqrt(10 ** ll[k]) / (10 ** lt[k] / TSUN) ** 2) * RSUN;
    age[0] = T0;
    for (let k = 1; k < S; k++) {
      const dE = (3 / 7) * G * (M * MSUN) ** 2 * Math.max(0, 1 / R(k) - 1 / R(k - 1));
      const L = 0.5 * (10 ** ll[k] + 10 ** ll[k - 1]) * LSUN;
      age[k] = age[k - 1] + dE / L / YR;
    }
    return { M, lt, ll, age, tZams: age[S - 1] };
  });
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 11 });
    const plot = new Plot(stage.canvas, {
      x: { min: 25000, max: 2500, log: true, label: 'effective temperature (K)', ticks: [20000, 10000, 7000, 5000, 4000, 3000], format: (v) => fmt(v) },
      y: { min: 10 ** -3.3, max: 1e3, log: true, label: 'luminosity (L☉)' },
      title: 'Approximate pre-main-sequence tracks',
    });
    const tracks = build();
    let logAge = 5.5, playing = false;

    function at(t: Track, age: number): [number, number] | null {
      if (age < t.age[0]) return null;
      if (age >= t.tZams) return [10 ** t.lt[t.lt.length - 1], 10 ** t.ll[t.ll.length - 1]];
      let k = 1; while (t.age[k] < age) k++;
      const f = (age - t.age[k - 1]) / (t.age[k] - t.age[k - 1]);
      return [10 ** (t.lt[k - 1] + f * (t.lt[k] - t.lt[k - 1])), 10 ** (t.ll[k - 1] + f * (t.ll[k] - t.ll[k - 1]))];
    }

    function render(_a: number, dt: number) {
      if (playing && dt > 0) { logAge += dt * 0.35; if (logAge > 9) { logAge = 9; playing = false; playBtn.textContent = '▶ Play'; } ageSl.set(logAge); }
      const age = 10 ** logAge;
      plot.draw(() => {
        // ZAMS and birthline
        const zx = tracks.map((t) => 10 ** t.lt[t.lt.length - 1]), zy = tracks.map((t) => 10 ** t.ll[t.ll.length - 1]);
        plot.line(zx, zy, { color: pal.fg, width: 2.5, alpha: 0.5 });
        plot.line(tracks.map((t) => 10 ** t.lt[0]), tracks.map((t) => 10 ** t.ll[0]), { color: pal.muted, dash: [4, 4], width: 1.2 });
        tracks.forEach((t, i) => {
          const xs = Array.from(t.lt, (v) => 10 ** v), ys = Array.from(t.ll, (v) => 10 ** v);
          plot.line(xs, ys, { color: pal.series[i % 5], width: 1.6, alpha: 0.85 });
          plot.text(`${t.M} M☉`, plot.px(xs[0]) + 6, plot.py(ys[0]) - 4, { color: pal.series[i % 5], size: 11 });
        });
        // isochrone and current positions
        const iso = tracks.map((t) => at(t, age)).filter((p): p is [number, number] => !!p);
        if (iso.length > 1) plot.line(iso.map((p) => p[0]), iso.map((p) => p[1]), { color: pal.accent, width: 1.5, dash: [2, 3] });
        tracks.forEach((t) => {
          const p = at(t, age);
          if (p) plot.point(p[0], p[1], { r: 5.5, color: blackbodyCSS(p[0]), stroke: pal.fg });
        });
        plot.text('ZAMS', plot.px(12000), plot.py(40), { color: pal.fg, size: 11 });
        plot.text('birthline', plot.px(4100), plot.py(60), { color: pal.muted, size: 11 });
        plot.text('Hayashi (convective, vertical)', plot.px(3900), plot.py(0.02), { color: pal.muted, size: 10 });
        plot.text('Henyey (radiative, horizontal)', plot.px(9000), plot.py(4), { color: pal.muted, size: 10 });
      });
      ageRO.set(age < 1e6 ? `${fmt(age / 1e3, 3)} kyr` : `${fmt(age / 1e6, 3)} Myr`);
    }

    const loop = new Loop(null, render);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onDestroy(onThemeChange(() => { pal = palette(); loop.invalidate(); }));

    const panel = new Panel(host);
    const playBtn = panel.button('▶ Play', () => { playing = !playing; if (playing && logAge >= 9) logAge = 5; playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play'; loop.invalidate(); });
    const ageSl = panel.slider('Age', { min: 5, max: 9, value: logAge, step: 0.01, format: (v) => `10^${v.toFixed(2)} yr` }, (v) => { logAge = v; loop.invalidate(); });
    const ageRO = panel.readout('Age');
    panel.readout('Time to reach the ZAMS:').set(tracks.map((t) => `${t.M} M☉ ${t.tZams < 1e6 ? fmt(t.tZams / 1e3, 2) + ' kyr' : fmt(t.tZams / 1e6, 2) + ' Myr'}`).join(' · '));
    return { setVisible: (v) => { loop.setVisible(v); loop.invalidate(); }, destroy: () => loop.destroy() };
  },
});
