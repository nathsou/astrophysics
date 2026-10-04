import { describe, expect, it } from 'vitest';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SymbolicExplorer } from './symex';

function explorer(src: string, name: string, opts = {}) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return new SymbolicExplorer(c, c.fns.get(name)!, src, opts);
}

const HARD = `fn check_code(code: int, salt: int) -> int
  requires 0 <= salt < 1000
{
  if code > 1000000 {
    if code * 3 + 7 == salt * 5 + 3000100 {
      assert salt != 432
      return 2
    }
    return 1
  }
  return 0
}`;

describe('symbolic execution', () => {
  it('builds the tree, finds a test for every path and the input that breaks the assertion', () => {
    const ex = explorer(HARD, 'check_code').all();
    expect(ex.leaves).toHaveLength(3);
    for (const l of ex.leaves) expect(l.test?.replayed).toBe(true);
    const outcomes = ex.leaves.map((l) => l.test!.outcome).sort();
    expect(outcomes.some((o) => o.startsWith('returns 0'))).toBe(true);
    expect(outcomes.some((o) => o.startsWith('returns 1'))).toBe(true);
    const f = ex.failures;
    expect(f).toHaveLength(1);
    expect(f[0]!.replayed).toBe(true);
    expect(f[0]!.input).toContain('salt = 432');
    // Every statement that can run (the assertion, the three returns) was reached by some replayed test.
    expect([...ex.covered].sort((a, b) => a - b)).toEqual([6, 7, 9, 11]);
  });
  it('marks infeasible directions', () => {
    const ex = explorer(`fn f(x: int) -> int {
  if x > 5 {
    if x < 3 { return 1 }
    return 2
  }
  return 3
}`, 'f').all();
    expect(ex.nodes.filter((n) => n.kind === 'infeasible')).toHaveLength(1);
    expect(ex.leaves).toHaveLength(2);
  });
  it('unrolls loops up to a bound, so the tree grows with the bound', () => {
    const src = `fn count(n: int) -> int
  requires n >= 0
{
  var i = 0
  while i < n {
    i = i + 1
  }
  return i
}`;
    const small = explorer(src, 'count', { maxUnroll: 3 }).all();
    const big = explorer(src, 'count', { maxUnroll: 8 }).all();
    expect(small.leaves).toHaveLength(4);
    expect(big.leaves).toHaveLength(9);
    expect(small.nodes.filter((n) => n.kind === 'cut')).toHaveLength(1);
    for (const l of big.leaves) expect(l.test!.outcome).toMatch(/^returns \d$/);
  });
  it('checks the postcondition on every path', () => {
    const ex = explorer(`fn abs(x: i32) -> i32
  ensures result >= 0
{
  if x < 0 { return -x }
  return x
}`, 'abs').all();
    const f = ex.failures;
    expect(f.length).toBeGreaterThanOrEqual(1);
    expect(f.some((x) => x.input.includes('-2147483648') && x.replayed)).toBe(true);
  });
});
