// Small function and relation libraries (built from the basis of chapter 4, without minimization,
// so that derivations of the representability clauses can be generated).

import { R, type RF } from '../../engine/recursive/rf';

const P = R.proj;

function constant(n: number, k: number): RF {
  let t: RF = R.comp(R.zero(), [P(k, 0)]);
  for (let i = 0; i < n; i++) t = R.comp(R.succ(), [t]);
  return t;
}

export interface FnEntry {
  id: string;
  /** TeX */
  label: string;
  arity: number;
  build: () => RF;
  args: bigint[];
}

export const FUNCTIONS: FnEntry[] = [
  { id: 'succ', label: 'x + 1', arity: 1, build: () => R.succ(), args: [3n] },
  { id: 'add', label: 'x + y', arity: 2, build: () => R.basic('add'), args: [2n, 3n] },
  { id: 'mult', label: 'x \\cdot y', arity: 2, build: () => R.basic('mult'), args: [2n, 3n] },
  { id: 'plus2', label: 'x + 2', arity: 1, build: () => R.comp(R.succ(), [R.succ()]), args: [3n] },
  { id: 'double', label: '2x', arity: 1, build: () => R.comp(R.basic('add'), [P(1, 0), P(1, 0)]), args: [3n] },
  { id: 'chareq', label: '\\chi_=(x, y)', arity: 2, build: () => R.basic('chareq'), args: [2n, 2n] },
];

export interface RelEntry {
  id: string;
  /** TeX of the relation R(x, y) */
  label: string;
  /** TeX of χ_R */
  chi: string;
  arity: number;
  build: () => RF;
  args: bigint[];
  test: (xs: bigint[]) => boolean;
}

export const RELATIONS: RelEntry[] = [
  { id: 'eq', label: 'x = y', chi: '\\chi_=(x, y)', arity: 2, build: () => R.basic('chareq'), args: [2n, 3n], test: ([x, y]) => x === y },
  { id: 'succ', label: 'x = y + 1', chi: '\\chi_=(x, \\mathrm{succ}(y))', arity: 2, build: () => R.comp(R.basic('chareq'), [P(2, 0), R.comp(R.succ(), [P(2, 1)])]), args: [3n, 2n], test: ([x, y]) => x === y + 1n },
  { id: 'square', label: 'y = x \\cdot x', chi: '\\chi_=(y, \\mathrm{mult}(x, x))', arity: 2, build: () => R.comp(R.basic('chareq'), [P(2, 1), R.comp(R.basic('mult'), [P(2, 0), P(2, 0)])]), args: [2n, 4n], test: ([x, y]) => y === x * x },
  { id: 'sum4', label: 'x + y = 4', chi: '\\chi_=(\\mathrm{add}(x, y), 4)', arity: 2, build: () => R.comp(R.basic('chareq'), [R.basic('add'), constant(4, 2)]), args: [1n, 3n], test: ([x, y]) => x + y === 4n },
];

export function parseArgList(s: string, k: number, max: bigint): bigint[] | string {
  const parts = s.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== k) return `${k} argument${k === 1 ? '' : 's'} needed`;
  if (!parts.every((p) => /^\d+$/.test(p))) return 'arguments must be natural numbers';
  const xs = parts.map(BigInt);
  if (xs.some((x) => x > max)) return `keep the arguments at most ${max}: derivations grow with the numbers`;
  return xs;
}
