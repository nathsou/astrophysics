import { afterAll, describe, expect, it } from 'vitest';
import { Solver, solveCnf, type SolverEvent } from './solver';
import { satisfies, parseDimacs, printDimacs } from './cnf';
import { checkDrat } from './check/drat';
import { countModels, fand, fiff, fnot, forr, fv, fxor, nQueens, naiveCnf, pigeonhole, randomKSat, sudoku, tseitin, evalFormula, atMostK } from './encode';
import { rng } from '../util/random';
import { cnfToSmtlib, z3Check } from '../testing/z3';

function brute(cnf: { nvars: number; clauses: number[][] }): boolean {
  for (let m = 0; m < 1 << cnf.nvars; m++) {
    const model = [false, ...Array.from({ length: cnf.nvars }, (_, i) => ((m >> i) & 1) === 1)];
    if (satisfies(cnf, model)) return true;
  }
  return false;
}

describe('CDCL solver', () => {
  it('solves tiny formulas, with models that satisfy them', () => {
    const sat = solveCnf({ nvars: 3, clauses: [[1, 2], [-1, 3], [-3], [2, -3]] });
    expect(sat.result).toBe('sat');
    expect(satisfies({ nvars: 3, clauses: [[1, 2], [-1, 3], [-3], [2, -3]] }, sat.model)).toBe(true);
    expect(solveCnf({ nvars: 1, clauses: [[1], [-1]] }).result).toBe('unsat');
    expect(solveCnf({ nvars: 2, clauses: [[]] }).result).toBe('unsat');
  });

  it('agrees with brute force on 600 random formulas, and every UNSAT has a valid DRAT proof', () => {
    const r = rng(2024);
    let unsat = 0;
    for (let i = 0; i < 600; i++) {
      const n = r.int(3, 12);
      const cnf = randomKSat(r, n, Math.round(n * (3.5 + r.next() * 2)), 3);
      const { result, model, solver } = solveCnf(cnf, { proof: true });
      expect(result === 'sat', `formula ${i}`).toBe(brute(cnf));
      if (result === 'sat') expect(satisfies(cnf, model)).toBe(true);
      else {
        unsat++;
        const check = checkDrat(cnf.clauses, solver.proof);
        expect(check.ok, check.message).toBe(true);
      }
    }
    expect(unsat).toBeGreaterThan(50);
  });

  it('plain DPLL (no learning) gives the same answers', () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 10);
      const cnf = randomKSat(r, n, Math.round(n * 4.3), 3);
      expect(solveCnf(cnf, { learn: false, vsids: false, restarts: false }).result === 'sat').toBe(brute(cnf));
    }
  });

  it('a sabotaged learned clause is caught by the DRAT checker', () => {
    const cnf = pigeonhole(5, 4);
    const { solver } = solveCnf(cnf, { proof: true });
    expect(checkDrat(cnf.clauses, solver.proof).ok).toBe(true);
    // Replace a learned clause with something that does not follow.
    const lie = solver.proof.map((l) => ({ ...l, lits: [...l.lits] }));
    const i = lie.findIndex((l) => l.kind === 'a' && l.lits.length >= 2);
    lie[i]!.lits = [lie[i]!.lits[0]!];
    lie.splice(i + 1, 0, { kind: 'a', lits: [] });
    expect(checkDrat(cnf.clauses, lie.slice(0, i + 2)).ok).toBe(false);
    // A proof that just claims the empty clause is rejected too.
    expect(checkDrat(cnf.clauses, [{ kind: 'a', lits: [] }]).ok).toBe(false);
  });

  it('solves under assumptions and reports the failed ones', () => {
    const s = new Solver();
    s.addClause([-1, 2]);
    s.addClause([-2, 3]);
    expect(s.solve({ assumptions: [1, -3] })).toBe('unsat');
    expect(s.failedAssumptions.sort()).toEqual([-3, 1].sort());
    expect(s.solve({ assumptions: [1] })).toBe('sat');
    expect(s.model[3]).toBe(true);
    // Incremental: add a clause and solve again.
    s.addClause([-3]);
    expect(s.solve({ assumptions: [1] })).toBe('unsat');
    expect(s.solve()).toBe('sat');
  });

  it('emits decide, propagate, conflict and learn events for the stepper', () => {
    const events: SolverEvent[] = [];
    solveCnf(pigeonhole(3, 2), { onEvent: (e) => events.push(e) });
    const kinds = new Set(events.map((e) => e.type));
    for (const k of ['decide', 'propagate', 'conflict', 'learn', 'unsat']) expect(kinds.has(k as SolverEvent['type'])).toBe(true);
    const learn = events.find((e) => e.type === 'learn') as Extract<SolverEvent, { type: 'learn' }>;
    expect(learn.clause[0]).toBe(learn.uip);
  });

  it('a human can choose the decisions', () => {
    const s = new Solver({ decide: (sv) => (sv.valueOf(2) === 0 ? -2 : 0) });
    s.addClause([1, 2]);
    s.addClause([2, 3]);
    expect(s.solve()).toBe('sat');
    expect(s.model[2]).toBe(false);
    expect(s.model[1] && s.model[3]).toBe(true);
  });

  it('round-trips DIMACS', () => {
    const cnf = { nvars: 3, clauses: [[1, -2], [3]] };
    expect(parseDimacs(printDimacs(cnf))).toEqual(cnf);
  });
});

describe('encodings', () => {
  it('Tseitin is equisatisfiable and linear, the naive CNF is exponential', () => {
    // (x1 ⊕ y1) ∧ … ∧ (xn ⊕ yn) as a disjunction of conjunctions blows up under distribution.
    const f = forr(...Array.from({ length: 6 }, (_, i) => fand(fv(2 * i + 1), fv(2 * i + 2))));
    expect(naiveCnf(f).length).toBe(2 ** 6);
    const t = tseitin(f);
    expect(t.clauses.length).toBeLessThan(40);
    const r = rng(5);
    for (let k = 0; k < 50; k++) {
      const g = fxor(fiff(fv(1), fnot(fv(2))), forr(fv(3), fand(fv(1), fv(4))));
      const tg = tseitin(g);
      const { result, model } = solveCnf(tg);
      expect(result).toBe('sat');
      expect(evalFormula(g, model)).toBe(true);
      void r;
    }
  });
  it('counts the 92 solutions of eight queens', () => {
    const q = nQueens(8);
    expect(countModels(q)).toBe(92);
  });
  it('the sequential counter allows exactly the assignments with at most k true', () => {
    let next = 6;
    const cnf = { nvars: 0, clauses: atMostK([1, 2, 3, 4, 5], 2, () => next++) };
    cnf.nvars = next - 1;
    // Projected on the 5 inputs: C(5,0)+C(5,1)+C(5,2) = 16.
    expect(countModels(cnf, [1, 2, 3, 4, 5])).toBe(16);
  });
  it('solves a hard 9×9 Sudoku quickly', () => {
    const puzzle = '800000000003600000070090200050007000000045700000100030001000068008500010090000400'.split('').map(Number);
    const s = sudoku(3, puzzle);
    solveCnf(s); // warm up
    const t0 = performance.now();
    const { result, model } = solveCnf(s);
    const ms = performance.now() - t0;
    expect(result).toBe('sat');
    const grid = s.decode(model);
    expect(grid.slice(0, 9)).toEqual([8, 1, 2, 7, 5, 3, 6, 4, 9]);
    expect(ms).toBeLessThan(500);
  });
  it('proves PHP(7, 6) unsatisfiable with a checked proof', () => {
    const cnf = pigeonhole(7, 6);
    const { result, solver } = solveCnf(cnf, { proof: true });
    expect(result).toBe('unsat');
    expect(checkDrat(cnf.clauses, solver.proof).ok).toBe(true);
  });
});

describe('differential testing against Z3', () => {
  it('agrees on 150 random 3-SAT formulas near the phase transition (n = 40…80)', async () => {
    const r = rng(99);
    for (let i = 0; i < 150; i++) {
      const n = r.int(40, 81);
      const cnf = randomKSat(r, n, Math.round(n * 4.26), 3);
      const ours = solveCnf(cnf, { proof: true });
      const theirs = await z3Check(cnfToSmtlib(cnf));
      expect(ours.result, `formula ${i}`).toBe(theirs);
      if (ours.result === 'sat') expect(satisfies(cnf, ours.model)).toBe(true);
    }
  }, 300_000);
  afterAll(async () => {
    const { killThreads } = await import('z3-solver');
    const { z3 } = await import('../testing/z3');
    const ctx = await z3();
    void ctx;
    void killThreads;
  });
});
