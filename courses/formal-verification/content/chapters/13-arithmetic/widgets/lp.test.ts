import { describe, expect, it } from 'vitest';
import { parseConstraint, runSimplex, farkasSum, branchAndBound } from './lp';
import { Q } from '$lib/fv/logic/rational';

const sat = (cs: ReturnType<typeof parseConstraint>[], x: Q, y: Q) =>
  cs.every((c) => {
    const v = Q.of(c.a).mul(x).add(Q.of(c.b).mul(y));
    const k = Q.of(c.k);
    return c.rel === '<=' ? v.le(k) : c.rel === '>=' ? k.le(v) : v.eq(k);
  });

describe('two-variable LPs', () => {
  it('parses constraints with terms on both sides', () => {
    const c = parseConstraint('2x - y + 1 <= 3 + x');
    expect([c.a, c.b, c.rel, c.k]).toEqual([1n, -1n, '<=', 2n]);
    expect(parseConstraint('3*y >= -2').b).toBe(3n);
    expect(() => parseConstraint('x + z <= 1')).toThrow();
  });
  it('finds feasible points and certifies infeasibility with Farkas multipliers', () => {
    const feas = ['x + y <= 4', 'x - y >= 1', 'y >= 1', 'x <= 3'].map(parseConstraint);
    const r = runSimplex(feas);
    expect(r.feasible).toBe(true);
    expect(sat(feas, r.x, r.y)).toBe(true);
    const inf = ['x + y <= 2', 'x >= 2', 'y >= 1', 'x - y <= 0'].map(parseConstraint);
    const r2 = runSimplex(inf);
    expect(r2.feasible).toBe(false);
    const { sum } = farkasSum(inf, r2.farkas!);
    expect(sum.a.isZero() && sum.b.isZero()).toBe(true);
    expect(sum.k.sign()).toBeLessThan(0);
  });
  it('branches and bounds', () => {
    const cs = ['2x - 2y = 1', 'x >= 0', 'x <= 3', 'y >= 0', 'y <= 3'].map(parseConstraint);
    expect(runSimplex(cs).feasible).toBe(true);
    const bb = branchAndBound(cs, 100);
    expect(bb.solution).toBeUndefined();
    expect(bb.exhausted).toBe(true);
    const cs2 = ['3x + 2y <= 12', 'x - y >= 1', '2x + 5y >= 9'].map(parseConstraint);
    const bb2 = branchAndBound(cs2);
    expect(bb2.solution).toBeDefined();
    expect(bb2.solution!.run.x.isInt() && bb2.solution!.run.y.isInt()).toBe(true);
    expect(sat(cs2, bb2.solution!.run.x, bb2.solution!.run.y)).toBe(true);
  });
});
