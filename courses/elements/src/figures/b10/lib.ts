// Helpers for Book X. Lines are rods (as in Book V) and areas are rectangles, usually "applied" to
// a rational line. Lengths are measured against an assigned rational line ρ of length 1, so that
// "rational" means: the square is a rational multiple of ρ², and "medial" means: the square is
// ρ² times the square root of a non-square rational.
//
// Everything here is shared by the three Book X figure sets: add to it, do not change exports.

import type { G, P, Style } from '../../geometry/figure';
import { v, type V } from '../../geometry/vec';

// ------------------------------------------------------------------ integers

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export const isSquare = (n: number): boolean => n >= 0 && Number.isInteger(n) && Math.round(Math.sqrt(n)) ** 2 === n;

/** p : q (positive integers) is the ratio of a square number to a square number. */
export function squareRatio(p: number, q: number): boolean {
  const d = gcd(p, q);
  return isSquare(p / d) && isSquare(q / d);
}

/** The least non-square integer ≥ k: turns a slider value into a non-square. */
export function nonSquare(k: number): number {
  let n = Math.max(2, Math.round(k));
  while (isSquare(n)) n++;
  return n;
}

/** n = out² · inn with inn square-free. */
export function squareFree(n: number): [number, number] {
  let out = 1;
  let inn = n;
  for (let d = 2; d * d <= inn; d++) {
    while (inn % (d * d) === 0) {
      inn /= d * d;
      out *= d;
    }
  }
  return [out, inn];
}

// ------------------------------------------------------------------ exact forms as text

const frac = (n: number, d: number): string => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};

/** √(n/d) simplified, as text: "2√3", "√6/3", "5". */
export function surd(n: number, d = 1): string {
  // √(n/d) = √(n·d)/d
  const [o, i] = squareFree(n * d);
  const g = gcd(o, d);
  const num = o / g;
  const den = d / g;
  const head = i === 1 ? `${num}` : `${num === 1 ? '' : num}√${i}`;
  return den === 1 ? head : `${head}/${den}`;
}

/** ⁴√(n/d) simplified, as text: "⁴√12", "√2", "2·⁴√3". */
export function root4(n: number, d = 1): string {
  // ⁴√(n/d) = ⁴√(n·d³)/d
  let m = n * d ** 3;
  let out = 1;
  for (let p = 2; p ** 4 <= m; p++) {
    while (m % p ** 4 === 0) {
      m /= p ** 4;
      out *= p;
    }
  }
  const g = gcd(out, d);
  const num = out / g;
  const den = d / g;
  let head: string;
  if (m === 1) head = `${num}`;
  else if (isSquare(m)) head = `${num === 1 ? '' : num}√${Math.round(Math.sqrt(m))}`;
  else head = `${num === 1 ? '' : num + '·'}⁴√${m}`;
  return den === 1 ? head : `${head}/${den}`;
}

export { frac };

/** A number to 3 decimals, for readouts. */
export const f3 = (x: number) => x.toFixed(3);

// ------------------------------------------------------------------ drawing

/**
 * Lines and rectangles drawn to one scale `u` (figure units per unit of length). Points are
 * created once: asking again for a name returns the existing point, so rectangles can share
 * corners.
 */
export class Lines {
  readonly g: G;
  readonly u: number;
  constructor(g: G, u: number) {
    this.g = g;
    this.u = u;
  }

  /** Scale so that `longest` (a raw length) is `width` long. */
  static fit(g: G, longest: number, width = 10): Lines {
    return new Lines(g, width / Math.max(1e-9, longest));
  }

  /** A named point (created once). */
  pt(name: string, p: V, o: { labelDir?: number; hidden?: boolean; from?: number } = {}): P {
    const have = this.g.scene.points.get(name);
    if (have) return Object.assign({ x: have.p.x, y: have.p.y }, { n: name }) as P;
    return this.g.point(name, p, o);
  }

  /**
   * A magnitude named by one letter (as in Book V): its left end is a point with that letter,
   * labelled on the left, and the segment carries `name`. With `label: 'text'` no point is made
   * and the letter is written above the rod (when the letter is also a point of the figure).
   */
  mag(name: string, len: number, x: number, y: number, o: Style & { ticks?: number; label?: 'point' | 'text' } = {}): [V, V] {
    const { label, ticks, ...s } = o;
    const a = label === 'text' ? v(x, y) : this.g.point(name, v(x, y), { labelDir: 180, from: s.from });
    const b = v(x + len * this.u, y);
    const t = ticks ? { ticks: ticks * this.u } : {};
    this.g.segment(a, b, { ...s, ...t, name, ...(label === 'text' ? { text: name } : {}) });
    return [a, b];
  }

  /**
   * A line named by its points: names[0] at (x, y), then one point after each part. Returns the
   * points. `hide` lists names that exist only to be named; `below` puts the labels underneath.
   */
  row(names: string[], parts: number[], x: number, y: number, o: { below?: boolean; hide?: string[]; style?: Style & { ticks?: number }; dirs?: Record<string, number> } = {}): P[] {
    let at = x;
    const dir = (n: string) => o.dirs?.[n] ?? (o.below ? 270 : 90);
    const ps: P[] = [this.pt(names[0], v(at, y), { labelDir: dir(names[0]), hidden: o.hide?.includes(names[0]) })];
    parts.forEach((p, k) => {
      at += p * this.u;
      ps.push(this.pt(names[k + 1], v(at, y), { labelDir: dir(names[k + 1]), hidden: o.hide?.includes(names[k + 1]) }));
    });
    this.g.segment(ps[0], ps[ps.length - 1], o.style ?? {});
    return ps;
  }

  /** An unnamed rod with a text label above it. */
  bare(len: number, x: number, y: number, text?: string, s: Style = {}): [V, V] {
    const a = v(x, y);
    const b = v(x + len * this.u, y);
    this.g.segment(a, b, { ...s, ...(text ? { text } : {}) });
    return [a, b];
  }

  /**
   * A rectangle with its lower-left corner at (x, y), width w and height h (all raw lengths,
   * scaled by u).
   * Corners are named counter-clockwise from the lower left; null leaves a corner unnamed, and a
   * name starting with '~' is a hidden point (so that "the rectangle AC" finds the polygon by its
   * diagonal without a fourth label in the figure).
   */
  rect(names: (string | null)[], x: number, y: number, w: number, h: number, s: Style = {}, dirs: (number | undefined)[] = [225, 315, 45, 135]): V[] {
    const u = this.u;
    const cs = [v(x * u, y * u), v((x + w) * u, y * u), v((x + w) * u, (y + h) * u), v(x * u, (y + h) * u)];
    const ps = cs.map((c, i) => (names[i] ? this.pt(names[i]!, c, { labelDir: dirs[i], hidden: names[i]!.startsWith('~') }) : c));
    this.g.polygon(ps, s);
    return ps;
  }

  x(k: number): number {
    return k * this.u;
  }
}

/** The continued fraction of √n (n not a square): [a0; a1, a2, …], computed exactly in integers. */
export function cfSqrt(n: number, terms: number): number[] {
  const a0 = Math.floor(Math.sqrt(n));
  const out = [a0];
  let m = 0;
  let d = 1;
  let a = a0;
  while (out.length < terms) {
    m = d * a - m;
    d = (n - m * m) / d;
    a = Math.floor((a0 + m) / d);
    out.push(a);
  }
  return out;
}

/** The convergents p/q of the continued fraction [a0; a1, …]. */
export function convergents(cf: number[]): [number, number][] {
  const out: [number, number][] = [];
  let [p0, q0, p1, q1] = [1, 0, cf[0], 1];
  out.push([p1, q1]);
  for (const a of cf.slice(1)) {
    [p0, q0, p1, q1] = [p1, q1, a * p1 + p0, a * q1 + q0];
    out.push([p1, q1]);
  }
  return out;
}

/** Numeric test: some multiple m·(x : y) with m ≤ limit is (within 1e-9) a whole number. */
export function looksCommensurable(x: number, y: number, limit = 200): boolean {
  for (let m = 1; m <= limit; m++) if (Math.abs((m * x) / y - Math.round((m * x) / y)) < 1e-9) return true;
  return false;
}

/**
 * X.17–18 (and later uses): BC with a rectangle BD·DC applied to it, falling short by the square
 * on DC. E bisects BC and EF = DE, so BF = DC and DF = BD − DC. Draws the line B F E D C at
 * height y, the applied rectangle and the square above it; returns the points.
 */
export function deficientApplication(L: Lines, bd: number, dc: number, y: number) {
  const bc = bd + dc;
  const [B, F, E, D, C] = L.row(['B', 'F', 'E', 'D', 'C'], [dc, bc / 2 - dc, bd - bc / 2, dc], 0, y, { below: true });
  L.rect([null, null, null, null], 0, y / L.u, bd, dc, { fill: true, aux: true });
  L.rect([null, null, null, null], bd, y / L.u, dc, dc, { dashed: true, aux: true });
  return { B, F, E, D, C };
}

/**
 * X.33–35: on the diameter AB (A at the origin, B to the right) a semicircle; BC drawn down from B
 * with midpoint `half`; the rectangle AE·EB = (BC/2)² applied to AB falling short by a square, `foot`
 * its dividing point, and `top` the point of the semicircle above it. Names are [A, B, C, half,
 * foot, top]. Needs BC < AB. Returns the points and the lengths of the two chords.
 */
export function semicircleSplit(L: Lines, ab: number, bc: number, names: [string, string, string, string, string, string]) {
  const [nA, nB, nC, nHalf, nFoot, nTop] = names;
  const ae = (ab + Math.sqrt(ab * ab - bc * bc)) / 2;
  const A = L.pt(nA, v(0, 0), { labelDir: 180 });
  const B = L.pt(nB, v(L.x(ab), 0), { labelDir: 0 });
  const C = L.pt(nC, v(L.x(ab), -L.x(bc)), { labelDir: 0 });
  const H = L.pt(nHalf, v(L.x(ab), -L.x(bc / 2)), { labelDir: 0 });
  const Ft = L.pt(nFoot, v(L.x(ae), 0), { labelDir: 270 });
  const T = L.pt(nTop, v(L.x(ae), L.x(Math.sqrt(ae * (ab - ae)))), { labelDir: 90 });
  L.g.arc(v(L.x(ab / 2), 0), B, A, { aux: true });
  L.g.segment(A, B);
  L.g.segment(B, C);
  L.g.segment(Ft, T);
  L.g.segment(A, T);
  L.g.segment(T, B);
  L.g.angle(A, Ft, T, { right: true });
  const d = (P: V, Q: V) => Math.hypot(P.x - Q.x, P.y - Q.y) / L.u;
  return { A, B, C, H, Ft, T, ae, eb: ab - ae, at: d(A, T), tb: d(T, B), ft: d(Ft, T) };
}

/**
 * The order (1–6) of the binomial √a + √b or the apotome √a − √b (a > b > 0 rational, a : b not a
 * ratio of squares), following X. Deff. II and III: orders 1–3 when √(a − b) is commensurable in
 * length with √a, 4–6 otherwise; then 1, 4 when the greater term √a is commensurable in length with
 * the rational line ρ = 1, 2, 5 when the lesser term √b is, and 3, 6 when neither is.
 * a, b are given as fractions [numerator, denominator] of positive integers.
 */
export function binomialOrder(a: [number, number], b: [number, number]): number {
  const sq = ([n, d]: [number, number]) => isSquare(n / gcd(n, d)) && isSquare(d / gcd(n, d));
  // (a − b)/a
  const diff: [number, number] = [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
  const ratio: [number, number] = [diff[0] * a[1], diff[1] * a[0]];
  const comm = sq(ratio);
  const k = sq(a) ? 1 : sq(b) ? 2 : 3;
  return comm ? k : k + 3;
}

/**
 * Proposition II.4 below a line A—B—C: the square on AC (from the point `at`, downwards) cut into
 * the squares on AB and BC and two rectangles AB·BC. Unnamed; returns nothing.
 */
export function sumSquare(L: Lines, ab: number, bc: number, at: V) {
  const ac = ab + bc;
  const P = (x: number, y: number) => v(at.x + L.x(x), at.y - L.x(y));
  const g = L.g;
  g.polygon([P(0, 0), P(ac, 0), P(ac, ac), P(0, ac)], { aux: true });
  g.polygon([P(0, 0), P(ab, 0), P(ab, ab), P(0, ab)], { fill: true, aux: true, text: 'AB²' });
  g.polygon([P(ab, ab), P(ac, ab), P(ac, ac), P(ab, ac)], { fill: true, aux: true, text: 'BC²' });
  g.polygon([P(ab, 0), P(ac, 0), P(ac, ab), P(ab, ab)], { aux: true, text: 'AB·BC' });
  g.polygon([P(0, ab), P(ab, ab), P(ab, ac), P(0, ac)], { aux: true, text: 'AB·BC' });
}
