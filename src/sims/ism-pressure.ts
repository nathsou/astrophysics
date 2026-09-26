// Chapter 6 secondary figure: the thermal-equilibrium curve P(n) (Field 1965 instability).
// Traces T_eq(n) by continuation (so it follows the unstable middle branch too), plots P/k_B = nT
// against n on log-log axes, and highlights the two stable branches (CNM, WNM) vs the unstable one.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { equilibriumT, dTdt } from './ism/cooling';

const N_MIN = 1e-2, N_MAX = 1e3;

function traceCurve(Gamma: number, Z: number, nPts = 240): { n: Float64Array; T: Float64Array; P: Float64Array; stable: Uint8Array } {
  const n = new Float64Array(nPts), T = new Float64Array(nPts), P = new Float64Array(nPts), stable = new Uint8Array(nPts);
  let Tprev = equilibriumT(0.05, Gamma, Z, 3000, 3e5);
  for (let i = 0; i < nPts; i++) {
    const ni = N_MIN * (N_MAX / N_MIN) ** (i / (nPts - 1));
    // Continuation: bracket the search near the previous solution so we follow the same branch
    // (including the unstable one) instead of jumping to whichever root bisection finds first.
    const lo = Tprev / 6, hi = Tprev * 6;
    const Ti = equilibriumT(ni, Gamma, Z, Math.max(3, lo), Math.min(3e7, hi * 4));
    n[i] = ni; T[i] = Ti; P[i] = ni * Ti;
    // Local stability: d(cooling-heating)/dT > 0 at fixed n means a perturbation is damped.
    const eps = Ti * 0.01;
    const slope = (dTdt(ni, Ti + eps, Gamma, Z) - dTdt(ni, Ti - eps, Gamma, Z)) / (2 * eps);
    stable[i] = slope < 0 ? 1 : 0; // dT/dt decreasing in T ⇒ negative feedback ⇒ stable
    Tprev = Ti;
  }
  return { n, T, P, stable };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: N_MIN, max: N_MAX, log: true, label: 'n (cm⁻³)' },
      y: { min: 1e2, max: 1e5, log: true, label: 'P / k_B = nT (K cm⁻³)' },
      title: 'Thermal equilibrium pressure curve',
    });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    let logGamma = Math.log10(2.2e-26), Z = 1;
    let curve = traceCurve(10 ** logGamma, Z);
    let dragN = 0.6; // reader-draggable operating point (cm^-3)

    function recompute() { curve = traceCurve(10 ** logGamma, Z); loop.invalidate(); }

    function nearestIndex(ni: number) {
      const t = Math.log(ni / N_MIN) / Math.log(N_MAX / N_MIN);
      return Math.max(0, Math.min(curve.n.length - 1, Math.round(t * (curve.n.length - 1))));
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
      // legend
      plot.text('● stable (CNM / WNM)', plot.m.l + 6, 20, { color: pal.good, size: 11 });
      plot.text('┄ unstable branch', plot.m.l + 6, 34, { color: pal.bad, size: 11 });
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.canvas.style.touchAction = 'none';
    let dragging = false;
    const toN = (clientX: number) => {
      const r = stage.canvas.getBoundingClientRect();
      const x = (clientX - r.left);
      return Math.max(N_MIN, Math.min(N_MAX, plot.dx(x)));
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; dragN = toN(e.clientX); loop.invalidate(); });
    window.addEventListener('pointermove', (e) => { if (dragging) { dragN = toN(e.clientX); loop.invalidate(); } });
    window.addEventListener('pointerup', () => { dragging = false; });

    const panel = new Panel(host);
    panel.slider('UV heating Γ', { min: -27, max: -25, value: logGamma, step: 0.01, format: (v) => `${fmt(10 ** v, 2)} erg/s` }, (v) => { logGamma = v; recompute(); });
    panel.slider('Metallicity Z', { min: 0.1, max: 3, value: Z, log: true, step: 0.01, format: (v) => `${fmt(v, 2)}×Z☉` }, (v) => { Z = v; recompute(); });

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
