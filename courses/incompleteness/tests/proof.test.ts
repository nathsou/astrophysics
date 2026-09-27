import { describe, expect, it } from 'vitest';
import { parseFormula, parseTerm } from '../src/engine/syntax/parse.ts';
import * as A from '../src/engine/syntax/ast.ts';
import { check, D, replaceMatch, symm, type Deriv } from '../src/engine/proof/nd.ts';
import { deriveAdd, deriveMult, deriveNeq, num, Q } from '../src/engine/proof/q.ts';
import { formulaEq } from '../src/engine/syntax/ops.ts';

const P = (s: string) => parseFormula(s);
const ok = (d: Deriv) => {
  const r = check(d, { axioms: Q() });
  if (!r.valid) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r;
};

describe('natural deduction checker: valid inferences', () => {
  it('→Intro discharges the labelled assumption', () => {
    const a = D.assume(P('0 = 0 ∧ ⊥'), 1);
    const d = D.impI(D.andE(a, 'left'), P('0 = 0 ∧ ⊥'), 1);
    const r = ok(d);
    expect(r.open).toHaveLength(0);
    expect(formulaEq(d.concl, P('(0 = 0 ∧ ⊥) → 0 = 0'))).toBe(true);
  });

  it('∀Elim instantiates with a closed term; ∃Intro generalises', () => {
    const q4 = D.axiom('Q4', A.cloneFresh(Q().get('Q4')!));
    const inst = D.allE(q4, parseTerm('2'));
    expect(formulaEq(inst.concl, P('(2 + 0) = 2'))).toBe(true);
    const ex = D.exI(inst, P('∃y (y + 0) = 2'), parseTerm('2'));
    const r = ok(ex);
    expect(r.axioms).toEqual(['Q4']);
  });

  it('=Elim replaces some occurrences', () => {
    expect(replaceMatch(P('(1 + 1) = (1 + 1)'), P('2 = (1 + 1)'), parseTerm('1 + 1'), parseTerm('2'))).toBe(true);
    expect(replaceMatch(P('(1 + 1) = (1 + 1)'), P('2 = 3'), parseTerm('1 + 1'), parseTerm('2'))).toBe(false);
  });
});

describe('natural deduction checker: invalid inferences are rejected', () => {
  const errorsOf = (d: Deriv) => check(d, { axioms: Q() }).errors.map((e) => e.message).join(' | ');

  it('∧Elim with a conclusion that is not a conjunct', () => {
    const a = D.assume(P('0 = 0 ∧ ⊥'), 1);
    const bad: Deriv = { ...D.andE(a, 'left'), concl: P('¬⊥') };
    expect(errorsOf(bad)).toMatch(/one of the conjuncts/);
  });

  it('∀Intro violating the eigenvariable condition', () => {
    // From the assumption a = 0, infer ∀x x = 0 — not allowed: a occurs in an open assumption.
    const a = D.assume(A.eq(A.c(1), A.zero()));
    const bad = D.allI(a, P('∀x x = 0'), 1);
    expect(errorsOf(bad)).toMatch(/eigenvariable condition/);
  });

  it('∀Intro where the eigenvariable is still in the conclusion', () => {
    const e = D.eqI(A.c(1));
    const bad = D.allI(e, A.forall(A.v(0), A.eq(A.v(0), A.c(1))), 1);
    expect(errorsOf(bad)).toMatch(/occurs in the conclusion/);
  });

  it('∃Elim whose eigenvariable escapes into the conclusion', () => {
    const ex = D.assume(P('∃x x = 0'), undefined);
    const inner = D.assume(A.eq(A.c(1), A.zero()), 2);
    const bad = D.exE(ex, inner, 1, 2);
    expect(errorsOf(bad)).toMatch(/occurs in the conclusion/);
  });

  it('∀Elim with an open term', () => {
    const q4 = D.axiom('Q4', A.cloneFresh(Q().get('Q4')!));
    const bad = D.allE(q4, parseTerm('y'));
    expect(errorsOf(bad)).toMatch(/not closed|not a sentence/);
  });

  it('an axiom that is not one of Q', () => {
    expect(errorsOf(D.axiom('Q4', P('∀x (0 + x) = x')))).toMatch(/not axiom Q4/);
    expect(errorsOf(D.axiom('PA', P('0 = 0')))).toMatch(/not an axiom/);
  });

  it('→Intro discharging the wrong label leaves the assumption open', () => {
    const a = D.assume(P('⊥'), 1);
    const bad = D.impI(a, P('⊥'), 2);
    expect(errorsOf(bad)).toMatch(/never discharged/);
  });

  it('→Elim with a mismatched minor premise', () => {
    const imp = D.assume(P('0 = 0 → ⊥'));
    const bad = D.impE(imp, D.eqI(parseTerm('1')));
    expect(errorsOf(bad)).toMatch(/antecedent/);
  });

  it('=Elim that replaces something else', () => {
    const e = D.assume(P('1 = 2'));
    const bad = D.eqE(e, D.eqI(parseTerm('3')), P('3 = 2'));
    expect(errorsOf(bad)).toMatch(/replaced/);
  });
});

describe('numeral lemmas in Q (checked instances)', () => {
  it.each([[0n, 0n], [2n, 3n], [5n, 1n]])('Q ⊢ %i + %i = n+m', (n, m) => {
    const d = deriveAdd(n, m);
    const r = ok(d);
    expect(formulaEq(d.concl, A.eq(A.plus(num(n), num(m)), num(n + m)))).toBe(true);
    expect(r.open.every((o) => o.kind === 'axiom')).toBe(true);
  });

  it.each([[0n, 3n], [2n, 3n], [3n, 0n]])('Q ⊢ %i × %i = n·m', (n, m) => {
    const d = deriveMult(n, m);
    ok(d);
    expect(formulaEq(d.concl, A.eq(A.times(num(n), num(m)), num(n * m)))).toBe(true);
  });

  it.each([[0n, 2n], [3n, 0n], [2n, 5n], [4n, 1n]])('Q ⊢ ¬ %i = %i', (n, m) => {
    const d = deriveNeq(n, m);
    const r = ok(d);
    expect(formulaEq(d.concl, A.not(A.eq(num(n), num(m))))).toBe(true);
    expect(r.open.every((o) => o.kind === 'axiom')).toBe(true);
  });

  it('symmetry helper', () => {
    const d = symm(deriveAdd(1n, 1n));
    ok(d);
    expect(formulaEq(d.concl, P('2 = (1 + 1)'))).toBe(true);
  });
});
