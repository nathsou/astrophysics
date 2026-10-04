import { describe, expect, it } from 'vitest';
import { checkAt, circuitSize, evaluate, parseRewrite, showValue, varsOf, type Rewrite } from './peephole';

/** Does some input at width w break the rewrite? Exhaustive, for small widths. */
function brute(rw: Rewrite, w: number): boolean {
  const names = varsOf(rw);
  const n = 1n << BigInt(w);
  const env = new Map<string, bigint>();
  const rec = (i: number): boolean => {
    if (i === names.length) {
      const pre = rw.pre ? evaluate(rw.pre, env, w) : { v: true, defined: true };
      if (pre.v !== true || !pre.defined) return false;
      const l = evaluate(rw.lhs, env, w);
      if (!l.defined) return false;
      const r = evaluate(rw.rhs, env, w);
      return !r.defined || l.v !== r.v;
    }
    for (let x = 0n; x < n; x++) {
      env.set(names[i]!, x);
      if (rec(i + 1)) return true;
    }
    return false;
  };
  return rec(0);
}

const DOCKET = [
  'x * 2 => x << 1',
  'x + x => x << 1',
  '(x ^ -1) + 1 => -x',
  '~x + 1 => -x',
  'x /u 2 => x >>u 1',
  'x /s 2 => x >>s 1',
  'x * C => x << C2 if C == 1 << C2',
  'x * C => x << C2 if C == 1 << C2 && C2 <u width',
  '(x & C1) | (x & C2) => x & (C1 | C2)',
  'x + 1 >s x => true',
  'x + 1 >s x => x != SMAX',
  'x %u C => x & (C - 1) if pow2(C)',
  'x %s C => x & (C - 1) if pow2(C)',
  '(x >>u C) <<  C => x & (UMAX << C) if C <u width',
  '0 - (x /s C) => x /s -C',
  'x - y <u x => y != 0',
  'x - y <u x => y != 0 && y <=u x',
  '(x | y) - (x & y) => x ^ y',
  'x /u y => 0 if x <u y',
  'x => x + 1 if x == x + 1',
];

describe('the peephole court', () => {
  it('parses rewrites and rejects ill-typed ones', () => {
    expect(varsOf(parseRewrite('x * C => x << C2 if C == 1 << C2'))).toEqual(['x', 'C', 'C2']);
    expect(() => parseRewrite('x + 1 => x > 1')).toThrow();
    expect(() => parseRewrite('x + => 1')).toThrow();
    expect(() => parseRewrite('x => y if x + 1')).toThrow();
    expect(() => parseRewrite('x / 2 => x >> 1')).toThrow(/\/u or \/s/);
  });
  it('agrees with brute force at widths 3 and 4, and every counterexample replays', () => {
    for (const text of DOCKET) {
      const rw = parseRewrite(text);
      for (const w of [3, 4]) {
        const v = checkAt(rw, w);
        const bad = brute(rw, w);
        expect([text, w, v.status === 'refuted']).toEqual([text, w, bad]);
        if (v.status !== 'refuted') expect([text, v.status]).toContain(v.status === 'vacuous' ? 'vacuous' : 'proved');
        if (v.status === 'proved') expect([text, w, v.certified]).toEqual([text, w, true]);
      }
    }
  });
  it('decides the docket at 8, 16 and 32 bits', () => {
    const expected: Record<string, string> = {
      'x * 2 => x << 1': 'proved',
      'x /s 2 => x >>s 1': 'refuted',
      'x + 1 >s x => true': 'refuted',
      'x + 1 >s x => x != SMAX': 'proved',
      'x %s C => x & (C - 1) if pow2(C)': 'refuted',
      'x => x + 1 if x == x + 1': 'vacuous',
    };
    for (const [text, status] of Object.entries(expected)) for (const w of [8, 16, 32]) expect([text, w, checkAt(parseRewrite(text), w).status]).toEqual([text, w, status]);
  });
  it('reports circuit sizes that grow with the width', () => {
    const rw = parseRewrite('x * y => y * x');
    const s8 = circuitSize(rw.lhs, 8);
    const s16 = circuitSize(rw.lhs, 16);
    expect(s16.gates).toBeGreaterThan(3 * s8.gates);
    expect(circuitSize(parseRewrite('x & y => y & x').lhs, 32).gates).toBe(32);
  });
  it('shows values in binary, hex and signed decimal', () => {
    expect(showValue(0xf0n, 8)).toEqual({ bin: '1111 0000', hex: '0xf0', dec: '240 (signed -16)' });
  });
});
