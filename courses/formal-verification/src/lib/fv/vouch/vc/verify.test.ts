import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../syntax/parser';
import { check } from '../check/checker';
import { verifyFunction } from './verify';

function verifySource(src: string, fn: string) {
  const checked = check(parse(src).program);
  const errs = checked.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((d) => d.message).join('\n'));
  return verifyFunction(checked, checked.fns.get(fn)!, { timeout: 8000 });
}

const example = (name: string) => readFileSync(new URL(`../examples/${name}.vouch`, import.meta.url), 'utf8');

describe('program verifier', () => {
  it('verifies a simple function', () => {
    const r = verifySource(`fn max(a: int, b: int) -> (m: int)
  ensures m >= a && m >= b
  ensures m == a || m == b
{
  if a >= b { return a }
  return b
}`, 'max');
    expect(r.unsupported).toBeUndefined();
    expect(r.verdicts[0]!.status, JSON.stringify(r.verdicts, null, 1)).toBe('verified');
  });

  it('finds and replays a bug', () => {
    const r = verifySource(`fn max(a: int, b: int) -> (m: int)
  ensures m >= a && m >= b
{
  if a > b { return b }
  return a
}`, 'max');
    expect(r.verdicts[0]!.status).toBe('violated');
    expect(r.verdicts[0]!.badge).toEqual({ kind: 'violated', replayed: true });
  });

  it('loop with invariant', () => {
    const r = verifySource(`fn sum_to(n: nat) -> (s: int)
  ensures s == n * (n + 1) / 2
{
  var i = 0
  s = 0
  while i < n
    invariant 0 <= i <= n
    invariant 2 * s == i * (i + 1)
    decreases n - i
  {
    i = i + 1
    s = s + i
  }
}`, 'sum_to');
    expect(r.unsupported).toBeUndefined();
    // Non-linear: may be unknown, but must not be "violated".
    expect(r.verdicts.every((v) => v.status !== 'violated')).toBe(true);
  });

  for (const [name, fn, expected] of [
    ['binary-search', 'search', 'verified'],
    ['binary-search-overflow', 'search', 'violated'],
    ['insertion-sort', 'insertion_sort', 'verified'],
    ['ledger-transfer', 'transfer', 'verified'],
    ['ring-buffer', 'push', 'verified'],
    ['ring-buffer', 'pop', 'verified'],
  ] as const) {
    it(`example ${name}`, () => {
      const r = verifySource(example(name), fn);
      expect(r.unsupported).toBeUndefined();
      const summary = r.verdicts.map((v) => `${v.status} ${v.subject} ${v.message}`).join('\n');
      expect(r.verdicts.some((v) => v.status === expected), summary).toBe(true);
      if (expected === 'verified') expect(r.verdicts.length, summary).toBe(1);
    }, 60000);
  }
});

describe('program verifier: failures', () => {
  it('replays the overflow', () => {
    const r = verifySource(example('binary-search-overflow'), 'search');
    const v = r.verdicts.find((x) => x.status === 'violated')!;
    expect(v.badge).toEqual({ kind: 'violated', replayed: true });
    expect(v.message).toMatch(/overflow/);
  });
  it('reports a counterexample to induction for a weak invariant', () => {
    const r = verifySource(`fn count(n: nat) -> (i: int)
  ensures i == n
{
  i = 0
  while i < n
    invariant i <= n + 1
    decreases n - i
  {
    i = i + 1
  }
}`, 'count');
    const v = r.verdicts.find((x) => x.status !== 'verified')!;
    expect(v.status).toBe('unknown');
    expect(v.subject).toMatch(/postcondition/);
    expect(v.trace?.steps.length).toBeGreaterThan(0);
  });
  it('replays an invariant that fails in a real run', () => {
    const r = verifySource(`fn f(n: nat) -> (i: int)
{
  i = 0
  var k = 0
  while k < n
    invariant i == k
    decreases n - k
  {
    k = k + 1
    i = i + 2
  }
}`, 'f');
    expect(r.verdicts[0]!.status).toBe('violated');
  });
  it('reports a true but non-inductive invariant as a counterexample to induction', () => {
    const r = verifySource(`fn f(n: nat) -> (y: int)
{
  y = 0
  var x = 0
  while x < n
    invariant 0 <= x <= n
    invariant y <= 2 * n
    decreases n - x
  {
    x = x + 1
    y = y + 2
  }
}`, 'f');
    expect(r.verdicts.some((v) => v.badge.kind === 'unknown' && v.badge.reason === 'counterexample to induction')).toBe(true);
  });
});

import { testFunction } from '../../verify/document';
import { rng } from '../../util/random';

describe('program verifier: soundness against the interpreter', () => {
  // Mutate verified programs; whenever the verifier still says "verified", random testing must find no failure.
  const mutations: [RegExp, string][] = [
    [/</, '<='], [/<=/, '<'], [/\+ 1/, '+ 2'], [/- 1/, '+ 0'], [/>/, '>='], [/hi = mid/, 'hi = mid + 1'], [/lo = mid \+ 1/, 'lo = mid'],
    [/j - 1/, 'j'], [/0 <= /, '1 <= '], [/key < a\[mid\]/, 'key <= a[mid]'], [/len\(a\)/, 'len(a) - 1'],
  ];
  for (const [name, fn] of [['binary-search', 'search'], ['insertion-sort', 'insertion_sort'], ['ledger-transfer', 'transfer'], ['ring-buffer', 'push']] as const) {
    it(`mutants of ${name}`, () => {
      const src = example(name);
      const r = rng(name.length);
      let verifiedMutants = 0;
      for (let n = 0; n < 25; n++) {
        const [re, rep] = mutations[r.int(0, mutations.length)]!;
        // Replace a random occurrence.
        const all = [...src.matchAll(new RegExp(re.source, 'g'))];
        if (!all.length) continue;
        const m = all[r.int(0, all.length)]!;
        const mutant = src.slice(0, m.index) + rep + src.slice(m.index! + m[0].length);
        const parsed = parse(mutant);
        if (parsed.diagnostics.some((d) => d.severity === 'error')) continue;
        const checked = check(parsed.program);
        if (checked.diagnostics.some((d) => d.severity === 'error')) continue;
        const info = checked.fns.get(fn);
        if (!info) continue;
        const v = verifyFunction(checked, info, { timeout: 3000 });
        if (v.verdicts.length !== 1 || v.verdicts[0]!.status !== 'verified') continue;
        verifiedMutants++;
        const t = testFunction(checked, info, 150);
        expect(t[0]!.status, `verified but fails when run:\n${mutant}\n${t[0]!.message}`).not.toBe('violated');
      }
      void verifiedMutants;
    }, 120000);
  }
});
