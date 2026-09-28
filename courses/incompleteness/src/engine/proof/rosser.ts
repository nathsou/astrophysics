// Rosser's theorem in the appendix "Derivations in Arithmetic Theories", both halves.
//
// First half (deriveRosserFirstHalf in arith.ts): if n is the Gödel number of a derivation of R,
// Q derives RProv(⌜R⌝) from δ₁ and the ρ_k. Here Lemma less-nsucc, a hypothesis there, can be
// replaced by its derivation in Q (proof/less.ts).
//
// Second half: if m is the Gödel number of a refutation of R and no k ≤ m is the Gödel number
// of a derivation of R, then Q derives ¬RProv(⌜R⌝) from ρ₁ : Refut(m̄, ⌜R⌝) and
// π_k : ¬Prf(k̄, ⌜R⌝) (k ≤ m). The book's λ₂ is built from λ₃ (Lemma trichotomy) and λ₁ (Lemma
// less-nsucc); both lemmas can be used as hypotheses, as the book does, or derived in Q. The
// book ends with ∀x (Prf(x, ⌜R⌝) → ∃z (z < x ∧ Refut(z, ⌜R⌝))) and a "\DeduceC" step to
// ¬RProv(⌜R⌝); that last step is written out here with ∃Elim twice and ¬Intro.
//
// Prf and Refut are not spelled out, and ⌜R⌝ is a symbolic numeral: the facts about them are
// hypotheses, which the checker lists.

import * as Ast from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { named } from '../numbers/nat.ts';
import { numeralValue as termValue } from '../syntax/ops.ts';
import { D, type Deriv } from './nd.ts';
import { num } from './q.ts';
import { deriveLessZero, deriveRosserFirstHalf, ROSSER_MAX, rprovR } from './arith.ts';
import { deriveLessNSucc, deriveTrichotomy, lessNSuccStatement, orCases, orInto, plugHypothesis, trichotomyStatement, upTo, type Labels } from './less.ts';

const R_NUM = (): Term => Ast.numeral(named('R', '\\ulcorner R\\urcorner'), 'R');
const prf = (x: Term, y: Term) => Ast.abbr('Prf', '\\mathrm{Prf}', [0, 1], [x, y]);
const refut = (x: Term, y: Term) => Ast.abbr('Refut', '\\mathrm{Refut}', [0, 1], [x, y]);
const a = () => Ast.c(1);
const b = () => Ast.c(2);
const c = () => Ast.c(3);

/** The first half, with Lemma less-nsucc derived in Q instead of assumed. */
export function deriveRosserFirstHalfDerived(n: number): Deriv {
  const d = deriveRosserFirstHalf(n);
  return plugHypothesis(d, 'less-nsucc', { ...deriveLessNSucc(n - 1), note: `Lemma less-nsucc for n = ${n - 1}, derived in Q (the derivation above).` });
}

/** ∀x (Prf(x, ⌜R⌝) → ∃z (z < x ∧ Refut(z, ⌜R⌝))) */
export function rosserSecondIntermediate(): Formula {
  const x = () => Ast.v(0);
  const z = () => Ast.v(2);
  return Ast.forall(x(), Ast.imp(prf(x(), R_NUM()), Ast.exists(z(), Ast.and(Ast.less(z(), x()), refut(z(), R_NUM())))));
}

export interface RosserSecondOptions {
  /** Derive Lemmas trichotomy and less-nsucc in Q (default), or use them as hypotheses as the book does. */
  lemmas?: 'derived' | 'hypotheses';
}

/**
 * If m is the Gödel number of a refutation of R and no k ≤ m is the Gödel number of a
 * derivation of R, then ¬RProv(⌜R⌝) is derivable from ρ₁ and π₀, …, π_m.
 */
export function deriveRosserSecondHalf(m: number, opt: RosserSecondOptions = {}): Deriv {
  if (!Number.isInteger(m) || m < 0 || m > ROSSER_MAX) throw new Error(`m must be between 0 and ${ROSSER_MAX}`);
  const derived = (opt.lemmas ?? 'derived') === 'derived';
  const L: Labels = { next: 10 };

  // λ₂: a = 0 ∨ … ∨ a = m̄ ∨ m̄ < a, from λ₃ (trichotomy) and λ₁ (less-nsucc)
  const g2 = 'λ₂: a = 0 ∨ … ∨ a = m̄ ∨ m̄ < a';
  const target = Ast.or(upTo(a, m), Ast.less(num(m), a()));
  const triLemma = derived
    ? deriveTrichotomy(m, L)
    : D.hyp('trichotomy', trichotomyStatement(m), { group: g2, note: `Lemma trichotomy for m = ${m}: Q derives it; used here as a hypothesis (the book’s λ₃).` });
  const lambda3 = D.allE(triLemma, a(), { group: g2, note: `λ₃: trichotomy for ${m}̄, for a.` });
  const lambda2 = orCases(
    lambda3,
    (f, hyp) => {
      if (f.k === 'pred' && f.args[0].k === 'const' && f.args[0].index === 1) {
        // a < m̄
        if (m === 0) {
          const lz = D.allE({ ...deriveLessZero() }, a(), { group: g2, note: 'Lemma less-zero, for a: there is no a < 0.' });
          return D.botI(D.notE(lz, hyp(), { group: g2 }), target, { group: g2 });
        }
        const lemma = derived
          ? deriveLessNSucc(m - 1, L)
          : D.hyp('less-nsucc', lessNSuccStatement(m - 1), { group: g2, note: `Lemma less-nsucc for n = ${m - 1}; used here as a hypothesis.` });
        const l1 = D.impE(D.allE(lemma, a(), { group: g2 }), hyp(), { group: g2, note: `λ₁: a = 0 ∨ … ∨ a = ${m - 1}̄.` });
        return orInto(l1, target, g2);
      }
      return orInto(hyp(), target, g2);
    },
    L,
    g2,
    'The book’s ∨Elim²: each disjunct of λ₃ gives the disjunction (with ∨Intro*).',
  );

  // for each case a = k̄, π_k′; the case m̄ < a is what we want
  const gc = 'from Prf(a, ⌜R⌝): the cases';
  const lP = L.next++;
  const prfA = () => D.assume(prf(a(), R_NUM()), lP, { group: gc });
  const mLess = orCases(
    lambda2,
    (f, hyp) => {
      if (f.k === 'eq') {
        const k = Number((termValue(f.r) as { v: bigint }).v);
        const pi = D.hyp(`π${k}`, Ast.not(prf(num(k), R_NUM())), { group: gc, note: `π${k}: ${k} is not the Gödel number of a derivation of R (T is consistent), so Q ⊢ ¬Prf(${k}̄, ⌜R⌝).` });
        const e = D.eqE(hyp(), prfA(), prf(num(k), R_NUM()), { group: gc, note: `Replace a by ${k}̄.` });
        const bot = D.notE(pi, e, { group: gc, note: `π′${k}: a contradiction.` });
        return D.botI(bot, Ast.less(num(m), a()), { group: gc });
      }
      return hyp();
    },
    L,
    gc,
    'The book’s ∨Elim*: every case a = k̄ is impossible, so m̄ < a.',
  );
  const gi = 'the intermediate sentence';
  const rho1 = D.hyp('ρ1', refut(num(m), R_NUM()), { group: gi, note: `ρ₁: ${m} is the Gödel number of a refutation of R, and Refut represents the refutation relation, so Q ⊢ Refut(${m}̄, ⌜R⌝).` });
  const conj = D.andI(mLess, rho1, { group: gi });
  const inter = rosserSecondIntermediate();
  if (inter.k !== 'forall' || inter.body.k !== 'imp') throw new Error('shape');
  const exZ = D.exI(conj, Ast.exists(Ast.v(2), Ast.and(Ast.less(Ast.v(2), a()), refut(Ast.v(2), R_NUM()))), num(m), { group: gi, note: `∃Intro with ${m}̄.` });
  const imp = D.impI(exZ, prf(a(), R_NUM()), lP, { group: gi });
  const all = D.allI(imp, inter, 1, { group: gi, note: 'Eigenvariable a: only hypotheses without a remain.' });

  // the last step, which the book leaves as \DeduceC: ¬RProv(⌜R⌝)
  const gf = 'the conclusion ¬RProv(⌜R⌝)';
  const rprov = rprovR();
  if (rprov.k !== 'exists') throw new Error('RProv');
  const l3 = L.next++;
  const l4 = L.next++;
  const l5 = L.next++;
  const bodyB = Ast.and(prf(b(), R_NUM()), Ast.forall(Ast.v(2), Ast.imp(Ast.less(Ast.v(2), b()), Ast.not(refut(Ast.v(2), R_NUM())))));
  const hB = () => D.assume(bodyB, l4, { group: gf });
  const ex = D.impE(D.allE(all, b(), { group: gf }), D.andE(hB(), 'left', { group: gf }), { group: gf, note: 'Some z < b is the Gödel number of a refutation…' });
  const hC = () => D.assume(Ast.and(Ast.less(c(), b()), refut(c(), R_NUM())), l5, { group: gf });
  const noRef = D.impE(D.allE(D.andE(hB(), 'right', { group: gf }), c(), { group: gf }), D.andE(hC(), 'left', { group: gf }), { group: gf, note: '…but no z < b is, by the second conjunct of RProv.' });
  const bot = D.notE(noRef, D.andE(hC(), 'right', { group: gf }), { group: gf });
  const e1 = D.exE(ex, bot, 3, l5, { group: gf, note: 'Eigenvariable c.' });
  const e2 = D.exE(D.assume(rprov, l3, { group: gf, note: 'Suppose RProv(⌜R⌝).' }), e1, 2, l4, { group: gf, note: 'Eigenvariable b.' });
  return D.notI(e2, rprov, l3, { group: gf, note: 'So ¬RProv(⌜R⌝).' });
}
