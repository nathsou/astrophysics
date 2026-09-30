/**
 * Gaussian elimination for Appendix B's stepper, in the same form the simulator's LU solver uses
 * (`src/lib/sim/analog/lu.ts`): forward elimination with row swaps, remembering each multiplier, then
 * back substitution. `gaussSteps` records every move so a widget can replay it; the multipliers it
 * collects are the L of the LU factorisation, and what is left is U.
 */

export type Matrix = number[][];

export type StepKind = 'start' | 'swap' | 'eliminate' | 'singular' | 'triangular' | 'back' | 'solved';

export interface Step {
  kind: StepKind;
  text: string;
  /** The augmented matrix [A | b] after this step. */
  m: Matrix;
  /** Rows to highlight. */
  rows: number[];
  /** The pivot (row, column) in play. */
  pivot?: [number, number];
  /** The multiplier of an elimination step. */
  factor?: number;
  /** Unknowns found so far, by back substitution (undefined: not yet). */
  x?: (number | undefined)[];
}

export interface Solution {
  steps: Step[];
  /** The solution, if there is a unique one. */
  x?: number[];
  singular: boolean;
  /** Unit lower triangular: the multipliers. */
  L: Matrix;
  /** Upper triangular: the matrix after forward elimination. */
  U: Matrix;
  /** Row i of P·A is row perm[i] of A. */
  perm: number[];
}

export type PivotRule = 'first-nonzero' | 'largest';

const clone = (m: Matrix): Matrix => m.map((r) => [...r]);

/** Format a number for a matrix cell: up to 4 significant digits, a proper minus sign, no trailing zeros. */
export function fmt(x: number): string {
  if (Object.is(x, -0) || Math.abs(x) < 1e-12) return '0';
  let s = Number(x.toPrecision(4)).toString();
  if (s.includes('e')) s = x.toExponential(2);
  return s.replace('-', '−');
}

const NAMES = ['x', 'y', 'z', 'u', 'v', 'w'];
export const unknownName = (i: number, n: number) => (n <= 3 ? NAMES[i]! : `x${i + 1}`);

export function gaussSteps(A: Matrix, b: number[], rule: PivotRule = 'first-nonzero'): Solution {
  const n = A.length;
  const m: Matrix = A.map((row, i) => [...row, b[i]!]);
  const L: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const perm = Array.from({ length: n }, (_, i) => i);
  const steps: Step[] = [];
  const scale = Math.max(1e-300, ...A.flat().map(Math.abs));
  const eps = 1e-10 * scale;
  steps.push({ kind: 'start', text: `${n} equations in ${n} unknowns. Each row is one equation; the last column is the right-hand side.`, m: clone(m), rows: [] });

  for (let k = 0; k < n; k++) {
    // Choose the pivot.
    let p = k;
    if (rule === 'largest') {
      for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[p]![k]!)) p = i;
    } else {
      while (p < n && Math.abs(m[p]![k]!) <= eps) p++;
      if (p === n) p = k;
    }
    if (Math.abs(m[p]![k]!) <= eps) {
      steps.push({
        kind: 'singular',
        text: `No pivot in column ${k + 1}: every remaining entry is zero. The equations are dependent (some equation adds nothing new) or contradictory, so there is no single solution. In a circuit, this is a floating node, or a loop of ideal voltage sources.`,
        m: clone(m),
        rows: [k],
        pivot: [k, k],
      });
      return { steps, singular: true, L, U: upper(m, n), perm };
    }
    if (p !== k) {
      [m[p], m[k]] = [m[k]!, m[p]!];
      [perm[p], perm[k]] = [perm[k]!, perm[p]!];
      for (let j = 0; j < k; j++) [L[p]![j], L[k]![j]] = [L[k]![j]!, L[p]![j]!];
      steps.push({
        kind: 'swap',
        text:
          rule === 'largest' && Math.abs(m[p]![k]!) > eps
            ? `Swap rows ${k + 1} and ${p + 1}: the largest entry in column ${k + 1} becomes the pivot, which keeps rounding errors small.`
            : `The pivot position holds 0, so swap rows ${k + 1} and ${p + 1}. Order does not matter to a set of equations.`,
        m: clone(m),
        rows: [k, p],
        pivot: [k, k],
      });
    }
    const piv = m[k]![k]!;
    for (let i = k + 1; i < n; i++) {
      const f = m[i]![k]! / piv;
      L[i]![k] = f;
      if (Math.abs(f) <= 1e-14) {
        continue;
      }
      for (let j = k; j <= n; j++) m[i]![j] = m[i]![j]! - f * m[k]![j]!;
      m[i]![k] = 0;
      steps.push({
        kind: 'eliminate',
        text: `Row ${i + 1} ← row ${i + 1} − (${fmt(f)}) × row ${k + 1}. The multiplier ${fmt(f)} is ${fmt(m[i]![k]! + f * piv)} ÷ ${fmt(piv)}, chosen to make the entry under the pivot zero, which removes ${unknownName(k, n)} from this equation.`,
        m: clone(m),
        rows: [i, k],
        pivot: [k, k],
        factor: f,
      });
    }
  }
  steps.push({ kind: 'triangular', text: 'Every entry below the diagonal is now zero: the system is triangular. The last equation has one unknown; solve upwards.', m: clone(m), rows: [], });

  const x: (number | undefined)[] = Array(n).fill(undefined);
  for (let i = n - 1; i >= 0; i--) {
    let s = m[i]![n]!;
    const terms: string[] = [];
    for (let j = i + 1; j < n; j++) {
      s -= m[i]![j]! * (x[j] as number);
      terms.push(`${fmt(m[i]![j]!)} × ${fmt(x[j] as number)}`);
    }
    x[i] = s / m[i]![i]!;
    steps.push({
      kind: 'back',
      text:
        terms.length === 0
          ? `Row ${i + 1}: ${fmt(m[i]![i]!)} ${unknownName(i, n)} = ${fmt(m[i]![n]!)}, so ${unknownName(i, n)} = ${fmt(x[i] as number)}.`
          : `Row ${i + 1}: ${fmt(m[i]![i]!)} ${unknownName(i, n)} = ${fmt(m[i]![n]!)} − (${terms.join(' + ')}), so ${unknownName(i, n)} = ${fmt(x[i] as number)}.`,
      m: clone(m),
      rows: [i],
      x: [...x],
    });
  }
  steps.push({ kind: 'solved', text: `Solved: ${x.map((v, i) => `${unknownName(i, n)} = ${fmt(v as number)}`).join(', ')}.`, m: clone(m), rows: [], x: [...x] });
  return { steps, x: x as number[], singular: false, L, U: upper(m, n), perm };
}

function upper(m: Matrix, n: number): Matrix {
  return m.map((row, i) => row.slice(0, n).map((v, j) => (j < i ? 0 : v)));
}

/** A·x for checking a solution. */
export function multiply(A: Matrix, x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j]!, 0));
}

/** Product of two square matrices. */
export function matmul(P: Matrix, Q: Matrix): Matrix {
  return P.map((row) => Q[0]!.map((_, j) => row.reduce((s, a, k) => s + a * Q[k]![j]!, 0)));
}

/** The rows of A in the order the elimination used them (P·A). */
export const permute = (A: Matrix, perm: number[]): Matrix => perm.map((p) => [...A[p]!]);

/** Solve from a stored factorisation: forward substitution with L, then back substitution with U. Two sweeps. */
export function solveWithLU(L: Matrix, U: Matrix, perm: number[], b: number[]): number[] {
  const n = L.length;
  const y = perm.map((p) => b[p]!);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) y[i]! -= L[i]![j]! * y[j]!;
  const x = Array(n).fill(0) as number[];
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let j = i + 1; j < n; j++) s -= U[i]![j]! * x[j]!;
    x[i] = s / U[i]![i]!;
  }
  return x;
}

export interface Preset {
  id: string;
  title: string;
  blurb: string;
  A: Matrix;
  b: number[];
}

export const PRESETS: Preset[] = [
  {
    id: 'ladder',
    title: 'A three-node ladder',
    blurb:
      'Nodal analysis of a 9 V source through 1 kΩ into node A, then 2 kΩ from A to ground, and a ladder of 1 kΩ resistors A–B, B–C, B–ground, C–ground. The unknowns x, y, z are the voltages at nodes A, B and C, in volts; conductances are in millisiemens.',
    A: [
      [2.5, -1, 0],
      [-1, 3, -1],
      [0, -1, 2],
    ],
    b: [9, 0, 0],
  },
  {
    id: 'classic',
    title: 'A textbook system',
    blurb: 'Three equations with the solution x = 2, y = 3, z = −1.',
    A: [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ],
    b: [8, -11, -3],
  },
  {
    id: 'swap',
    title: 'A zero where the pivot should be',
    blurb: 'The first equation has no x, so it cannot be the pivot row for x: rows must swap. The solution is x = 1, y = 2, z = 3.',
    A: [
      [0, 2, 1],
      [1, 1, 1],
      [2, 1, -1],
    ],
    b: [7, 6, 1],
  },
  {
    id: 'floating',
    title: 'A floating node (no solution)',
    blurb: 'Two of the equations say the same thing about x and y, so nothing fixes their voltages: only the difference is known. The same happens to a subnetwork with no path to ground.',
    A: [
      [1, -1, 0],
      [-1, 1, 0],
      [0, 0, 1],
    ],
    b: [1, -1, 2],
  },
];
