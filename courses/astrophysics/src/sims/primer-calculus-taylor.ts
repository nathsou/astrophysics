// Appendix A4: Taylor polynomials of adjustable order around an adjustable centre a.
// Shows local accuracy, the growth of the "good" region with order, and the radius of convergence
// (for ln(1+x) and the Lorentz factor γ(β) = 1/√(1−β²), which blow up at a finite distance).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const MAXN = 24;

/** Generalised binomial coefficients C(p, k) for k = 0..n. */
function binom(p: number, n: number) {
  const c = new Float64Array(n + 1);
  c[0] = 1;
  for (let k = 1; k <= n; k++) c[k] = (c[k - 1] * (p - k + 1)) / k;
  return c;
}

interface Fn {
  id: string;
  label: string;
  f: (x: number) => number;
  /** Taylor coefficients c_k = f⁽ᵏ⁾(a)/k! for k = 0..n. */
  coeffs: (a: number, n: number) => Float64Array;
  x: [number, number];
  y: [number, number];
  a: [number, number, number]; // min, max, default
  /** Distance from a to the nearest singularity (radius of convergence), or Infinity. */
  radius: (a: number) => number;
  /** Where the function itself blows up. */
  sing: number[];
  xLabel: string;
}

const FNS: Fn[] = [
  {
    id: 'sin', label: 'sin x', f: Math.sin, x: [-10, 10], y: [-2.2, 2.2], a: [-6, 6, 0], radius: () => Infinity, sing: [], xLabel: 'x (radians)',
    coeffs(a, n) { const c = new Float64Array(n + 1); let fact = 1; for (let k = 0; k <= n; k++) { if (k) fact *= k; c[k] = Math.sin(a + (k * Math.PI) / 2) / fact; } return c; },
  },
  {
    id: 'exp', label: 'eˣ', f: Math.exp, x: [-6, 4], y: [-4, 30], a: [-4, 3, 0], radius: () => Infinity, sing: [], xLabel: 'x',
    coeffs(a, n) { const c = new Float64Array(n + 1); let fact = 1; for (let k = 0; k <= n; k++) { if (k) fact *= k; c[k] = Math.exp(a) / fact; } return c; },
  },
  {
    id: 'ln', label: 'ln(1 + x)', f: (x) => (x > -1 ? Math.log1p(x) : NaN), x: [-1.2, 3.5], y: [-3, 2.2], a: [-0.6, 2, 0], radius: (a) => 1 + a, sing: [-1], xLabel: 'x',
    coeffs(a, n) {
      const c = new Float64Array(n + 1);
      c[0] = Math.log1p(a);
      for (let k = 1; k <= n; k++) c[k] = ((k % 2 ? 1 : -1) / k) / Math.pow(1 + a, k); // f⁽ᵏ⁾/k! = (−1)^(k−1)(k−1)!/(1+a)^k / k!
      return c;
    },
  },
  {
    id: 'gamma', label: 'Lorentz γ = 1/√(1 − β²)', f: (b) => (Math.abs(b) < 1 ? 1 / Math.sqrt(1 - b * b) : NaN), x: [-1.15, 1.15], y: [0, 5], a: [-0.9, 0.9, 0],
    radius: (a) => 1 - Math.abs(a), sing: [-1, 1], xLabel: 'β = v / c',
    coeffs(a, n) {
      // (1−β²)^(−½) = (1−β)^(−½)·(1+β)^(−½); expand each factor about a and multiply the series.
      const p = binom(-0.5, n);
      const u = new Float64Array(n + 1), w = new Float64Array(n + 1), c = new Float64Array(n + 1);
      for (let k = 0; k <= n; k++) {
        u[k] = p[k] * Math.pow(1 + a, -0.5 - k);                  // (1+β)^(−½) about a
        w[k] = p[k] * (k % 2 ? -1 : 1) * Math.pow(1 - a, -0.5 - k); // (1−β)^(−½) about a
      }
      for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) c[i + j] += u[i] * w[j];
      return c;
    },
  },
];

/** Translucent backdrop so legend text stays readable over curves. */
function backdrop(ctx: CanvasRenderingContext2D, bg: string, x: number, y: number, lines: string[], lh: number, extra = 0) {
  ctx.save();
  ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
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
    let order = 3;
    let a = fn.a[2];
    let c = fn.coeffs(a, MAXN);

    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, { x: { min: fn.x[0], max: fn.x[1], label: fn.xLabel }, y: { min: fn.y[0], max: fn.y[1] } });
    const loop = new Loop(null, render);
    loop.onDemand = true;

    const poly = (x: number, n: number) => {
      // Horner's rule in (x − a)
      const t = x - a;
      let s = 0;
      for (let k = n; k >= 0; k--) s = s * t + c[k];
      return s;
    };

    function render() {
      plot.o.x.min = fn.x[0]; plot.o.x.max = fn.x[1]; plot.o.y.min = fn.y[0]; plot.o.y.max = fn.y[1]; plot.o.x.label = fn.xLabel;
      const R = fn.radius(a);
      // Region where the polynomial is within 1% (relative, or 0.01 absolute) of the function: scan outwards from a.
      const tol = (x: number) => Math.abs(poly(x, order) - fn.f(x)) <= 0.01 * Math.max(1, Math.abs(fn.f(x)));
      const span = fn.x[1] - fn.x[0], dx = span / 800;
      let lo = a, hi = a;
      while (lo - dx > fn.x[0] && tol(lo - dx)) lo -= dx;
      while (hi + dx < fn.x[1] && tol(hi + dx)) hi += dx;
      plot.draw(() => {
        const { ctx } = plot;
        ctx.fillStyle = pal.good; ctx.globalAlpha = 0.1;
        ctx.fillRect(plot.px(lo), plot.m.t, plot.px(hi) - plot.px(lo), plot.ph);
        ctx.globalAlpha = 1;
        fn.sing.forEach((xs, i) => plot.vline(xs, { color: pal.bad, label: i === 0 ? 'singularity' : undefined }));
        if (Number.isFinite(R)) {
          // the interval of convergence |x − a| < R
          ctx.strokeStyle = pal.bad; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
          const yb = plot.m.t + plot.ph - 3;
          ctx.beginPath(); ctx.moveTo(plot.px(a - R), yb); ctx.lineTo(plot.px(a + R), yb); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        plot.hline(0, { color: pal.axis, dash: [], width: 1 });
        // lower orders, faint, to show the sequence building up
        for (let k = Math.max(0, order - 3); k < order; k++) plot.fn((x) => poly(x, k), { color: pal.series[0], width: 1, alpha: 0.18 + 0.12 * (k - order + 3), samples: 400 });
        plot.fn(fn.f, { color: pal.fg, width: 2.2, samples: 600 });
        plot.fn((x) => poly(x, order), { color: pal.accent, width: 2.2, samples: 600 });
        plot.point(a, fn.f(a), { r: 5, color: pal.accent, stroke: pal.fg, label: `a = ${fmt(a, 3)}` });
      });
      backdrop(plot.ctx, pal.bg, plot.m.l + 10, plot.m.t + 14, [`— ${fn.label}`, `— Taylor polynomial of order ${order}`, 'shaded: within 1%'], 17);
      plot.text(`— ${fn.label}`, plot.m.l + 10, plot.m.t + 14, { color: pal.fg });
      plot.text(`— Taylor polynomial of order ${order}`, plot.m.l + 10, plot.m.t + 31, { color: pal.accent });
      plot.text(`shaded: within 1%`, plot.m.l + 10, plot.m.t + 48, { color: pal.good });
      good.set(`${fmt(lo, 3)} … ${fmt(hi, 3)}`);
      rad.set(Number.isFinite(R) ? fmt(R, 3) : '∞');
    }

    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    // Drag on the canvas to move the expansion point.
    let dragging = false;
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'ew-resize';
    const move = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      setA(Math.min(fn.a[1], Math.max(fn.a[0], plot.dx(e.clientX - r.left))));
      aSlider.set(a);
    };
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; stage.canvas.setPointerCapture(e.pointerId); move(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (dragging) move(e); });
    stage.canvas.addEventListener('pointerup', () => (dragging = false));
    stage.canvas.addEventListener('pointercancel', () => (dragging = false));

    function setA(v: number) { a = v; c = fn.coeffs(a, MAXN); loop.invalidate(); }

    const panel = new Panel(host);
    panel.select('Function', FNS.map((f) => ({ value: f.id, label: f.label })), fn.id, (id) => {
      fn = FNS.find((f) => f.id === id)!;
      aSlider.set(fn.a[2]);
      setA(fn.a[2]);
    });
    panel.slider('Order n', { min: 0, max: 20, value: order, step: 1, format: (v) => String(Math.round(v)) }, (v) => { order = Math.round(v); loop.invalidate(); });
    const aSlider = panel.slider('Centre a', { min: -6, max: 6, value: a, step: 0.01 }, (v) => setA(Math.min(fn.a[1], Math.max(fn.a[0], v))));
    const good = panel.readout('good to 1% on');
    const rad = panel.readout('radius of convergence');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
