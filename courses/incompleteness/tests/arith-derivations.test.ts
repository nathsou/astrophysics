// Q's reasoning about <, minimization, Rosser's second half and PA with induction: every
// generated derivation is accepted by the natural deduction checker, and tampered ones are not.

import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/syntax/ast.ts';
import type { Formula } from '../src/engine/syntax/ast.ts';
import { check, D, linearize, type Deriv } from '../src/engine/proof/nd.ts';
import { num, Q } from '../src/engine/proof/q.ts';
import { qUnfolded, ROSSER_MAX, rprovR } from '../src/engine/proof/arith.ts';
import {
  deriveLess, deriveLessFact, deriveLessNSucc, deriveNotLess, deriveTrichotomy, lessNSuccStatement, plugHypothesis, trichotomyStatement,
} from '../src/engine/proof/less.ts';
import { deriveRosserFirstHalfDerived, deriveRosserSecondHalf } from '../src/engine/proof/rosser.ts';
import { checkPA, PA_THEOREMS, deriveZeroAdd, zeroAddStatement } from '../src/engine/proof/pa.ts';
import { deriveClauses, instance, MIN_VALUE_MAX, representing } from '../src/engine/represent/represent.ts';
import { R, evaluate, type RF } from '../src/engine/recursive/rf.ts';
import { formulaEq } from '../src/engine/syntax/ops.ts';
import { formulaText } from '../src/engine/syntax/print.ts';
import { inductionInstance } from '../src/engine/syntax/induction.ts';
import { subst } from '../src/engine/syntax/subst.ts';

const QU = qUnfolded();
const onlyAxioms = (d: Deriv, axioms = QU) => {
  const r = check(d, { axioms });
  expect(r.errors).toEqual([]);
  expect(r.valid).toBe(true);
  expect(r.open.every((o) => o.kind === 'axiom')).toBe(true);
  return r;
};

/** A copy of the derivation with the n-th step (in reading order) changed by f. */
function tamper(root: Deriv, n: number, f: (d: Deriv) => Deriv): Deriv {
  const target = linearize(root)[n];
  const go = (d: Deriv): Deriv => (d === target ? f(d) : d.premises.length ? { ...d, premises: d.premises.map(go) } : d);
  return go(root);
}

const lessF = (k: number, n: number) => A.less(num(k), num(n));

describe('Lemma less-nsucc: Q ⊢ ∀x (x < n+1 → (x = 0 ∨ … ∨ x = n))', () => {
  it.each([0, 1, 2, 3, 4, 5, 8])('n = %i', (n) => {
    const d = deriveLessNSucc(n);
    const r = onlyAxioms(d);
    expect(formulaEq(d.concl, lessNSuccStatement(n))).toBe(true);
    expect(r.axioms).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q8']);
  });

  it('sizes stay moderate', () => {
    expect(check(deriveLessNSucc(12), { axioms: QU }).size).toBeLessThan(2000);
  });

  it('is not a derivation from Q with Q8 as the ↔ sentence (the checker has no ↔ rules)', () => {
    expect(check(deriveLessNSucc(1), { axioms: Q() }).valid).toBe(false);
  });

  it('rejects the derivation for n presented as the one for n + 1', () => {
    const d = deriveLessNSucc(2);
    expect(check({ ...d, concl: lessNSuccStatement(3) }, { axioms: QU }).valid).toBe(false);
  });

  it('rejects a tampered inner step', () => {
    const d = deriveLessNSucc(2);
    const steps = linearize(d);
    const i = steps.findIndex((s) => s.rule === 'eqE');
    const bad = tamper(d, i, (s) => ({ ...s, concl: A.eq(A.c(1), num(7)) }));
    expect(check(bad, { axioms: QU }).valid).toBe(false);
  });
});

describe('Lemma trichotomy: Q ⊢ ∀y ((y < m ∨ m < y) ∨ y = m)', () => {
  it.each([0, 1, 2, 3, 6, 12])('m = %i', (m) => {
    const d = deriveTrichotomy(m);
    onlyAxioms(d);
    expect(formulaEq(d.concl, trichotomyStatement(m))).toBe(true);
  });

  it('rejects a swapped disjunction order', () => {
    const d = deriveTrichotomy(2);
    const swapped = A.forall(A.v(1), A.or(A.or(A.less(num(2), A.v(1)), A.less(A.v(1), num(2))), A.eq(A.v(1), num(2))));
    expect(check({ ...d, concl: swapped }, { axioms: QU }).valid).toBe(false);
  });

  it('rejects a violated eigenvariable condition', () => {
    // make the final ∀Intro generalise over b, which occurs in no step's conclusion there → premise mismatch
    const d = deriveTrichotomy(1);
    expect(check({ ...d, eigen: 2 }, { axioms: QU }).valid).toBe(false);
  });
});

describe('k̄ < n̄ and ¬k̄ < n̄', () => {
  for (let n = 0; n <= 5; n++) {
    for (let k = 0; k <= 6; k++) {
      it(`k = ${k}, n = ${n}`, () => {
        const d = deriveLessFact(k, n);
        onlyAxioms(d);
        expect(formulaEq(d.concl, k < n ? lessF(k, n) : A.not(lessF(k, n)))).toBe(true);
      });
    }
  }

  it('does not produce false facts', () => {
    expect(() => deriveLess(3, 3)).toThrow();
    expect(() => deriveNotLess(2, 3)).toThrow();
    const d = deriveLess(1, 3);
    expect(check({ ...d, concl: lessF(1, 2) }, { axioms: QU }).valid).toBe(false);
  });
});

describe('minimization: both clauses derived and checked', () => {
  const P = R.proj;
  const searchZ = () => R.min(R.comp(R.basic('chareq'), [R.basic('chareq'), R.comp(R.zero(), [P(2, 0)])]));
  const fns: [string, () => RF, bigint[]][] = [
    ['μx [χ=(x, z) = 0], z = 0', () => R.min(R.basic('chareq')), [0n]],
    ['μx [χ=(x, z) = 0], z = 3 (value 0)', () => R.min(R.basic('chareq')), [3n]],
    ['μx [χ=(χ=(x, z), 0) = 0] finds z, z = 0', searchZ, [0n]],
    ['μx [χ=(χ=(x, z), 0) = 0] finds z, z = 3', searchZ, [3n]],
    ['μx [χ=(χ=(x, z), 0) = 0] finds z, z = 5', searchZ, [5n]],
    ['μx [χ=(x·x, x + z) = 0], z = 2', () => R.min(R.comp(R.basic('chareq'), [R.comp(R.basic('mult'), [P(2, 0), P(2, 0)]), R.basic('add')])), [2n]],
    ['succ ∘ μ (a minimization inside a composition)', () => R.comp(R.succ(), [R.min(R.basic('chareq'))]), [0n]],
    ['a minimization inside a minimization', () => R.min(R.comp(R.basic('chareq'), [R.min(R.basic('chareq')), R.comp(R.succ(), [P(1, 0)])])), []],
  ];
  it.each(fns)('%s', (_name, mk, args) => {
    const f = mk();
    const r = deriveClauses(f, args);
    if ('error' in r) throw new Error(r.error);
    expect(r.value).toBe(evaluate(f, args).value);
    const rep = representing(f);
    if ('error' in rep) throw new Error(rep.error);
    onlyAxioms(r.a, r.axioms);
    onlyAxioms(r.b, r.axioms);
    expect(formulaEq(r.a.concl, instance(rep, args, num(r.value)))).toBe(true);
    const target = A.forall(A.v(rep.output), A.imp(instance(rep, args, A.v(rep.output)), A.eq(A.v(rep.output), num(r.value))));
    expect(formulaEq(r.b.concl, target), formulaText(r.b.concl)).toBe(true);
  });

  it('the representing formula uses the same A_g in both conjuncts (same bound variables)', () => {
    const rep = representing(searchZ());
    if ('error' in rep || rep.formula.k !== 'and' || rep.formula.b.k !== 'forall' || rep.formula.b.body.k !== 'imp' || rep.formula.b.body.b.k !== 'not') throw new Error('shape');
    const w = rep.formula.b.v.index;
    const first = rep.formula.a;
    const second = rep.formula.b.body.b.a;
    // renaming w to y in the second gives the first
    const renamed = subst(second, w, A.v(rep.output));
    expect(formulaEq(renamed, first)).toBe(true);
  });

  it('declines values above the cap', () => {
    expect(deriveClauses(searchZ(), [BigInt(MIN_VALUE_MAX + 1)])).toHaveProperty('error');
  });

  it('rejects a clause (b) claiming a different value', () => {
    const r = deriveClauses(searchZ(), [2n]);
    if ('error' in r) throw new Error(r.error);
    const rep = representing(searchZ());
    if ('error' in rep) throw new Error(rep.error);
    // a derivation of clause (b) for the input 2 is not one for the value 3
    const wrong = A.forall(A.v(rep.output), A.imp(instance(rep, [2n], A.v(rep.output)), A.eq(A.v(rep.output), num(3))));
    expect(check({ ...r.b, concl: wrong }, { axioms: r.axioms }).valid).toBe(false);
  });
});

describe('Rosser’s theorem in Q', () => {
  it.each(Array.from({ length: ROSSER_MAX + 1 }, (_, m) => m))('second half, m = %i: ¬RProv(⌜R⌝) from ρ₁ and the π_k', (m) => {
    const d = deriveRosserSecondHalf(m);
    const r = check(d, { axioms: QU });
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(formulaEq(d.concl, A.not(rprovR()))).toBe(true);
    expect([...r.hypotheses].sort()).toEqual([...Array.from({ length: m + 1 }, (_, k) => `π${k}`), 'ρ1'].sort());
  });

  it('second half with the lemmas as hypotheses, as the book writes it', () => {
    const d = deriveRosserSecondHalf(3, { lemmas: 'hypotheses' });
    const r = check(d, { axioms: QU });
    expect(r.valid).toBe(true);
    expect(r.hypotheses).toContain('trichotomy');
    expect(r.hypotheses).toContain('less-nsucc');
  });

  it('second half needs every π_k', () => {
    const d = deriveRosserSecondHalf(2);
    // replace π1 by π0's sentence under the name π1: the =Elim step from a = 1̄ no longer matches
    const steps = linearize(d);
    const i = steps.findIndex((s) => s.rule === 'hyp' && s.name === 'π1');
    const bad = tamper(d, i, (s) => ({ ...s, concl: A.not(A.abbr('Prf', '\\mathrm{Prf}', [0, 1], [num(0), (s.concl as { a: { args: A.Term[] } }).a.args[1]])) }));
    expect(check(bad, { axioms: QU }).valid).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, 6])('first half, n = %i, with less-nsucc derived', (n) => {
    const d = deriveRosserFirstHalfDerived(n);
    const r = check(d, { axioms: QU });
    expect(r.valid).toBe(true);
    expect(formulaEq(d.concl, rprovR())).toBe(true);
    expect(r.hypotheses).not.toContain('less-nsucc');
    expect([...r.hypotheses].sort()).toEqual(['δ1', ...Array.from({ length: n }, (_, k) => `ρ${k}`)].sort());
  });

  it('plugging in a derivation of a different sentence is refused', () => {
    const d = deriveRosserSecondHalf(2, { lemmas: 'hypotheses' });
    expect(() => plugHypothesis(d, 'trichotomy', deriveTrichotomy(1))).toThrow();
  });
});

describe('PA: Q plus the induction schema', () => {
  it.each(PA_THEOREMS.map((t) => [t.text, t] as const))('%s', (_text, t) => {
    const d = t.derive();
    const r = checkPA(d);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.open.every((o) => o.kind === 'axiom')).toBe(true);
    expect(formulaEq(d.concl, t.statement())).toBe(true);
    expect(r.induction.length).toBeGreaterThan(0);
    expect(r.induction.every((i) => i.recognized)).toBe(true);
    expect(r.axioms.some((n) => n.startsWith('Ind'))).toBe(true);
  });

  it('commutativity uses three induction axioms (its own and the two lemmas’)', () => {
    const t = PA_THEOREMS.find((x) => x.id === 'comm')!;
    expect(checkPA(t.derive()).induction).toHaveLength(3);
  });

  it('the same derivations are not derivations in Q', () => {
    const r = check(deriveZeroAdd(), { axioms: QU });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /not an axiom/.test(e.message))).toBe(true);
  });

  it('rejects an axiom leaf that is not an instance of the induction schema', () => {
    const bogus = D.axiom('Ind: bogus', A.forall(A.v(0), A.eq(A.plus(A.zero(), A.v(0)), A.v(0))));
    const r = checkPA(bogus);
    expect(r.valid).toBe(false);
    expect(r.induction[0].recognized).toBe(false);
  });

  it('rejects an induction "instance" whose base case is A(1)', () => {
    const d = deriveZeroAdd();
    const Af = A.eq(A.plus(A.zero(), A.v(0)), A.v(0));
    const good = inductionInstance(Af, 0);
    if (good.k !== 'imp' || good.a.k !== 'and') throw new Error('shape');
    const wrong: Formula = A.imp(A.and(A.eq(A.plus(A.zero(), num(1)), num(1)), good.a.b), good.b);
    const steps = linearize(d);
    const i = steps.findIndex((s) => s.rule === 'axiom' && s.name?.startsWith('Ind'));
    const r = checkPA(tamper(d, i, (s) => ({ ...s, concl: wrong })));
    expect(r.valid).toBe(false);
    expect(r.induction[0].recognized).toBe(false);
  });

  it('rejects a violated eigenvariable condition in the inductive step', () => {
    // generalise the step over a while the inductive hypothesis (mentioning a) is still open
    const d = deriveZeroAdd();
    const steps = linearize(d);
    const i = steps.findIndex((s) => s.rule === 'impI');
    const bad = tamper(d, i, (s) => s.premises[0]);
    expect(checkPA(bad).valid).toBe(false);
    expect(formulaEq(d.concl, zeroAddStatement())).toBe(true);
  });
});
