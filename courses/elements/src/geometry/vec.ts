// Plane and space geometry used by the figures: vectors, the constructions of the postulates
// (lines, circles and their intersections) and the handful of derived constructions that recur.
//
// Intersections are returned in a *stable order* so that a figure can say which of two points it
// means and keep meaning it while points are dragged:
//   - circle ∩ circle: first the point on the left of the directed line from the first centre to
//     the second (counter-clockwise in mathematical orientation, y up), then the one on the right;
//   - line ∩ circle: in the order of the line's direction A→B.
// A construction that does not exist in the current configuration throws `Degenerate`; the figure
// view then keeps the last valid position.

export interface V {
  x: number;
  y: number;
  z?: number;
}

export class Degenerate extends Error {
  constructor(what: string) {
    super(`degenerate: ${what}`);
  }
}

export const EPS = 1e-9;

export const v = (x: number, y: number, z?: number): V => (z === undefined ? { x, y } : { x, y, z });
export const zOf = (p: V) => p.z ?? 0;
export const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y, a.z === undefined && b.z === undefined ? undefined : zOf(a) + zOf(b));
export const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y, a.z === undefined && b.z === undefined ? undefined : zOf(a) - zOf(b));
export const mul = (a: V, k: number): V => v(a.x * k, a.y * k, a.z === undefined ? undefined : a.z * k);
export const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + zOf(a) * zOf(b);
export const cross2 = (a: V, b: V) => a.x * b.y - a.y * b.x;
export const cross = (a: V, b: V): V => v(a.y * zOf(b) - zOf(a) * b.y, zOf(a) * b.x - a.x * zOf(b), a.x * b.y - a.y * b.x);
export const len = (a: V) => Math.sqrt(dot(a, a));
export const dist = (a: V, b: V) => len(sub(a, b));
export const unit = (a: V): V => {
  const l = len(a);
  if (l < EPS) throw new Degenerate('zero vector');
  return mul(a, 1 / l);
};
export const mid = (a: V, b: V) => lerp(a, b, 0.5);
export const lerp = (a: V, b: V, t: number): V => add(a, mul(sub(b, a), t));
/** Rotate a plane vector by `ang` radians counter-clockwise. */
export const rot = (a: V, ang: number): V => v(a.x * Math.cos(ang) - a.y * Math.sin(ang), a.x * Math.sin(ang) + a.y * Math.cos(ang));
/** Rotate point `p` about centre `c`. */
export const rotAbout = (p: V, c: V, ang: number) => add(c, rot(sub(p, c), ang));
/** Left normal of a plane vector. */
export const perp = (a: V): V => v(-a.y, a.x);
export const polar = (c: V, r: number, ang: number): V => v(c.x + r * Math.cos(ang), c.y + r * Math.sin(ang));

/** The (unsigned) angle ABC at B, in radians, in [0, π]. */
export function angle(a: V, b: V, c: V): number {
  const u = sub(a, b);
  const w = sub(c, b);
  const d = len(u) * len(w);
  if (d < EPS) throw new Degenerate('angle with a zero side');
  return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / d)));
}
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Signed area of a plane polygon (positive when counter-clockwise). */
export function signedArea(ps: V[]): number {
  let s = 0;
  for (let i = 0; i < ps.length; i++) s += cross2(ps[i], ps[(i + 1) % ps.length]);
  return s / 2;
}
export const area = (ps: V[]) => Math.abs(signedArea(ps));
/** Which side of the directed line AB the point P is on: +1 left, -1 right, 0 on it. */
export const side = (a: V, b: V, p: V) => Math.sign(cross2(sub(b, a), sub(p, a)));

export interface Circle {
  c: V;
  r: number;
}

/** Circle ∩ circle: [left, right] of the directed line c1→c2. */
export function cc(k1: Circle, k2: Circle): [V, V] {
  const d = dist(k1.c, k2.c);
  if (d < EPS) throw new Degenerate('concentric circles');
  const a = (k1.r * k1.r - k2.r * k2.r + d * d) / (2 * d);
  const h2 = k1.r * k1.r - a * a;
  if (h2 < -1e-9 * Math.max(1, k1.r * k1.r)) throw new Degenerate('circles do not meet');
  const h = Math.sqrt(Math.max(0, h2));
  const e = unit(sub(k2.c, k1.c));
  const m = add(k1.c, mul(e, a));
  const n = perp(e);
  return [add(m, mul(n, h)), sub(m, mul(n, h))];
}

/** Line AB ∩ circle: the two points in the order of the direction A→B. */
export function lc(a: V, b: V, k: Circle): [V, V] {
  const d = unit(sub(b, a));
  const f = sub(a, k.c);
  const B = dot(f, d);
  const C = dot(f, f) - k.r * k.r;
  const disc = B * B - C;
  if (disc < -1e-9 * Math.max(1, k.r * k.r)) throw new Degenerate('line misses circle');
  const s = Math.sqrt(Math.max(0, disc));
  return [add(a, mul(d, -B - s)), add(a, mul(d, -B + s))];
}

/** Line AB ∩ line CD. */
export function ll(a: V, b: V, c: V, d: V): V {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = cross2(r, s);
  if (Math.abs(den) < EPS * Math.max(1, len(r) * len(s))) throw new Degenerate('parallel lines');
  const t = cross2(sub(c, a), s) / den;
  return add(a, mul(r, t));
}

/** Foot of the perpendicular from P to line AB. */
export function foot(p: V, a: V, b: V): V {
  const d = sub(b, a);
  const t = dot(sub(p, a), d) / dot(d, d);
  return add(a, mul(d, t));
}
/** Reflection of P in line AB. */
export const reflect = (p: V, a: V, b: V) => sub(mul(foot(p, a, b), 2), p);

/** Point at distance `r` from A towards B. */
export const along = (a: V, b: V, r: number) => add(a, mul(unit(sub(b, a)), r));

/** Circle through three points. */
export function circumcircle(a: V, b: V, c: V): Circle {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) throw new Degenerate('collinear points');
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const o = v(x, y);
  return { c: o, r: dist(o, a) };
}

/** Incircle of triangle ABC. */
export function incircle(a: V, b: V, c: V): Circle {
  const la = dist(b, c);
  const lb = dist(c, a);
  const lc_ = dist(a, b);
  const p = la + lb + lc_;
  const o = v((la * a.x + lb * b.x + lc_ * c.x) / p, (la * a.y + lb * b.y + lc_ * c.y) / p);
  return { c: o, r: (2 * area([a, b, c])) / p };
}

/** The square on AB, on the left of the directed segment A→B: [A, B, C, D]. */
export function squareOn(a: V, b: V): [V, V, V, V] {
  const n = perp(sub(b, a));
  return [a, b, add(b, n), add(a, n)];
}

/** Regular n-gon inscribed in a circle, first vertex at angle `start`. */
export function regular(c: V, r: number, n: number, start = Math.PI / 2): V[] {
  return Array.from({ length: n }, (_, i) => polar(c, r, start + (2 * Math.PI * i) / n));
}

/** The golden section point of AB (AC the greater segment): AB·CB = AC². */
export function goldenCut(a: V, b: V): V {
  return lerp(a, b, (Math.sqrt(5) - 1) / 2);
}

export const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
export const samePoint = (a: V, b: V, tol = 1e-6) => dist(a, b) <= tol * Math.max(1, len(a), len(b));
export const onCircle = (p: V, k: Circle, tol = 1e-6) => near(dist(p, k.c), k.r, tol);
export const collinear = (a: V, b: V, c: V, tol = 1e-6) => Math.abs(cross2(sub(b, a), sub(c, a))) <= tol * Math.max(1, dist(a, b) * dist(a, c));
