// Helpers for Book IX: numbers are rods.
//
// Two kinds of rod are used.
//
// - `Rods` (as in Book VII): a number n is a rod of n units, all rods of a figure to one scale, the
//   longest `width` long. A number named by one letter is a rod whose left end is the point of that
//   letter and which carries `name: letter`; a number named by two letters is the segment between
//   two named points.
// - `LogRods`: for the continued proportions of IX.1–13, whose terms grow like a^k and cannot share a
//   linear scale. A number n is drawn with length proportional to log n, cut at its prime factors, so
//   that a product is drawn as the two factors laid end to end and a continued proportion
//   1, a, a², a³, … becomes a staircase of equal steps. The actual value is written at the right end.
//
// The scale is chosen from the largest number of the current configuration, so the figure keeps the
// same size whatever the sliders say (the view box is fixed when the figure is first drawn).

import type { G, P, Style } from '../../geometry/figure';
import { v, type V } from '../../geometry/vec';

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const lcmAll = (...xs: number[]): number => xs.reduce(lcm);
export const divides = (a: number, b: number): boolean => b % a === 0;
export const isEven = (n: number): boolean => n % 2 === 0;
export const isOdd = (n: number): boolean => n % 2 === 1;

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

export const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

/** The least prime dividing n (n ≥ 2). */
export function leastPrimeFactor(n: number): number {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
}

/** The prime factors of n with multiplicity, ascending: 12 → [2, 2, 3]. */
export function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let d = 2; d * d <= m; d++)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  if (m > 1) out.push(m);
  return out;
}

/** The distinct primes dividing n. */
export const primeDivisors = (n: number): number[] => [...new Set(primeFactors(n))];

/** All divisors of n, ascending (including 1 and n). */
export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

/** Euclid's "parts" of n: the divisors less than n (the unit included). */
export const parts = (n: number): number[] => divisors(n).filter((d) => d < n);

const iroot = (n: number, k: number): number => {
  const r = Math.round(Math.pow(n, 1 / k));
  for (const c of [r - 1, r, r + 1]) if (c >= 0 && Math.pow(c, k) === n) return c;
  return NaN;
};
export const sqrtInt = (n: number): number => iroot(n, 2);
export const cbrtInt = (n: number): number => iroot(n, 3);
export const isSquare = (n: number): boolean => !Number.isNaN(sqrtInt(n));
export const isCube = (n: number): boolean => !Number.isNaN(cbrtInt(n));

/**
 * Sides showing that a and b are similar plane numbers (VII Def. 21): a = x·y, b = u·w with every
 * side a number (≥ 2) and x : y = u : w. Null if there are none.
 */
export function similarPlaneSides(a: number, b: number): [number, number, number, number] | null {
  for (let x = 2; x * x <= a; x++) {
    if (a % x) continue;
    const y = a / x;
    for (let u = 2; u * u <= b; u++) {
      if (b % u) continue;
      const w = b / u;
      if (x * w === y * u) return [x, y, u, w];
    }
  }
  return null;
}

/** The least m ≥ k with gcd(m, n) = 1: turns a slider value into a number prime to n. */
export function primeTo(n: number, k: number): number {
  let m = Math.max(1, k);
  while (gcd(m, n) !== 1) m++;
  return m;
}

/** a : b in lowest terms, as text. */
export function ratio(a: number, b: number): string {
  const d = gcd(a, b);
  return `${a / d} : ${b / d}`;
}

export interface RodOpts extends Style {
  /** Draw the unit marks (default: yes, unless the rod is too long for them to be legible). */
  ticks?: boolean;
  /** Label directions (degrees) of the two ends of a rod named by its ends. */
  dirs?: [number, number];
}

function styleOf(o: RodOpts): Style {
  const { ticks, dirs, ...rest } = o;
  void ticks;
  void dirs;
  return rest;
}

/** Rods drawn to a common scale: the longest number is `width` long. */
export class Rods {
  readonly u: number;
  readonly g: G;
  constructor(g: G, longest: number, width = 10) {
    this.g = g;
    this.u = width / Math.max(1, longest);
  }

  private tickOpt(n: number, o: RodOpts): { ticks?: number } {
    const want = o.ticks ?? true;
    return want && this.u >= 0.055 && n <= 150 ? { ticks: this.u } : {};
  }

  /** A number named by one letter: a rod of n units from (x, y), labelled at its left end. */
  num(name: string, n: number, x: number, y: number, o: RodOpts = {}): { a: P; b: V } {
    const a = this.g.point(name, v(x, y), { labelDir: 180, from: o.from });
    const b = v(x + n * this.u, y);
    this.g.segment(a, b, { name, ...this.tickOpt(n, o), ...styleOf(o) });
    return { a, b };
  }

  /** A number named by its ends: the rod AB of n units from (x, y). */
  seg(an: string, bn: string, n: number, x: number, y: number, o: RodOpts = {}): { a: P; b: P } {
    const a = this.g.point(an, v(x, y), { labelDir: o.dirs?.[0] ?? 180 });
    const b = this.g.point(bn, v(x + n * this.u, y), { labelDir: o.dirs?.[1] ?? 0 });
    this.g.segment(a, b, { ...this.tickOpt(n, o), ...styleOf(o) });
    return { a, b };
  }

  /** A point on a rod starting at (x, y), k units along it, labelled above (or below). */
  mark(name: string, x: number, y: number, k: number, o: { hidden?: boolean; from?: number; below?: boolean; dir?: number } = {}): P {
    return this.g.point(name, v(x + k * this.u, y), { labelDir: o.dir ?? (o.below ? 270 : 90), hidden: o.hidden, from: o.from });
  }

  /** Taller marks on a rod every `size` units: how a product is made of copies of a number. */
  groups(x: number, y: number, size: number, count: number, from?: number): void {
    for (let i = 1; i < count; i++) {
      const px = x + i * size * this.u;
      this.g.segment(v(px, y - 0.2), v(px, y + 0.2), { aux: true, from });
    }
  }

  /** A plain rod with no named points (a remainder, a sum), with a text label on its right. */
  bare(n: number, x: number, y: number, text?: string, o: RodOpts = {}): void {
    this.g.segment(v(x, y), v(x + n * this.u, y), { ...this.tickOpt(n, o), ...styleOf(o) });
    if (text) this.g.text(v(x + n * this.u + 0.25, y - 0.1), text, { from: o.from });
  }

  /** The value of a rod written at its right end. */
  value(n: number, x: number, y: number, from?: number): void {
    this.g.text(v(x + n * this.u + 0.25, y - 0.1), String(n), { from });
  }

  x(k: number): number {
    return k * this.u;
  }
}

/**
 * Rods on a logarithmic scale: n is drawn log n long, cut into its prime factors, with its value on
 * the right. The largest number is `width` long.
 */
export class LogRods {
  readonly u: number;
  readonly g: G;
  constructor(g: G, largest: number, width = 10) {
    this.g = g;
    this.u = width / Math.log(Math.max(2, largest));
  }

  len(n: number): number {
    return this.u * Math.log(n);
  }

  /**
   * A number named by one letter, from (x, y). The unit (n = 1) is a point. Non-integers are allowed
   * for the impossible numbers of a reductio (draw them dashed): they are not cut into factors.
   */
  num(name: string, n: number, x: number, y: number, o: Style & { value?: string | false } = {}): { a: P; b: V } {
    const { value, ...style } = o;
    const a = this.g.point(name, v(x, y), { labelDir: 180, from: o.from });
    const b = v(x + this.len(n), y);
    if (n > 1) {
      this.g.segment(a, b, { name, ...style });
      if (Number.isInteger(n)) this.factorMarks(n, x, y, o.from);
    }
    if (value !== false) this.g.text(v(b.x + 0.25, y - 0.1), value ?? (Number.isInteger(n) ? String(n) : '?'), { from: o.from });
    return { a, b };
  }

  /** Marks between the prime factors of n on a rod starting at (x, y). */
  factorMarks(n: number, x: number, y: number, from?: number): void {
    const fs = primeFactors(n);
    let acc = 0;
    for (let i = 0; i + 1 < fs.length; i++) {
      acc += Math.log(fs[i]);
      const px = x + this.u * acc;
      this.g.segment(v(px, y - 0.18), v(px, y + 0.18), { aux: true, from });
    }
  }
}
