import { describe, expect, test } from 'vitest';
import { allMaximal, bin, cycles, firstPoor, isMaximal, maximalTaps, next, parity, polynomial, stream, wheel } from './lfsr';

describe('the register', () => {
  test('matches the parts bin: taps 0xb8 on 8 bits step through all 255 non-zero states', () => {
    expect(isMaximal(8, 0xb8)).toBe(true);
    const c = cycles(8, 0xb8);
    expect(c.map((x) => x.length)).toEqual([255, 1]);
    expect(c[1]).toEqual([0]);
  });
  test('the first steps from 00000001', () => {
    // A single 1 just shifts left until it reaches bit 3, the first tap: then a 1 is fed in behind it.
    let s = 1;
    const seen = [s];
    for (let i = 0; i < 8; i++) seen.push((s = next(s, 8, 0xb8)));
    expect(seen).toEqual([1, 2, 4, 8, 17, 35, 71, 142, 28]);
  });
  test('parity', () => {
    expect([0, 1, 3, 7, 0xb8].map(parity)).toEqual([0, 1, 0, 1, 0]);
  });
});

describe('maximal-length taps', () => {
  test('exist for 2 to 10 bits, and give one cycle of 2ⁿ − 1 plus the lock-up state', () => {
    for (let n = 2; n <= 10; n++) {
      const t = maximalTaps(n);
      expect(cycles(n, t).map((c) => c.length), `n = ${n}`).toEqual([(1 << n) - 1, 1]);
    }
  });
  test('the number of maximal tap sets is φ(2ⁿ − 1)/n', () => {
    // 3 bits: 2; 4 bits: 2; 5 bits: 6; 6 bits: 6; 7 bits: 18; 8 bits: 16.
    expect([3, 4, 5, 6, 7, 8].map((n) => allMaximal(n).length)).toEqual([2, 2, 6, 6, 18, 16]);
  });
  test('a poor choice splits the states into several shorter cycles', () => {
    for (const n of [4, 5, 6, 7, 8]) {
      const c = cycles(n, firstPoor(n));
      expect(c.length).toBeGreaterThan(2);
      expect(c[0]!.length).toBeLessThan((1 << n) - 1);
      expect(c.reduce((a, x) => a + x.length, 0)).toBe(1 << n);
    }
  });
  test('the output of a maximal register has 2ⁿ⁻¹ ones and 2ⁿ⁻¹ − 1 zeros per period', () => {
    const n = 8;
    const bits = stream(n, 0xb8, 1, 255);
    expect(bits.filter((b) => b === 1).length).toBe(128);
    expect(bits.filter((b) => b === 0).length).toBe(127);
  });
  test('the stream repeats after exactly the period, not before', () => {
    const b = stream(5, maximalTaps(5), 1, 62);
    expect(b.slice(0, 31)).toEqual(b.slice(31, 62));
  });
});

describe('text and geometry', () => {
  test('polynomials', () => {
    expect(polynomial(8, 0xb8)).toBe('x⁸ + x⁶ + x⁵ + x⁴ + 1');
    expect(polynomial(3, 0b110)).toBe('x³ + x² + 1');
    expect(polynomial(4, 0b1001)).toBe('x⁴ + x + 1');
  });
  test('binary strings', () => {
    expect(bin(5, 8)).toBe('00000101');
  });
  test('a wheel starts at the top', () => {
    const p = wheel(4, 0, 0, 10);
    expect(p[0]![0]).toBeCloseTo(0, 6);
    expect(p[0]![1]).toBeCloseTo(-10, 6);
    expect(p[1]![0]).toBeCloseTo(10, 6);
    expect(wheel(1, 3, 4, 10)).toEqual([[3, 4]]);
  });
});
