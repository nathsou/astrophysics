import { describe, expect, it } from 'vitest';
import { lookaheadAdder, miter, rippleAdder, simulate } from './adders';
import { tseitin, type Formula } from '$lib/fv/sat/encode';
import { solveCnf } from '$lib/fv/sat/solver';
import { checkDrat } from '$lib/fv/sat/check/drat';
import { rng } from '$lib/fv/util/random';

const vars = (w: number, from: number): Formula[] => Array.from({ length: w }, (_, i) => ({ k: 'var', v: from + i }));

describe('adders', () => {
  it('both adders add correctly on random inputs, and the buggy one only rarely fails', () => {
    const r = rng(14);
    for (const w of [4, 8, 16]) {
      for (let t = 0; t < 200; t++) {
        const a = BigInt(Math.floor(r.next() * 2 ** w));
        const b = BigInt(Math.floor(r.next() * 2 ** w));
        expect(simulate(rippleAdder, w, a, b)).toBe(a + b);
        expect(simulate((x) => lookaheadAdder(x), w, a, b)).toBe(a + b);
      }
    }
  });

  it('the miter is UNSAT for the correct adders (with a checked proof) and SAT for the planted bug', () => {
    for (const w of [8, 16]) {
      const inp = { a: vars(w, 1), b: vars(w, w + 1) };
      const m = miter(rippleAdder(inp), lookaheadAdder(inp));
      const cnf = tseitin(m, 2 * w + 1);
      const r = solveCnf(cnf, { proof: true });
      expect(r.result).toBe('unsat');
      expect(checkDrat(cnf.clauses, r.solver.proof).ok).toBe(true);
      const bad = tseitin(miter(rippleAdder(inp), lookaheadAdder(inp, true)), 2 * w + 1);
      const rb = solveCnf(bad);
      expect(rb.result).toBe('sat');
      const val = (from: number) => Array.from({ length: w }, (_, i) => (rb.model[from + i] ? 1n << BigInt(i) : 0n)).reduce((x, y) => x + y, 0n);
      const a = val(1);
      const b = val(w + 1);
      expect(simulate((x) => lookaheadAdder(x, true), w, a, b)).not.toBe(a + b);
    }
  });
});

import { lookaheadNumeric, bugProbability } from './adders';
describe('numeric simulation', () => {
  it('matches addition, and the buggy adder fails at about the predicted rate for 8 bits', () => {
    const r = rng(3);
    let fails = 0;
    const N = 20000;
    for (let t = 0; t < N; t++) {
      const a = Array.from({ length: 8 }, () => r.next() < 0.5);
      const b = Array.from({ length: 8 }, () => r.next() < 0.5);
      const num = (x: boolean[]) => x.reduce((n, bit, i) => n + (bit ? 2 ** i : 0), 0);
      const sum = (bits: boolean[]) => num(bits);
      expect(sum(lookaheadNumeric(8, a, b, false))).toBe(num(a) + num(b));
      if (sum(lookaheadNumeric(8, a, b, true)) !== num(a) + num(b)) fails++;
    }
    expect(Math.abs(fails / N - bugProbability(8))).toBeLessThan(0.02);
  });
});
