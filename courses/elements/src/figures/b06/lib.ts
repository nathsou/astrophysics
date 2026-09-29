// Helpers shared by the figures of Book VI (similarity and proportion).

import type { G } from '../../geometry/figure';
import { add, angle, area, cross2, dist, mul, sub, v, type V } from '../../geometry/vec';

/** The direct similarity (rotation + scaling + translation) taking a0 → a1 and b0 → b1, as a map of points. */
export function simMap(a0: V, b0: V, a1: V, b1: V): (p: V) => V {
  const d0 = sub(b0, a0);
  const d1 = sub(b1, a1);
  const n = d0.x * d0.x + d0.y * d0.y;
  // complex quotient d1 / d0
  const re = (d1.x * d0.x + d1.y * d0.y) / n;
  const im = (d1.y * d0.x - d1.x * d0.y) / n;
  return (p: V) => {
    const q = sub(p, a0);
    return add(a1, v(re * q.x - im * q.y, re * q.y + im * q.x));
  };
}

/** The fourth vertex D of the parallelogram ABCD (B and D opposite): D = A + C − B. */
export const fourth = (a: V, b: V, c: V): V => add(a, sub(c, b));

/** The dilation of p about centre c by factor k. */
export const dilate = (p: V, c: V, k: number): V => add(c, mul(sub(p, c), k));

/** A magnitude drawn as a rod from `at` to the right with length `l`, named `name` for the text, with its letter beside it. */
export function rod(g: G, name: string, at: V, l: number, o: { colour?: 'red' | 'blue' | 'yellow' | 'black'; dashed?: boolean; label?: string } = {}): [V, V] {
  const b = v(at.x + l, at.y);
  g.segment(at, b, { name, colour: o.colour, dashed: o.dashed });
  g.text(v(at.x - 0.28, at.y - 0.08), o.label ?? name);
  return [at, b];
}

/** True if the two polygons (listed in corresponding order) are similar: equal angles, proportional sides. */
export function similar(p: V[], q: V[], tol = 1e-6): boolean {
  const n = p.length;
  if (q.length !== n) return false;
  const k = dist(q[0], q[1]) / dist(p[0], p[1]);
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    const a2 = q[(i + n - 1) % n];
    const b2 = q[i];
    const c2 = q[(i + 1) % n];
    if (Math.abs(angle(a, b, c) - angle(a2, b2, c2)) > tol * 10) return false;
    if (Math.abs(dist(b2, c2) - k * dist(b, c)) > tol * Math.max(1, k * dist(b, c)) * 10) return false;
  }
  return true;
}

export { angle, area, cross2 };
