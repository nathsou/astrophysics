// Constructions of Book IV that later propositions of the book reuse. Each follows Euclid's
// recipe (tangent and chord, golden section, bisected angles) rather than placing the answer.

import { add, angle, cc, dist, lc, ll, mul, perp, rot, sub, unit, type Circle, type V } from '../../geometry/vec';

/** Where the tangents to the circle with centre K at the points P and Q meet (III.16, Por.). */
export function tangentsMeet(K: V, P: V, Q: V): V {
  return ll(P, add(P, perp(sub(P, K))), Q, add(Q, perp(sub(Q, K))));
}

/**
 * IV.2: in the circle k, inscribe a triangle with vertex A (on k) whose angles at the other two
 * vertices are `atLeft` and `atRight`. Returns [left, right] as seen from A looking at the centre,
 * and the ends G, H of the tangent at A (G on the left, H on the right).
 */
export function inscribeEquiangular(k: Circle, A: V, atLeft: number, atRight: number): { left: V; right: V; G: V; H: V } {
  const r = unit(sub(A, k.c));
  const h = rot(r, -Math.PI / 2); // along the tangent, towards H
  // the angle between the tangent AH and the chord to the right-hand vertex equals the angle at the
  // left-hand vertex, in the alternate segment (III.32); and symmetrically
  const toRight = rot(h, -atLeft);
  const toLeft = rot(mul(h, -1), atRight);
  const right = lc(A, add(A, toRight), k)[1];
  const left = lc(A, add(A, toLeft), k)[1];
  return { left, right, G: add(A, mul(h, -k.r * 0.8)), H: add(A, mul(h, k.r * 0.8)) };
}

/**
 * II.11: the point H of AB with AB·BH = AH², found as Euclid finds it (the square on AB is drawn
 * on the right of A→B, E bisects its side AC, and EF = EB).
 */
export function goldenCut11(A: V, B: V): V {
  const s = dist(A, B);
  const u = unit(sub(B, A));
  const dn = mul(perp(u), -1);
  const C = add(A, mul(dn, s));
  const E = add(A, mul(dn, s / 2));
  const F = lc(C, A, { c: E, r: dist(E, B) })[1];
  return add(A, mul(u, dist(A, F)));
}

/**
 * IV.10: on the side AB, the isosceles triangle ABD with each base angle double the apex angle.
 * C cuts AB in extreme and mean ratio; D is on the circle with centre A through B, with BD = AC,
 * on the left of A→B.
 */
export function goldenTriangle(A: V, B: V): { C: V; D: V } {
  const C = goldenCut11(A, B);
  const D = cc({ c: A, r: dist(A, B) }, { c: B, r: dist(A, C) })[0];
  return { C, D };
}

/** The bisector of the angle ABC meets the circle k again (B on k). */
export function bisectorMeets(k: Circle, A: V, B: V, C: V): V {
  const d = add(unit(sub(A, B)), unit(sub(C, B)));
  return lc(B, add(B, d), k)[1];
}

/**
 * IV.11: the regular pentagon inscribed in k with a vertex at A, in counter-clockwise order
 * [A, B, C, D, E]. A golden triangle (IV.10) gives the angles; IV.2 inscribes ACD with them; the
 * base angles at C and D are bisected.
 */
export function pentagon(k: Circle, A: V): [V, V, V, V, V] {
  const P = { x: 0, y: 0 };
  const Q = { x: 0, y: -1 };
  const { D: R } = goldenTriangle(P, Q);
  const base = angle(P, Q, R);
  const t = inscribeEquiangular(k, A, base, base);
  const C = t.left;
  const D = t.right;
  const E = bisectorMeets(k, A, C, D);
  const B = bisectorMeets(k, A, D, C);
  return [A, B, C, D, E];
}

/** The angle of each vertex of a polygon, for claims. */
export function angles(ps: V[]): number[] {
  return ps.map((p, i) => angle(ps[(i + ps.length - 1) % ps.length], p, ps[(i + 1) % ps.length]));
}
export function sides(ps: V[]): number[] {
  return ps.map((p, i) => dist(p, ps[(i + 1) % ps.length]));
}
