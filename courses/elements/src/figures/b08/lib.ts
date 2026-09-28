// Helpers for Book VIII: numbers are rods of units, as in Book VII, but the numbers of a continued
// proportion grow fast, so every rod also carries its value, written at its right end.
//
// A number named by one letter ("the number A") is a rod whose left end is a point with that
// letter; the rod carries `name: 'A'`, so "A" resolves to it. The value written at the end of the
// rod appears in the step-through at the paragraph where the text first names the number (the
// table FIRST below, computed from Heath's text).
//
// The scale is chosen from the longest rod of the current configuration, so the figure keeps the
// same size whatever the sliders say (the view box is fixed when the figure is first drawn).

import type { G, P, Style } from '../../geometry/figure';
import { v } from '../../geometry/vec';

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const gcdAll = (...xs: number[]): number => xs.reduce(gcd);
export const divides = (a: number, b: number): boolean => b % a === 0;

/** The least m ≥ k with gcd(m, n) = 1: turns a slider value into a number prime to n. */
export function primeTo(n: number, k: number): number {
  let m = Math.max(1, k);
  while (gcd(m, n) !== 1) m++;
  return m;
}

/** The least m ≥ k that is prime to n and different from it (so a : m is a genuine ratio). */
export function primeToOther(n: number, k: number): number {
  let m = Math.max(1, k);
  while (gcd(m, n) !== 1 || m === n) m++;
  return m;
}

/** a : b in lowest terms, as text. */
export function ratio(a: number, b: number): string {
  const d = gcd(a, b);
  return `${a / d} : ${b / d}`;
}

/** a : b in lowest terms. */
export function lowest(a: number, b: number): [number, number] {
  const d = gcd(a, b);
  return [a / d, b / d];
}

/** a : b = c : d, tested by cross-multiplication. */
export const same = (a: number, b: number, c: number, d: number): boolean => a * d === b * c;

/** The numbers are in continued proportion: each ratio of consecutive terms is the same. */
export function continued(xs: number[]): boolean {
  for (let i = 1; i + 1 < xs.length; i++) if (!same(xs[i - 1], xs[i], xs[i], xs[i + 1])) return false;
  return true;
}

/** The n terms k·aⁿ⁻¹, k·aⁿ⁻²b, …, k·bⁿ⁻¹: a continued proportion in the ratio a : b. */
export function progression(k: number, a: number, b: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => k * a ** (n - 1 - i) * b ** i);
}

/** The integer root, or NaN if n is not a perfect power. */
export function root(n: number, e: number): number {
  const r = Math.round(n ** (1 / e));
  for (const c of [r - 1, r, r + 1]) if (c >= 0 && c ** e === n) return c;
  return NaN;
}
export const isSquare = (n: number): boolean => !Number.isNaN(root(n, 2));
export const isCube = (n: number): boolean => !Number.isNaN(root(n, 3));

/** Several numbers as text: "8, 12, 18, 27". */
export const list = (...xs: number[]): string => xs.join(', ');

/** "yes" or "no". */
export const yn = (b: boolean): string => (b ? 'yes' : 'no');

/** Paragraph of Heath's text where each letter is first named. */
const FIRST: Record<string, Record<string, number>> = {"8.1":{"A":1,"B":1,"C":1,"D":1,"E":2,"F":2,"G":2,"H":2},"8.2":{"A":1,"B":1,"C":2,"D":2,"E":2,"F":2,"G":2,"H":2,"K":2},"8.3":{"A":1,"B":1,"C":1,"D":1,"E":2,"F":2,"G":2,"H":2,"K":2,"L":3,"M":3,"N":3,"O":3},"8.4":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":1,"G":2,"H":3,"K":3,"L":6,"N":10,"O":10,"M":10,"P":10,"Q":24,"R":24,"S":24,"T":24},"8.5":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":1,"G":2,"H":2,"K":2,"L":3},"8.6":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":5,"G":5,"H":5},"8.7":{"A":1,"B":1,"C":1,"D":1},"8.8":{"C":1,"D":1,"A":1,"B":1,"E":1,"F":1,"G":2,"H":2,"K":2,"L":2,"M":7,"N":7},"8.9":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":2,"G":2,"H":2,"K":2,"L":2,"M":3,"N":3,"O":3,"P":3},"8.10":{"D":1,"E":1,"F":1,"G":1,"A":1,"B":1,"C":1,"H":2,"K":2,"L":2},"8.11":{"A":1,"B":1,"C":1,"D":1,"E":2},"8.12":{"A":1,"B":1,"C":1,"D":1,"E":2,"F":2,"G":2,"H":2,"K":2},"8.13":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":1,"G":1,"H":1,"K":1,"L":2,"M":2,"N":2,"O":3,"P":3,"Q":3},"8.14":{"A":1,"B":1,"C":1,"D":1,"E":2},"8.15":{"A":1,"B":1,"C":1,"D":1,"E":2,"G":2,"F":2,"H":2,"K":2},"8.16":{"A":1,"B":1,"C":1,"D":1},"8.17":{"A":1,"B":1,"C":1,"D":1},"8.18":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":1,"G":7},"8.19":{"A":1,"B":1,"C":1,"D":1,"E":1,"F":1,"G":1,"H":1,"K":4,"L":4,"M":6,"N":14,"O":14},"8.20":{"C":1,"A":1,"B":1,"D":2,"E":2,"F":3,"G":5},"8.21":{"C":1,"D":1,"A":1,"B":1,"E":2,"F":2,"G":2,"H":4,"K":4,"L":4,"M":4,"N":8,"O":13},"8.22":{"A":1,"B":1,"C":1},"8.23":{"A":1,"B":1,"C":1,"D":1},"8.24":{"A":1,"B":1,"C":1,"D":1},"8.25":{"A":1,"B":1,"C":1,"D":1,"E":5,"F":5},"8.26":{"A":1,"B":1,"C":3,"D":3,"E":3,"F":3},"8.27":{"A":1,"B":1,"C":3,"D":3,"E":3,"F":3,"G":3,"H":3}};

export interface NumOpts extends Style {
  /** Draw the unit marks (default: yes, unless the rod is too long for them to be legible). */
  ticks?: boolean;
  /** Write the value at the right end (default: yes). A string replaces the value. */
  value?: boolean | string;
}

/** Rods drawn to a common scale: the longest number is `width` long. */
export class Nums {
  readonly u: number;
  readonly g: G;
  readonly id: string;
  constructor(g: G, id: string, longest: number, width = 10) {
    this.g = g;
    this.id = id;
    this.u = width / Math.max(1, longest);
  }

  /** Paragraph where the text first names a letter. */
  first(name: string): number | undefined {
    return FIRST[this.id]?.[name];
  }

  /** A number named by one letter: a rod of n units from (x, y), labelled at its left end, with its value at the right. */
  num(name: string, n: number, x: number, y: number, o: NumOpts = {}): P {
    const { ticks, value, ...style } = o;
    const a = this.g.point(name, v(x, y), { labelDir: 180, from: o.from });
    const end = x + n * this.u;
    const tk = (ticks ?? true) && this.u >= 0.14 && n <= 120 && Number.isInteger(n) ? { ticks: this.u } : {};
    this.g.segment(a, v(end, y), { name, ...tk, ...style });
    if (value !== false) {
      const text = typeof value === 'string' ? value : String(n);
      this.g.text(v(end + 0.18, y - 0.14), text, { from: o.from ?? this.first(name) });
    }
    return a;
  }

  /** Taller marks on a rod every `size` units: how a product is made of copies of a number. */
  groups(x: number, y: number, size: number, count: number, from?: number): void {
    if (count > 40) return;
    for (let i = 1; i < count; i++) {
      const px = x + i * size * this.u;
      this.g.segment(v(px, y - 0.18), v(px, y + 0.18), { aux: true, from });
    }
  }

  /** A plain rod with no letter (a mean the text does not name), with a text label on its right. */
  bare(n: number, x: number, y: number, text: string, o: NumOpts = {}): void {
    const { ticks, value, ...style } = o;
    void value;
    const tk = (ticks ?? true) && this.u >= 0.14 && n <= 120 ? { ticks: this.u } : {};
    this.g.segment(v(x, y), v(x + n * this.u, y), { ...tk, ...style });
    this.g.text(v(x + n * this.u + 0.18, y - 0.14), text, { from: o.from });
  }

  x(k: number): number {
    return k * this.u;
  }
}
