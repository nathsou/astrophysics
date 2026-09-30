import { describe, expect, test } from 'vitest';
import { addWithFlags, asciiName, bitsNeeded, bitsOf, flipBit, format, negate, parseField, patternOfBits, patternOfSigned, resize, signedValue } from './numbers';

describe('two’s complement', () => {
  test('signed values of 8-bit patterns', () => {
    expect(signedValue(0x00, 8)).toBe(0);
    expect(signedValue(0x7f, 8)).toBe(127);
    expect(signedValue(0x80, 8)).toBe(-128);
    expect(signedValue(0xff, 8)).toBe(-1);
    expect(signedValue(0b1111, 4)).toBe(-1);
    expect(signedValue(0xffffffff, 32)).toBe(-1);
    expect(signedValue(0x80000000, 32)).toBe(-2147483648);
  });
  test('round trip', () => {
    for (const w of [4, 8, 16]) for (let p = 0; p < 2 ** w; p += w === 16 ? 97 : 1) expect(patternOfSigned(signedValue(p, w), w)).toBe(p);
  });
  test('out of range', () => {
    expect(patternOfSigned(128, 8)).toBeUndefined();
    expect(patternOfSigned(-129, 8)).toBeUndefined();
    expect(patternOfSigned(-128, 8)).toBe(0x80);
  });
  test('negation is invert then add one', () => {
    expect(negate(5, 8)).toEqual({ inverted: 0xfa, result: 0xfb });
    expect(signedValue(negate(5, 8).result, 8)).toBe(-5);
    expect(negate(0, 8).result).toBe(0);
    // the one value with no positive partner
    expect(negate(0x80, 8).result).toBe(0x80);
  });
  test('sign extension and truncation', () => {
    expect(resize(0xfb, 8, 16, true)).toBe(0xfffb);
    expect(resize(0xfb, 8, 16, false)).toBe(0xfb);
    expect(resize(0x1234, 16, 8, false)).toBe(0x34);
    expect(resize(0x0b, 4, 8, true)).toBe(0xfb);
  });
});

describe('formatting', () => {
  test('bases', () => {
    expect(format(0xa5, 'bin', 8)).toBe('1010 0101');
    expect(format(0x5, 'bin', 8)).toBe('0000 0101');
    expect(format(0xa5, 'hex', 8)).toBe('A5');
    expect(format(5, 'hex', 16)).toBe('0005');
    expect(format(0xa5, 'oct', 8)).toBe('245');
    expect(format(0xa5, 'dec', 8)).toBe('165');
    expect(format(0xa5, 'sdec', 8)).toBe('−91');
    expect(format(5, 'bin', 4)).toBe('0101');
  });
  test('bits', () => {
    expect(bitsOf(0xa5, 8)).toEqual([1, 0, 1, 0, 0, 1, 0, 1]);
    expect(patternOfBits(bitsOf(0xa5, 8))).toBe(0xa5);
    expect(flipBit(0, 8, 0)).toBe(0x80);
    expect(flipBit(0xff, 8, 7)).toBe(0xfe);
    expect(bitsOf(0xdeadbeef, 32).length).toBe(32);
    expect(patternOfBits(bitsOf(0xdeadbeef, 32))).toBe(0xdeadbeef);
  });
});

describe('parsing', () => {
  const p = (t: string, f: Parameters<typeof parseField>[1], w = 8) => parseField(t, f, w);
  test('accepts prefixes, spaces, underscores', () => {
    expect(p('0xA5', 'hex')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('a5', 'hex')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('1010 0101', 'bin')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('0b1010_0101', 'bin')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('245', 'oct')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('165', 'dec')).toEqual({ ok: true, pattern: 0xa5 });
  });
  test('signed decimal', () => {
    expect(p('-91', 'sdec')).toEqual({ ok: true, pattern: 0xa5 });
    expect(p('−1', 'sdec')).toEqual({ ok: true, pattern: 0xff });
    expect(p('127', 'sdec')).toEqual({ ok: true, pattern: 0x7f });
  });
  test('errors say what is wrong', () => {
    expect(p('256', 'dec').ok).toBe(false);
    expect(p('-1', 'dec')).toMatchObject({ ok: false });
    expect(p('128', 'sdec')).toMatchObject({ ok: false });
    expect(p('102', 'bin')).toMatchObject({ ok: false, message: 'Not a binary number.' });
    expect(p('8', 'oct').ok).toBe(false);
    expect(p('100', 'hex').ok).toBe(false);
    expect(p('', 'hex').ok).toBe(false);
    expect(p('1.5', 'dec').ok).toBe(false);
  });
});

describe('helpers', () => {
  test('ascii', () => {
    expect(asciiName(65)).toBe("'A'");
    expect(asciiName(10)).toBe('LF');
    expect(asciiName(32)).toBe('space');
    expect(asciiName(200)).toBe('(not ASCII)');
  });
  test('addition flags', () => {
    expect(addWithFlags(0x7f, 0x01, 8)).toEqual({ sum: 0x80, carry: false, overflow: true });
    expect(addWithFlags(0xff, 0x01, 8)).toEqual({ sum: 0x00, carry: true, overflow: false });
    expect(addWithFlags(0x80, 0x80, 8)).toEqual({ sum: 0x00, carry: true, overflow: true });
    expect(addWithFlags(0x05, 0xfb, 8)).toEqual({ sum: 0x00, carry: true, overflow: false });
  });
  test('bits needed', () => {
    expect([0, 1, 2, 3, 4, 255, 256].map(bitsNeeded)).toEqual([1, 1, 2, 2, 3, 8, 9]);
  });
});
