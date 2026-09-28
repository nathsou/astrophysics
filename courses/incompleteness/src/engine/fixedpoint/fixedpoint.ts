// The fixed-point lemma (section The Fixed-Point Lemma).
//
// Given B(x) with one free variable x:
//   E(x)  :=  ∃y (D_diag(x, y) ∧ B(y))           D_diag represents diag in Q
//   A     :=  E(⌜E(x)⌝)                          the diagonalisation of E(x)
// Then diag(#E(x)#) = #A#, and Q ⊢ A ↔ B(⌜A⌝).
//
// Three different kinds of object appear, and are kept apart here as in the book:
//   the formula E(x) (an AST), its Gödel number #E(x)# (a Nat, far too large to write out),
//   and the numeral ⌜E(x)⌝ (a term of arithmetic, 0′′…′ with #E(x)# primes, a Numeral node).
//
// D_diag is a genuine formula of arithmetic, but a very long one; it appears here by name. The
// derivation of A ↔ B(⌜A⌝) is complete and mechanically checked, from two hypotheses that
// the representability of diag provides.

import * as A from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { freeVars, freshConstIndex, freshVarIndex } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { formulaTex } from '../syntax/print.ts';
import type { Abbreviation } from '../syntax/parse.ts';
import { decode, godel, type Encoding } from '../coding/godel.ts';
import { natEq, type Equality, type Nat } from '../numbers/nat.ts';
import { check, D, type CheckResult, type Deriv } from '../proof/nd.ts';
import { Q } from '../proof/q.ts';
import { varIndex } from '../syntax/language.ts';

export const X = varIndex('x')!;
export const Y = varIndex('y')!;

export const D_DIAG: Abbreviation = {
  name: 'Ddiag',
  tex: '\\mathrm{D}_{\\mathrm{diag}}',
  params: [X, Y],
  description: 'the formula representing diag in Q (it exists because diag is primitive recursive, hence computable)',
};

export const PROV: Abbreviation = {
  name: 'Prov',
  tex: '\\mathsf{Prov}',
  params: [X],
  description: 'Prov(x) is ∃z Prf(z, x), where Prf represents the proof relation of Q',
};

export interface FixedPointConstruction {
  B: Formula;
  /** E(x) = ∃y (D_diag(x, y) ∧ B(y)) */
  E: Formula;
  encE: Encoding;
  /** the numeral ⌜E(x)⌝ */
  quoteE: A.Numeral;
  /** A = E(⌜E(x)⌝) */
  fixed: Formula;
  encA: Encoding;
  quoteA: A.Numeral;
  /** B(⌜A⌝) */
  BofA: Formula;
  /** diag(#E#) computed by decoding #E#, substituting, re-encoding */
  diagCheck: { decoded: Formula | null; recomputed: Nat | null; agrees: Equality; error?: string };
  derivation: Deriv;
  checked: CheckResult;
}

export function validateB(B: Formula): string | null {
  const fv = freeVars(B);
  if (fv.size !== 1 || !fv.has(X)) return 'B(x) must have exactly one free variable, x';
  return null;
}

export function fixedPoint(B: Formula, eTex = 'E', aTex = 'A'): FixedPointConstruction {
  const err = validateB(B);
  if (err) throw new Error(err);
  // E(x) := ∃y (D_diag(x, y) ∧ B(y)), with y not occurring in B.
  const y = freshVarIndex([B], [Y]);
  const E = A.exists(A.v(y), A.and(A.abbr(D_DIAG.name, D_DIAG.tex, D_DIAG.params, [A.v(X), A.v(y)]), subst(B, X, A.v(y))));
  const encE = godel(E);
  const quoteE = A.numeral(encE.number, `${eTex}(x)`);
  const fixed = subst(E, X, quoteE);
  const encA = godel(fixed);
  const quoteA = A.numeral(encA.number, aTex);
  const BofA = subst(B, X, quoteA);

  // diag, computed: decode #E#, substitute the numeral of #E# for x, encode.
  let diagCheck: FixedPointConstruction['diagCheck'];
  const dec = decode(encE.number, { expect: 'formula', abbreviations: [D_DIAG, PROV] });
  if (!dec.ok) diagCheck = { decoded: null, recomputed: null, agrees: 'unknown', error: dec.error };
  else {
    const decoded = dec.node as Formula;
    const recomputed = godel(subst(decoded, X, A.numeral(encE.number))).number;
    diagCheck = { decoded, recomputed, agrees: natEq(recomputed, encA.number) };
  }

  const derivation = fixedPointDerivation(E, fixed, quoteE, quoteA, B, y);
  const checked = check(derivation, { axioms: Q() });
  return { B, E, encE, quoteE, fixed, encA, quoteA, BofA, diagCheck, derivation, checked };
}

/** The derivation of (A → B(⌜A⌝)) ∧ (B(⌜A⌝) → A), i.e. A ↔ B(⌜A⌝). */
export function fixedPointDerivation(E: Formula, fixed: Formula, quoteE: A.Numeral, quoteA: A.Numeral, B: Formula, y: number): Deriv {
  const dAbbr = (t: A.Term) => A.abbr(D_DIAG.name, D_DIAG.tex, D_DIAG.params, [A.cloneFresh(quoteE), t]);
  const BofA = subst(B, X, quoteA);
  const eig = freshConstIndex([B, E]);
  const a = A.c(eig);
  const g1 = '(1) A → B(⌜A⌝)';
  const g2 = '(2) B(⌜A⌝) → A';

  // Hypotheses from the representability of diag, with diag(#E#) = #A#.
  const h1 = () => D.hyp('repdiag1', dAbbr(A.cloneFresh(quoteA)), {
    note: 'D_diag represents diag, and diag(#E(x)#) = #A#. Clause (a) of representability gives this sentence.',
    group: g2,
  });
  const h2 = () =>
    D.hyp('repdiag2', A.forall(A.v(y), A.imp(dAbbr(A.v(y)), A.eq(A.v(y), A.cloneFresh(quoteA)))), {
      note: 'Clause (b) of representability: D_diag(⌜E(x)⌝, y) holds only of y = ⌜A⌝.',
      group: g1,
    });

  // (1) Suppose A, i.e. ∃y (D_diag(⌜E⌝, y) ∧ B(y)).
  const assumeA = D.assume(fixed, 1, { note: 'Suppose A. By definition A is E(⌜E(x)⌝), that is, ∃y (D_diag(⌜E(x)⌝, y) ∧ B(y)).', group: g1 });
  const inst = A.and(dAbbr(a), subst(B, X, a));
  const pair = () => D.assume(inst, 2, { note: 'Consider such a y; call it a.', group: g1 });
  const dPart = D.andE(pair(), 'left', { group: g1 });
  const unique = D.allE(h2(), a, { group: g1 });
  const aIsA = D.impE(unique, dPart, { note: 'Since D_diag(⌜E(x)⌝, a), representability says a = ⌜A⌝.', group: g1 });
  const bPart = D.andE(pair(), 'right', { note: 'And B(a).', group: g1 });
  const bOfA = D.eqE(aIsA, bPart, BofA, { note: 'So B(⌜A⌝), replacing a by ⌜A⌝.', group: g1 });
  const exE = D.exE(assumeA, bOfA, eig, 2, { note: 'a occurs neither in A, nor in B(⌜A⌝), nor in the hypotheses: ∃Elim applies.', group: g1 });
  const left = D.impI(exE, fixed, 1, { note: 'Discharging the supposition: A → B(⌜A⌝).', group: g1 });

  // (2) Suppose B(⌜A⌝).
  const assumeB = D.assume(BofA, 3, { note: 'Suppose B(⌜A⌝).', group: g2 });
  const both = D.andI(h1(), assumeB, { group: g2 });
  const exI = D.exI(both, fixed, A.cloneFresh(quoteA), { note: 'Then ∃y (D_diag(⌜E(x)⌝, y) ∧ B(y)) with witness ⌜A⌝ — and that sentence is A.', group: g2 });
  const right = D.impI(exI, BofA, 3, { note: 'Discharging: B(⌜A⌝) → A.', group: g2 });

  return D.andI(left, right, { note: 'Both directions: A ↔ B(⌜A⌝), which in this book abbreviates (A → B(⌜A⌝)) ∧ (B(⌜A⌝) → A).', group: 'A ↔ B(⌜A⌝)' });
}

export function describe(c: FixedPointConstruction) {
  return {
    E: formulaTex(c.E),
    A: formulaTex(c.fixed),
  };
}
