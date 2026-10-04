import { describe, expect, it } from 'vitest';
import { iff } from '../logic/term';
import { checkVc, computeWp, formulaFromText, formulaSize, fromVouch, HoareProof, showFormula, valid, verificationCondition } from './wp';

const SWAP = `fn swap_sum(x: int, y: int) -> int
  requires x >= 0 && y >= 0
  ensures result == x + y
{
  var a = x
  var b = y
  a = a + b
  b = a - b
  a = a - b
  return a + b
}`;

const ABS = `fn abs(x: int) -> int
  ensures result >= 0 && (result == x || result == -x)
{
  if x < 0 {
    return -x
  }
  return x
}`;

const SUM = `fn twice(n: int) -> int
  requires n >= 0
  ensures result == 2 * n
{
  var i = 0
  var s = 0
  while i < n
    invariant 0 <= i <= n && s == 2 * i
  {
    i = i + 1
    s = s + 2
  }
  return s
}`;

describe('weakest preconditions', () => {
  it('computes wp backwards through assignments', () => {
    const p = fromVouch(SWAP);
    const r = computeWp(p);
    expect(valid(verificationCondition(p, r)).valid).toBe(true);
    // The annotation before the last assignment: (a - b) + b = x + y with b already updated.
    expect(r.annotations.length).toBe(6);
    expect(showFormula(r.wp)).toContain('x');
  });
  it('handles branches and returns, and finds counterexamples to wrong contracts', () => {
    const p = fromVouch(ABS);
    expect(valid(verificationCondition(p)).valid).toBe(true);
    const bad = fromVouch(ABS.replace('return -x', 'return x'));
    const v = valid(verificationCondition(bad));
    expect(v.status).toBe('invalid');
    expect(v.counterexample!.find(([k]) => k === 'x')![1]).toMatch(/^-/);
  });
  it('turns a loop into side conditions about its invariant', () => {
    const p = fromVouch(SUM);
    const r = computeWp(p);
    expect(r.side).toHaveLength(2);
    expect(checkVc(p, r).every((x) => x.result.valid)).toBe(true);
    const weak = fromVouch(SUM.replace('0 <= i <= n && ', ''));
    expect(checkVc(weak).every((x) => x.result.valid)).toBe(false);
  });
  it('builds Hoare proofs whose side conditions the solver checks', () => {
    for (const [src, ok] of [[SWAP, true], [ABS, true], [SUM, true], [ABS.replace('return -x', 'return x'), false]] as const) {
      const h = new HoareProof(fromVouch(src));
      h.auto();
      expect(h.done).toBe(ok);
    }
  });
  it('naive wp duplicates the postcondition at every branch', () => {
    const prog = (n: number) => `fn f(x0: int) -> int
  ensures result != 7
{
  var x = x0
${Array.from({ length: n }, () => '  if x > 10 { x = 2 * x } else { x = x + 3 }').join('\n')}
  return x
}`;
    const sizes = [2, 4, 6, 8].map((n) => formulaSize(computeWp(fromVouch(prog(n))).wp).dag);
    // Roughly doubling with every branch.
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]! / sizes[i - 1]!).toBeGreaterThan(3);
  });
  it('the chapter 17 exercises have the weakest preconditions the text gives', () => {
    const DOUBLE = `fn double(x: int) -> int
  ensures result >= 10
{
  var y = x + 3
  y = 2 * y
  return y
}`;
    const DIST = `fn distance(x: int) -> int
  ensures result > 0
{
  if x > 5 {
    return x - 5
  }
  return 5 - x
}`;
    for (const [src, ans] of [[DOUBLE, 'x >= 2'], [DIST, 'x != 5']] as const) {
      const p = fromVouch(src);
      expect(valid(iff(formulaFromText(p, ans), computeWp(p).wp)).valid).toBe(true);
    }
  });
});
