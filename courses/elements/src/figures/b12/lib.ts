// Helpers for the solid figures of Book XII: volumes, pyramids and prisms drawn as translucent
// faces, wireframes that name a whole solid, polygons inscribed in circles in space, and the
// latitude–longitude polyhedron of XII.17.

import type { G, Style } from '../../geometry/figure';
import { add, cross, dot, len, mul, sub, v, type V } from '../../geometry/vec';

export const v3 = (x: number, y: number, z: number): V => v(x, y, z);

/** Volume of the tetrahedron ABCD. */
export const tetra = (a: V, b: V, c: V, d: V) => Math.abs(dot(sub(b, a), cross(sub(c, a), sub(d, a)))) / 6;

/** Area of a planar polygon in space. */
export function area3(ps: V[]): number {
  let s = v(0, 0, 0);
  for (let i = 0; i < ps.length; i++) s = add(s, cross(ps[i], ps[(i + 1) % ps.length]));
  return len(s) / 2;
}

/** Volume of a pyramid with a planar polygonal base and an apex. */
export function pyramidVol(base: V[], apex: V): number {
  let s = 0;
  for (let i = 1; i + 1 < base.length; i++) s += tetra(base[0], base[i], base[i + 1], apex);
  return s;
}

/** Distance from a point to the plane through a, b, c. */
export function planeDist(p: V, a: V, b: V, c: V): number {
  const n = cross(sub(b, a), sub(c, a));
  return Math.abs(dot(sub(p, a), n)) / len(n);
}

/** Centroid of some points. */
export const centroid = (ps: V[]) => mul(ps.reduce((s, p) => add(s, p), v(0, 0, 0)), 1 / ps.length);

/**
 * A walk along the edges of a graph that covers every edge (retracing where it must), so that a
 * single polyline can draw — and name — a whole solid.
 */
export function edgeWalk(pts: V[], edges: [number, number][]): V[] {
  const adj = pts.map(() => [] as number[]);
  edges.forEach(([a, b], i) => {
    adj[a].push(i);
    adj[b].push(i);
  });
  const used = new Set<number>();
  const walk: number[] = [edges[0]?.[0] ?? 0];
  const visit = (u: number) => {
    for (const ei of adj[u]) {
      if (used.has(ei)) continue;
      used.add(ei);
      const w = edges[ei][0] === u ? edges[ei][1] : edges[ei][0];
      walk.push(w);
      visit(w);
      walk.push(u);
    }
  };
  visit(walk[0]);
  // drop immediate back-and-forth duplicates at the end
  while (walk.length > 2 && walk[walk.length - 1] === walk[walk.length - 3]) walk.splice(-2, 2);
  return walk.map((i) => pts[i]);
}

/** The edges of a solid given by its faces (as index lists). */
export function faceEdges(faces: number[][]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const f of faces)
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([a, b]);
      }
    }
  return out;
}

/**
 * Draws a solid: its faces as translucent polygons and, if `name` is given, a thin wireframe
 * carrying that name, so that "the pyramid ABCG" or "the solid BGML" highlights the whole solid.
 */
export function solid(g: G, pts: V[], faces: number[][], s: Style & { faceStyle?: Style } = {}): void {
  const { faceStyle, ...rest } = s;
  for (const f of faces) g.polygon(f.map((i) => pts[i]), { fill: true, ...(rest.from !== undefined ? { from: rest.from } : {}), ...faceStyle });
  if (rest.name) g.curve(edgeWalk(pts, faceEdges(faces)), { aux: true, ...rest });
}

/** Faces of the tetrahedron [a, b, c, apex]. */
export const TETRA_FACES = [
  [0, 1, 2],
  [0, 1, 3],
  [1, 2, 3],
  [2, 0, 3],
];

/** Faces of a triangular prism [a, b, c, a', b', c']. */
export const PRISM_FACES = [
  [0, 1, 2],
  [3, 4, 5],
  [0, 1, 4, 3],
  [1, 2, 5, 4],
  [2, 0, 3, 5],
];

/** Faces of a pyramid on an n-gon (indices 0..n-1) with apex n. */
export const pyramidFaces = (n: number) => [Array.from({ length: n }, (_, i) => i), ...Array.from({ length: n }, (_, i) => [i, (i + 1) % n, n])];

/** Faces of a prism on an n-gon (bottom 0..n-1, top n..2n-1). */
export const prismFaces = (n: number) => [
  Array.from({ length: n }, (_, i) => i),
  Array.from({ length: n }, (_, i) => n + i),
  ...Array.from({ length: n }, (_, i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i]),
];

/** Faces of the parallelepiped on the edges a, b, c from o: [o, o+a, o+b, o+c, o+a+b, o+a+c, o+b+c, o+a+b+c]. */
export const BOX_FACES = [
  [0, 1, 4, 2],
  [0, 1, 5, 3],
  [0, 2, 6, 3],
  [7, 6, 2, 4],
  [7, 5, 1, 4],
  [7, 6, 3, 5],
];
export function box(o: V, a: V, b: V, c: V): V[] {
  return [o, add(o, a), add(o, b), add(o, c), add(add(o, a), b), add(add(o, a), c), add(add(o, b), c), add(add(add(o, a), b), c)];
}

/** Point at angle t on the horizontal circle with centre c and radius r (z = c.z). */
export const onCircle = (c: V, r: number, t: number): V => v(c.x + r * Math.cos(t), c.y + r * Math.sin(t), c.z ?? 0);

/** n points of a horizontal circle, starting at angle t0, counter-clockwise. */
export const ring = (c: V, r: number, n: number, t0 = 0): V[] => Array.from({ length: n }, (_, i) => onCircle(c, r, t0 + (2 * Math.PI * i) / n));

/** Points of an arc of a horizontal circle, for drawing. */
export const arcPts = (c: V, r: number, t0: number, t1: number, k = 48): V[] => Array.from({ length: k + 1 }, (_, i) => onCircle(c, r, t0 + ((t1 - t0) * i) / k));

/** Area of the regular n-gon inscribed in a circle of radius r. */
export const ngonArea = (n: number, r: number) => (n / 2) * r * r * Math.sin((2 * Math.PI) / n);

/**
 * The polyhedron of XII.17 inscribed in a sphere (centre c, radius r): the equator is cut into 4k
 * equal arcs, each quarter meridian into k, and neighbouring meridian points are joined. Returns
 * its vertices by (meridian i, level j) with j = 0 on the equator and j = k at the pole, and its
 * volume (the sum of the pyramids from the centre on its faces, both hemispheres).
 */
export function globe(c: V, r: number, k: number) {
  const m = 4 * k;
  const P = (i: number, j: number, s = 1): V => {
    const lat = (Math.PI / 2) * (j / k);
    const lon = (2 * Math.PI * i) / m;
    return add(c, v(r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), s * r * Math.sin(lat)));
  };
  let vol = 0;
  for (let i = 0; i < m; i++)
    for (let j = 0; j < k; j++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const cc = P(i + 1, j + 1);
      const d = P(i, j + 1);
      // the face is a trapezium (a triangle at the pole): two tetrahedra from the centre
      vol += tetra(c, a, b, cc) + (j + 1 < k ? tetra(c, a, cc, d) : 0);
    }
  return { P, m, vol: 2 * vol };
}
