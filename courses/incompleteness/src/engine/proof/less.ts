// Q's reasoning about < (section "Regular Minimization is Representable in Q"), mechanised.
//
// The book proves Lemmas less-nsucc and trichotomy "by induction on n" in the metalanguage and
// only sketches the derivations. The functions below build, for a given n, the derivation that
// the induction describes — the derivation for n + 1 contains the one for n, as the inductive
// hypothesis — following the book's case analysis step by step. Lemma less-zero is the
// appendix's derivation (deriveLessZero), used here as a sub-derivation.
//
// As in the appendix, Q8 is given to the checker with ↔ written out as the book defines it
// (qUnfolded): the checker has rules for the primitive connectives only.
//
// A checked derivation for a particular n is not a proof of the lemma for every n; the induction
// in the text is.

import * as A from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { formulaEq, numeralValue } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { D, type Deriv } from './nd.ts';
import { deriveAdd, deriveNeq, num } from './q.ts';
import { deriveLessZero, qUnfolded } from './arith.ts';

export interface Labels {
  next: number;
}

/** Largest n for which the lemma derivations are generated (they grow like n³ for less-nsucc). */
export const LESS_MAX = 12;

// ------------------------------------------------------------------ small tools

let qu: Map<string, Formula> | null = null;
const QU = () => (qu ??= qUnfolded());
export const axU = (name: string, group?: string) => D.axiom(name, A.cloneFresh(QU().get(name)!), { group });

const X = 0; // x
const Y = 1; // y
const a = () => A.c(1);
const b = () => A.c(2);
const c = () => A.c(3);

/** Q8 for s, t, left to right: s < t → ∃z (z′ + s) = t. */
export function q8Left(s: Term, t: Term, group?: string): Deriv {
  const inst = D.allE(D.allE(axU('Q8', group), s, { group }), t, { group, note: 'Q8 (↔ written out as the book defines it).' });
  return D.andE(inst, 'left', { group, note: 'The direction from < to its definition.' });
}

/** Q8 for s, t, right to left: ∃z (z′ + s) = t → s < t. */
export function q8Right(s: Term, t: Term, group?: string): Deriv {
  const inst = D.allE(D.allE(axU('Q8', group), s, { group }), t, { group, note: 'Q8 (↔ written out as the book defines it).' });
  return D.andE(inst, 'right', { group, note: 'The direction from the definition to <.' });
}

/** The antecedent of a conditional derivation (for building the premise it needs). */
export function antecedent(d: Deriv): Formula {
  if (d.concl.k !== 'imp') throw new Error('not a conditional');
  return d.concl.a;
}

/** The body of ∃y B(y) with t for y. */
function exBody(f: Formula, t: Term): Formula {
  if (f.k !== 'exists') throw new Error('not existential');
  return subst(f.body, f.v.index, t);
}

/** t = 0̄ ∨ … ∨ t = n̄ (n + 1 disjuncts, left-nested as the parser reads x = 0 ∨ x = 1 ∨ …). */
export function upTo(t: () => Term, n: number): Formula {
  let f: Formula = A.eq(t(), num(0));
  for (let k = 1; k <= n; k++) f = A.or(f, A.eq(t(), num(k)));
  return f;
}

/** (t < m̄ ∨ m̄ < t) ∨ t = m̄, the book's statement of trichotomy. */
export function trich(t: () => Term, m: number): Formula {
  return A.or(A.or(A.less(t(), num(m)), A.less(num(m), t())), A.eq(t(), num(m)));
}

/** s′ with n primes. */
export function succs(t: Term, n: number): Term {
  let r = t;
  for (let i = 0; i < n; i++) r = A.succ(r);
  return r;
}

function hasDisjunct(f: Formula, g: Formula): boolean {
  return formulaEq(f, g) || (f.k === 'or' && (hasDisjunct(f.a, g) || hasDisjunct(f.b, g)));
}

/** From a derivation of one disjunct, ∨Intro steps up to the (nested) disjunction `target`. */
export function orInto(d: Deriv, target: Formula, group?: string): Deriv {
  if (formulaEq(d.concl, target)) return d;
  if (target.k !== 'or') throw new Error('orInto: not a disjunct of the target');
  if (hasDisjunct(target.b, d.concl)) return D.orI(orInto(d, target.b, group), target, { group });
  if (hasDisjunct(target.a, d.concl)) return D.orI(orInto(d, target.a, group), target, { group });
  throw new Error('orInto: not a disjunct of the target');
}

/**
 * ∨Elim over every disjunct of a nested disjunction (the book's ∨Elim*). `leaf` gets a disjunct
 * and a function producing an assumption of it (with the label the ∨Elim discharges), and
 * derives the common conclusion. If the major premise is not a disjunction, `leaf` gets the
 * major premise itself (call `hyp` once only in that case).
 */
export function orCases(major: Deriv, leaf: (f: Formula, hyp: () => Deriv) => Deriv, L: Labels, group?: string, note?: string): Deriv {
  const f = major.concl;
  if (f.k !== 'or') return leaf(f, () => major);
  const lab = L.next++;
  const side = (g: Formula): Deriv => (g.k === 'or' ? orCases(D.assume(g, lab, { group }), leaf, L, group) : leaf(g, () => D.assume(g, lab, { group })));
  const left = side(f.a);
  const right = side(f.b);
  return D.orE(major, left, right, lab, { group, note: note ?? `Proof by cases, discharging the assumptions labelled ${lab}.` });
}

/** From s = t derive s′ = t′ ("by logic": =Intro and =Elim). */
export function congSucc(p: Deriv, group?: string): Deriv {
  const e = p.concl;
  if (e.k !== 'eq') throw new Error('congSucc');
  const refl = D.eqI(A.succ(e.l), { group });
  return D.eqE(p, refl, A.eq(A.succ(A.cloneFresh(e.l)), A.succ(A.cloneFresh(e.r))), { group, note: 'Replace the second occurrence: from s = t, s′ = t′.' });
}

/** The value of a numeral term. */
function valueOf(t: Term): number {
  const v = numeralValue(t);
  if (!v || v.k !== 'lit') throw new Error('not a numeral');
  return Number(v.v);
}

function checkN(n: number, min = 0) {
  if (!Number.isInteger(n) || n < min || n > LESS_MAX) throw new Error(`n must be an integer between ${min} and ${LESS_MAX}`);
}

// ------------------------------------------------------------------ Lemma less-nsucc

/** ∀x (x < n+1 → (x = 0 ∨ … ∨ x = n̄)). */
export function lessNSuccStatement(n: number): Formula {
  return A.forall(A.v(X), A.imp(A.less(A.v(X), num(n + 1)), upTo(() => A.v(X), n)));
}

/**
 * Q ⊢ ∀x (x < n+1 → (x = 0 ∨ … ∨ x = n̄)), by the book's induction on n: the derivation for n
 * uses the one for n − 1 (the inductive hypothesis) as a sub-derivation.
 */
export function deriveLessNSucc(n: number, L: Labels = { next: 1 }): Deriv {
  checkN(n);
  return n === 0 ? lessNSuccBase(L) : lessNSuccStep(n, L);
}

function lessNSuccBase(L: Labels): Deriv {
  const g0 = 'less-nsucc, n = 0: from a < 1̄ to (b′ + a) = 1̄';
  const g1 = 'case a = c′: then c < 0, against less-zero';
  const gf = 'less-nsucc, n = 0: conclusion';
  const l1 = L.next++;
  const lessA = D.assume(A.less(a(), num(1)), l1, { group: g0, note: 'Suppose a < 1̄.' });
  const ex = D.impE(q8Left(a(), num(1), g0), lessA, { group: g0, note: 'By Q8, ∃y (y′ + a) = 1̄ (1̄ is 0′).' });
  const l2 = L.next++;
  const sum = () => D.assume(exBody(ex.concl, b()), l2, { group: g1 });
  const q3 = D.allE(axU('Q3', g1), a(), { group: g1, note: 'Q3: a = 0 or a is a successor.' });
  if (q3.concl.k !== 'or') throw new Error('Q3');
  const l3 = L.next++;
  const left = D.assume(q3.concl.a, l3, { group: g1, note: 'In the first case there is nothing to show.' });
  const l4 = L.next++;
  const aSc = D.assume(exBody(q3.concl.b, c()), l4, { group: g1, note: 'Suppose a = c′.' });
  const s1 = D.eqE(aSc, sum(), A.eq(A.plus(A.succ(b()), A.succ(c())), num(1)), { group: g1, note: 'Replace a by c′: (b′ + c′) = 1̄.' });
  const q5 = D.allE(D.allE(axU('Q5', g1), A.succ(b()), { group: g1 }), c(), { group: g1, note: 'Q5: (b′ + c′) = (b′ + c)′.' });
  const s2 = D.eqE(q5, s1, A.eq(A.succ(A.plus(A.succ(b()), c())), num(1)), { group: g1, note: 'So (b′ + c)′ = 0′.' });
  const q1 = D.allE(D.allE(axU('Q1', g1), A.plus(A.succ(b()), c()), { group: g1 }), A.zero(), { group: g1, note: 'Q1 with x := b′ + c, y := 0.' });
  const s3 = D.impE(q1, s2, { group: g1, note: 'By Q1, (b′ + c) = 0.' });
  const r8 = q8Right(c(), A.zero(), g1);
  const s4 = D.exI(s3, antecedent(r8), b(), { group: g1, note: '∃Intro on b.' });
  const s5 = D.impE(r8, s4, { group: g1, note: 'By Q8, c < 0.' });
  const lz = D.allE({ ...deriveLessZero(), group: g1 }, c(), { group: g1, note: 'Lemma less-zero (its derivation is above), for c.' });
  const bot = D.notE(lz, s5, { group: g1, note: 'c < 0 contradicts less-zero.' });
  const right = D.exE(D.assume(q3.concl.b, l3, { group: g1 }), D.botI(bot, A.eq(a(), A.zero()), { group: g1 }), 3, l4, { group: g1, note: 'Eigenvariable c.' });
  const cases = D.orE(q3, left, right, l3, { group: g1, note: 'Either way a = 0.' });
  const exe = D.exE(ex, cases, 2, l2, { group: gf, note: 'Eigenvariable b: it occurs neither in ∃y (y′ + a) = 1̄, nor in a = 0, nor in a < 1̄.' });
  const imp = D.impI(exe, A.less(a(), num(1)), l1, { group: gf });
  return D.allI(imp, lessNSuccStatement(0), 1, { group: gf, note: 'Eigenvariable a: no undischarged assumption mentions it.' });
}

function lessNSuccStep(n: number, L: Labels): Deriv {
  const ih = deriveLessNSucc(n - 1, L);
  const g0 = `less-nsucc, n = ${n}: cases by Q3`;
  const g1 = `less-nsucc, n = ${n}: from b′ < ${n + 1} to b < ${n}`;
  const g2 = `less-nsucc, n = ${n}: the inductive hypothesis, and a = b′`;
  const gf = `less-nsucc, n = ${n}: conclusion`;
  const target = () => upTo(a, n);
  const l1 = L.next++;
  const lessA = () => D.assume(A.less(a(), num(n + 1)), l1, { group: g1 });
  const q3 = D.allE(axU('Q3', g0), a(), { group: g0, note: 'Q3: a = 0 or a is a successor.' });
  if (q3.concl.k !== 'or') throw new Error('Q3');
  const l3 = L.next++;
  const left = orInto(D.assume(q3.concl.a, l3, { group: g0, note: 'First case: a = 0, the first disjunct.' }), target(), g0);
  const l4 = L.next++;
  const aIsBs = exBody(q3.concl.b, b());
  const ab = () => D.assume(A.cloneFresh(aIsBs), l4, { group: g1 });
  // b′ < n+1, then b < n̄
  const s1 = D.eqE(ab(), lessA(), A.less(A.succ(b()), num(n + 1)), { group: g1, note: `Replace a by b′: b′ < ${n + 1}̄, i.e. b′ < ${n}̄′.` });
  const ex = D.impE(q8Left(A.succ(b()), num(n + 1), g1), s1, { group: g1, note: `By Q8, ∃z (z′ + b′) = ${n + 1}̄.` });
  const l5 = L.next++;
  const h = D.assume(exBody(ex.concl, c()), l5, { group: g1, note: 'Let c be such a z.' });
  const q5 = D.allE(D.allE(axU('Q5', g1), A.succ(c()), { group: g1 }), b(), { group: g1, note: 'Q5: (c′ + b′) = (c′ + b)′.' });
  const t1 = D.eqE(q5, h, A.eq(A.succ(A.plus(A.succ(c()), b())), num(n + 1)), { group: g1, note: `So (c′ + b)′ = ${n}̄′.` });
  const q1 = D.allE(D.allE(axU('Q1', g1), A.plus(A.succ(c()), b()), { group: g1 }), num(n), { group: g1, note: `Q1 with x := c′ + b, y := ${n}̄.` });
  const t2 = D.impE(q1, t1, { group: g1, note: `By Q1, (c′ + b) = ${n}̄.` });
  const r8 = q8Right(b(), num(n), g1);
  const t3 = D.exI(t2, antecedent(r8), c(), { group: g1 });
  const t4 = D.impE(r8, t3, { group: g1, note: `By Q8, b < ${n}̄.` });
  const bLess = D.exE(ex, t4, 3, l5, { group: g1, note: 'Eigenvariable c.' });
  // the inductive hypothesis for b, and then a = b′
  const ihB = D.allE({ ...ih, group: ih.group }, b(), { group: g2, note: `The inductive hypothesis (the derivation for n = ${n - 1}, above), for b.` });
  const cases = D.impE(ihB, bLess, { group: g2, note: `b = 0 ∨ … ∨ b = ${n - 1}̄.` });
  const each = orCases(
    cases,
    (f, hyp) => {
      if (f.k !== 'eq') throw new Error('disjunct');
      const k = valueOf(f.r);
      const e = D.eqE(hyp(), ab(), A.eq(a(), num(k + 1)), { group: g2, note: `b = ${k}̄ and a = b′, so a = ${k + 1}̄.` });
      return orInto(e, target(), g2);
    },
    L,
    g2,
    'From each disjunct for b, the corresponding one for a (∨Elim*).',
  );
  const right = D.exE(D.assume(q3.concl.b, l3, { group: g2 }), each, 2, l4, { group: g2, note: 'Eigenvariable b.' });
  const both = D.orE(q3, left, right, l3, { group: gf, note: 'Both cases of Q3 give the disjunction.' });
  const imp = D.impI(both, A.less(a(), num(n + 1)), l1, { group: gf });
  return D.allI(imp, lessNSuccStatement(n), 1, { group: gf, note: 'Eigenvariable a: no undischarged assumption mentions it.' });
}

// ------------------------------------------------------------------ Lemma trichotomy

/** ∀y ((y < m̄ ∨ m̄ < y) ∨ y = m̄). */
export function trichotomyStatement(m: number): Formula {
  return A.forall(A.v(Y), trich(() => A.v(Y), m));
}

/** Q ⊢ ∀y ((y < m̄ ∨ m̄ < y) ∨ y = m̄), by the book's induction on m. */
export function deriveTrichotomy(m: number, L: Labels = { next: 1 }): Deriv {
  checkN(m);
  return m === 0 ? trichBase(L) : trichStep(m, L);
}

function trichBase(L: Labels): Deriv {
  const g = 'trichotomy, m = 0';
  const target = () => trich(a, 0);
  const q3 = D.allE(axU('Q3', g), a(), { group: g, note: 'Q3: a = 0 or a is a successor.' });
  if (q3.concl.k !== 'or') throw new Error('Q3');
  const l1 = L.next++;
  const left = orInto(D.assume(q3.concl.a, l1, { group: g, note: 'If a = 0, the last disjunct holds.' }), target(), g);
  const l2 = L.next++;
  const h = D.assume(exBody(q3.concl.b, b()), l2, { group: g, note: 'Suppose a = b′.' });
  const e1 = D.eqI(A.plus(A.succ(b()), A.zero()), { group: g });
  const e2 = D.eqE(h, e1, A.eq(A.plus(A.succ(b()), A.zero()), A.plus(a(), A.zero())), { group: g, note: '(b′ + 0) = (a + 0) “by the logic of =”.' });
  const q4 = D.allE(axU('Q4', g), a(), { group: g, note: 'Q4: (a + 0) = a.' });
  const e3 = D.eqE(q4, e2, A.eq(A.plus(A.succ(b()), A.zero()), a()), { group: g, note: 'So (b′ + 0) = a.' });
  const r8 = q8Right(A.zero(), a(), g);
  const e4 = D.exI(e3, antecedent(r8), b(), { group: g });
  const e5 = D.impE(r8, e4, { group: g, note: 'By Q8, 0 < a.' });
  const right = D.exE(D.assume(q3.concl.b, l1, { group: g }), orInto(e5, target(), g), 2, l2, { group: g, note: 'Eigenvariable b.' });
  const cases = D.orE(q3, left, right, l1, { group: g });
  return D.allI(cases, trichotomyStatement(0), 1, { group: g, note: 'Eigenvariable a.' });
}

function trichStep(m: number, L: Labels): Deriv {
  const p = m - 1;
  const ih = deriveTrichotomy(p, L);
  const g0 = `trichotomy, m = ${m}: case a = 0`;
  const gL = `trichotomy, m = ${m}: b < ${p}̄ gives a < ${m}̄`;
  const gG = `trichotomy, m = ${m}: ${p}̄ < b gives ${m}̄ < a`;
  const gE = `trichotomy, m = ${m}: b = ${p}̄ gives a = ${m}̄`;
  const gf = `trichotomy, m = ${m}: conclusion`;
  const target = () => trich(a, m);
  const q3 = D.allE(axU('Q3', g0), a(), { group: g0, note: 'Q3: a = 0 or a is a successor.' });
  if (q3.concl.k !== 'or') throw new Error('Q3');
  const l1 = L.next++;
  // case a = 0: (m̄ + a) = m̄, so a < m̄
  const h0 = D.assume(q3.concl.a, l1, { group: g0 });
  const q4 = D.allE(axU('Q4', g0), num(m), { group: g0, note: `Q4: (${m}̄ + 0) = ${m}̄.` });
  const z1 = D.eqE(h0, q4, A.eq(A.plus(num(m), a()), num(m)), { group: g0, note: `Replace 0 by a: (${p}̄′ + a) = ${m}̄.` });
  const r80 = q8Right(a(), num(m), g0);
  const z2 = D.exI(z1, antecedent(r80), num(p), { group: g0, note: `∃Intro on ${p}̄.` });
  const z3 = D.impE(r80, z2, { group: g0, note: `By Q8, a < ${m}̄.` });
  const left = orInto(z3, target(), g0);
  // case a = b′
  const l2 = L.next++;
  const aIsBs = exBody(q3.concl.b, b());
  const ab = (group: string) => D.assume(A.cloneFresh(aIsBs), l2, { group });
  const ihB = D.allE({ ...ih }, b(), { group: gL, note: `The inductive hypothesis (the derivation for m = ${p}, above), for b.` });
  const each = orCases(
    ihB,
    (f, hyp) => {
      const lab = L.next++;
      const isB = (t: Term) => t.k === 'const' && t.index === 2;
      if (f.k === 'pred' && isB(f.args[0])) {
        // b < p̄
        const ex = D.impE(q8Left(b(), num(p), gL), hyp(), { group: gL, note: `By Q8, ∃z (z′ + b) = ${p}̄.` });
        const h = D.assume(exBody(ex.concl, c()), lab, { group: gL, note: 'Let c be such a z.' });
        const e1 = congSucc(h, gL);
        const q5 = D.allE(D.allE(axU('Q5', gL), A.succ(c()), { group: gL }), b(), { group: gL, note: 'Q5: (c′ + b′) = (c′ + b)′.' });
        const e2 = D.eqE(e1, q5, A.eq(A.plus(A.succ(c()), A.succ(b())), num(m)), { group: gL, note: `Hence (c′ + b′) = ${p}̄′, and ${p}̄′ is ${m}̄.` });
        const r8 = q8Right(A.succ(b()), num(m), gL);
        const e3 = D.exI(e2, antecedent(r8), c(), { group: gL, note: 'Existentially generalise on c.' });
        const e4 = D.impE(r8, e3, { group: gL, note: `By Q8, b′ < ${m}̄.` });
        const e5 = D.eqE(ab(gL), e4, A.less(a(), num(m)), { group: gL, note: `Since a = b′, a < ${m}̄.` });
        return D.exE(ex, orInto(e5, target(), gL), 3, lab, { group: gL, note: 'Eigenvariable c.' });
      }
      if (f.k === 'pred') {
        // p̄ < b
        const ex = D.impE(q8Left(num(p), b(), gG), hyp(), { group: gG, note: `By Q8, ∃z (z′ + ${p}̄) = b.` });
        const h = D.assume(exBody(ex.concl, c()), lab, { group: gG, note: 'Let c be such a z.' });
        const e1 = congSucc(h, gG);
        const q5 = D.allE(D.allE(axU('Q5', gG), A.succ(c()), { group: gG }), num(p), { group: gG, note: `Q5: (c′ + ${p}̄′) = (c′ + ${p}̄)′.` });
        const e2 = D.eqE(e1, q5, A.eq(A.plus(A.succ(c()), num(m)), A.succ(b())), { group: gG, note: `Hence (c′ + ${m}̄) = b′.` });
        const e3 = D.eqE(ab(gG), e2, A.eq(A.plus(A.succ(c()), num(m)), a()), { group: gG, note: `Since a = b′, (c′ + ${m}̄) = a.` });
        const r8 = q8Right(num(m), a(), gG);
        const e4 = D.exI(e3, antecedent(r8), c(), { group: gG });
        const e5 = D.impE(r8, e4, { group: gG, note: `By Q8, ${m}̄ < a.` });
        return D.exE(ex, orInto(e5, target(), gG), 3, lab, { group: gG, note: 'Eigenvariable c.' });
      }
      // b = p̄
      const e = D.eqE(hyp(), ab(gE), A.eq(a(), num(m)), { group: gE, note: `b = ${p}̄ and a = b′, so a = ${p}̄′, which is ${m}̄.` });
      return orInto(e, target(), gE);
    },
    L,
    gf,
    'From each disjunct of the case for m − 1 and b, the corresponding disjunct for m and a.',
  );
  const right = D.exE(D.assume(q3.concl.b, l1, { group: gf }), each, 2, l2, { group: gf, note: 'Eigenvariable b.' });
  const cases = D.orE(q3, left, right, l1, { group: gf });
  return D.allI(cases, trichotomyStatement(m), 1, { group: gf, note: 'Eigenvariable a.' });
}

// ------------------------------------------------------------------ k̄ < n̄ and ¬ k̄ < n̄

/** Q ⊢ k̄ < n̄ for k < n: Q8 with the witness n − k − 1 and the addition lemma. */
export function deriveLess(k: number, n: number): Deriv {
  if (!(Number.isInteger(k) && Number.isInteger(n) && 0 <= k && k < n && n <= 4 * LESS_MAX)) throw new Error('deriveLess needs 0 ≤ k < n');
  const g = `${k}̄ < ${n}̄`;
  const r8 = q8Right(num(k), num(n), g);
  const add = deriveAdd(BigInt(n - k), BigInt(k), g);
  const ex = D.exI(add, antecedent(r8), num(n - k - 1), { group: g, note: `∃Intro: ${n - k}̄ is ${n - k - 1}̄′, so this is (z′ + ${k}̄) = ${n}̄ for z := ${n - k - 1}̄.` });
  return D.impE(r8, ex, { group: g, note: `By Q8, ${k}̄ < ${n}̄.` });
}

/**
 * Q ⊢ ¬ k̄ < n̄ for k ≥ n, from the book's lemmas: less-zero if n = 0; otherwise less-nsucc for
 * n − 1 gives k̄ = 0 ∨ … ∨ k̄ = n−1, and each disjunct is refuted by Lemma q-proves-neq.
 */
export function deriveNotLess(k: number, n: number, L: Labels = { next: 1 }): Deriv {
  if (!(Number.isInteger(k) && Number.isInteger(n) && 0 <= n && n <= k && n <= LESS_MAX)) throw new Error('deriveNotLess needs 0 ≤ n ≤ k');
  const g = `¬${k}̄ < ${n}̄`;
  if (n === 0) return D.allE(deriveLessZero(), num(k), { group: g, note: `Lemma less-zero, for ${k}̄.` });
  const lemma = deriveLessNSucc(n - 1, L);
  const l1 = L.next++;
  const h = D.assume(A.less(num(k), num(n)), l1, { group: g, note: `Suppose ${k}̄ < ${n}̄.` });
  const cases = D.impE(D.allE(lemma, num(k), { group: g, note: `Lemma less-nsucc for n = ${n - 1}, for ${k}̄.` }), h, { group: g });
  const bot = orCases(
    cases,
    (f, hyp) => {
      if (f.k !== 'eq') throw new Error('disjunct');
      const j = valueOf(f.r);
      return D.notE({ ...deriveNeq(BigInt(k), BigInt(j), L), group: g }, hyp(), { group: g, note: `${k} ≠ ${j}, and Q proves ${k}̄ ≠ ${j}̄.` });
    },
    L,
    g,
    'Every case contradicts a numeral inequality.',
  );
  return D.notI(bot, A.less(num(k), num(n)), l1, { group: g, note: `So ¬${k}̄ < ${n}̄.` });
}

/** Q ⊢ k̄ < n̄ or Q ⊢ ¬ k̄ < n̄, whichever is true. */
export function deriveLessFact(k: number, n: number): Deriv {
  return k < n ? deriveLess(k, n) : deriveNotLess(k, n);
}

// ------------------------------------------------------------------ plugging in derivations

/**
 * Replaces every hypothesis leaf named `name` by the derivation `proof` of the same sentence.
 * The derivation must have no undischarged assumptions other than axioms (so that no
 * eigenvariable condition or discharge outside it can be affected).
 */
export function plugHypothesis(root: Deriv, name: string, proof: Deriv): Deriv {
  const go = (d: Deriv): Deriv => {
    if (d.rule === 'hyp' && d.name === name) {
      if (!formulaEq(d.concl, proof.concl)) throw new Error(`plugHypothesis: ${name} is not the sentence derived`);
      return proof;
    }
    return d.premises.length ? { ...d, premises: d.premises.map(go) } : d;
  };
  return go(root);
}
