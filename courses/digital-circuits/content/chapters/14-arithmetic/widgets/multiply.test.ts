import { describe, expect, test } from 'vitest';
import { additions, arrayCost, product, steps } from './multiply';

describe('shift and add', () => {
  test('every 4 × 4 and a sample of 8 × 8 products are right', () => {
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) expect(product(a, b, 4)).toBe(a * b);
    for (let a = 0; a < 256; a += 7) for (let b = 0; b < 256; b += 11) expect(product(a, b, 8)).toBe(a * b);
  });
  test('the worked example: 13 × 11 = 143', () => {
    const s = steps(13, 11, 4);
    expect(s.map((x) => x.bit)).toEqual([1, 1, 0, 1]);
    expect(s.map((x) => x.added)).toEqual([13, 26, 0, 104]);
    expect(s.map((x) => x.after)).toEqual([13, 39, 39, 143]);
    expect(s.at(-1)!.after).toBe(143);
  });
  test('the product of two n-bit numbers fits in 2n bits', () => {
    expect(product(15, 15, 4)).toBe(225);
    expect(225).toBeLessThan(256);
    expect(product(255, 255, 8)).toBeLessThan(65536);
  });
  test('counting additions and array-multiplier parts', () => {
    expect(additions(11, 4)).toBe(3);
    expect(additions(15, 4)).toBe(4);
    expect(arrayCost(4)).toEqual({ ands: 16, fullAdders: 12 });
    expect(arrayCost(8)).toEqual({ ands: 64, fullAdders: 56 });
  });
});
