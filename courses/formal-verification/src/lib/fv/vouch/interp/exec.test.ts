import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../syntax/parser';
import { check } from '../check/checker';
import { Runner } from './exec';
import { Heap } from './eval';
import { seq, show, type Value } from './values';
import { rng } from '../../util/random';

const ex = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../examples', f), 'utf8');

function load(src: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((d) => `${d.code} ${d.message}`).join('\n'));
  return c;
}
const ints = (xs: number[]) => seq(xs.map((x) => BigInt(x)));

describe('running programs with contracts', () => {
  it('binary search satisfies its contract on random sorted arrays (but tests never reach the overflow)', () => {
    for (const file of ['binary-search.vouch', 'binary-search-overflow.vouch']) {
      const c = load(ex(file));
      const r = rng(1);
      for (let n = 0; n < 200; n++) {
        const a = Array.from({ length: r.int(0, 20) }, () => r.int(-50, 50)).sort((x, y) => x - y);
        const res = new Runner(c).run('search', [ints(a), BigInt(r.int(-60, 60))]);
        expect(res.failure?.message).toBeUndefined();
        expect(res.ok).toBe(true);
      }
    }
  });
  it('the overflow appears as soon as the indices are large', () => {
    const c = load(`fn mid(lo: i32, hi: i32) -> i32
  requires 0 <= lo <= hi
{
  return (lo + hi) / 2
}`);
    const res = new Runner(c).run('mid', [1_073_741_824n, 2_147_483_647n]);
    expect(res.failure?.kind).toBe('overflow');
    expect(res.failure?.message).toMatch(/i32 overflow/);
  });
  it('unsorted inputs are discarded, not failures', () => {
    const c = load(ex('binary-search.vouch'));
    const res = new Runner(c).run('search', [ints([3, 1, 2]), 1n]);
    expect(res.discarded).toBe(true);
  });
  it('insertion sort: invariants are checked on entry and after every iteration', () => {
    const c = load(ex('insertion-sort.vouch'));
    const r = rng(3);
    for (let n = 0; n < 50; n++) {
      const a = Array.from({ length: r.int(0, 12) }, () => r.int(-9, 9));
      const res = new Runner(c).run('insertion_sort', [ints(a)]);
      expect(res.failure?.message).toBeUndefined();
      expect(show(res.outs.a!)).toBe(show(ints([...a].sort((x, y) => x - y))));
    }
  });
  it('a wrong invariant is caught after the first iteration', () => {
    const c = load(`fn sum(n: nat) -> (s: int)
  ensures s == n * (n + 1) / 2
{
  s = 0
  var i = 0
  while i < n
    invariant s == i * i
    decreases n - i
  {
    i = i + 1
    s = s + i
  }
}`);
    const res = new Runner(c).run('sum', [3n]);
    expect(res.failure?.kind).toBe('invariant-preserved');
  });
  it('the Zune loop never terminates on the 366th day of a leap year', () => {
    const c = load(`pure fn leap(y: int) -> bool { y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) }

fn year_of(days0: int) -> (year: int)
  requires days0 > 0
{
  var days = days0
  year = 1980
  while days > 365
    decreases days
  {
    if leap(year) {
      if days > 366 {
        days = days - 366
        year = year + 1
      }
    } else {
      days = days - 365
      year = year + 1
    }
  }
}`);
    expect(new Runner(c).run('year_of', [10_000n]).ok).toBe(true);
    const res = new Runner(c).run('year_of', [10_593n]);
    expect(res.failure?.kind).toBe('decreases');
  });
  it('u64 arithmetic in the Ledger transfer is checked', () => {
    const c = load(ex('ledger-transfer.vouch'));
    const ok = new Runner(c).run('transfer', [ints([10, 20, 30]), 0n, 2n, 5n]);
    expect(ok.ok).toBe(true);
    expect(show(ok.outs.balance!)).toBe('[5, 20, 35]');
  });
  it('the ring buffer agrees with its abstraction', () => {
    const c = load(ex('ring-buffer.vouch'));
    const q: Value = { t: 'struct', name: 'Ring', fields: [ints([0, 0, 0]), 2n, 1n] };
    const res = new Runner(c).run('push', [q, 7n]);
    expect(res.failure?.message).toBeUndefined();
    expect(res.ok).toBe(true);
  });
  it('list reversal: separation-logic contracts are checked on the concrete heap', () => {
    const c = load(ex('list-reverse.vouch'));
    const heap = new Heap();
    let head: Value = null;
    for (const v of [3n, 2n, 1n]) head = heap.alloc('Node', [v, head]);
    const res = new Runner(c).run('reverse', [head, ints([1, 2, 3])], heap);
    expect(res.failure?.message).toBeUndefined();
    expect(res.ok).toBe(true);
    // A cyclic list does not satisfy list(x, xs): the call is discarded.
    const h2 = new Heap();
    const a = h2.alloc('Node', [1n, null]);
    h2.get(1)!.fields[1] = a;
    expect(new Runner(c, { fuel: 10_000 }).run('reverse', [a, ints([1])], h2).discarded).toBe(true);
  });
  it('records a trace for the time-travel debugger', () => {
    const c = load('fn f(x: int) -> int { var y = x\n y = y * 2\n return y + 1 }');
    const res = new Runner(c, { trace: 100 }).run('f', [4n]);
    expect(res.result).toBe(9n);
    expect(res.trace.map((t) => t.vars.y)).toEqual(['4', '8', '8']);
  });
});
