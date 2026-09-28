// Helpers for the solid figures of Book XI: vectors in space, feet of perpendiculars, planes drawn
// as translucent quadrilaterals, parallelepipeds and prisms, and volumes as triple products.
// Coordinates: z is up; "the plane of reference" is the plane z = 0.

import type { G, P, Style } from '../../geometry/figure';
import { add, cross, dot, len, mul, sub, unit, v, Degenerate, type V } from '../../geometry/vec';

export const v3 = (x: number, y: number, z: number): V => v(x, y, z);
export const O3 = v3(0, 0, 0);
export const X3 = v3(1, 0, 0);
export const Y3 = v3(0, 1, 0);
export const Z3 = v3(0, 0, 1);

/** Unit vector with azimuth `az` (from the x-axis, in the xy-plane) and elevation `el` (radians). */
export const sph = (az: number, el = 0): V => v3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));

/** Rotate p about the axis through `c` with (unit or not) direction `axis`, by `ang` radians (Rodrigues). */
export function rotAxis(p: V, axis: V, ang: number, c: V = O3): V {
  const k = unit(axis);
  const q = sub(p, c);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const r = add(add(mul(q, cs), mul(cross(k, q), sn)), mul(k, dot(k, q) * (1 - cs)));
  return add(c, r);
}

/** Rotate about the vertical axis through c. */
export const rotZ = (p: V, ang: number, c: V = O3) => rotAxis(p, Z3, ang, c);

/** Foot of the perpendicular from p to the plane through o with normal n. */
export const footPlane = (p: V, o: V, n: V): V => sub(p, mul(n, dot(sub(p, o), n) / dot(n, n)));

/** Foot of the perpendicular from p to the line ab (in space). */
export function footLine(p: V, a: V, b: V): V {
  const d = sub(b, a);
  const dd = dot(d, d);
  if (dd < 1e-18) throw new Degenerate('line of zero length');
  return add(a, mul(d, dot(sub(p, a), d) / dd));
}

/** Normal of the plane through a, b, c. */
export const normal = (a: V, b: V, c: V): V => cross(sub(b, a), sub(c, a));

/** a · (b × c): the signed volume of the parallelepiped on a, b, c. */
export const triple = (a: V, b: V, c: V) => dot(a, cross(b, c));

/** Volume of the parallelepiped with vertex o and adjacent vertices a, b, c. */
export const ppdVolume = (o: V, a: V, b: V, c: V) => Math.abs(triple(sub(a, o), sub(b, o), sub(c, o)));

/** Volume of the tetrahedron abcd. */
export const tetVolume = (a: V, b: V, c: V, d: V) => ppdVolume(a, b, c, d) / 6;

/** Volume of the prism with triangles a0 a1 a2 and b0 b1 b2 (bi joined to ai), as three tetrahedra. */
export const prismVolume = (a: V[], b: V[]) => tetVolume(a[0], a[1], a[2], b[0]) + tetVolume(a[1], a[2], b[0], b[1]) + tetVolume(a[2], b[0], b[1], b[2]);

/** Area of a planar polygon in space. */
export function area3(ps: V[]): number {
  let s = v3(0, 0, 0);
  for (let i = 0; i < ps.length; i++) s = add(s, cross(ps[i], ps[(i + 1) % ps.length]));
  return len(s) / 2;
}

/** The cosine of the angle between two directions. */
export const cosBetween = (a: V, b: V) => dot(a, b) / (len(a) * len(b));

/** Distance from p to the plane through o with normal n. */
export const distPlane = (p: V, o: V, n: V) => Math.abs(dot(sub(p, o), n)) / len(n);

/** Distance between the parallel lines / from p to the line ab. */
export const distLine = (p: V, a: V, b: V) => len(cross(sub(p, a), sub(b, a))) / len(sub(b, a));

/** |sin| of the angle between two directions (0 when parallel). */
export const sinBetween = (a: V, b: V) => len(cross(a, b)) / (len(a) * len(b));

/**
 * Intersection of the lines a + s(b − a) and c + t(d − c), assumed coplanar: the midpoint of the
 * common perpendicular, which is the intersection when they meet.
 */
export function meet(a: V, b: V, c: V, d: V): V {
  const u = sub(b, a);
  const w = sub(d, c);
  const r = sub(a, c);
  const uu = dot(u, u);
  const uw = dot(u, w);
  const ww = dot(w, w);
  const ur = dot(u, r);
  const wr = dot(w, r);
  const den = uu * ww - uw * uw;
  if (Math.abs(den) < 1e-12 * uu * ww) throw new Degenerate('parallel lines');
  const s = (uw * wr - ww * ur) / den;
  const t = (uu * wr - uw * ur) / den;
  return mul(add(add(a, mul(u, s)), add(c, mul(w, t))), 0.5);
}

/** Intersection of the line ab with the plane through o with normal n. */
export function linePlane(a: V, b: V, o: V, n: V): V {
  const d = sub(b, a);
  const den = dot(d, n);
  if (Math.abs(den) < 1e-12) throw new Degenerate('line parallel to plane');
  return add(a, mul(d, dot(sub(o, a), n) / den));
}

/**
 * The unit direction making the angle `alpha` with e and `beta` with f (e, f spanning a plane),
 * on the side of the plane towards `up`. This is how an "elevated straight line containing given
 * angles with the original straight lines" is determined.
 */
export function dirWithAngles(e: V, f: V, alpha: number, beta: number, up: V): V {
  const eu = unit(e);
  const fu = unit(f);
  const c = dot(eu, fu);
  const den = 1 - c * c;
  if (den < 1e-12) throw new Degenerate('e and f are parallel');
  const ca = Math.cos(alpha);
  const cb = Math.cos(beta);
  const a = (ca - cb * c) / den;
  const b = (cb - ca * c) / den;
  const inPlane = add(mul(eu, a), mul(fu, b));
  const rest = 1 - dot(inPlane, inPlane);
  if (rest < 1e-9) throw new Degenerate('no such direction');
  let n = unit(cross(eu, fu));
  if (dot(n, up) < 0) n = mul(n, -1);
  return add(inPlane, mul(n, Math.sqrt(rest)));
}

/** Tests for claims. */
export const isPerp = (a: V, b: V, tol = 1e-7) => Math.abs(cosBetween(a, b)) < tol;
export const isParallel = (a: V, b: V, tol = 1e-7) => sinBetween(a, b) < tol;
export const coplanar = (ps: V[], tol = 1e-7) => {
  if (ps.length < 4) return true;
  const n = cross(sub(ps[1], ps[0]), sub(ps[2], ps[0]));
  const scale = Math.max(...ps.map((p) => len(sub(p, ps[0])))) || 1;
  return ps.every((p) => Math.abs(dot(sub(p, ps[0]), n)) <= tol * scale * scale * scale);
};

/** A plane drawn as the parallelogram centre ± u ± w. */
export function plane(g: G, centre: V, u: V, w: V, s: Style = {}): V[] {
  const pts = [sub(sub(centre, u), w), sub(add(centre, u), w), add(add(centre, u), w), add(sub(centre, u), w)];
  return g.polygon(pts, { fill: true, aux: true, ...s });
}

/** The horizontal plane z = h, drawn as a rectangle [x0, x1] × [y0, y1]. */
export function ground(g: G, x0: number, x1: number, y0: number, y1: number, s: Style = {}, h = 0): V[] {
  return g.polygon([v3(x0, y0, h), v3(x1, y0, h), v3(x1, y1, h), v3(x0, y1, h)], { fill: true, aux: true, ...s });
}

/** The eight vertices of the parallelepiped on o with edges a, b, c: [o, o+a, o+a+b, o+b, o+c, o+a+c, o+a+b+c, o+b+c]. */
export function box(o: V, a: V, b: V, c: V): V[] {
  const b0 = [o, add(o, a), add(add(o, a), b), add(o, b)];
  return [...b0, ...b0.map((p) => add(p, c))];
}

/** The six faces of a box (indices into box()): bottom, top, and the four sides. */
export const BOX_FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];

/** The twelve edges of a box. */
export const BOX_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Draw the edges of a box (vertices as from box(), possibly named points). */
export function drawBox(g: G, vs: V[], s: Style = {}): void {
  for (const [i, j] of BOX_EDGES) g.segment(vs[i], vs[j], s);
}

/** Volume of a box from its vertices. */
export const boxVolume = (vs: V[]) => ppdVolume(vs[0], vs[1], vs[3], vs[4]);

/** Name several points at once, keeping them in an array (in the order of `names`; '' leaves a point unnamed). */
export function named(g: G, names: string[], ps: V[], o?: { hidden?: boolean }): P[] {
  return ps.map((p, i) => (names[i] ? g.point(names[i], p, o) : (p as P)));
}

export { add, sub, mul, dot, cross, len, unit, v };
export type { V };
