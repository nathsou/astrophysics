// Derivations in Peano arithmetic: Q together with every instance of the induction schema
// (Definition in section 1.2, "Definitions"). PA has infinitely many axioms, so they cannot be
// listed; what makes PA axiomatizable is that instances of the schema can be recognised. That is
// how the checker is given PA here: an axiom leaf is accepted if it is an axiom of Q (Q8 with ↔
// written out, as in the appendix), or if the book's test (syntax/induction.ts,
// recognizeInduction) says that its sentence is an instance of the induction schema.
//
// Unlike the Q-derivations of numeral facts, each derivation below is ONE derivation of a
// universal sentence: induction does in PA what the metalanguage induction did for Q.

import * as A from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { formulaEq } from '../syntax/ops.ts';
import { formulaText } from '../syntax/print.ts';
import { inductionInstance, recognizeInduction, type InductionStep } from '../syntax/induction.ts';
import { check, D, linearize, symm, type CheckOptions, type CheckResult, type Deriv } from './nd.ts';
import { qUnfolded } from './arith.ts';
import { antecedent, axU, q8Left } from './less.ts';

export interface InductionAxiomUse {
  name: string;
  formula: Formula;
  /** The book's test, step by step. */
  steps: InductionStep[];
  recognized: boolean;
}

export interface PACheck extends CheckResult {
  induction: InductionAxiomUse[];
}

/** The prefix of the names of induction axioms in derivations. */
export const IND_PREFIX = 'Ind';

/**
 * Checks a derivation in PA. Axiom leaves named Q1–Q8 must be those axioms (Q8 written out);
 * axiom leaves named `Ind…` must be sentences that recognizeInduction accepts as instances of
 * the induction schema (and each name stands for one sentence). Everything else is the
 * natural deduction checker's.
 */
export function checkPA(root: Deriv, opt: Omit<CheckOptions, 'axioms'> = {}): PACheck {
  const axioms = new Map(qUnfolded());
  const induction: InductionAxiomUse[] = [];
  const seen = new Set<string>();
  for (const d of linearize(root)) {
    if (d.rule !== 'axiom' || !d.name || !d.name.startsWith(IND_PREFIX) || seen.has(d.name)) continue;
    seen.add(d.name);
    const r = recognizeInduction(d.concl);
    induction.push({ name: d.name, formula: d.concl, steps: r.steps, recognized: r.instance });
    if (r.instance) axioms.set(d.name, d.concl);
  }
  return { ...check(root, { ...opt, axioms }), induction };
}

const a = () => A.c(1);
const b = () => A.c(2);
const X = 0;
const Y = 1;
const Z = 2;
const x = () => A.v(X);
const y = () => A.v(Y);
const z = () => A.v(Z);

/** The name of the induction axiom for A(x): "Ind: A(x)" (or the given display of A). */
export function inductionName(Af: Formula, display?: string): string {
  return `${IND_PREFIX}: ${display ?? formulaText(Af)}`;
}

interface Induction {
  /** the instance, with ∀Elim for the parameters: (A(0) ∧ ∀x (A(x) → A(x′))) → ∀x A(x) */
  axiom: Deriv;
  base: Formula;
  step: Formula;
}

function induction(Af: Formula, xv: number, params: Term[], group: string, display?: string): Induction {
  let d = D.axiom(inductionName(Af, display), inductionInstance(Af, xv), { group, note: 'An instance of the induction schema: an axiom of PA.' });
  for (const t of params) d = D.allE(d, t, { group });
  const ant = antecedent(d);
  if (ant.k !== 'and') throw new Error('induction');
  return { axiom: d, base: ant.a, step: ant.b };
}

function finish(ind: Induction, base: Deriv, step: Deriv, group: string): Deriv {
  if (!formulaEq(base.concl, ind.base) || !formulaEq(step.concl, ind.step)) throw new Error('induction: base or step does not match');
  return D.impE(ind.axiom, D.andI(base, step, { group, note: 'Base case and inductive step.' }), { group, note: 'By the induction axiom.' });
}

// ------------------------------------------------------------------ the theorems

export interface PATheorem {
  id: string;
  /** The sentence, as text. */
  text: string;
  statement: () => Formula;
  derive: () => Deriv;
  /** What the derivation does, for the reader. */
  summary: string;
}

/** ∀x ¬x = x′ */
export function notSuccSelfStatement(): Formula {
  return A.forall(x(), A.not(A.eq(x(), A.succ(x()))));
}

export function deriveNotSuccSelf(): Deriv {
  const Af = A.not(A.eq(x(), A.succ(x())));
  const g0 = 'A(x) := ¬x = x′: base case';
  const gs = 'A(x) := ¬x = x′: inductive step';
  const ind = induction(Af, X, [], g0, '¬x = x′');
  const base = D.allE(axU('Q2', g0), A.zero(), { group: g0, note: 'Q2 for x := 0: ¬0 = 0′.' });
  const ih = D.assume(A.not(A.eq(a(), A.succ(a()))), 1, { group: gs, note: 'Inductive hypothesis: ¬a = a′.' });
  const h = D.assume(A.eq(A.succ(a()), A.succ(A.succ(a()))), 2, { group: gs, note: 'Suppose a′ = a′′.' });
  const q1 = D.allE(D.allE(axU('Q1', gs), a(), { group: gs }), A.succ(a()), { group: gs, note: 'Q1 for a and a′.' });
  const e = D.impE(q1, h, { group: gs, note: 'So a = a′.' });
  const bot = D.notE(ih, e, { group: gs, note: 'Against the inductive hypothesis.' });
  const neg = D.notI(bot, A.eq(A.succ(a()), A.succ(A.succ(a()))), 2, { group: gs });
  const imp = D.impI(neg, ih.concl, 1, { group: gs });
  const step = D.allI(imp, ind.step, 1, { group: gs, note: 'Eigenvariable a.' });
  return finish(ind, base, step, gs);
}

/** ∀x (0 + x) = x */
export function zeroAddStatement(): Formula {
  return A.forall(x(), A.eq(A.plus(A.zero(), x()), x()));
}

export function deriveZeroAdd(): Deriv {
  const Af = A.eq(A.plus(A.zero(), x()), x());
  const g0 = 'A(x) := (0 + x) = x: base case';
  const gs = 'A(x) := (0 + x) = x: inductive step';
  const ind = induction(Af, X, [], g0, '(0 + x) = x');
  const base = D.allE(axU('Q4', g0), A.zero(), { group: g0, note: 'Q4 for x := 0: (0 + 0) = 0.' });
  const ih = D.assume(A.eq(A.plus(A.zero(), a()), a()), 1, { group: gs, note: 'Inductive hypothesis: (0 + a) = a.' });
  const q5 = D.allE(D.allE(axU('Q5', gs), A.zero(), { group: gs }), a(), { group: gs, note: 'Q5: (0 + a′) = (0 + a)′.' });
  const e = D.eqE(ih, q5, A.eq(A.plus(A.zero(), A.succ(a())), A.succ(a())), { group: gs, note: 'Replace 0 + a by a: (0 + a′) = a′.' });
  const imp = D.impI(e, ih.concl, 1, { group: gs });
  const step = D.allI(imp, ind.step, 1, { group: gs, note: 'Eigenvariable a.' });
  return finish(ind, base, step, gs);
}

/** ∀x ∀y (x′ + y) = (x + y)′ */
export function succAddStatement(): Formula {
  return A.forall(x(), A.forall(y(), A.eq(A.plus(A.succ(x()), y()), A.succ(A.plus(x(), y())))));
}

export function deriveSuccAdd(): Deriv {
  const Af = A.eq(A.plus(A.succ(x()), y()), A.succ(A.plus(x(), y())));
  const g0 = 'A(x, y) := (x′ + y) = (x + y)′, induction on y: base case';
  const gs = 'A(x, y) := (x′ + y) = (x + y)′: inductive step';
  const gf = '(x′ + y) = (x + y)′: conclusion';
  const ind = induction(Af, Y, [a()], g0, '(x′ + y) = (x + y)′');
  const q4s = D.allE(axU('Q4', g0), A.succ(a()), { group: g0, note: 'Q4: (a′ + 0) = a′.' });
  const q4 = D.allE(axU('Q4', g0), a(), { group: g0, note: 'Q4: (a + 0) = a.' });
  const base = D.eqE(q4, q4s, A.eq(A.plus(A.succ(a()), A.zero()), A.succ(A.plus(a(), A.zero()))), { group: g0, note: 'Replace a (in a′ on the right) by a + 0: (a′ + 0) = (a + 0)′.' });
  const ih = D.assume(A.eq(A.plus(A.succ(a()), b()), A.succ(A.plus(a(), b()))), 1, { group: gs, note: 'Inductive hypothesis: (a′ + b) = (a + b)′.' });
  const q5s = D.allE(D.allE(axU('Q5', gs), A.succ(a()), { group: gs }), b(), { group: gs, note: 'Q5: (a′ + b′) = (a′ + b)′.' });
  const s1 = D.eqE(ih, q5s, A.eq(A.plus(A.succ(a()), A.succ(b())), A.succ(A.succ(A.plus(a(), b())))), { group: gs, note: 'By the hypothesis: (a′ + b′) = (a + b)′′.' });
  const q5 = D.allE(D.allE(axU('Q5', gs), a(), { group: gs }), b(), { group: gs, note: 'Q5: (a + b′) = (a + b)′.' });
  const s2 = D.eqE(q5, s1, A.eq(A.plus(A.succ(a()), A.succ(b())), A.succ(A.plus(a(), A.succ(b())))), { group: gs, note: 'Replace (a + b)′ by a + b′: (a′ + b′) = (a + b′)′.' });
  const imp = D.impI(s2, ih.concl, 1, { group: gs });
  const step = D.allI(imp, ind.step, 2, { group: gs, note: 'Eigenvariable b.' });
  const all = finish(ind, base, step, gf);
  return D.allI(all, succAddStatement(), 1, { group: gf, note: 'Eigenvariable a: the only undischarged assumptions are axioms.' });
}

/** ∀x ∀y (x + y) = (y + x) */
export function commStatement(): Formula {
  return A.forall(x(), A.forall(y(), A.eq(A.plus(x(), y()), A.plus(y(), x()))));
}

export function deriveComm(): Deriv {
  const Af = A.eq(A.plus(x(), y()), A.plus(y(), x()));
  const g0 = 'A(x, y) := (x + y) = (y + x), induction on y: base case';
  const gs = 'A(x, y) := (x + y) = (y + x): inductive step';
  const gf = '(x + y) = (y + x): conclusion';
  const ind = induction(Af, Y, [a()], g0, '(x + y) = (y + x)');
  const zeroAdd = { ...deriveZeroAdd() };
  const succAdd = { ...deriveSuccAdd() };
  const q4 = D.allE(axU('Q4', g0), a(), { group: g0, note: 'Q4: (a + 0) = a.' });
  const za = D.allE(zeroAdd, a(), { group: g0, note: 'The lemma ∀x (0 + x) = x (derived above), for a.' });
  const base = D.eqE(za, q4, A.eq(A.plus(a(), A.zero()), A.plus(A.zero(), a())), { group: g0, note: 'Replace a (on the right) by 0 + a.' });
  const ih = D.assume(A.eq(A.plus(a(), b()), A.plus(b(), a())), 1, { group: gs, note: 'Inductive hypothesis: (a + b) = (b + a).' });
  const q5 = D.allE(D.allE(axU('Q5', gs), a(), { group: gs }), b(), { group: gs, note: 'Q5: (a + b′) = (a + b)′.' });
  const s1 = D.eqE(ih, q5, A.eq(A.plus(a(), A.succ(b())), A.succ(A.plus(b(), a()))), { group: gs, note: 'By the hypothesis: (a + b′) = (b + a)′.' });
  const sa = D.allE(D.allE(succAdd, b(), { group: gs }), a(), { group: gs, note: 'The lemma ∀x ∀y (x′ + y) = (x + y)′ (derived above), for b and a.' });
  const s2 = D.eqE(sa, s1, A.eq(A.plus(a(), A.succ(b())), A.plus(A.succ(b()), a())), { group: gs, note: 'Replace (b + a)′ by b′ + a.' });
  const imp = D.impI(s2, ih.concl, 1, { group: gs });
  const step = D.allI(imp, ind.step, 2, { group: gs, note: 'Eigenvariable b.' });
  const all = finish(ind, base, step, gf);
  return D.allI(all, commStatement(), 1, { group: gf, note: 'Eigenvariable a.' });
}

/** ∀x ∀z ¬(z′ + x) = x */
export function noSuccSumStatement(): Formula {
  return A.forall(x(), A.forall(z(), A.not(A.eq(A.plus(A.succ(z()), x()), x()))));
}

export function deriveNoSuccSum(): Deriv {
  const Af = A.forall(z(), A.not(A.eq(A.plus(A.succ(z()), x()), x())));
  const g0 = 'A(x) := ∀z ¬(z′ + x) = x: base case';
  const gs = 'A(x) := ∀z ¬(z′ + x) = x: inductive step';
  const ind = induction(Af, X, [], g0, '∀z ¬(z′ + x) = x');
  // base: ∀z ¬(z′ + 0) = 0
  const hb = D.assume(A.eq(A.plus(A.succ(b()), A.zero()), A.zero()), 2, { group: g0, note: 'Suppose (b′ + 0) = 0.' });
  const q4 = D.allE(axU('Q4', g0), A.succ(b()), { group: g0, note: 'Q4: (b′ + 0) = b′.' });
  const e1 = D.eqE(q4, hb, A.eq(A.succ(b()), A.zero()), { group: g0, note: 'So b′ = 0.' });
  const e2 = symm(e1, { group: g0 });
  const q2 = D.allE(axU('Q2', g0), b(), { group: g0, note: 'Q2: ¬0 = b′.' });
  const nb = D.notI(D.notE(q2, e2, { group: g0 }), hb.concl, 2, { group: g0 });
  const base = D.allI(nb, ind.base, 2, { group: g0, note: 'Eigenvariable b.' });
  // step
  const ihF = A.forall(z(), A.not(A.eq(A.plus(A.succ(z()), a()), a())));
  const ih = () => D.assume(ihF, 1, { group: gs, note: 'Inductive hypothesis: ∀z ¬(z′ + a) = a.' });
  const hs = D.assume(A.eq(A.plus(A.succ(b()), A.succ(a())), A.succ(a())), 3, { group: gs, note: 'Suppose (b′ + a′) = a′.' });
  const q5 = D.allE(D.allE(axU('Q5', gs), A.succ(b()), { group: gs }), a(), { group: gs, note: 'Q5: (b′ + a′) = (b′ + a)′.' });
  const s1 = D.eqE(q5, hs, A.eq(A.succ(A.plus(A.succ(b()), a())), A.succ(a())), { group: gs, note: 'So (b′ + a)′ = a′.' });
  const q1 = D.allE(D.allE(axU('Q1', gs), A.plus(A.succ(b()), a()), { group: gs }), a(), { group: gs, note: 'Q1.' });
  const s2 = D.impE(q1, s1, { group: gs, note: 'So (b′ + a) = a.' });
  const bot = D.notE(D.allE(ih(), b(), { group: gs }), s2, { group: gs, note: 'Against the inductive hypothesis for b.' });
  const ns = D.notI(bot, hs.concl, 3, { group: gs });
  const allB = D.allI(ns, A.forall(z(), A.not(A.eq(A.plus(A.succ(z()), A.succ(a())), A.succ(a())))), 2, { group: gs, note: 'Eigenvariable b: the inductive hypothesis does not mention b.' });
  const imp = D.impI(allB, ihF, 1, { group: gs });
  const step = D.allI(imp, ind.step, 1, { group: gs, note: 'Eigenvariable a.' });
  return finish(ind, base, step, gs);
}

/** ∀x ¬x < x */
export function irreflexiveStatement(): Formula {
  return A.forall(x(), A.not(A.less(x(), x())));
}

export function deriveIrreflexive(): Deriv {
  const g = 'from the lemma and Q8';
  const lemma = { ...deriveNoSuccSum() };
  const h = D.assume(A.less(a(), a()), 1, { group: g, note: 'Suppose a < a.' });
  const ex = D.impE(q8Left(a(), a(), g), h, { group: g, note: 'By Q8, ∃z (z′ + a) = a.' });
  const hb = D.assume(A.eq(A.plus(A.succ(b()), a()), a()), 2, { group: g, note: 'Let b be such a z.' });
  const nb = D.allE(D.allE(lemma, a(), { group: g }), b(), { group: g, note: 'The lemma (derived above), for a and b.' });
  const bot = D.exE(ex, D.notE(nb, hb, { group: g }), 2, 2, { group: g, note: 'Eigenvariable b.' });
  const neg = D.notI(bot, A.less(a(), a()), 1, { group: g });
  return D.allI(neg, irreflexiveStatement(), 1, { group: g, note: 'Eigenvariable a.' });
}

export const PA_THEOREMS: PATheorem[] = [
  { id: 'nsucc', text: '∀x ¬x = x′', statement: notSuccSelfStatement, derive: deriveNotSuccSelf, summary: 'The shortest induction: the base case is Q2, the step uses Q1.' },
  { id: 'zeroadd', text: '∀x (0 + x) = x', statement: zeroAddStatement, derive: deriveZeroAdd, summary: 'Q4 says x + 0 = x; that 0 + x = x needs induction on x, with Q5 in the step.' },
  { id: 'succadd', text: '∀x ∀y (x′ + y) = (x + y)′', statement: succAddStatement, derive: deriveSuccAdd, summary: 'Lemma inc.req.min “succ” proves each instance with a numeral for y in Q; with induction on y, PA proves it for all y.' },
  { id: 'comm', text: '∀x ∀y (x + y) = (y + x)', statement: commStatement, derive: deriveComm, summary: 'Commutativity of addition, by induction on y, using the two lemmas above (their derivations are part of this one).' },
  { id: 'irrefl', text: '∀x ¬x < x', statement: irreflexiveStatement, derive: deriveIrreflexive, summary: 'By induction, ∀x ∀z ¬(z′ + x) = x; with Q8, nothing is less than itself.' },
];
