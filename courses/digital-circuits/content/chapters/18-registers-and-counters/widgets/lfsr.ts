/**
 * Linear-feedback shift registers: the state graph of an n-bit register whose new bit is the XOR of some of its
 * bits (the taps), and which taps give the longest cycle.
 *
 * The convention is the parts bin's (`src/lib/partsbin/refs.ts`): the register shifts left, and
 * `next = ((s << 1) | parity(s & taps)) & mask`. The top bit is always tapped, so the map from a state to the next
 * is a permutation and the state graph is a set of separate cycles; the all-zero state is a cycle of length one.
 */

export const parity = (x: number): number => {
  let p = 0;
  for (; x; x &= x - 1) p ^= 1;
  return p;
};

export const mask = (n: number): number => (1 << n) - 1;

export function next(s: number, n: number, taps: number): number {
  return ((s << 1) | parity(s & taps)) & mask(n);
}

/** Every cycle of the state graph, longest first, each listed from its smallest state. */
export function cycles(n: number, taps: number): number[][] {
  const seen = new Uint8Array(1 << n);
  const out: number[][] = [];
  for (let s0 = 0; s0 < 1 << n; s0++) {
    if (seen[s0]) continue;
    const cyc: number[] = [];
    for (let s = s0; !seen[s]; s = next(s, n, taps)) {
      seen[s] = 1;
      cyc.push(s);
    }
    out.push(cyc);
  }
  return out.sort((a, b) => b.length - a.length || a[0]! - b[0]!);
}

/** True when the register, started at 00…01, visits every non-zero state before it repeats. */
export function isMaximal(n: number, taps: number): boolean {
  let s = next(1, n, taps);
  let steps = 1;
  while (s !== 1 && steps <= 1 << n) {
    s = next(s, n, taps);
    steps++;
  }
  return s === 1 && steps === (1 << n) - 1;
}

/** The smallest tap mask (top bit set) that gives a maximal-length sequence. */
export function maximalTaps(n: number): number {
  for (let t = 1 << (n - 1); t < 1 << n; t++) if (isMaximal(n, t)) return t;
  throw new Error(`no maximal taps for ${n} bits`);
}

/** Every tap mask (top bit set) that gives a maximal-length sequence. */
export function allMaximal(n: number): number[] {
  const out: number[] = [];
  for (let t = 1 << (n - 1); t < 1 << n; t++) if (isMaximal(n, t)) out.push(t);
  return out;
}

/** The first tap mask with the top bit set that is not maximal (for a counter-example). */
export function firstPoor(n: number): number {
  for (let t = 1 << (n - 1); t < 1 << n; t++) if (!isMaximal(n, t) && t !== (1 << (n - 1))) return t;
  return 1 << (n - 1);
}

/** The bit shifted out at the top, for `count` steps from `start`: the pseudo-random output stream. */
export function stream(n: number, taps: number, start: number, count: number): number[] {
  const out: number[] = [];
  let s = start;
  for (let i = 0; i < count; i++) {
    out.push((s >> (n - 1)) & 1);
    s = next(s, n, taps);
  }
  return out;
}

/** The polynomial of a tap mask, written as text: taps at bits 7, 5, 4, 3 of 8 make x⁸ + x⁶ + x⁵ + x⁴ + 1. */
export function polynomial(n: number, taps: number): string {
  const sup = (k: number) => String(k).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
  const terms: string[] = [`x${sup(n)}`];
  for (let i = n - 2; i >= 0; i--) if ((taps >> i) & 1) terms.push(i + 1 === 1 ? 'x' : `x${sup(i + 1)}`);
  terms.push('1');
  return terms.join(' + ');
}

/** Positions of `count` points around a circle of radius `r`, starting at the top, clockwise. */
export function wheel(count: number, cx: number, cy: number, r: number): [number, number][] {
  if (count === 1) return [[cx, cy]];
  return Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

export const bin = (s: number, n: number): string => s.toString(2).padStart(n, '0');
