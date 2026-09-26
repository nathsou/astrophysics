// Appendix A6: a ball rolling in a 1D potential well, shown twice. Left: the potential V(x) with
// the ball and its energy level. Right: the same motion as a trajectory in phase space (x, p),
// on top of faint contours of constant H = p²/2 + V(x). Dimensionless units, m = 1.
// Integrator: kick–drift–kick leapfrog (symplectic), with optional linear damping −γp that
// breaks energy conservation and makes phase-space areas shrink.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

type WellId = 'harmonic' | 'pendulum' | 'double' | 'kepler';
interface Well {
  label: string;
  V: (x: number) => number;
  dV: (x: number) => number;
  x: [number, number];
  v: [number, number];
  p: number; // |p| range of the phase plot
  x0: number; // default start
  wrap?: boolean; // x is an angle on (−π, π]
  xLabel: string;
}

const WELLS: Record<WellId, Well> = {
  harmonic: { label: 'Spring (harmonic)', V: (x) => 0.5 * x * x, dV: (x) => x, x: [-3, 3], v: [-0.2, 4.5], p: 3, x0: 2, xLabel: 'position x' },
  pendulum: { label: 'Pendulum', V: (x) => 1 - Math.cos(x), dV: (x) => Math.sin(x), x: [-Math.PI, Math.PI], v: [-0.1, 2.6], p: 3, x0: 2.2, wrap: true, xLabel: 'angle θ (rad)' },
  double: { label: 'Double well', V: (x) => (x * x - 1) ** 2, dV: (x) => 4 * x * (x * x - 1), x: [-2, 2], v: [-0.1, 2.2], p: 2.2, x0: 1.6, xLabel: 'position x' },
  kepler: { label: 'Orbit (effective potential)', V: (r) => 0.5 / (r * r) - 1 / r, dV: (r) => -1 / (r * r * r) + 1 / (r * r), x: [0.25, 6], v: [-0.6, 0.6], p: 1.4, x0: 0.6, xLabel: 'radius r' },
};

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const vStage = createStage(wrap, { aspect: 1.1 });
    const pStage = createStage(wrap, { aspect: 1.1 });
    vStage.canvas.style.touchAction = 'none';
    pStage.canvas.style.touchAction = 'none';

    let id: WellId = (params.well as WellId) in WELLS ? (params.well as WellId) : 'double';
    let W = WELLS[id];
    let damping = 0;
    let x = W.x0, p = 0;
    const N = 1600;
    const tx = new Float64Array(N), tp = new Float64Array(N);
    let head = 0, count = 0, sub = 0;

    const vPlot = new Plot(vStage.canvas, { x: { min: W.x[0], max: W.x[1], label: W.xLabel }, y: { min: W.v[0], max: W.v[1], label: 'potential energy V' }, title: 'Energy landscape' });
    const pPlot = new Plot(pStage.canvas, { x: { min: W.x[0], max: W.x[1], label: W.xLabel }, y: { min: -W.p, max: W.p, label: 'momentum p' }, title: 'Phase space' });

    function setWell(k: WellId) {
      id = k; W = WELLS[k];
      vPlot.o.x = { min: W.x[0], max: W.x[1], label: W.xLabel };
      vPlot.o.y = { min: W.v[0], max: W.v[1], label: 'potential energy V' };
      pPlot.o.x = { min: W.x[0], max: W.x[1], label: W.xLabel };
      pPlot.o.y = { min: -W.p, max: W.p, label: 'momentum p' };
      place(W.x0, 0);
    }
    function place(nx: number, np: number) {
      x = nx; p = np; head = 0; count = 0;
    }
    const H = () => 0.5 * p * p + W.V(x);
    const wrapAngle = (a: number) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

    function step(h: number) {
      if (dragging) return;
      const dt = h * 2.5; // ~2.5 time units per real second
      const sub2 = 8, hh = dt / sub2;
      for (let k = 0; k < sub2; k++) {
        p -= 0.5 * hh * W.dV(x);
        x += hh * p;
        p -= 0.5 * hh * W.dV(x);
        if (damping > 0) p *= Math.exp(-damping * hh);
        if (W.wrap) x = wrapAngle(x);
        if (id === 'kepler' && x < 0.05) { x = 0.05; p = Math.abs(p); }
      }
      if (++sub % 2 === 0) {
        tx[head] = x; tp[head] = p; head = (head + 1) % N; count = Math.min(count + 1, N);
      }
    }

    function contours() {
      // level sets of H: p = ±sqrt(2(E − V(x)))
      const levels = id === 'kepler' ? [-0.45, -0.4, -0.3, -0.2, -0.1, 0, 0.15, 0.4]
        : id === 'pendulum' ? [0.1, 0.4, 0.8, 1.2, 1.6, 2, 2.6, 3.4]
          : id === 'double' ? [0.1, 0.35, 0.7, 1, 1.4, 2, 2.6]
            : [0.25, 0.75, 1.5, 2.5, 3.5];
      const sep = id === 'pendulum' ? 2 : id === 'double' ? 1 : id === 'kepler' ? 0 : NaN;
      const n = 240, xs = new Float64Array(n + 1), up = new Float64Array(n + 1), dn = new Float64Array(n + 1);
      for (const E of [...levels, sep]) {
        if (!Number.isFinite(E)) continue;
        for (let i = 0; i <= n; i++) {
          const xx = W.x[0] + ((W.x[1] - W.x[0]) * i) / n;
          const d = 2 * (E - W.V(xx));
          xs[i] = xx;
          up[i] = d >= 0 ? Math.sqrt(d) : NaN;
          dn[i] = d >= 0 ? -Math.sqrt(d) : NaN;
        }
        const isSep = E === sep;
        const o = { color: isSep ? pal.accent3 : pal.faint, width: isSep ? 1.3 : 1, dash: isSep ? [4, 3] : undefined, alpha: isSep ? 0.9 : 0.6 };
        pPlot.line(xs, up, o);
        pPlot.line(xs, dn, o);
      }
    }

    function drawTrail(plot: Plot, ys: (i: number) => number) {
      const ctx = plot.ctx;
      ctx.strokeStyle = pal.series[0]; ctx.lineWidth = 1.6;
      const start = (head - count + N) % N;
      let prevX = NaN;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const j = (start + k) % N;
        const X = plot.px(tx[j]), Y = plot.py(ys(j));
        if (!Number.isFinite(prevX) || (W.wrap && Math.abs(tx[j] - prevX) > Math.PI)) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
        prevX = tx[j];
      }
      ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    }

    function render() {
      const E = H();
      vPlot.draw(() => {
        vPlot.fn(W.V, { color: pal.fg, width: 2, fill: pal.grid });
        vPlot.hline(E, { color: pal.accent, dash: [5, 4], label: `E = ${fmt(E, 3)}` });
        // kinetic energy is the gap between E and V at the ball
        const X = vPlot.px(x), yV = vPlot.py(W.V(x)), yE = vPlot.py(E);
        const c = vPlot.ctx;
        c.strokeStyle = pal.series[0]; c.lineWidth = 3;
        c.beginPath(); c.moveTo(X, yV); c.lineTo(X, yE); c.stroke();
        vPlot.point(x, W.V(x), { r: 7, color: pal.accent, stroke: pal.fg });
      });
      pPlot.draw(() => {
        contours();
        pPlot.hline(0, { color: pal.axis, dash: [] });
        drawTrail(pPlot, (j) => tp[j]);
        pPlot.point(x, p, { r: 6, color: pal.accent, stroke: pal.fg });
      });
      rE.set(fmt(E, 4));
      rX.set(fmt(x, 3));
      rP.set(fmt(p, 3));
    }

    const loop = new Loop(step, render, 1 / 120);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    vStage.onResize((w, h, d) => { vPlot.resize(w, h, d); loop.invalidate(); });
    pStage.onResize((w, h, d) => { pPlot.resize(w, h, d); loop.invalidate(); });

    // Interaction: drag in the landscape to release the ball from rest at x;
    // drag in phase space to choose (x, p) directly.
    let dragging = false;
    const clampX = (v: number) => Math.min(W.x[1] - 1e-3, Math.max(W.x[0] + 1e-3, v));
    function fromEvent(e: PointerEvent, which: 'v' | 'p') {
      const st = which === 'v' ? vStage : pStage, pl = which === 'v' ? vPlot : pPlot;
      const r = st.canvas.getBoundingClientRect();
      const nx = clampX(pl.dx(e.clientX - r.left));
      if (which === 'v') place(nx, 0);
      else place(nx, Math.max(-W.p, Math.min(W.p, pl.dy(e.clientY - r.top))));
      loop.invalidate();
    }
    for (const [st, which] of [[vStage, 'v'], [pStage, 'p']] as const) {
      st.canvas.addEventListener('pointerdown', (e) => { dragging = true; st.canvas.setPointerCapture(e.pointerId); fromEvent(e, which); });
      st.canvas.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e, which); });
      st.canvas.addEventListener('pointerup', () => (dragging = false));
      st.canvas.addEventListener('pointercancel', () => (dragging = false));
    }

    const panel = new Panel(host);
    panel.select<WellId>('Potential', (Object.keys(WELLS) as WellId[]).map((k) => ({ value: k, label: WELLS[k].label })), id, (v) => { setWell(v); loop.invalidate(); });
    panel.slider('Friction γ', { min: 0, max: 0.5, value: 0, step: 0.01 }, (v) => (damping = v));
    panel.playPause(() => loop.paused, (v) => (loop.paused = v));
    const rE = panel.readout('E');
    const rX = panel.readout('x');
    const rP = panel.readout('p');

    setWell(id);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
