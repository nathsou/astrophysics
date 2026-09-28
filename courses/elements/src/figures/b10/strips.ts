// Drawing helpers for X.41–84: areas applied to a rational line, and the square of X.54–59.

import type { G, P, Style } from '../../geometry/figure';
import { v } from '../../geometry/vec';
import type { Lines } from './lib';

/**
 * Rectangles applied to a rational line of (raw) height h, standing at x with its foot at y.
 * `top[i]` and `bottom[i]` are the ends of the i-th vertical (null: unnamed); the widths are the
 * raw breadths between consecutive verticals. `rects` lists the rectangles the text names, as
 * pairs of vertical indices; each becomes a polygon whose diagonals are top[i]–bottom[j] and
 * bottom[i]–top[j], so that "the rectangle DF" finds it. Returns the points, top then bottom.
 */
export function strip(
  L: Lines,
  x: number,
  y: number,
  h: number,
  top: (string | null)[],
  bottom: (string | null)[],
  widths: number[],
  rects: [number, number, Style?][] = [],
  o: { verticals?: boolean; style?: Style } = {},
): { top: P[]; bottom: P[] } {
  const g = L.g;
  const xs = [x];
  for (const w of widths) xs.push(xs[xs.length - 1] + L.x(w));
  const yt = y + L.x(h);
  const mk = (n: string | null, px: number, py: number, dir: number): P => (n ? L.pt(n, v(px, py), { labelDir: dir }) : (v(px, py) as P));
  const T = xs.map((px, i) => mk(top[i], px, yt, 90));
  const B = xs.map((px, i) => mk(bottom[i], px, y, 270));
  const s = o.style ?? {};
  g.segment(T[0], T[T.length - 1], s);
  g.segment(B[0], B[B.length - 1], s);
  if (o.verticals !== false) xs.forEach((_, i) => g.segment(T[i], B[i], s));
  for (const [i, j, st] of rects) g.polygon([B[i], B[j], T[j], T[i]], { ...s, ...(st ?? {}) });
  return { top: T, bottom: B };
}

/**
 * The square of the lemma after X.53, as X.54 names it: the squares SN (side a, upper left) and NQ
 * (side c, lower right) with MN in line with NO and PN in line with NR, completed to the square SQ
 * on MO. MR and PO are the two rectangles a·c. N is at (x, y).
 */
export function lemmaSquare(L: Lines, x: number, y: number, a: number, c: number, s: Style = {}): void {
  const g = L.g;
  const A = L.x(a);
  const C = L.x(c);
  const S = L.pt('S', v(x - A, y + A), { labelDir: 135 });
  const Pp = L.pt('P', v(x, y + A), { labelDir: 90 });
  const M = L.pt('M', v(x - A, y), { labelDir: 180 });
  const N = L.pt('N', v(x, y), { labelDir: 45 });
  const O = L.pt('O', v(x + C, y), { labelDir: 0 });
  const R = L.pt('R', v(x, y - C), { labelDir: 270 });
  const Q = L.pt('Q', v(x + C, y - C), { labelDir: 315 });
  const ne = v(x + C, y + A);
  const sw = v(x - A, y - C);
  g.polygon([S, M, N, Pp], s); // the square SN
  g.polygon([N, R, Q, O], s); // the square NQ
  g.polygon([M, sw, R, N], s); // MR
  g.polygon([Pp, N, O, ne], s); // PO
  g.polygon([S, sw, Q, ne], s); // SQ
}
