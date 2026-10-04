import { describe, expect, it } from 'vitest';
import { checkStep, clashes, explainRup, LyingStepper, refutation, resolve, runWithProof } from './resolution';
import { Stepper } from './stepper';
import { pigeonhole, randomKSat } from './encode';
import { checkDrat } from './check/drat';
import { solveCnf } from './solver';
import { rng } from '../util/random';
import type { Cnf } from './cnf';

describe('resolution', () => {
  it('resolves and checks single steps', () => {
    expect(resolve([1, 2], [-1, 3], 1)).toEqual([2, 3]);
    expect(clashes([1, 2], [-1, -2])).toEqual([1, 2]);
    const cs = [[1, 2], [-1, 2], [1, -2], [-1, -2]];
    expect(checkStep(cs, { left: 0, right: 1, pivot: 1, clause: [2] })).toBeUndefined();
    expect(checkStep(cs, { left: 0, right: 1, pivot: 2, clause: [] })).toMatch(/clash/);
    expect(checkStep(cs, { left: 0, right: 1, pivot: 1, clause: [] })).toMatch(/resolvent/);
  });

  it('extracts valid refutations from the stepper', () => {
    const formulas: Cnf[] = [pigeonhole(3, 2), pigeonhole(4, 3), pigeonhole(5, 4)];
    const r = rng(7);
    for (let k = 0; formulas.length < 30 && k < 400; k++) {
      const f = randomKSat(r, 10, 60);
      if (solveCnf(f).result === 'unsat') formulas.push(f);
    }
    expect(formulas.length).toBeGreaterThan(10);
    for (const f of formulas) {
      const ref = refutation(f.clauses, f.nvars)!;
      expect(ref).toBeDefined();
      expect(ref.clauses[ref.empty]).toEqual([]);
      for (const [i, st] of ref.steps) {
        expect(st.left).toBeLessThan(i);
        expect(st.right).toBeLessThan(i);
        expect(checkStep(ref.clauses, { ...st, clause: ref.clauses[i]! })).toBeUndefined();
      }
    }
    expect(refutation([[1, 2], [-1]], 2)).toBeUndefined();
  });

  it('explains RUP steps consistently with the DRAT checker', () => {
    const f = pigeonhole(4, 3);
    const { result, proof } = runWithProof(new Stepper(f.clauses, f.nvars));
    expect(result).toBe('unsat');
    expect(checkDrat(f.clauses, proof).ok).toBe(true);
    const db = f.clauses.map((c) => [...c]);
    for (const line of proof) {
      const e = explainRup(db, line.lits);
      expect(e.ok).toBe(true);
      db.push(line.lits);
    }
    expect(explainRup([[1, 2]], [1]).ok).toBe(false);
  });

  it('catches the lying solver', () => {
    const r = rng(2016);
    let caught = 0;
    let honestAccepted = 0;
    for (let k = 0; k < 300; k++) {
      const f = randomKSat(r, 12, 50);
      const truth = solveCnf(f).result;
      const lie = runWithProof(new LyingStepper(f.clauses, f.nvars));
      const honest = runWithProof(new Stepper(f.clauses, f.nvars));
      expect(honest.result).toBe(truth);
      if (honest.result === 'unsat') {
        expect(checkDrat(f.clauses, honest.proof).ok).toBe(true);
        honestAccepted++;
      }
      if (lie.result === 'unsat' && truth === 'sat') {
        expect(checkDrat(f.clauses, lie.proof).ok).toBe(false);
        caught++;
      }
    }
    expect(caught).toBeGreaterThan(5);
    expect(honestAccepted).toBeGreaterThan(5);
  });
});
