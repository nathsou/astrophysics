// Appendix A2: reading power laws off a log–log plot. Real data (planets, Jupiter's moons,
// main-sequence stars) on linear or logarithmic axes, with a draggable power law y = A·xⁿ and a
// least-squares fit in log space (a straight-line fit to log y against log x).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Pt { name: string; x: number; y: number; group: number }
interface DS { label: string; xl: string; yl: string; xr: [number, number]; yr: [number, number]; pts: Pt[]; fitGroup: number; n0: number; A0: number; groups: string[] }

// Semi-major axis (AU) and sidereal period (yr).
const PLANETS: Pt[] = [
  ['Mercury', 0.387, 0.241], ['Venus', 0.723, 0.615], ['Earth', 1, 1], ['Mars', 1.524, 1.881],
  ['Jupiter', 5.203, 11.86], ['Saturn', 9.537, 29.46], ['Uranus', 19.19, 84.01], ['Neptune', 30.07, 164.8],
].map(([name, x, y]) => ({ name: name as string, x: x as number, y: y as number, group: 0 }));
// Galilean moons: a in AU (km / 1.496e8), P in yr (days / 365.25).
const MOONS: Pt[] = [
  ['Io', 421_700, 1.769], ['Europa', 671_034, 3.551], ['Ganymede', 1_070_412, 7.155], ['Callisto', 1_882_709, 16.689],
].map(([name, km, d]) => ({ name: name as string, x: (km as number) / 1.496e8, y: (d as number) / 365.25, group: 1 }));
// Representative main-sequence masses (M☉) and luminosities (L☉), rounded from stellar models and eclipsing binaries.
const MS: Pt[] = [
  [0.1, 0.0009], [0.2, 0.005], [0.3, 0.012], [0.5, 0.04], [0.7, 0.15], [0.8, 0.35], [1, 1], [1.2, 1.8],
  [1.5, 5], [2, 16], [3, 80], [5, 550], [8, 2500], [12, 1.2e4], [20, 5e4], [40, 2.5e5], [60, 6e5],
].map(([x, y]) => ({ name: x === 1 ? 'Sun' : '', x, y, group: 0 }));

const DATA: Record<string, DS> = {
  planets: { label: 'Planets: period vs orbit size', xl: 'semi-major axis a (AU)', yl: 'period P (yr)', xr: [0.1, 100], yr: [0.03, 1000], pts: PLANETS, fitGroup: 0, n0: 1, A0: 1, groups: ['planets'] },
  moons: { label: 'Planets + Jupiter’s moons', xl: 'semi-major axis a (AU)', yl: 'period P (yr)', xr: [1e-3, 100], yr: [1e-3, 1000], pts: [...PLANETS, ...MOONS], fitGroup: 0, n0: 1.5, A0: 1, groups: ['planets', 'Galilean moons'] },
  ms: { label: 'Main-sequence stars: luminosity vs mass', xl: 'mass M (M☉)', yl: 'luminosity L (L☉)', xr: [0.07, 100], yr: [1e-4, 1e7], pts: MS, fitGroup: 0, n0: 2, A0: 1, groups: ['stars'] },
};

function fit(pts: Pt[]): { n: number; A: number; rms: number } {
  const X = pts.map((p) => Math.log10(p.x)), Y = pts.map((p) => Math.log10(p.y));
  const m = X.length, mx = X.reduce((a, b) => a + b) / m, my = Y.reduce((a, b) => a + b) / m;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < m; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; }
  const n = sxy / sxx, a = my - n * mx;
  const rms = Math.sqrt(X.reduce((s, x, i) => s + (Y[i] - a - n * x) ** 2, 0) / m);
  return { n, A: 10 ** a, rms };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let key = 'planets';
    let logAxes = false;
    let n = DATA[key].n0, A = DATA[key].A0;
    let revealed = false;

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } });
    const loop = new Loop(null, render);
    loop.onDemand = true;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    function render() {
      const ds = DATA[key];
      const xs = ds.pts.map((p) => p.x), ys = ds.pts.map((p) => p.y);
      if (logAxes) {
        plot.o.x = { min: ds.xr[0], max: ds.xr[1], log: true, label: ds.xl + ' — log scale' };
        plot.o.y = { min: ds.yr[0], max: ds.yr[1], log: true, label: ds.yl + ' — log scale' };
      } else {
        plot.o.x = { min: 0, max: Math.max(...xs) * 1.08, label: ds.xl };
        plot.o.y = { min: 0, max: Math.max(...ys) * 1.08, label: ds.yl };
      }
      plot.draw(() => {
        plot.fn((x) => A * Math.pow(x, n), { color: pal.accent, width: 2, samples: 400 });
        ds.pts.forEach((p) => plot.point(p.x, p.y, { r: 4.5, color: pal.series[p.group === 0 ? 1 : 3], label: p.name || undefined }));
      });
      const f = fit(ds.pts.filter((p) => p.group === ds.fitGroup));
      const mine = ds.pts.filter((p) => p.group === ds.fitGroup);
      const rmsMine = Math.sqrt(mine.reduce((s, p) => s + (Math.log10(p.y) - Math.log10(A) - n * Math.log10(p.x)) ** 2, 0) / mine.length);
      rLine.set(`y = ${fmt(A, 3)} · x^${fmt(n, 3)}`);
      rMiss.set(`${fmt(rmsMine, 2)} dex (×${fmt(10 ** rmsMine, 3)})`);
      rBest.set(revealed ? `n = ${fmt(f.n, 3)}` : 'press Best fit');
      plot.text(ds.groups.length > 1 ? `● ${ds.groups[0]}   ● ${ds.groups[1]}` : '', plot.m.l + 8, plot.m.t + 14, { color: pal.muted });
    }

    const panel = new Panel(host);
    panel.select('Data', Object.entries(DATA).map(([k, d]) => ({ value: k, label: d.label })), key, (v) => {
      key = v; revealed = false; n = DATA[v].n0; A = DATA[v].A0; sn.set(n); sA.set(A); loop.invalidate();
    });
    panel.toggle('log–log axes', logAxes, (v) => { logAxes = v; loop.invalidate(); });
    const sn = panel.slider('Slope n', { min: 0, max: 5, value: n, step: 0.05, format: (v) => fmt(v, 3) }, (v) => { n = v; loop.invalidate(); });
    const sA = panel.slider('Prefactor A', { min: 0.01, max: 100, value: A, log: true }, (v) => { A = v; loop.invalidate(); });
    panel.button('Best fit', () => {
      const ds = DATA[key];
      const f = fit(ds.pts.filter((p) => p.group === ds.fitGroup));
      revealed = true; n = f.n; A = f.A; sn.set(n); sA.set(A); loop.invalidate();
    });
    const rLine = panel.readout('Your line:');
    const rMiss = panel.readout('Typical miss:');
    const rBest = panel.readout('Least-squares slope:');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
