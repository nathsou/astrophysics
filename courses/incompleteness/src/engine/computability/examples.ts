// Example definitions for the computability-theory chapter, with their indices in this
// edition's coding (indices.ts). Built from zero, succ, projections, composition, primitive
// recursion and minimization only (the library's functions are defined that way too).

import { R, type RF } from '../recursive/rf.ts';
import * as Lib from './library.ts';

const P = R.proj;

/** par(0) = 0, par(y + 1) = IsZero(par(y)): 0 on even, 1 on odd numbers (with the book's dummy parameter). */
export function parity(): RF {
  const parP = R.def("par'", "\\mathrm{par}'", R.rec(R.zero(), R.comp(Lib.isZero(), [P(3, 2)])));
  return R.def('par', '\\mathrm{par}', R.comp(parP, [R.zero(), P(1, 0)]));
}

/** μz par(x): 0 on even numbers, undefined on odd ones. Its domain is the set of even numbers. */
export function haltsOnEvens(): RF {
  return R.min(R.comp(parity(), [P(2, 1)]));
}

/** μz IsZero(par(x)): 0 on odd numbers, undefined on even ones. */
export function haltsOnOdds(): RF {
  return R.min(R.comp(Lib.isZero(), [R.comp(parity(), [P(2, 1)])]));
}

/** χ of the even numbers: IsZero(par(x)). */
export function chiEven(): RF {
  return R.def('χ_even', '\\chi_{\\mathrm{Even}}', R.comp(Lib.isZero(), [parity()]));
}

/** μz succ(z): undefined everywhere. */
export function nowhere(): RF {
  return R.min(R.comp(R.succ(), [P(2, 0)]));
}

/** x + x. */
export function double(): RF {
  return R.comp(Lib.add(), [P(1, 0), P(1, 0)]);
}

/** x · x. */
export function square(): RF {
  return R.comp(Lib.mult(), [P(1, 0), P(1, 0)]);
}

/** μz |x − 2z|: x/2 for even x, undefined for odd x. */
export function exactHalf(): RF {
  return R.min(R.comp(Lib.dist(), [P(2, 1), R.comp(Lib.add(), [P(2, 0), P(2, 0)])]));
}

/** μz (x ∸ z·z): the least z with z² ≥ x (a total function defined by an unbounded search). */
export function sqrtCeil(): RF {
  return R.min(R.comp(Lib.tsub(), [P(2, 1), R.comp(Lib.mult(), [P(2, 0), P(2, 0)])]));
}

export interface Example {
  id: string;
  /** a short plain description */
  label: string;
  tex: string;
  arity: number;
  build: () => RF;
  note?: string;
}

export const UNARY_EXAMPLES: Example[] = [
  { id: 'succ', label: 'succ(x) = x + 1', tex: '\\mathrm{succ}', arity: 1, build: () => R.succ() },
  { id: 'plus2', label: 'x + 2 = succ(succ(x))', tex: 'x+2', arity: 1, build: () => R.comp(R.succ(), [R.succ()]) },
  { id: 'min45', label: 'μz P²₁(z, x): defined only at 0', tex: '\\mu z\\,P^2_1(z, x)', arity: 1, build: () => R.min(P(2, 1)) },
  { id: 'nowhere', label: 'μz succ(z): defined nowhere', tex: '\\mu z\\,\\mathrm{succ}(z)', arity: 1, build: nowhere },
  { id: 'double', label: 'x + x', tex: 'x + x', arity: 1, build: double },
  { id: 'pred', label: 'pred(x)', tex: '\\mathrm{pred}(x)', arity: 1, build: Lib.pred },
  { id: 'iszero', label: 'IsZero(x)', tex: '\\mathrm{IsZero}(x)', arity: 1, build: Lib.isZero },
  { id: 'parity', label: 'par(x): 0 on evens, 1 on odds', tex: '\\mathrm{par}(x)', arity: 1, build: parity },
  { id: 'evens', label: 'μz par(x): halts exactly on even x', tex: '\\mu z\\,\\mathrm{par}(x)', arity: 1, build: haltsOnEvens },
  { id: 'odds', label: 'μz IsZero(par(x)): halts exactly on odd x', tex: '\\mu z\\,\\mathrm{IsZero}(\\mathrm{par}(x))', arity: 1, build: haltsOnOdds },
  { id: 'half', label: 'μz |x − 2z|: x/2, only for even x', tex: '\\mu z\\,|x - 2z|', arity: 1, build: exactHalf },
  { id: 'square', label: 'x · x', tex: 'x \\cdot x', arity: 1, build: square },
  { id: 'sqrt', label: 'μz (x ∸ z·z): total, found by search', tex: '\\mu z\\,(x \\dot- z\\cdot z)', arity: 1, build: sqrtCeil },
];

export const MULTI_EXAMPLES: Example[] = [
  { id: 'add', label: 'add(x, y) = x + y', tex: '\\mathrm{add}', arity: 2, build: Lib.add },
  { id: 'mult', label: 'mult(x, y) = x · y', tex: '\\mathrm{mult}', arity: 2, build: Lib.mult },
  { id: 'tsub', label: 'x ∸ y (truncated subtraction)', tex: 'x \\dot- y', arity: 2, build: Lib.tsub },
  { id: 'exp', label: 'exp(x, y) = xʸ', tex: '\\mathrm{exp}', arity: 2, build: Lib.exp },
  { id: 'cond', label: 'cond(x, y, z): y if x = 0, else z', tex: '\\mathrm{cond}', arity: 3, build: Lib.cond },
  { id: 'searchsum', label: 'μz |x − (y + z)|: x − y if y ≤ x, else undefined', tex: '\\mu z\\,|x - (y + z)|', arity: 2, build: () => R.min(R.comp(Lib.dist(), [P(3, 1), R.comp(Lib.add(), [P(3, 2), P(3, 0)])])) },
];
