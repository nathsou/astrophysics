// Appendix A5: the slope field of a first-order ODE y′ = f(t, y). Every short segment shows the slope the
// equation demands at that point; a solution is a curve that is tangent to the segments everywhere.
// Click/drag to place initial conditions (accurate RK4 curves), and overlay forward-Euler steps of size h.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Eq { id: string; label: string; f: (t: number, y: number) => number; t: [number, number]; y: [number, number]; ic: [number, number]; yLabel: string }

const EQS: Eq[] = [
  { id: 'decay', label: 'Decay: y′ = −y', f: (_t, y) => -y, t: [0, 5], y: [-1, 3], ic: [0, 2.5], yLabel: 'N / N₀' },
  { id: 'drag', label: 'Fall with drag: v′ = 1 − v²', f: (_t, v) => 1 - v * v, t: [0, 4], y: [-0.6, 2.2], ic: [0, 0], yLabel: 'v / v_terminal' },
  { id: 'logistic', label: 'Logistic: y′ = y(1 − y)', f: (_t, y) => y * (1 - y), t: [0, 10], y: [-0.4, 1.6], ic: [0, 0.05], yLabel: 'y' },
  { id: 'driven', label: 'Driven cooling: y′ = cos t − y', f: (t, y) => Math.cos(t) - y, t: [0, 12], y: [-2, 2], ic: [0, 1.8], yLabel: 'y' },
  { id: 'blowup', label: 'Blow-up: y′ = y²', f: (_t, y) => y * y, t: [0, 3], y: [-2, 4], ic: [0, 0.5], yLabel: 'y' },
];

/** Translucent backdrop so legend text stays readable over curves. */
function backdrop(ctx: CanvasRenderingContext2D, bg: string, x: number, y: number, lines: string[], lh: number, extra = 0) {
  ctx.save();
  ctx.font = '11px Inter, system-ui, sans-serif';
  const w = Math.max(...lines.map((s) => ctx.measureText(s).width)) + extra;
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = bg;
  ctx.fillRect(x - 6, y - lh / 2 - 5, w + 12, lines.length * lh + 6);
  ctx.restore();
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let eq = EQS[0];
    let ics: [number, number][] = [eq.ic];
    let showEuler = true;
    let hEuler = 0.5;

    const stage = createStage(host, { aspect: 16 / 9 });
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'crosshair';
    const plot = new Plot(stage.canvas, { x: { min: eq.t[0], max: eq.t[1], label: 'time t' }, y: { min: eq.y[0], max: eq.y[1], label: eq.yLabel } });
    const loop = new Loop(null, render);

    const inBox = (t: number, y: number) => t >= eq.t[0] - 1e-9 && t <= eq.t[1] + 1e-9 && y >= eq.y[0] - 3 && y <= eq.y[1] + 3 && Number.isFinite(y);

    /** RK4 from (t0, y0) with step h (sign sets direction) until leaving the window. */
    function trace(t0: number, y0: number, h: number) {
      const ts = [t0], ys = [y0];
      let t = t0, y = y0;
      const f = eq.f;
      for (let i = 0; i < 4000; i++) {
        const k1 = f(t, y), k2 = f(t + h / 2, y + (h / 2) * k1), k3 = f(t + h / 2, y + (h / 2) * k2), k4 = f(t + h, y + h * k3);
        y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        t += h;
        if (!inBox(t, y)) break;
        ts.push(t); ys.push(y);
      }
      return [ts, ys] as const;
    }

    function render() {
      plot.o.x.min = eq.t[0]; plot.o.x.max = eq.t[1]; plot.o.y.min = eq.y[0]; plot.o.y.max = eq.y[1]; plot.o.y.label = eq.yLabel;
      const hTrace = (eq.t[1] - eq.t[0]) / 1500;
      plot.draw(() => {
        const { ctx } = plot;
        // slope field: fixed screen-length segments on a grid
        const nx = Math.max(10, Math.round(plot.pw / 30)), ny = Math.max(8, Math.round(plot.ph / 30));
        const L = Math.min(plot.pw / nx, plot.ph / ny) * 0.36;
        const sx = plot.pw / (eq.t[1] - eq.t[0]), sy = plot.ph / (eq.y[1] - eq.y[0]);
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const t = eq.t[0] + ((i + 0.5) / nx) * (eq.t[1] - eq.t[0]);
          const y = eq.y[0] + ((j + 0.5) / ny) * (eq.y[1] - eq.y[0]);
          const m = eq.f(t, y);
          // direction in screen space: (sx, −m·sy), normalised
          const dx = sx, dy = -m * sy, n = Math.hypot(dx, dy);
          const X = plot.px(t), Y = plot.py(y);
          ctx.moveTo(X - (L * dx) / n, Y - (L * dy) / n);
          ctx.lineTo(X + (L * dx) / n, Y + (L * dy) / n);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        plot.hline(0, { color: pal.axis, dash: [], width: 1 });
        // accurate solution curves
        ics.forEach(([t0, y0], k) => {
          const last = k === ics.length - 1;
          const [tf, yf] = trace(t0, y0, hTrace), [tb, yb] = trace(t0, y0, -hTrace);
          const col = last ? pal.series[1] : pal.series[4];
          plot.line(tf, yf, { color: col, width: last ? 2.4 : 1.6, alpha: last ? 1 : 0.7 });
          plot.line(tb, yb, { color: col, width: last ? 2.4 : 1.6, alpha: last ? 1 : 0.7 });
          plot.point(t0, y0, { r: last ? 5.5 : 3.5, color: col, stroke: last ? pal.fg : undefined });
        });
        // forward-Euler polygon from the latest initial condition
        if (showEuler) {
          const [t0, y0] = ics[ics.length - 1];
          const ts = [t0], ys = [y0];
          let t = t0, y = y0;
          while (t < eq.t[1] - 1e-9 && ts.length < 2000) {
            y += hEuler * eq.f(t, y); t += hEuler;
            ts.push(t); ys.push(y);
            if (!Number.isFinite(y) || Math.abs(y) > 1e6) break;
          }
          plot.line(ts, ys, { color: pal.accent, width: 1.8 });
          for (let i = 0; i < ts.length && i < 200; i++) plot.point(ts[i], ys[i], { r: 3, color: pal.accent });
        }
      });
      backdrop(plot.ctx, pal.bg, plot.m.l + 10, plot.m.t + 14, showEuler ? ['— exact (RK4, tiny steps)', `— Euler, h = ${fmt(hEuler, 2)}`] : ['— exact (RK4, tiny steps)'], 17);
      plot.text('— exact (RK4, tiny steps)', plot.m.l + 10, plot.m.t + 14, { color: pal.series[1] });
      if (showEuler) plot.text(`— Euler, h = ${fmt(hEuler, 2)}`, plot.m.l + 10, plot.m.t + 31, { color: pal.accent });
      const [t0, y0] = ics[ics.length - 1];
      icRead.set(`t = ${fmt(t0, 3)}, y = ${fmt(y0, 3)}, slope = ${fmt(eq.f(t0, y0), 3)}`);
    }

    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    let dragging = false;
    const at = (e: PointerEvent): [number, number] => {
      const r = stage.canvas.getBoundingClientRect();
      const t = Math.min(eq.t[1], Math.max(eq.t[0], plot.dx(e.clientX - r.left)));
      const y = Math.min(eq.y[1], Math.max(eq.y[0], plot.dy(e.clientY - r.top)));
      return [t, y];
    };
    stage.canvas.addEventListener('pointerdown', (e) => {
      dragging = true; stage.canvas.setPointerCapture(e.pointerId);
      ics.push(at(e)); if (ics.length > 8) ics.shift();
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointermove', (e) => { if (!dragging) return; ics[ics.length - 1] = at(e); loop.invalidate(); });
    stage.canvas.addEventListener('pointerup', () => (dragging = false));
    stage.canvas.addEventListener('pointercancel', () => (dragging = false));

    const panel = new Panel(host);
    panel.select('Equation', EQS.map((q) => ({ value: q.id, label: q.label })), eq.id, (id) => { eq = EQS.find((q) => q.id === id)!; ics = [eq.ic]; loop.invalidate(); });
    panel.toggle('Euler steps', showEuler, (v) => { showEuler = v; loop.invalidate(); });
    panel.slider('Euler step h', { min: 0.02, max: 1.5, value: hEuler, log: true }, (v) => { hEuler = v; loop.invalidate(); });
    panel.button('Clear curves', () => { ics = [ics[ics.length - 1]]; loop.invalidate(); });
    const icRead = panel.readout('start');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
