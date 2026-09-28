// Substitution on Gödel numbers (section Substitution): the primitive recursive function
//
//   hSubst(x, y, z, 0)     = Λ
//   hSubst(x, y, z, i + 1) = hSubst(x, y, z, i) ⌢ y          if FreeOcc(x, z, i)
//                          = append(hSubst(x, y, z, i), (x)_i) otherwise
//   Subst(x, y, z)         = hSubst(x, y, z, len(x))
//
// computed step by step on the symbol string, so that each step can be shown.

import type { Formula, Term } from '../syntax/ast.ts';
import { occurrences } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { freeVars } from '../syntax/ops.ts';
import { natEq, type Equality, type Nat } from '../numbers/nat.ts';
import { codeItemsToNat, godel, termItems, type CodeItem } from './godel.ts';

export interface HSubstStep {
  /** i: the position in x being processed (hSubst(x, y, z, i + 1) is computed) */
  i: number;
  item: CodeItem;
  freeOcc: boolean;
  /** number of elements of hSubst(x, y, z, i + 1) */
  length: number;
}

export type HSubstResult =
  | {
      ok: true;
      steps: HSubstStep[];
      /** the symbol strings of the arguments */
      x: CodeItem[];
      y: CodeItem[];
      result: CodeItem[];
      resultNumber: Nat;
      /** #A[t/u]#, computed directly from the formula */
      expected: Nat;
      agrees: Equality;
    }
  | { ok: false; error: string };

export function hSubst(A: Formula, t: Term, u: number): HSubstResult {
  const encA = godel(A);
  const x = encA.items;
  if (x.some((it) => it.k === 'abbr' && freeVars(it.formula).has(u))) {
    return { ok: false, error: 'this formula contains a named formula in which the variable occurs: its symbols are not spelled out, so the step-by-step computation is not available' };
  }
  const y = termItems(t);
  const free = new Set(occurrences(encA.expanded, u).filter((o) => o.free).map((o) => o.node.id));
  const steps: HSubstStep[] = [];
  const result: CodeItem[] = [];
  x.forEach((item, i) => {
    const freeOcc = item.k === 'sym' && item.sym.k === 'var' && item.sym.index === u && item.role !== 'binder-var' && free.has(item.node);
    if (freeOcc) result.push(...y);
    else result.push(item);
    steps.push({ i, item, freeOcc, length: result.length });
  });
  const resultNumber = codeItemsToNat(result);
  const expected = godel(subst(A, u, t)).number;
  return { ok: true, steps, x, y, result, resultNumber, expected, agrees: natEq(resultNumber, expected) };
}
