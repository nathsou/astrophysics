import { describe, expect, test } from 'vitest';
import { add, bits, decode, label, negate, overflowBySign, patternAt, range, subtract, zeros } from './wheel';

describe('four-bit encodings', () => {
  const row = (enc: Parameters<typeof label>[0]) => Array.from({ length: 16 }, (_, v) => label(enc, v, 4));
  test('unsigned', () => expect(row('unsigned')).toEqual(Array.from({ length: 16 }, (_, i) => `${i}`)));
  test('two’s complement', () => expect(row('twos')).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '−8', '−7', '−6', '−5', '−4', '−3', '−2', '−1']));
  test('sign–magnitude has −0 at 1000 and −7 at 1111', () => expect(row('sign-magnitude')).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '−0', '−1', '−2', '−3', '−4', '−5', '−6', '−7']));
  test('ones’ complement has −0 at 1111 and −7 at 1000', () => expect(row('ones')).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '−7', '−6', '−5', '−4', '−3', '−2', '−1', '−0']));
  test('ranges and the number of zeros', () => {
    expect(range('twos', 4)).toEqual([-8, 7]);
    expect(range('ones', 4)).toEqual([-7, 7]);
    expect(range('sign-magnitude', 8)).toEqual([-127, 127]);
    expect(range('twos', 8)).toEqual([-128, 127]);
    expect([zeros('unsigned', 4), zeros('twos', 4), zeros('ones', 4), zeros('sign-magnitude', 4)]).toEqual([1, 1, 2, 2]);
  });
  test('negation in two’s complement is invert and add one, and −(−8) is −8', () => {
    for (let x = 0; x < 16; x++) {
      const v = decode('twos', x, 4).value;
      const neg = decode('twos', negate(x, 4), 4).value;
      expect(neg).toBe(v === -8 ? -8 : v === 0 ? 0 : -v);
    }
    expect(bits(negate(0b0101, 4), 4)).toBe('1011');
  });
});

describe('addition and its flags', () => {
  test('the four-bit examples of the text', () => {
    expect(add(7, 1, 4)).toMatchObject({ result: 8, carry: false, overflow: true, negative: true });
    expect(add(15, 1, 4)).toMatchObject({ result: 0, carry: true, overflow: false, zero: true });
    expect(add(8, 15, 4)).toMatchObject({ result: 7, carry: true, overflow: true });
    expect(add(5, 3, 4)).toMatchObject({ result: 8, carry: false, overflow: true });
    expect(add(5, 10, 4)).toMatchObject({ result: 15, carry: false, overflow: false });
    expect(add(3, 13, 4)).toMatchObject({ result: 0, carry: true, overflow: false });
  });
  test('the hardware rule for V agrees with the human rule on every pair, at 4 and 8 bits', () => {
    for (const n of [4, 8])
      for (let a = 0; a < 2 ** n; a++) for (let b = 0; b < 2 ** n; b++) expect(add(a, b, n).overflow, `${a}+${b}`).toBe(overflowBySign(a, b, n));
  });
  test('the sum is right modulo 2^n as unsigned and as signed', () => {
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const s = add(a, b, 4);
        expect(s.result).toBe((a + b) % 16);
        expect(s.carry).toBe(a + b > 15);
        const va = decode('twos', a, 4).value;
        const vb = decode('twos', b, 4).value;
        expect(s.overflow).toBe(va + vb < -8 || va + vb > 7);
      }
  });
  test('subtraction is addition of the complement: a − b, carry means no borrow', () => {
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        const s = subtract(a, b, 4);
        expect(s.result).toBe((a - b + 16) % 16);
        expect(s.carry).toBe(a >= b);
        const d = decode('twos', a, 4).value - decode('twos', b, 4).value;
        expect(s.overflow).toBe(d < -8 || d > 7);
      }
  });
});

describe('the wheel geometry', () => {
  test('patterns at the compass points', () => {
    expect(patternAt(0, -10, 4)).toBe(0);
    expect(patternAt(10, 0, 4)).toBe(4);
    expect(patternAt(0, 10, 4)).toBe(8);
    expect(patternAt(-10, 0, 4)).toBe(12);
    expect(patternAt(-0.001, -10, 4)).toBe(0);
  });
});
