import { describe, expect, it } from 'vitest';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { check } from '../src/engine/proof/nd.ts';
import { Q } from '../src/engine/proof/q.ts';
import { R } from '../src/engine/recursive/rf.ts';
import { formulaText } from '../src/engine/syntax/print.ts';
import { deriveNotValue, deriveRelation } from '../src/engine/represent/relations.ts';
import { planDelta0, sigma1Plan, type PlanNode } from '../src/engine/proof/sigma1.ts';

const P = (s: string) => parseFormula(s);
const valid = (d: Parameters<typeof check>[0]) => {
  const r = check(d, { axioms: Q() });
  if (!r.valid) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r;
};

describe('Lemma rep-q and representing relations, for particular inputs', () => {
  it('Q ⊢ ¬A_add(2̄, 3̄, m̄) for m ≠ 5 (checked)', () => {
    for (const m of [0n, 4n, 6n]) {
      const r = deriveNotValue(R.basic('add'), [2n, 3n], m);
      if ('error' in r) throw new Error(r.error);
      expect(r.value).toBe(5n);
      const c = valid(r.deriv);
      expect(c.hypotheses).toEqual([]);
      expect(formulaText(r.deriv.concl)).toBe(formulaText(r.target));
    }
    expect('error' in deriveNotValue(R.basic('add'), [2n, 3n], 5n)).toBe(true);
  });

  it('χ= represents =: Q ⊢ A_=(n̄, m̄) or Q ⊢ ¬A_=(n̄, m̄)', () => {
    for (const [n, m] of [[2n, 2n], [2n, 3n], [0n, 1n]] as const) {
      const r = deriveRelation(R.basic('chareq'), [n, m]);
      if ('error' in r) throw new Error(r.error);
      expect(r.holds).toBe(n === m);
      valid(r.deriv);
      expect(r.deriv.concl.k === 'not').toBe(n !== m);
    }
  });

  it('composed relation x = y + 1', () => {
    const chi = R.comp(R.basic('chareq'), [R.proj(2, 0), R.comp(R.succ(), [R.proj(2, 1)])]);
    const yes = deriveRelation(chi, [3n, 2n]);
    const no = deriveRelation(chi, [3n, 3n]);
    if ('error' in yes || 'error' in no) throw new Error('failed');
    expect(yes.holds).toBe(true);
    expect(no.holds).toBe(false);
    valid(yes.deriv);
    valid(no.deriv);
  });

  it('refuses a function that is not a characteristic function', () => {
    expect('error' in deriveRelation(R.basic('add'), [2n, 3n])).toBe(true);
  });
});

const flat = (p: PlanNode): PlanNode[] => [p, ...p.children.flatMap(flat)];

describe('Σ1-completeness, unfolded for one sentence', () => {
  it('finds the witness of a true Σ1 sentence and plans the Δ0 instance', () => {
    const r = sigma1Plan(P('∃x (x × x = 49)'));
    expect(r.status).toBe('true');
    expect(r.witness).toBe(7n);
    expect(r.plan!.case).toMatch(/atomic/);
  });

  it('bounded quantifiers: every instance for a true ∀, one witness for a true ∃', () => {
    const p = planDelta0(P('∀x (x < 4 → ¬ x × x = 5)'), 'prove');
    if ('error' in p) throw new Error(p.error);
    expect(p.plan.bound).toBe(4n);
    expect(p.plan.children).toHaveLength(4);
    const e = planDelta0(P('∃x (x < 10 ∧ x + x = 6)'), 'prove');
    if ('error' in e) throw new Error(e.error);
    expect(e.plan.children).toHaveLength(1);
    expect(e.plan.lemma).toBe('inc:inp:s1c:lem:bounded-quant-equiv');
  });

  it('a false Δ0 sentence gets a plan for its negation; leaves are atomic', () => {
    const r = sigma1Plan(P('∀x (x < 5 → x × x < 10)'));
    expect(r.status).toBe('false');
    const leaves = flat(r.negationPlan!).filter((n) => n.children.length === 0);
    expect(leaves.every((n) => n.lemma === 'inc:inp:s1c:lem:atomic-completeness')).toBe(true);
  });

  it('Π1 and other formulas are not covered; a missing witness is not falsity', () => {
    expect(sigma1Plan(P('∀x ¬ x′ = 0')).status).toBe('not-applicable');
    expect(sigma1Plan(P('∃x ∃y x = y')).status).toBe('not-applicable');
    const none = sigma1Plan(P('∃x (x × x = 2)'), { limit: 50 });
    expect(none.status).toBe('unknown');
    expect(none.message).toMatch(/does not make the sentence false/);
  });

  it('prime witness: ∃x (x > 20 and x prime)', () => {
    const r = sigma1Plan(P('∃x (20 < x ∧ ∀y (y < x → ∀z (z < x → ¬ (y′′ × z′′) = x)))'));
    expect(r.status).toBe('true');
    expect(r.witness).toBe(23n);
    expect(r.nodes).toBeGreaterThan(20);
  });
});

import * as Lib from '../src/engine/computability/library.ts';
import { eliminateRecursion } from '../src/engine/represent/elimrec.ts';

describe('eliminating primitive recursion', () => {
  it('rewrites add and mult with β and μ', () => {
    const eqs = eliminateRecursion(Lib.mult());
    expect(eqs.map((e) => e.name)).toEqual(['add', 'mult']);
    expect(eqs.every((e) => e.viaBeta)).toBe(true);
    expect(eqs[1].rewritten).toMatch(/\\mu d/);
  });
});
