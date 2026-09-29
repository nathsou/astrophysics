// Book V draws magnitudes as rods (horizontal segments), as Heath's diagrams do. A figure lists its
// rods row by row with their true (raw) lengths; `rods` scales everything by one common factor so
// that the longest row always fills the same width. The figure keeps its size while the reader
// moves the sliders, and only the proportions change, which is what Book V is about.

import type { G, Style } from '../../geometry/figure';
import { v, type V } from '../../geometry/vec';

export interface Rod {
  /** A magnitude named by a single letter (A, B, …): drawn with a text label on its left. */
  name?: string;
  /** Or a magnitude named by its points: pts[0] at the start, then one point after each part. */
  pts?: string[];
  /** Lengths of the parts between consecutive points (or the single length of a named rod). */
  parts: number[];
  /** Draw tick marks every `unit` (raw length): a multiple shows its copies of the part. */
  unit?: number;
  /** Space left empty before the rod (raw length). */
  pre?: number;
  /** Points that exist to be named but are not labelled. */
  hide?: string[];
  /** Label direction for the rod's points (default: above). */
  labelDir?: number;
  style?: Style;
}

export const WIDTH = 10;

/** Three-way comparison with a relative tolerance: 1 if x > y, 0 if equal, −1 if x < y. */
export function cmp(x: number, y: number, tol = 1e-9): -1 | 0 | 1 {
  if (Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y))) return 0;
  return x > y ? 1 : -1;
}

export const sym = (c: -1 | 0 | 1) => (c > 0 ? '>' : c < 0 ? '<' : '=');

/**
 * Two comparisons agree: "if the first exceeds, the second exceeds; if equal, equal; if less, less".
 * `alike(g, 'K', 'M', [k, m], 'L', 'N', [l, n])` claims "K > M and L > N" (or = and =, or < and <).
 */
export function alike(g: G, p: string, q: string, a: [number, number], r: string, t: string, b: [number, number]): boolean {
  const c1 = cmp(a[0], a[1]);
  const c2 = cmp(b[0], b[1]);
  return g.claim(`${p} ${sym(c1)} ${q} and ${r} ${sym(c2)} ${t}: alike`, c1 === c2);
}

/**
 * Draws rows of rods. Row i is at height (rows.length − 1 − i)·dy, so the first row is on top.
 * Rods in a row are laid out left to right with a gap between them. Returns the scale factor.
 */
export function rods(g: G, rows: Rod[][], o: { width?: number; dy?: number; gap?: number } = {}): number {
  const width = o.width ?? WIDTH;
  const dy = o.dy ?? 1;
  const gap = o.gap ?? 1.2;
  const total = (r: Rod) => (r.pre ?? 0) + r.parts.reduce((t, x) => t + x, 0);
  // rods in the same column start at the same x
  const cols = Math.max(...rows.map((r) => r.length));
  const colMax = Array.from({ length: cols }, (_, j) => Math.max(0, ...rows.map((r) => (r[j] ? total(r[j]) : 0))));
  const s = (width - gap * (cols - 1)) / colMax.reduce((t, x) => t + x, 0);
  const colX = colMax.map((_, j) => colMax.slice(0, j).reduce((t, x) => t + x * s + gap, 0));
  rows.forEach((row, i) => {
    const y = (rows.length - 1 - i) * dy;
    row.forEach((r, j) => {
      const start = colX[j] + (r.pre ?? 0) * s;
      const len = r.parts.reduce((t, p) => t + p, 0) * s;
      const tick = r.unit ? { ticks: r.unit * s } : {};
      if (r.pts) {
        let at = start;
        const ps: V[] = [g.point(r.pts[0], v(at, y), { labelDir: r.labelDir ?? 90, hidden: r.hide?.includes(r.pts[0]) })];
        r.parts.forEach((p, k) => {
          at += p * s;
          ps.push(g.point(r.pts![k + 1], v(at, y), { labelDir: r.labelDir ?? 90, hidden: r.hide?.includes(r.pts![k + 1]) }));
        });
        g.segment(ps[0], ps[ps.length - 1], { ...tick, ...r.style });
      } else if (r.name) {
        rod(g, r.name, v(start, y), v(start + len, y), { ...tick, ...r.style });
      }
    });
  });
  return s;
}

/**
 * A magnitude named by a letter: a segment from a to b with `name`. Its start is a point with the
 * same name, labelled on the left; the text's "the magnitude A" resolves to the segment.
 */
export function rod(g: G, name: string, a: V, b: V, s: Style & { ticks?: number } = {}): void {
  const p = g.point(name, a, { labelDir: 180 });
  g.segment(p, b, { ...s, name });
}

/**
 * Integers m, n with m·x > n·y and m·z ≤ n·w: the witness of Def. 7 that x : y > z : w.
 * Exists when x/y > z/w; returns null if none is found with m ≤ limit.
 */
export function witness(x: number, y: number, z: number, w: number, limit = 10000): [number, number] | null {
  for (let m = 1; m <= limit; m++) {
    // the least n with n·w ≥ m·z
    let n = Math.max(1, Math.ceil((m * z) / w - 1e-12));
    if (cmp(n * w, m * z) < 0) n++;
    if (cmp(m * x, n * y) > 0) return [m, n];
  }
  return null;
}
