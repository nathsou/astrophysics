// Other recursions (section "Other Recursions"), reduced to ordinary primitive recursion on
// sequence codes.
//
// Course-of-values recursion:  h(y) = g(y, ⟨h(0), …, h(y − 1)⟩).
//   Put H(y) = ⟨h(0), …, h(y − 1)⟩ (H(0) = ⟨⟩ = 0). Then
//     H(0) = 0,   H(y + 1) = append(H(y), g(y, H(y)))
//   is an ordinary primitive recursion, and h(y) = (H(y + 1))_y.
//
// Simultaneous recursion:  h₀, h₁ with h_i(y + 1) = g_i(y, h₀(y), h₁(y)).
//   Put P(y) = ⟨h₀(y), h₁(y)⟩. Then P(0) = ⟨f₀, f₁⟩, P(y + 1) = ⟨g₀(y, (P(y))₀, (P(y))₁), g₁(…)⟩
//   is an ordinary primitive recursion, and h_i(y) = (P(y))_i.
//
// The step functions g read the history only through the code, by (s)_i; the traces record which
// entries each step read. (The parameters x⃗ of the book's schemas are left out.)

import { encodeSeq, valuation } from '../numbers/nat.ts';
import { nthPrime } from '../numbers/primes.ts';

/** (s)_i: the exponent of p_i in s, minus 1 (0 if p_i does not divide s, as in the book). */
export function element(s: bigint, i: number): bigint {
  if (s === 0n) return 0n;
  const { exponent } = valuation(s, BigInt(nthPrime(i)));
  return exponent === 0n ? 0n : exponent - 1n;
}

/** append(s, a) = s · p_{len(s)}^{a+1} (with ⟨⟩ = 0 and append(0, a) = 2^{a+1}). */
export function append(s: bigint, len: number, a: bigint): bigint {
  const p = BigInt(nthPrime(len)) ** (a + 1n);
  return s === 0n ? p : s * p;
}

// ------------------------------------------------------------------ course-of-values recursion

export interface CovPreset {
  id: string;
  name: string;
  /** the defining equations, in TeX */
  tex: string;
  /** g(y, s) where s = ⟨h(0), …, h(y − 1)⟩; `read(i)` is (s)_i and is recorded in the trace */
  g: (y: bigint, read: (i: number) => bigint) => bigint;
  /** the intended values (for checking) */
  spec: (y: bigint) => bigint;
  /** largest y offered (the codes grow quickly) */
  maxY: number;
}

const fibSpec = (y: bigint): bigint => {
  let a = 0n,
    b = 1n;
  for (let i = 0n; i < y; i++) [a, b] = [b, a + b];
  return a;
};

export const COV_PRESETS: CovPreset[] = [
  {
    id: 'fib',
    name: 'Fibonacci numbers',
    tex: 'h(y) = \\begin{cases} y & \\text{if } y < 2 \\\\ (s)_{y-1} + (s)_{y-2} & \\text{otherwise} \\end{cases} \\quad\\text{where } s = \\langle h(0), \\ldots, h(y-1)\\rangle',
    g: (y, read) => (y < 2n ? y : read(Number(y) - 1) + read(Number(y) - 2)),
    spec: fibSpec,
    maxY: 12,
  },
  {
    id: 'halves',
    name: 'Binary length: h(y) = h(⌊y/2⌋) + 1',
    tex: 'h(y) = \\begin{cases} 0 & \\text{if } y = 0 \\\\ (s)_{\\lfloor y/2 \\rfloor} + 1 & \\text{otherwise} \\end{cases} \\quad\\text{(the value at } k(y) = \\lfloor y/2\\rfloor < y)',
    g: (y, read) => (y === 0n ? 0n : read(Number(y / 2n)) + 1n),
    spec: (y) => BigInt(y === 0n ? 0 : y.toString(2).length),
    maxY: 16,
  },
  {
    id: 'sum',
    name: 'Sum of all earlier values, plus one',
    tex: 'h(y) = 1 + \\sum_{i < y} (s)_i \\qquad (\\text{so } h(y) = 2^y)',
    g: (y, read) => {
      let t = 1n;
      for (let i = 0; i < Number(y); i++) t += read(i);
      return t;
    },
    spec: (y) => 2n ** y,
    maxY: 9,
  },
];

export interface CovRow {
  y: bigint;
  /** H(y) = ⟨h(0), …, h(y − 1)⟩ */
  history: bigint;
  /** the entries (s)_i that g read, with their values */
  reads: { i: number; value: bigint }[];
  /** h(y) = g(y, H(y)) */
  value: bigint;
  /** H(y + 1) = append(H(y), h(y)) */
  next: bigint;
}

/** h(0), …, h(upTo) by course-of-values recursion, carrying the code of the history. */
export function runCourseOfValues(p: CovPreset, upTo: number): CovRow[] {
  const rows: CovRow[] = [];
  let H = 0n;
  for (let y = 0; y <= upTo; y++) {
    const reads: { i: number; value: bigint }[] = [];
    const s = H;
    const read = (i: number) => {
      if (i < 0 || i >= y) throw new RangeError(`the step for y = ${y} may only read (s)_0, …, (s)_${y - 1}`);
      const v = element(s, i);
      reads.push({ i, value: v });
      return v;
    };
    const value = p.g(BigInt(y), read);
    const next = append(H, y, value);
    rows.push({ y: BigInt(y), history: H, reads, value, next });
    H = next;
  }
  return rows;
}

// ------------------------------------------------------------------ simultaneous recursion

export interface SimPreset {
  id: string;
  name: string;
  tex: string;
  f: [bigint, bigint];
  g0: (y: bigint, a: bigint, b: bigint) => bigint;
  g1: (y: bigint, a: bigint, b: bigint) => bigint;
  spec: (y: bigint) => [bigint, bigint];
  maxY: number;
}

export const SIM_PRESETS: SimPreset[] = [
  {
    id: 'parity',
    name: 'Even and odd',
    tex: '\\begin{aligned} h_0(0) &= 1, & h_0(y+1) &= h_1(y) \\\\ h_1(0) &= 0, & h_1(y+1) &= h_0(y) \\end{aligned}',
    f: [1n, 0n],
    g0: (_y, _a, b) => b,
    g1: (_y, a) => a,
    spec: (y) => (y % 2n === 0n ? [1n, 0n] : [0n, 1n]),
    maxY: 12,
  },
  {
    id: 'fibpair',
    name: 'Fibonacci, two at a time',
    tex: '\\begin{aligned} h_0(0) &= 0, & h_0(y+1) &= h_1(y) \\\\ h_1(0) &= 1, & h_1(y+1) &= h_0(y) + h_1(y) \\end{aligned}',
    f: [0n, 1n],
    g0: (_y, _a, b) => b,
    g1: (_y, a, b) => a + b,
    spec: (y) => [fibSpec(y), fibSpec(y + 1n)],
    maxY: 14,
  },
];

export interface SimRow {
  y: bigint;
  h0: bigint;
  h1: bigint;
  /** P(y) = ⟨h₀(y), h₁(y)⟩ */
  code: bigint;
}

export function runSimultaneous(p: SimPreset, upTo: number): SimRow[] {
  const rows: SimRow[] = [];
  let code = encodeSeq(p.f);
  for (let y = 0; y <= upTo; y++) {
    const a = element(code, 0);
    const b = element(code, 1);
    rows.push({ y: BigInt(y), h0: a, h1: b, code });
    code = encodeSeq([p.g0(BigInt(y), a, b), p.g1(BigInt(y), a, b)]);
  }
  return rows;
}
