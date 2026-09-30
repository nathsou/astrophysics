import { describe, expect, test } from 'vitest';
import { AGC, agcBits, blank, bitsOfChar, charOfBits, couplings, programText, readWord, textOf, toggle } from './rom';

describe('text in a ROM', () => {
  test('A is 1000001', () => {
    expect(bitsOfChar('A')).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(charOfBits([1, 0, 0, 0, 0, 0, 1])).toBe('A');
  });
  test('eight words spell APOLLO 8', () => {
    const r = programText('APOLLO 8');
    expect(r.words).toHaveLength(8);
    expect(textOf(r)).toBe('APOLLO 8');
    expect(charOfBits(readWord(r, 3))).toBe('L');
  });
  test('short text is padded with spaces, long text is cut', () => {
    expect(textOf(programText('HI'))).toBe('HI      ');
    expect(textOf(programText('ABCDEFGHIJ'))).toBe('ABCDEFGH');
  });
  test('toggling a crossing flips exactly one bit', () => {
    const r = toggle(blank(), 2, 5);
    expect(couplings(r)).toBe(1);
    expect(r.words[2]![5]).toBe(1);
    expect(toggle(r, 2, 5).words).toEqual(blank().words);
  });
  test('the count of ones of APOLLO 8 is the count of cores threaded', () => {
    expect(couplings(programText('APOLLO 8'))).toBe([...'APOLLO 8'].reduce((n, c) => n + bitsOfChar(c).filter(Boolean).length, 0));
  });
});

test('the AGC’s fixed memory is 36,864 words of 16 bits, 590,000 bits', () => {
  expect(AGC.modules * AGC.coresPerModule * 12).toBe(AGC.words);
  expect(agcBits()).toBe(589824);
  expect(AGC.coresPerModule * 192 / 16).toBe(6144);
});
