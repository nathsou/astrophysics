import { describe, expect, it } from 'vitest';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { rng } from '../util/random';
import * as I from './interval';
import { analyse } from './analyse';
import { NonRelational, IntervalValues, SignValues } from './domain';
import { Octagons } from './octagon';
import { triage } from './triage';

function load(src: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return c;
}

describe('interval arithmetic', () => {
  it('is sound on random intervals (every concrete result is inside)', () => {
    const r = rng(7);
    const pick = () => BigInt(r.int(-20, 21));
    for (let t = 0; t < 400; t++) {
      const [a1, a2, b1, b2] = [pick(), pick(), pick(), pick()];
      const A = I.itv(a1 < a2 ? a1 : a2, a1 < a2 ? a2 : a1) as I.Itv;
      const B = I.itv(b1 < b2 ? b1 : b2, b1 < b2 ? b2 : b1) as I.Itv;
      for (let x = A.lo!; x <= A.hi!; x++)
        for (let y = B.lo!; y <= B.hi!; y++) {
          expect(I.contains(I.add(A, B), x + y)).toBe(true);
          expect(I.contains(I.sub(A, B), x - y)).toBe(true);
          expect(I.contains(I.mul(A, B), x * y)).toBe(true);
          if (y !== 0n) {
            expect(I.contains(I.div(A, B), x / y)).toBe(true);
            expect(I.contains(I.mod(A, B), x % y)).toBe(true);
          }
        }
    }
  });
  it('widens a growing bound to infinity', () => {
    expect(I.show(I.widen(I.itv(0n, 1n), I.itv(0n, 2n)))).toBe('[0, +∞]');
    expect(I.show(I.narrow(I.itv(0n, null), I.itv(0n, 10n)))).toBe('[0, 10]');
  });
});

const SUM = `fn sum(a: [int]) -> int {
  var s = 0
  var i = 0
  while i < len(a) {
    s = s + a[i]
    i = i + 1
  }
  return s
}`;

describe('abstract interpretation', () => {
  it('raises a false index alarm with intervals, and proves the index with octagons', () => {
    const c = load(SUM);
    const iv = analyse(c, c.fns.get('sum')!, new NonRelational(IntervalValues), SUM);
    expect(iv.checks.find((k) => k.kind === 'index')?.status).toBe('alarm');
    const oc = analyse(c, c.fns.get('sum')!, new Octagons(), SUM);
    expect(oc.checks.find((k) => k.kind === 'index')?.status).toBe('proved');
    const t = triage(c, c.fns.get('sum')!, SUM, iv.checks);
    expect(t.checks.find((k) => k.kind === 'index')?.verdict).toBe('unconfirmed');
  });
  it('widens at the loop head after the delay, and stops', () => {
    const src = `fn count(n: int) -> int
  requires n >= 0
{
  var i = 0
  while i < n { i = i + 1 }
  return i
}`;
    const c = load(src);
    const r = analyse(c, c.fns.get('count')!, new NonRelational(IntervalValues), src, { widenDelay: 2 });
    expect(r.loops[0]!.iterations.map((x) => x.how)).toEqual(['entry', 'join', 'join', 'widen', 'stable']);
    const plain = analyse(c, c.fns.get('count')!, new NonRelational(IntervalValues), src, { noWidening: true, maxIterations: 20 });
    expect(plain.loops[0]!.capped).toBe(true);
  });
  it('confirms a real division by zero and a real overflow by replay', () => {
    const src = `fn avg(total: int, n: int) -> int {
  var k = n
  if k < 0 { k = -k }
  return total / k
}

fn fee(amount: u32, rate: u32) -> u32
  requires rate <= 10000
{
  return amount * rate / 10000
}`;
    const c = load(src);
    for (const fn of ['avg', 'fee']) {
      const r = analyse(c, c.fns.get(fn)!, new NonRelational(IntervalValues), src);
      const t = triage(c, c.fns.get(fn)!, src, r.checks);
      const alarm = t.checks.find((k) => k.status === 'alarm')!;
      expect(alarm.verdict).toBe('confirmed');
      expect(alarm.input).toBeTruthy();
    }
  });
  it('signs prove a division by a square of a positive number', () => {
    const src = `fn f(x: int) -> int
  requires x > 0
{
  let y = x * x
  return 10 / y
}`;
    const c = load(src);
    const r = analyse(c, c.fns.get('f')!, new NonRelational(SignValues), src);
    expect(r.checks.every((k) => k.status === 'proved')).toBe(true);
  });
});
