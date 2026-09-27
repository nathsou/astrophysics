// Chapter 6 secondary figure: the thermal-equilibrium curve P(n) (Field 1965 instability).
// Traces the equilibrium curve parametrically in T (so it follows the unstable middle branch too), plots P/k_B = nT
// against n on log-log axes, and highlights the two stable branches (CNM, WNM) vs the unstable one.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { equilibriumCurve } from './ism/cooling';

const N_MIN = 1e-2, N_MAX = 1e3;

function traceCurve(Gamma: number, Z: number): { n: Float64Array; T: Float64Array; P: Float64Array; stable: Uint8Array } {
  // Parametric in T (n = Γ/ΛZ), which follows every branch; keep the part inside the plotted n range,
  // ordered by increasing n.
  const eq = equilibriumCurve(Gamma, Z, 8, 5e4, 480);
  const idx: number[] = [];
  for (let i = eq.n.length - 1; i >= 0; i--) if (eq.n[i] >= N_MIN && eq.n[i] <= N_MAX) idx.push(i);
  const m = idx.length;
  const n = new Float64Array(m), T = new Float64Array(m), P = new Float64Array(m), stable = new Uint8Array(m);
  idx.forEach((k, j) => { n[j] = eq.n[k]; T[j] = eq.T[k]; P[j] = eq.n[k] * eq.T[k]; });
  // Field's isobaric criterion: a parcel is stable where the equilibrium pressure rises with density.
  for (let j = 0; j < m; j++) {
    const a = Math.max(0, j - 1), b = Math.min(m - 1, j + 1);
    stable[j] = (P[b] - P[a]) * (n[b] - n[a]) > 0 ? 1 : 0;
  }
  return { n, T, P, stable };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1.1 : 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: N_MIN, max: N_MAX, log: true, label: 'n (cm⁻³)' },
      y: { min: 3e2, max: 3e4, log: true, label: 'P / k = nT (K cm⁻³)' },
      title: 'Thermal equilibrium pressure curve',
    });

    let logGamma = Math.log10(2.2e-26), Z = 1;
    let curve = traceCurve(10 ** logGamma, Z);
    let dragN = 0.3; // reader-draggable operating point (cm^-3)

    function recompute() { curve = traceCurve(10 ** logGamma, Z); loop.invalidate(); }

    function nearestIndex(ni: number) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < curve.n.length; j++) { const d = Math.abs(Math.log(curve.n[j] / ni)); if (d < bd) { bd = d; best = j; } }
      return best;
    }

    function render() {
      plot.draw(() => {
        // stable/unstable segments
        for (let i = 0; i < curve.n.length - 1; i++) {
          plot.line([curve.n[i], curve.n[i + 1]], [curve.P[i], curve.P[i + 1]], {
            color: curve.stable[i] ? pal.good : pal.bad,
            width: curve.stable[i] ? 2.25 : 1.75,
            dash: curve.stable[i] ? undefined : [2, 3],
          });
        }
        const i = nearestIndex(dragN);
        plot.point(curve.n[i], curve.P[i], { r: 5.5, color: pal.accent, stroke: pal.fg });
        plot.text(`n=${fmt(curve.n[i], 3)} cm⁻³, T=${fmt(curve.T[i], 3)} K`, plot.px(curve.n[i]) + 8, plot.py(curve.P[i]) - 8, { color: pal.accent });
      });
      // legend, bottom right inside the plot
      const lx = plot.m.l + plot.pw - 8, ly = plot.m.t + plot.ph - 44;
      plot.text('— stable: WNM (left), CNM (right)', lx, ly, { color: pal.good, size: 11, align: 'right' });
      plot.text('┄ unstable: dP/dn < 0', lx, ly + 16, { color: pal.bad, size: 11, align: 'right' });
      plot.text('WNM', plot.px(0.1), plot.py(900) , { color: pal.muted, align: 'center' });
      plot.text('CNM', plot.px(100), plot.py(900), { color: pal.muted, align: 'center' });
    }

    const loop = new Loop(null, render, 1 / 30);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    stage.canvas.style.touchAction = 'none';
    let dragging = false;
    const toN = (clientX: number) => {
      const r = stage.canvas.getBoundingClientRect();
      const x = (clientX - r.left);
      return Math.max(N_MIN, Math.min(N_MAX, plot.dx(x)));
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; stage.canvas.setPointerCapture(e.pointerId); dragN = toN(e.clientX); loop.invalidate(); });
    stage.canvas.addEventListener('pointermove', (e) => { if (dragging) { dragN = toN(e.clientX); loop.invalidate(); } });
    stage.canvas.addEventListener('pointerup', () => { dragging = false; });
    stage.canvas.addEventListener('pointercancel', () => { dragging = false; });

    const panel = new Panel(host);
    panel.slider('UV heating Γ', { min: -27, max: -25, value: logGamma, step: 0.01, format: (v) => `${fmt(10 ** v, 2)} erg/s` }, (v) => { logGamma = v; recompute(); });
    panel.slider('Metallicity Z', { min: 0.1, max: 3, value: Z, log: true, step: 0.01, format: (v) => `${fmt(v, 2)}×Z☉` }, (v) => { Z = v; recompute(); });

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
