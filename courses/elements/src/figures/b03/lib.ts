// Helpers for the figures of Book III: points on circles, arcs through three points, tangents,
// and the checks that keep a glider on the arc the hypothesis requires.

import type { G, Style } from '../../geometry/figure';
import { add, angle, circumcircle, Degenerate, deg, dist, dot, lc, mul, polar, sub, unit, type Circle, type V } from '../../geometry/vec';

/** Direction of p seen from c, in radians. */
export const dirOf = (c: V, p: V) => Math.atan2(p.y - c.y, p.x - c.x);

/** The point of circle k at angle t. */
export const onC = (k: Circle, t: number): V => polar(k.c, k.r, t);

/** Counter-clockwise angle from direction a0 to direction a1, in [0, 2π). */
export function ccw(a0: number, a1: number): number {
  let d = a1 - a0;
  while (d < 0) d += 2 * Math.PI;
  while (d >= 2 * Math.PI) d -= 2 * Math.PI;
  return d;
}

/** Is p strictly inside the counter-clockwise arc from a to b of the circle centred at c? */
export function onArc(c: V, a: V, b: V, p: V): boolean {
  const s = ccw(dirOf(c, a), dirOf(c, p));
  return s > 1e-6 && s < ccw(dirOf(c, a), dirOf(c, b)) - 1e-6;
}

/** Throw Degenerate unless the condition holds: the view then refuses the drag. */
export function need(ok: boolean, why: string): void {
  if (!ok) throw new Degenerate(why);
}

/** Draw the arc from a to b through m (of the circle through the three points); returns the circle. */
export function arc3(g: G, a: V, m: V, b: V, s: Style = {}): Circle {
  const k = circumcircle(a, m, b);
  if (onArc(k.c, a, b, m)) g.arc(k.c, a, b, s);
  else g.arc(k.c, b, a, s);
  return k;
}

/** Arc length of the counter-clockwise arc from a to b of circle k. */
export const arcLen = (k: Circle, a: V, b: V) => k.r * ccw(dirOf(k.c, a), dirOf(k.c, b));

/** The two points where the tangents from p touch circle k (p outside): [left, right] of p→centre. */
export function tangentPoints(p: V, k: Circle): [V, V] {
  const d = dist(p, k.c);
  if (d <= k.r * (1 + 1e-9)) throw new Degenerate('point not outside the circle');
  const m = mul(add(p, k.c), 0.5);
  const [l, r] = lc2(m, d / 2, k);
  return [l, r];
}

function lc2(c: V, r: number, k: Circle): [V, V] {
  // circle (c, r) ∩ k, [left, right] of the directed line c → k.c
  const d = dist(c, k.c);
  const a = (r * r - k.r * k.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const e = unit(sub(k.c, c));
  const base = add(c, mul(e, a));
  const n = { x: -e.y, y: e.x };
  return [add(base, mul(n, h)), sub(base, mul(n, h))];
}

/** The second point where the line from p (on circle k) through q meets k. */
export function secondHit(p: V, q: V, k: Circle): V {
  const [x, y] = lc(p, q, k);
  return dist(x, p) > dist(y, p) ? x : y;
}

/** The angle ABC in degrees. */
export const degAt = (a: V, b: V, c: V) => deg(angle(a, b, c));

/** Reflect the direction: the point symmetric to p about the line through c in direction u. */
export function mirror(p: V, c: V, u: V): V {
  const w = unit(u);
  const d = sub(p, c);
  const along = mul(w, dot(d, w));
  return add(c, sub(mul(along, 2), d));
}

/** Area of the segment of circle k cut off by the chord ab, on the side of the arc a → b (counter-clockwise). */
export function segmentArea(k: Circle, a: V, b: V): number {
  const th = ccw(dirOf(k.c, a), dirOf(k.c, b));
  return (k.r * k.r * (th - Math.sin(th))) / 2;
}
