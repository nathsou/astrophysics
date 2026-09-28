import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { type Nat, concatSeq, decodeSeq, digitCount, encodeSeq, evaluate, formatMagnitude, lit, magnitude, natEq, named, seqLength, seqLit, valuation } from '../src/engine/numbers/nat.ts';
import { nthPrime } from '../src/engine/numbers/primes.ts';

describe('primes', () => {
  it('indexes primes from 0', () => {
    expect([0, 1, 2, 3, 4, 5, 99].map(nthPrime)).toEqual([2, 3, 5, 7, 11, 13, 541]);
  });
});

describe('sequence codes (section Sequences)', () => {
  it('codes ⟨a0,…,ak⟩ as p0^(a0+1)·…·pk^(ak+1), with ⟨⟩ = Λ = 0', () => {
    expect(encodeSeq([])).toBe(0n);
    expect(encodeSeq([2n, 7n, 3n])).toBe(2n ** 3n * 3n ** 8n * 5n ** 4n);
    // ⟨2,7,3⟩ and ⟨2,7,3,0,0⟩ are different (the reason for the +1)
    expect(encodeSeq([2n, 7n, 3n])).not.toBe(encodeSeq([2n, 7n, 3n, 0n, 0n]));
  });

  it('decodes what it encodes (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.bigInt({ min: 0n, max: 40n }), { maxLength: 8 }), (xs) => {
        const d = decodeSeq(encodeSeq(xs));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.items).toEqual(xs);
      }),
    );
  });

  it('rejects numbers that are not sequence codes', () => {
    // 2^1 · 5^1: p1 = 3 is skipped
    const d = decodeSeq(10n);
    expect(d.ok).toBe(false);
  });

  it('computes large valuations quickly', () => {
    const n = 3n ** 100_000n * 7n;
    expect(valuation(n, 3n).exponent).toBe(100_000n);
  });
});

describe('symbolic numbers', () => {
  it('estimates magnitude of the book’s example 2^13123·3^39367·5^13·7^354295·11^25·13^118099', () => {
    const exact = 2n ** 13123n * 3n ** 39367n * 5n ** 13n * 7n ** 354295n * 11n ** 25n * 13n ** 118099n;
    const n = seqLit([13122, 39366, 12, 354294, 24, 118098]);
    expect(evaluate(n, 1 << 22)).toBe(exact);
    const m = magnitude(n)!;
    expect('L' in m).toBe(true);
    const digits = exact.toString().length;
    expect(Math.floor((m as { L: number }).L) + 1).toBe(digits);
  });

  it('keeps runs symbolic and compares them structurally', () => {
    const big = named('N', 'N');
    const a: Nat = { k: 'seq', parts: [{ k: 'run', times: big, items: [lit(5)] }, { k: 'item', v: lit(1) }] };
    const b: Nat = { k: 'seq', parts: [{ k: 'run', times: named('N', 'N'), items: [lit(5)] }, { k: 'item', v: lit(1) }] };
    expect(natEq(a, b)).toBe('equal');
    expect(natEq(a, lit(3))).toBe('unknown');
    expect(seqLength(a)).toEqual({ k: 'add', ts: [big, lit(1)] });
  });

  it('concatenation of concrete sequences is the concatenated sequence', () => {
    expect(natEq(concatSeq(seqLit([1, 2]), seqLit([3])), seqLit([1, 2, 3]))).toBe('equal');
    expect(natEq(seqLit([1, 2]), seqLit([2, 1]))).toBe('different');
  });

  it('formats digit counts', () => {
    expect(formatMagnitude(magnitude(lit(12345)))).toBe('5 digits');
    expect(digitCount(lit(10n ** 50n))).toEqual({ L: Math.log10(50) });
  });
});
