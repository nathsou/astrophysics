// Helpers for Book XIII: a frame along a given line (for the square-and-gnomon figures of
// XIII.1–5), the golden ratio, and the regular solids built in XIII.13–17.

import type { G } from '../../geometry/figure';
import { add, cross, dist, dot, len, mul, perp, sub, unit, v, type V } from '../../geometry/vec';

export const PHI = (1 + Math.sqrt(5)) / 2;

/** Coordinates along AB: at(x, y) is A + x·u + y·n, with u the unit vector of AB and n its left normal. */
export function frame(A: V, B: V) {
  const u = unit(sub(B, A));
  const n = perp(u);
  return { at: (x: number, y: number) => add(A, add(mul(u, x), mul(n, y))), len: dist(A, B) };
}

export const v3 = (x: number, y: number, z: number): V => v(x, y, z);

/** Area of a planar polygon in space. */
export function area3(ps: V[]): number {
  let s = v(0, 0, 0);
  for (let i = 0; i < ps.length; i++) s = add(s, cross(ps[i], ps[(i + 1) % ps.length]));
  return len(s) / 2;
}

/** Distance from p to the plane through a, b, c. */
export function planeDist(p: V, a: V, b: V, c: V): number {
  const n = cross(sub(b, a), sub(c, a));
  return Math.abs(dot(sub(p, a), n)) / len(n);
}

/** All pairs of points at the least distance among them: the edges of a regular solid. */
export function edgesOf(ps: V[]): [number, number][] {
  let d = Infinity;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) d = Math.min(d, dist(ps[i], ps[j]));
  const out: [number, number][] = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (dist(ps[i], ps[j]) < d * (1 + 1e-6)) out.push([i, j]);
  return out;
}

/**
 * Checks of a solid inscribed in a sphere: every vertex on the sphere, every edge equal (to the
 * first), and the expected number of edges.
 */
export function checkSolid(g: G, name: string, ps: V[], edges: [number, number][], centre: V, radius: number, nEdges: number): number {
  g.claim(`all ${ps.length} vertices of the ${name} lie on the sphere`, ps.every((p) => Math.abs(dist(p, centre) - radius) < 1e-9 * Math.max(1, radius)));
  const e0 = dist(ps[edges[0][0]], ps[edges[0][1]]);
  g.claim(`all ${nEdges} edges are equal`, edges.length === nEdges && edges.every(([i, j]) => Math.abs(dist(ps[i], ps[j]) - e0) < 1e-9 * Math.max(1, e0)));
  return e0;
}

/** The faces of a convex solid whose faces are the regular polygons through the given edges: found as the planes that leave every vertex on one side. */
export function hullFaces(ps: V[]): number[][] {
  const faces: number[][] = [];
  const seen = new Set<string>();
  const c = mul(ps.reduce((s, p) => add(s, p), v(0, 0, 0)), 1 / ps.length);
  const n = ps.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const nn = cross(sub(ps[j], ps[i]), sub(ps[k], ps[i]));
        if (len(nn) < 1e-9) continue;
        const d0 = dot(nn, ps[i]);
        let pos = 0;
        let neg = 0;
        const on: number[] = [];
        for (let m = 0; m < n; m++) {
          const s = dot(nn, ps[m]) - d0;
          if (Math.abs(s) < 1e-7 * len(nn)) on.push(m);
          else if (s > 0) pos++;
          else neg++;
        }
        if (pos && neg) continue;
        const key = on.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        // order the face's vertices around its centre
        const fc = mul(on.reduce((s, m) => add(s, ps[m]), v(0, 0, 0)), 1 / on.length);
        const out = unit(sub(fc, c));
        const e1 = unit(sub(ps[on[0]], fc));
        const e2 = cross(out, e1);
        on.sort((a, b) => Math.atan2(dot(sub(ps[a], fc), e2), dot(sub(ps[a], fc), e1)) - Math.atan2(dot(sub(ps[b], fc), e2), dot(sub(ps[b], fc), e1)));
        faces.push(on);
      }
  return faces;
}

/**
 * The diameter AB of the given sphere set out as a line in space, starting at `left` and running
 * along x, cut at C with AC = frac·AB; the semicircle ADB above it (in the plane y = left.y) with D
 * over C (below AB if dir = -1). Returns the points (named A, B, C, D) and DC, DB, DA.
 */
export function diameter(g: G, left: V, d: number, frac: number, o: { from?: number } = {}, dir: 1 | -1 = 1) {
  const at = (x: number, z: number) => v3(left.x + x, left.y, (left.z ?? 0) + dir * z);
  const A = g.point('A', at(0, 0));
  const B = g.point('B', at(d, 0));
  const C = g.point('C', at(frac * d, 0));
  const h = Math.sqrt(frac * (1 - frac)) * d;
  const D = g.point('D', at(frac * d, h));
  // the semicircle, with D among its vertices so that "the semicircle ADB" finds it
  const tD = Math.atan2(h, frac * d - d / 2);
  const ts = [...Array.from({ length: 49 }, (_, i) => Math.PI - (Math.PI * i) / 48), tD].sort((a, b) => b - a);
  g.curve(
    ts.map((t) => (t === tD ? D : at(d / 2 + (d / 2) * Math.cos(t), (d / 2) * Math.sin(t)))),
    { ...o },
  );
  g.segment(A, B, o);
  g.segment(C, D, { aux: true, ...o });
  return { A, B, C, D, at, DC: h, DB: dist(D, B), DA: dist(D, A) };
}
