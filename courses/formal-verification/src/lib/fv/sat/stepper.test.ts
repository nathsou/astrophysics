import { describe, expect, it } from 'vitest';
import { Stepper } from './stepper';
import { solveCnf } from './solver';
import { randomKSat, pigeonhole } from './encode';
import { rng } from '../util/random';

describe('CDCL stepper', () => {
  it('agrees with the solver on random formulas', () => {
    const r = rng(7);
    for (let i = 0; i < 300; i++) {
      const n = r.int(3, 12);
      const cnf = randomKSat(r, n, r.int(n, 6 * n), 3);
      const s = new Stepper(cnf.clauses, cnf.nvars);
      s.run();
      const ref = solveCnf(cnf).result;
      expect(s.status).toBe(ref);
      if (s.status === 'sat') for (const c of cnf.clauses) expect(c.some((l) => s.value(l) === true)).toBe(true);
    }
  });
  it('learns clauses that are implied (checked by the solver)', () => {
    const cnf = pigeonhole(4, 3);
    const s = new Stepper(cnf.clauses, cnf.nvars);
    s.run();
    expect(s.status).toBe('unsat');
    for (const learned of s.clauses.slice(s.inputCount)) {
      // F ∧ ¬learned must be unsatisfiable.
      const check = solveCnf({ nvars: cnf.nvars, clauses: [...cnf.clauses, ...learned.map((l) => [-l])] });
      expect(check.result).toBe('unsat');
    }
  });
  it('the textbook example: 1-UIP and backjump level', () => {
    // x1 decided at level 1, x2 at level 2, x3 at level 3; x3 implies x4 and x5 (with x1, x2), which conflict.
    const clauses = [[-3, 4], [-1, -3, 5], [-2, -4, -5]];
    const s = new Stepper(clauses, 5);
    s.decide(1);
    s.decide(2);
    s.decide(3);
    s.propagateAll();
    expect(s.status).toBe('conflict');
    expect(s.analysis!.uip).toBe(-3);
    expect(new Set(s.analysis!.learned)).toEqual(new Set([-3, -1, -2]));
    expect(s.analysis!.backjump).toBe(2);
  });
});
