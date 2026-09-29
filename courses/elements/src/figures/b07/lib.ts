// Helpers for the arithmetical books: numbers are rods of units.
//
// A number named by one letter ("the number A") is a rod whose left end is a point with that
// letter, so that the label is drawn at the rod and appears in the step-through when the text first
// names it; the rod itself carries `name: 'A'`, so "A" resolves to the rod. A number named by two
// letters ("the number AB") is the segment between two named points.
//
// The scale is chosen from the longest rod of the current configuration, so the figure keeps the
// same size whatever the sliders say (the view box is fixed when the figure is first drawn).

import type { G, P, Style } from '../../geometry/figure';
import { v, type V } from '../../geometry/vec';

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const gcdAll = (...xs: number[]): number => xs.reduce(gcd);
export const lcmAll = (...xs: number[]): number => xs.reduce(lcm);
export const divides = (a: number, b: number): boolean => b % a === 0;

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

/** The least m ≥ k with gcd(m, n) = 1: turns a slider value into a number prime to n. */
export function primeTo(n: number, k: number): number {
  let m = Math.max(1, k);
  while (gcd(m, n) !== 1) m++;
  return m;
}

/** The least m ≥ k that n does not divide. */
export function notMultipleOf(n: number, k: number): number {
  let m = Math.max(1, k);
  while (m % n === 0) m++;
  return m;
}

/** a : b in lowest terms, as text. */
export function ratio(a: number, b: number): string {
  const d = gcd(a, b);
  return `${a / d} : ${b / d}`;
}

/** The least common multiple found by brute force: the least n ≥ 1 measured by every x. */
export function leastMeasured(...xs: number[]): number {
  for (let n = 1; ; n++) if (xs.every((x) => n % x === 0)) return n;
}

/** True if some pair (c, d) with c < a is in the ratio a : b (so a, b are not the least). */
export function smallerPairInRatio(a: number, b: number): boolean {
  for (let c = 1; c < a; c++) if ((c * b) % a === 0) return true;
  return false;
}

export interface RodOpts extends Style {
  /** Draw the unit marks (default: yes, unless the rod is too long for them to be legible). */
  ticks?: boolean;
  /** Label directions (degrees) of the two ends of a rod named by its ends. */
  dirs?: [number, number];
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

  private style(o: RodOpts): Style {
    const { ticks, dirs, ...rest } = o;
    void ticks;
    void dirs;
    return rest;
  }

  /** A number named by one letter: a rod of n units from (x, y), labelled at its left end. */
  num(name: string, n: number, x: number, y: number, o: RodOpts = {}): { a: P; b: V } {
    const a = this.g.point(name, v(x, y), { labelDir: 180, from: o.from });
    const b = v(x + n * this.u, y);
    this.g.segment(a, b, { name, ...this.tickOpt(n, o), ...this.style(o) });
    return { a, b };
  }

  /** A number named by its ends: the rod AB of n units from (x, y). */
  seg(an: string, bn: string, n: number, x: number, y: number, o: RodOpts = {}): { a: P; b: P } {
    const a = this.g.point(an, v(x, y), { labelDir: o.dirs?.[0] ?? 180 });
    const b = this.g.point(bn, v(x + n * this.u, y), { labelDir: o.dirs?.[1] ?? 0 });
    this.g.segment(a, b, { ...this.tickOpt(n, o), ...this.style(o) });
    return { a, b };
  }

  /** A point on a rod starting at (x, y), k units along it, labelled above. */
  mark(name: string, x: number, y: number, k: number, o: { hidden?: boolean; from?: number; below?: boolean } = {}): P {
    return this.g.point(name, v(x + k * this.u, y), { labelDir: o.below ? 270 : 90, hidden: o.hidden, from: o.from });
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
    this.g.segment(v(x, y), v(x + n * this.u, y), { ...this.tickOpt(n, o), ...this.style(o) });
    if (text) this.g.text(v(x + n * this.u + 0.25, y - 0.1), text, { from: o.from });
  }

  x(k: number): number {
    return k * this.u;
  }
}
