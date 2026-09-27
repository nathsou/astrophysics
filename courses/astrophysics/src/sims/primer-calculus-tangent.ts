// Appendix A4: secant → tangent. A secant through P = (x₀, f(x₀)) and Q = (x₀+h, f(x₀+h)) turns into
// the tangent as h → 0; zooming in on P shows that any smooth curve looks like a straight line up close.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Fn {
  id: string;
  label: string;
  f: (x: number) => number;
  df: (x: number) => number;
  x: [number, number];
  y: [number, number];
  x0: number;
  xLabel: string;
  yLabel: string;
  slopeUnit: string;
}

const FNS: Fn[] = [
  {
    id: 'ball', label: 'Thrown ball: y = 20t − 4.9t²',
    f: (t) => 20 * t - 4.9 * t * t, df: (t) => 20 - 9.8 * t,
    x: [0, 4.2], y: [-2, 24], x0: 1, xLabel: 'time t (s)', yLabel: 'height y (m)', slopeUnit: 'm/s',
  },
  {
    id: 'sq', label: 'y = x²', f: (x) => x * x, df: (x) => 2 * x,
    x: [-2.5, 2.5], y: [-1, 6.5], x0: 1, xLabel: 'x', yLabel: 'y', slopeUnit: '',
  },
  {
    id: 'sin', label: 'y = sin x', f: Math.sin, df: Math.cos,
    x: [-4, 4], y: [-1.6, 1.6], x0: 0.8, xLabel: 'x (radians)', yLabel: 'y', slopeUnit: '',
  },
  {
    id: 'exp', label: 'y = eˣ', f: Math.exp, df: Math.exp,
    x: [-3, 2.2], y: [-0.8, 9], x0: 1, xLabel: 'x', yLabel: 'y', slopeUnit: '',
  },
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
  mount({ host, params }) {
    let pal = palette();
    let fn = FNS.find((f) => f.id === params.fn) ?? FNS[0];
    let x0 = fn.x0;
    let h = 1;
    let zoom = 1;
    let animating = false;

    const stage = createStage(host, { aspect: 16 / 9 });
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'ew-resize';
    const plot = new Plot(stage.canvas, { x: { min: fn.x[0], max: fn.x[1], label: fn.xLabel }, y: { min: fn.y[0], max: fn.y[1], label: fn.yLabel } });

    function view() {
      // Interpolate the view centre from the default window towards P as the zoom grows.
      const cx0 = (fn.x[0] + fn.x[1]) / 2, cy0 = (fn.y[0] + fn.y[1]) / 2;
      const w = 1 - 1 / zoom;
      const cx = cx0 + (x0 - cx0) * w, cy = cy0 + (fn.f(x0) - cy0) * w;
      const hx = (fn.x[1] - fn.x[0]) / 2 / zoom, hy = (fn.y[1] - fn.y[0]) / 2 / zoom;
      plot.o.x.min = cx - hx; plot.o.x.max = cx + hx;
      plot.o.y.min = cy - hy; plot.o.y.max = cy + hy;
    }

    const loop = new Loop((dt) => {
      if (!animating) return;
      h *= Math.pow(0.35, dt);
      if (h <= 1e-3) { h = 1e-3; animating = false; }
      hSlider.set(h);
    }, render, 1 / 60);

    function render() {
      view();
      const f = fn.f, P = [x0, f(x0)] as const, Q = [x0 + h, f(x0 + h)] as const;
      const sec = (Q[1] - P[1]) / h, tan = fn.df(x0);
      plot.draw(() => {
        const { ctx } = plot;
        plot.fn(f, { color: pal.fg, width: 2 });
        // tangent (dashed) and secant lines across the whole view
        plot.fn((x) => P[1] + tan * (x - x0), { color: pal.series[1], width: 1.5, dash: [6, 5] });
        plot.fn((x) => P[1] + sec * (x - x0), { color: pal.accent, width: 1.75 });
        // rise-over-run triangle
        ctx.beginPath();
        ctx.moveTo(plot.px(P[0]), plot.py(P[1]));
        ctx.lineTo(plot.px(Q[0]), plot.py(P[1]));
        ctx.lineTo(plot.px(Q[0]), plot.py(Q[1]));
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
        const runPx = Math.abs(plot.px(Q[0]) - plot.px(P[0]));
        if (runPx > 36) {
          plot.text(`Δx = ${fmt(h, 3)}`, (plot.px(P[0]) + plot.px(Q[0])) / 2, plot.py(P[1]) + (Q[1] > P[1] ? 14 : -6), { color: pal.muted, align: 'center' });
          plot.text(`Δy = ${fmt(Q[1] - P[1], 3)}`, plot.px(Q[0]) + 5, (plot.py(P[1]) + plot.py(Q[1])) / 2, { color: pal.muted, baseline: 'middle' });
        }
        plot.point(Q[0], Q[1], { r: 4.5, color: pal.accent, label: 'Q' });
        plot.point(P[0], P[1], { r: 5.5, color: pal.series[1], stroke: pal.fg, label: 'P' });
      });
      // legend
      const { ctx } = plot;
      const L = plot.m.l + 10;
      let Y = plot.m.t + 14;
      const row = (col: string, dash: boolean, txt: string) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(L, Y); ctx.lineTo(L + 18, Y); ctx.stroke(); ctx.setLineDash([]);
        plot.text(txt, L + 24, Y, { baseline: 'middle', color: pal.fg });
        Y += 17;
      };
      const u = fn.slopeUnit ? ` ${fn.slopeUnit}` : '';
      backdrop(ctx, pal.bg, L, Y, [`secant slope Δy/Δx = ${fmt(sec, 5)}${u}`, `tangent slope f′(x₀) = ${fmt(tan, 5)}${u}`], 17, 24);
      row(pal.accent, false, `secant slope Δy/Δx = ${fmt(sec, 5)}${u}`);
      row(pal.series[1], true, `tangent slope f′(x₀) = ${fmt(tan, 5)}${u}`);
      if (zoom > 1.05) plot.text(`zoom ×${fmt(zoom, 3)}`, plot.m.l + plot.pw - 8, plot.m.t + 14, { align: 'right', color: pal.muted });
      diff.set(fmt(Math.abs(sec - tan), 3) + u);
    }

    stage.onResize((w, hh, d) => { plot.resize(w, hh, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    // Drag anywhere on the canvas to move P along the curve.
    let dragging = false;
    const move = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      const x = plot.dx(e.clientX - r.left);
      x0 = Math.min(fn.x[1] - 0.05 * (fn.x[1] - fn.x[0]), Math.max(fn.x[0], x));
      loop.invalidate();
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; stage.canvas.setPointerCapture(e.pointerId); move(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    stage.canvas.addEventListener('pointerup', () => (dragging = false));
    stage.canvas.addEventListener('pointercancel', () => (dragging = false));

    const panel = new Panel(host);
    panel.select('Function', FNS.map((f) => ({ value: f.id, label: f.label })), fn.id, (id) => {
      fn = FNS.find((f) => f.id === id)!;
      x0 = fn.x0;
      plot.o.x.label = fn.xLabel; plot.o.y.label = fn.yLabel;
      loop.invalidate();
    });
    const hSlider = panel.slider('Step Δx', { min: 1e-3, max: 2, value: h, log: true }, (v) => { h = v; animating = false; loop.invalidate(); });
    panel.slider('Zoom on P', { min: 1, max: 1000, value: 1, log: true, format: (v) => `×${fmt(v, 3)}` }, (v) => { zoom = v; loop.invalidate(); });
    panel.button('Shrink Δx → 0', () => { h = 1.5; animating = true; });
    const diff = panel.readout('|secant − tangent|');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
