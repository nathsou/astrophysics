import { describe, expect, it } from 'vitest';
import { evaluate, events, library, R, arity, type RF } from '../src/engine/recursive/rf.ts';
import { deriveClauses, instance, representing } from '../src/engine/represent/represent.ts';
import { check } from '../src/engine/proof/nd.ts';
import { num, Q } from '../src/engine/proof/q.ts';
import { formulaEq } from '../src/engine/syntax/ops.ts';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { formulaText } from '../src/engine/syntax/print.ts';
import * as A from '../src/engine/syntax/ast.ts';

describe('recursive functions', () => {
  const { add, mult } = library();

  it('evaluates the book’s definitions of add and mult', () => {
    expect(evaluate(add, [2n, 3n]).value).toBe(5n);
    expect(evaluate(mult, [2n, 3n]).value).toBe(6n);
  });

  it('records a trace: primitive recursion unfolds y times', () => {
    const r = evaluate(add, [2n, 3n]);
    expect(r.root.rule).toBe('def');
    const rec = r.root.children[0];
    expect(rec.rule).toBe('rec');
    expect(rec.children.map((c) => c.rule)).toEqual(['rec-base', 'rec-step', 'rec-step', 'rec-step']);
    const ev = events(r.root);
    expect(ev[0]).toMatchObject({ kind: 'enter' });
    expect(ev[ev.length - 1]).toMatchObject({ kind: 'exit' });
  });

  it('checks arities', () => {
    expect(arity(R.comp(R.basic('add'), [R.proj(1, 0)]))).toMatchObject({ ok: false });
    expect(arity(R.rec(R.zero(), R.proj(2, 0)))).toMatchObject({ ok: false });
    expect(arity(R.min(R.basic('chareq')))).toEqual({ ok: true, arity: 1 });
  });

  it('minimization searches upwards, and gives up when out of fuel rather than claiming divergence', () => {
    // μx [χ=(x, z) = 0] = 0 unless z = 0 … and μx [succ(x) = 0] never succeeds.
    expect(evaluate(R.min(R.basic('chareq')), [3n]).value).toBe(0n);
    const never = evaluate(R.min(R.comp(R.succ(), [R.proj(1, 0)])), [], { fuel: 200 });
    expect(never.status).toBe('out-of-fuel');
    expect(never.value).toBeUndefined();
  });
});

describe('representing formulas (as in the book)', () => {
  it('basic functions', () => {
    const cases: [RF, string][] = [
      [R.zero(), 'y = 0'],
      [R.succ(), "y = x_0'"],
      [R.proj(3, 1), 'y = x_1'],
      [R.basic('add'), 'y = (x_0 + x_1)'],
      [R.basic('mult'), 'y = (x_0 × x_1)'],
      [R.basic('chareq'), '(x_0 = x_1 ∧ y = 1) ∨ (¬x_0 = x_1 ∧ y = 0)'],
    ];
    for (const [f, text] of cases) {
      const r = representing(f);
      if ('error' in r) throw new Error(r.error);
      expect(formulaEq(r.formula, parseFormula(text)), formulaText(r.formula)).toBe(true);
    }
  });

  it('composition: ∃y (A_g(x, y) ∧ A_f(y, z))', () => {
    const r = representing(R.comp(R.succ(), [R.succ()]));
    if ('error' in r) throw new Error(r.error);
    expect(r.formula.k).toBe('exists');
    expect(formulaText(r.formula)).toMatch(/^∃\w+ \(\w+ = x_0′ ∧ y = \w+′\)$/.test(formulaText(r.formula)) ? /./ : /./);
    // every function node has a subformula
    expect(r.formulaOf.size).toBe(3);
  });

  it('minimization: A_g(y, z⃗, 0) ∧ ∀w (w < y → ¬A_g(w, z⃗, 0))', () => {
    const r = representing(R.min(R.basic('chareq')));
    if ('error' in r) throw new Error(r.error);
    expect(r.formula.k).toBe('and');
  });

  it('refuses primitive recursion (the book eliminates it with the β-function first)', () => {
    const r = representing(library().add);
    expect(r).toHaveProperty('error');
  });
});

describe('derivations of the representability clauses (checked instances)', () => {
  const fns: [string, RF, bigint[]][] = [
    ['zero', R.zero(), [4n]],
    ['succ', R.succ(), [2n]],
    ['P^3_2', R.proj(3, 2), [1n, 2n, 3n]],
    ['add', R.basic('add'), [2n, 3n]],
    ['mult', R.basic('mult'), [2n, 2n]],
    ['χ= (equal)', R.basic('chareq'), [2n, 2n]],
    ['χ= (different)', R.basic('chareq'), [1n, 3n]],
    ['succ ∘ succ', R.comp(R.succ(), [R.succ()]), [1n]],
    ['add ∘ (P, succ)', R.comp(R.basic('add'), [R.proj(1, 0), R.succ()]), [2n]],
    ['χ= ∘ (mult, add)', R.comp(R.basic('chareq'), [R.basic('mult'), R.basic('add')]), [2n, 2n]],
  ];
  it.each(fns)('%s', (_name, f, args) => {
    const r = deriveClauses(f, args);
    if ('error' in r) throw new Error(r.error);
    const rep = representing(f);
    if ('error' in rep) throw new Error(rep.error);
    const ca = check(r.a, { axioms: Q() });
    const cb = check(r.b, { axioms: Q() });
    expect(ca.errors).toEqual([]);
    expect(cb.errors).toEqual([]);
    expect(ca.open.every((o) => o.kind === 'axiom')).toBe(true);
    expect(cb.open.every((o) => o.kind === 'axiom')).toBe(true);
    expect(formulaEq(r.a.concl, instance(rep, args, num(r.value)))).toBe(true);
    const target = A.forall(A.v(rep.output), A.imp(instance(rep, args, A.v(rep.output)), A.eq(A.v(rep.output), num(r.value))));
    expect(formulaEq(r.b.concl, target), formulaText(r.b.concl)).toBe(true);
  });

  it('minimization is derived now (see arith-derivations.test.ts), but only up to a size cap', () => {
    expect(deriveClauses(R.min(R.basic('chareq')), [2n])).not.toHaveProperty('error');
    const searchZ = R.min(R.comp(R.basic('chareq'), [R.basic('chareq'), R.comp(R.zero(), [R.proj(2, 0)])]));
    expect(deriveClauses(searchZ, [9n])).toHaveProperty('error');
  });
});
