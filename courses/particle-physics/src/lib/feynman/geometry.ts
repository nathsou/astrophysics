/**
 * Line geometry for the textbook styles: straight, wavy, curly (a coil) and dashed, along any base curve.
 */
export interface Pt {
  x: number;
  y: number;
}

/** A polyline with cumulative lengths, so that it can be sampled by distance. */
export class Curve {
  readonly pts: Pt[];
  readonly cum: number[];
  readonly length: number;
  constructor(pts: Pt[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
    this.length = this.cum[this.cum.length - 1]!;
  }
  /** Point and unit tangent at arc length s. */
  at(s: number): { x: number; y: number; tx: number; ty: number } {
    const n = this.pts.length;
    if (n === 1 || this.length === 0) return { ...this.pts[0]!, tx: 1, ty: 0 };
    const t = Math.min(Math.max(s, 0), this.length);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid]! <= t) lo = mid;
      else hi = mid;
    }
    const a = this.pts[lo]!;
    const b = this.pts[hi]!;
    const seg = this.cum[hi]! - this.cum[lo]!;
    const f = seg === 0 ? 0 : (t - this.cum[lo]!) / seg;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * f, y: a.y + dy * f, tx: dx / len, ty: dy / len };
  }
}

/** A straight line, or a circular-ish arc (quadratic Bézier) bowed sideways by `bow` pixels at its middle. */
export function baseCurve(a: Pt, b: Pt, bow = 0): Curve {
  if (Math.abs(bow) < 0.5) return new Curve([a, b]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c = { x: (a.x + b.x) / 2 + nx * bow * 2, y: (a.y + b.y) / 2 + ny * bow * 2 };
  const pts: Pt[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  }
  return new Curve(pts);
}

/** A loop that starts and ends at `a`, pointing in direction `dir` (unit vector), radius r. */
export function loopCurve(a: Pt, dir: Pt, r: number): Curve {
  const c = { x: a.x + dir.x * r, y: a.y + dir.y * r };
  const a0 = Math.atan2(-dir.y, -dir.x);
  const pts: Pt[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = a0 + (2 * Math.PI * i) / N;
    pts.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
  }
  return new Curve(pts);
}

const f2 = (x: number): string => (Math.round(x * 100) / 100).toString();

function toPath(pts: Pt[]): string {
  let d = '';
  pts.forEach((p, i) => (d += `${i ? 'L' : 'M'}${f2(p.x)} ${f2(p.y)}`));
  return d;
}

export const straightPath = (c: Curve): string => toPath(c.length === 0 ? c.pts : c.pts.length === 2 ? c.pts : c.pts);

/** A sine wave of the given amplitude and (approximate) wavelength along the curve, with a whole number of periods. */
export function wavyPath(c: Curve, amplitude = 4.2, wavelength = 14): string {
  if (c.length < 2) return toPath(c.pts);
  const lead = Math.min(3, c.length * 0.1);
  const span = c.length - 2 * lead;
  const n = Math.max(1, Math.round(span / wavelength));
  const pts: Pt[] = [];
  const steps = Math.max(8, Math.ceil(span / 1.2));
  pts.push(c.at(0));
  for (let i = 0; i <= steps; i++) {
    const s = lead + (span * i) / steps;
    const p = c.at(s);
    const w = amplitude * Math.sin((2 * Math.PI * n * i) / steps);
    pts.push({ x: p.x - p.ty * w, y: p.y + p.tx * w });
  }
  pts.push(c.at(c.length));
  return toPath(pts);
}

/** A gluon: a prolate cycloid (a coil), with straight tails at both ends. */
export function coilPath(c: Curve, radius = 4.6, pitch = 11): string {
  if (c.length < 2) return toPath(c.pts);
  const a = pitch / (2 * Math.PI);
  const b = radius;
  const tail = Math.min(4, c.length * 0.12);
  // The coil spans `n` pitches along the curve; in the parametrisation x = aθ − b sinθ the loop begins at θ0 = π/2 where y = 0.
  const avail = c.length - 2 * tail - 2 * b * 0.9;
  const n = Math.max(1, Math.round(avail / pitch));
  const θ0 = Math.PI / 2;
  const x0 = a * θ0 - b * Math.sin(θ0);
  const xTotal = 2 * Math.PI * a * n;
  const lead = (c.length - xTotal) / 2;
  const pts: Pt[] = [c.at(0)];
  const steps = n * 40;
  for (let i = 0; i <= steps; i++) {
    const θ = θ0 + (2 * Math.PI * n * i) / steps;
    const x = a * θ - b * Math.sin(θ) - x0; // 0 … xTotal
    const y = -b * Math.cos(θ);
    const p = c.at(lead + x);
    pts.push({ x: p.x - p.ty * y, y: p.y + p.tx * y });
  }
  pts.push(c.at(c.length));
  return toPath(pts);
}

/** The position and direction of the arrow on a line (at `frac` of its length, pointing along the curve). */
export function arrowAt(c: Curve, frac = 0.5): { x: number; y: number; angle: number } {
  const p = c.at(c.length * frac);
  return { x: p.x, y: p.y, angle: (Math.atan2(p.ty, p.tx) * 180) / Math.PI };
}

/** Minimum distance from a point to a curve (sampled). */
export function distanceToCurve(c: Curve, p: Pt): number {
  let m = Infinity;
  const step = Math.max(2, c.length / 60);
  for (let s = 0; s <= c.length; s += step) {
    const q = c.at(s);
    m = Math.min(m, Math.hypot(q.x - p.x, q.y - p.y));
  }
  return m;
}
