// Derivations in arithmetic theories (the book's appendix "Derivations in Arithmetic Theories"),
// transcribed from its trees and verified by the checker.
//
// - Q ⊢ ∀x ¬x < 0 (Lemma "less-zero"): the book's complete derivation, built from its pieces
//   δ₁ … δ₅. The book writes Q8 with ↔ and applies ∧Elim to it, "recall that A ↔ B is short
//   for (A → B) ∧ (B → A)". The checker has no rules for ↔, so the axiom Q8 is given to it
//   with ↔ written out as the book defines it (Q8 unfolded). Nothing else differs.
// - The first half of the proof of Rosser's theorem, for a chosen n: a derivation of
//   RProv(⌜R⌝) from the hypotheses the proof provides (Prf represents the proof relation, the
//   refutation relation is represented, and Lemma "less-nsucc").

import * as Ast from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { expandDefined } from '../syntax/ops.ts';
import { parseFormula } from '../syntax/parse.ts';
import { named } from '../numbers/nat.ts';
import { D, symm, type Deriv } from './nd.ts';
import { num, Q } from './q.ts';

/** Q with Q8 written out: ∀x ∀y ((x < y → ∃z (z′ + x) = y) ∧ (∃z (z′ + x) = y → x < y)). */
export function qUnfolded(): Map<string, Formula> {
  const m = new Map(Q());
  m.set('Q8', expandDefined(Q().get('Q8')!));
  return m;
}

const ax = (name: string, group?: string) => D.axiom(name, Ast.cloneFresh(qUnfolded().get(name)!), { group });
const P = (s: string) => parseFormula(s);
const a = () => Ast.c(1);
const b = () => Ast.c(2);
const c = () => Ast.c(3);

/** Q ⊢ ∀x ¬x < 0, as in the appendix. */
export function deriveLessZero(): Deriv {
  // δ₃ (case 1): ⊥ from a = 0 and (b′ + a) = 0, with Q2 and Q4
  const g3 = 'δ₃: case a = 0';
  const q2 = D.allE(ax('Q2', g3), b(), { group: g3, note: 'Q2 with x := b: ¬0 = b′.' });
  const q4 = D.allE(ax('Q4', g3), Ast.succ(b()), { group: g3, note: 'Q4 with x := b′: (b′ + 0) = b′.' });
  const aZero = D.assume(P('a = 0'), 7, { group: g3 });
  const sum0 = D.assume(P("(b' + a) = 0"), 3, { group: g3 });
  const s1 = D.eqE(aZero, sum0, P("(b' + 0) = 0"), { group: g3, note: 'Replace a by 0.' });
  const s2 = symm(s1, { group: g3, note: 'The book abbreviates this step by a double line: from (b′ + 0) = 0 infer 0 = (b′ + 0).' });
  const s3 = D.eqE(q4, s2, P("0 = b'"), { group: g3, note: 'Replace b′ + 0 by b′.' });
  const delta3 = D.notE(q2, s3, { group: g3 });

  // δ₄: ⊥ from a = c′ and (b′ + a) = 0, with Q2 and Q5; δ₅ adds ∃Elim
  const g4 = 'δ₄, δ₅: case ∃y a = y′';
  const q2bc = D.allE(ax('Q2', g4), Ast.plus(Ast.succ(b()), c()), { group: g4, note: 'Q2 with x := (b′ + c): ¬0 = (b′ + c)′.' });
  const aSc = D.assume(P("a = c'"), 6, { group: g4 });
  const sum0b = D.assume(P("(b' + a) = 0"), 3, { group: g4 });
  const t1 = D.eqE(aSc, sum0b, P("(b' + c') = 0"), { group: g4, note: 'Replace a by c′.' });
  const q5 = D.allE(D.allE(ax('Q5', g4), Ast.succ(b()), { group: g4 }), c(), { group: g4, note: 'Q5 with x := b′, y := c: (b′ + c′) = (b′ + c)′.' });
  const t2 = D.eqE(t1, q5, P("0 = (b' + c)'"), { group: g4, note: 'Replace b′ + c′ (on the left) by 0.' });
  const delta4 = D.notE(q2bc, t2, { group: g4 });
  const exA = D.assume(P("∃y a = y'"), 7, { group: g4 });
  const delta5 = D.exE(exA, delta4, 3, 6, { group: g4, note: 'Eigenvariable c: it occurs neither in ∃y a = y′, nor in ⊥, nor in (b′ + a) = 0.' });

  // δ₂ and the negation
  const g2 = 'δ₂: from ∃z (z′ + a) = 0 to ⊥';
  const q3 = D.allE(ax('Q3', g2), a(), { group: g2, note: 'Q3 with x := a: a = 0 ∨ ∃y a = y′.' });
  const cases = D.orE(q3, delta3, delta5, 7, { group: g2, note: 'Proof by cases, discharging a = 0 and ∃y a = y′ (label 7).' });
  const exZ = D.assume(P("∃z (z' + a) = 0"), 2, { group: g2 });
  const delta2 = D.exE(exZ, cases, 2, 3, { group: g2, note: 'Eigenvariable b, discharging (b′ + a) = 0 (label 3).' });
  const notEx = D.notI(delta2, P("∃z (z' + a) = 0"), 2, { group: g2 });

  // δ₁: from ¬∃z (z′ + a) = 0 to ¬a < 0, then ∀Intro
  const g1 = 'δ₁ and ∀Intro';
  const q8 = D.allE(D.allE(ax('Q8', g1), a(), { group: g1 }), Ast.zero(), { group: g1, note: 'Q8 with x := a, y := 0 (↔ written out as the book defines it).' });
  const dir = D.andE(q8, 'left', { group: g1, note: 'The book: “recall that A ↔ B is short for (A → B) ∧ (B → A)”.' });
  const less = D.assume(P('a < 0'), 1, { group: g1 });
  const ex = D.impE(dir, less, { group: g1 });
  const bot = D.notE(notEx, ex, { group: g1 });
  const notLess = D.notI(bot, P('a < 0'), 1, { group: g1 });
  return D.allI(notLess, P('∀x ¬x < 0'), 1, { group: g1, note: 'Eigenvariable a: every assumption is discharged, and only axioms of Q remain.' });
}

// ------------------------------------------------------------------ Rosser, first half

const R_NUM = (): Term => Ast.numeral(named('R', '\\ulcorner R\\urcorner'), 'R');
const prf = (x: Term, y: Term) => Ast.abbr('Prf', '\\mathrm{Prf}', [0, 1], [x, y]);
const refut = (x: Term, y: Term) => Ast.abbr('Refut', '\\mathrm{Refut}', [0, 1], [x, y]);

/** x = 0 ∨ … ∨ x = n−1 (left-nested, as the parser reads it), for n ≥ 1. */
function disj(t: () => Term, n: number): Formula {
  let f: Formula = Ast.eq(t(), num(0));
  for (let k = 1; k < n; k++) f = Ast.or(f, Ast.eq(t(), num(k)));
  return f;
}

/** RProv(y) = ∃x (Prf(x, y) ∧ ∀z (z < x → ¬Refut(z, y))), for y := ⌜R⌝. */
export function rprovR(): Formula {
  const x = Ast.v(0);
  const z = Ast.v(2);
  return Ast.exists(x, Ast.and(prf(Ast.v(0), R_NUM()), Ast.forall(z, Ast.imp(Ast.less(Ast.v(2), Ast.v(0)), Ast.not(refut(Ast.v(2), R_NUM()))))));
}

export const ROSSER_MAX = 6;

/**
 * If n is the Gödel number of a derivation of R, and no k < n is one of a refutation, then
 * RProv(⌜R⌝) is derivable from: Prf(n̄, ⌜R⌝) (δ₁), ¬Refut(k̄, ⌜R⌝) for k < n (ρ_k), and
 * ∀x (x < n̄ → (x = 0 ∨ … ∨ x = n−1)) (Lemma less-nsucc). These are hypotheses: facts the
 * text establishes, not derived here.
 */
export function deriveRosserFirstHalf(n: number): Deriv {
  if (!Number.isInteger(n) || n < 1 || n > ROSSER_MAX) throw new Error(`n must be between 1 and ${ROSSER_MAX}`);
  const g0 = 'λ₁: from a < n̄ to the cases';
  const lemma = D.hyp('less-nsucc', Ast.forall(Ast.v(0), Ast.imp(Ast.less(Ast.v(0), num(n)), disj(() => Ast.v(0), n))), { group: g0, note: `Lemma “less-nsucc” (for n − 1 = ${n - 1}): Q derives it; used here as a hypothesis.` });
  const inst = D.allE(lemma, a(), { group: g0 });
  const lessN = D.assume(Ast.less(a(), num(n)), 1, { group: g0 });
  const cases = D.impE(inst, lessN, { group: g0 });

  const gc = '∨Elim*: each case a = k̄';
  const goal = () => Ast.not(refut(a(), R_NUM()));
  const oneCase = (k: number): Deriv => {
    const rho = D.hyp(`ρ${k}`, Ast.not(refut(num(k), R_NUM())), { group: gc, note: `ρ${k}: ${k} is not the Gödel number of a refutation of R (T is consistent), so Q ⊢ ¬Refut(${k}̄, ⌜R⌝).` });
    const eq = D.assume(Ast.eq(a(), num(k)), 2, { group: gc });
    return D.eqE(eq, rho, goal(), { group: gc, note: `Replace ${k}̄ by a.` });
  };
  // ∨Elim over the left-nested disjunction, all cases labelled 2 (as in the book)
  const elim = (major: Deriv, m: number): Deriv => {
    if (m === 1) return oneCase(0);
    const left = m === 2 ? oneCase(0) : elim(D.assume(disj(a, m - 1), 2, { group: gc }), m - 1);
    return D.orE(major, left, oneCase(m - 1), 2, { group: gc });
  };
  let body: Deriv;
  if (n === 1) {
    // the "disjunction" is the single identity a = 0: use it directly (=Elim with ρ₀)
    const rho = D.hyp('ρ0', Ast.not(refut(num(0), R_NUM())), { group: gc, note: 'ρ0: Q ⊢ ¬Refut(0, ⌜R⌝).' });
    body = D.eqE(cases, rho, goal(), { group: gc, note: 'Replace 0 by a.' });
  } else body = elim(cases, n);

  const gf = 'the conclusion RProv(⌜R⌝)';
  const imp = D.impI(body, Ast.less(a(), num(n)), 1, { group: gf });
  const all = D.allI(imp, Ast.forall(Ast.v(2), Ast.imp(Ast.less(Ast.v(2), num(n)), Ast.not(refut(Ast.v(2), R_NUM())))), 1, { group: gf });
  const delta1 = D.hyp('δ1', prf(num(n), R_NUM()), { group: gf, note: `δ₁: ${n} is the Gödel number of a derivation of R, and Prf represents the proof relation, so Q ⊢ Prf(${n}̄, ⌜R⌝).` });
  const conj = D.andI(delta1, all, { group: gf });
  return D.exI(conj, rprovR(), num(n), { group: gf, note: `∃Intro with the term ${n}̄.` });
}
