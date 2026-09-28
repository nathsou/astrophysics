// Lightweight, fast Canvas2D plotting for live figures (60 fps friendly).
//
//   const plot = new Plot(canvasOrStage, { x: { label: 'λ (nm)', min: 100, max: 3000, log: true }, y: {...} });
//   plot.draw(() => {
//     plot.line(xs, ys, { color: pal.series[0] });
//     plot.fn((x) => f(x), { color: pal.accent, dash: [4, 4] });
//     plot.point(x0, y0, { r: 4 });
//   });

import { palette, onThemeChange, type Palette } from './theme';
import { fmt, superscript } from './controls';

export interface AxisOpts {
  min: number;
  max: number;
  log?: boolean;
  label?: string;
  /** Custom tick formatter. */
  format?: (v: number) => string;
  ticks?: number[];
}

export interface PlotOpts {
  x: AxisOpts;
  y: AxisOpts;
  margin?: { l: number; r: number; t: number; b: number };
  title?: string;
  grid?: boolean;
}

export interface StrokeOpts {
  color?: string;
  width?: number;
  dash?: number[];
  alpha?: number;
}

export class Plot {
  ctx: CanvasRenderingContext2D;
  pal: Palette = palette();
  w = 1;
  h = 1;
  dpr = 1;
  m: { l: number; r: number; t: number; b: number };

  constructor(public canvas: HTMLCanvasElement, public o: PlotOpts) {
    this.ctx = canvas.getContext('2d')!;
    this.m = o.margin ?? { l: 56, r: 16, t: o.title ? 28 : 14, b: 42 };
    onThemeChange(() => (this.pal = palette()));
  }

  /** Call from Stage.onResize. */
  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  get pw() { return this.w - this.m.l - this.m.r; }
  get ph() { return this.h - this.m.t - this.m.b; }

  private norm(a: AxisOpts, v: number) {
    return a.log ? Math.log(v / a.min) / Math.log(a.max / a.min) : (v - a.min) / (a.max - a.min);
  }
  private denorm(a: AxisOpts, t: number) {
    return a.log ? a.min * Math.pow(a.max / a.min, t) : a.min + t * (a.max - a.min);
  }
  /** Data → CSS pixel. */
  px(x: number) { return this.m.l + this.norm(this.o.x, x) * this.pw; }
  py(y: number) { return this.m.t + (1 - this.norm(this.o.y, y)) * this.ph; }
  /** CSS pixel → data. */
  dx(px: number) { return this.denorm(this.o.x, (px - this.m.l) / this.pw); }
  dy(py: number) { return this.denorm(this.o.y, 1 - (py - this.m.t) / this.ph); }

  /** Clear, draw axes, run `body` clipped to the plot area. */
  draw(body: () => void) {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.axes();
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.m.l, this.m.t, this.pw, this.ph);
    ctx.clip();
    body();
    ctx.restore();
  }

  static ticks(a: AxisOpts): number[] {
    if (a.ticks) return a.ticks;
    if (a.log) {
      const out: number[] = [];
      // reversed axes (min > max) are allowed: work on the sorted endpoints
      const lo0 = Math.min(a.min, a.max), hi0 = Math.max(a.min, a.max);
      const lo = Math.floor(Math.log10(lo0)), hi = Math.ceil(Math.log10(hi0));
      const stride = Math.max(1, Math.ceil((hi - lo) / 8));
      for (let e = lo; e <= hi; e += stride) {
        const v = 10 ** e;
        if (v >= lo0 * 0.999 && v <= hi0 * 1.001) out.push(v);
      }
      return out;
    }
    const lo = Math.min(a.min, a.max), hi = Math.max(a.min, a.max);
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const raw = span / 6;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= 7) ?? mag * 10;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  private tickLabel(a: AxisOpts, v: number) {
    if (a.format) return a.format(v);
    if (a.log) {
      const e = Math.round(Math.log10(v));
      // only label as a power of ten when the tick really is one (custom ticks like 5, 20, 300)
      if (Math.abs(Math.log10(v) - e) > 1e-9) return fmt(v, 3);
      if (e >= -2 && e <= 3) return String(10 ** e >= 1 ? 10 ** e : Number((10 ** e).toPrecision(1)));
      return `10${superscript(String(e))}`;
    }
    return fmt(v, 4);
  }

  axes() {
    const { ctx, pal, m } = this;
    ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
    ctx.lineWidth = 1;
    const xt = Plot.ticks(this.o.x), yt = Plot.ticks(this.o.y);
    if (this.o.grid !== false) {
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      for (const v of xt) { const x = Math.round(this.px(v)) + 0.5; ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + this.ph); }
      for (const v of yt) { const y = Math.round(this.py(v)) + 0.5; ctx.moveTo(m.l, y); ctx.lineTo(m.l + this.pw, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = pal.axis;
    ctx.beginPath();
    ctx.moveTo(m.l + 0.5, m.t);
    ctx.lineTo(m.l + 0.5, m.t + this.ph + 0.5);
    ctx.lineTo(m.l + this.pw, m.t + this.ph + 0.5);
    ctx.stroke();
    ctx.fillStyle = pal.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of xt) ctx.fillText(this.tickLabel(this.o.x, v), this.px(v), m.t + this.ph + 6);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) ctx.fillText(this.tickLabel(this.o.y, v), m.l - 6, this.py(v));
    ctx.fillStyle = pal.muted;
    if (this.o.x.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.o.x.label, m.l + this.pw / 2, this.h - 4);
    }
    if (this.o.y.label) {
      ctx.save();
      ctx.translate(12, m.t + this.ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.o.y.label, 0, 0);
      ctx.restore();
    }
    if (this.o.title) {
      ctx.fillStyle = pal.fg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(this.o.title, m.l, 6);
    }
  }

  private stroke(o: StrokeOpts) {
    const { ctx } = this;
    ctx.strokeStyle = o.color ?? this.pal.series[0];
    ctx.lineWidth = o.width ?? 1.75;
    ctx.setLineDash(o.dash ?? []);
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** Polyline through (xs[i], ys[i]); `n` limits the count (for ring buffers pass pre-linearised arrays). */
  line(xs: ArrayLike<number>, ys: ArrayLike<number>, o: StrokeOpts & { n?: number } = {}) {
    const { ctx } = this;
    const n = o.n ?? Math.min(xs.length, ys.length);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = ys[i];
      if (!Number.isFinite(x) || !Number.isFinite(y) || (this.o.y.log && y <= 0) || (this.o.x.log && x <= 0)) { pen = false; continue; }
      const X = this.px(x), Y = this.py(y);
      if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
    }
    this.stroke(o);
  }

  /** Plot y = f(x) sampled across the visible x range. */
  fn(f: (x: number) => number, o: StrokeOpts & { samples?: number; fill?: string } = {}) {
    const N = o.samples ?? Math.max(64, Math.ceil(this.pw));
    const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { xs[i] = this.denorm(this.o.x, i / N); ys[i] = f(xs[i]); }
    if (o.fill) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.moveTo(this.px(xs[0]), this.m.t + this.ph);
      for (let i = 0; i <= N; i++) if (Number.isFinite(ys[i])) ctx.lineTo(this.px(xs[i]), this.py(Math.max(ys[i], this.o.y.min)));
      ctx.lineTo(this.px(xs[N]), this.m.t + this.ph);
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    this.line(xs, ys, o);
  }

  point(x: number, y: number, o: { r?: number; color?: string; stroke?: string; label?: string } = {}) {
    const { ctx } = this;
    const X = this.px(x), Y = this.py(y);
    ctx.beginPath();
    ctx.arc(X, Y, o.r ?? 3.5, 0, Math.PI * 2);
    ctx.fillStyle = o.color ?? this.pal.accent;
    ctx.fill();
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (o.label) {
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = this.pal.fg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(o.label, X + 6, Y - 4);
    }
  }

  /** Scatter many points quickly (square dots). */
  scatter(xs: ArrayLike<number>, ys: ArrayLike<number>, o: { size?: number; color?: string | ((i: number) => string); alpha?: number; n?: number } = {}) {
    const { ctx } = this;
    const s = o.size ?? 2, n = o.n ?? xs.length;
    ctx.globalAlpha = o.alpha ?? 1;
    const col = o.color ?? this.pal.series[0];
    if (typeof col === 'string') ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      if (typeof col === 'function') ctx.fillStyle = col(i);
      ctx.fillRect(this.px(xs[i]) - s / 2, this.py(ys[i]) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  vline(x: number, o: StrokeOpts & { label?: string } = {}) {
    const { ctx } = this;
    const X = this.px(x);
    ctx.beginPath();
    ctx.moveTo(X, this.m.t);
    ctx.lineTo(X, this.m.t + this.ph);
    this.stroke({ width: 1, dash: [3, 3], color: this.pal.muted, ...o });
    if (o.label) this.text(o.label, X + 4, this.m.t + 4, { align: 'left', baseline: 'top', color: o.color });
  }

  hline(y: number, o: StrokeOpts & { label?: string } = {}) {
    const { ctx } = this;
    const Y = this.py(y);
    ctx.beginPath();
    ctx.moveTo(this.m.l, Y);
    ctx.lineTo(this.m.l + this.pw, Y);
    this.stroke({ width: 1, dash: [3, 3], color: this.pal.muted, ...o });
    if (o.label) this.text(o.label, this.m.l + this.pw - 4, Y - 3, { align: 'right', baseline: 'bottom', color: o.color });
  }

  /** Text at CSS pixel coords. */
  text(s: string, X: number, Y: number, o: { color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; size?: number } = {}) {
    const { ctx } = this;
    ctx.font = `${o.size ?? 11}px JetBrains Mono, ui-monospace, monospace`;
    ctx.fillStyle = o.color ?? this.pal.fg;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    ctx.fillText(s, X, Y);
  }
}

/** Fixed-capacity ring buffer for time series; `linear()` returns ordered copies for plotting. */
export class Series {
  xs: Float64Array;
  ys: Float64Array;
  private head = 0;
  count = 0;
  constructor(public capacity: number) {
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
  }
  push(x: number, y: number) {
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }
  clear() { this.head = 0; this.count = 0; }
  linear(): [Float64Array, Float64Array] {
    const n = this.count, X = new Float64Array(n), Y = new Float64Array(n);
    const start = (this.head - n + this.capacity) % this.capacity;
    for (let i = 0; i < n; i++) { const j = (start + i) % this.capacity; X[i] = this.xs[j]; Y[i] = this.ys[j]; }
    return [X, Y];
  }
}
