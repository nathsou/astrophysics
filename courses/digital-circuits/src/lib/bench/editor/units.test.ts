import { describe, expect, test } from 'vitest';
import { clamp, formatParam, parseSI, round3, snapE24 } from './units';

describe('parseSI', () => {
  test.each([
    ['4700', 4700],
    ['4.7k', 4700],
    ['4.7 kΩ', 4700],
    ['4.7kohm', 4700],
    ['100n', 1e-7],
    ['10uF', 1e-5],
    ['10 µF', 1e-5],
    ['1meg', 1e6],
    ['1 MΩ', 1e6],
    ['1M', 1e6],
    ['1m', 1e-3],
    ['5 mV', 5e-3],
    ['2.2e-6', 2.2e-6],
    ['1,5', 1.5],
    ['-3.3', -3.3],
    ['−3.3 V', -3.3],
    ['.5', 0.5],
    ['12 V', 12],
    ['1 kHz', 1000],
    ['50 Hz', 50],
    ['2 s', 2],
    ['3p', 3e-12],
  ])('%s → %s', (text, value) => {
    expect(parseSI(text)).toBeCloseTo(value, 12);
  });
  test.each(['', 'abc', 'k', '1.2.3', '5 parsecs', '--3'])('%j is not a number', (text) => {
    expect(parseSI(text)).toBeUndefined();
  });
});

describe('formatParam', () => {
  test('base units get prefixes, others stay plain', () => {
    expect(formatParam(4700, 'Ω')).toBe('4.7\u00a0kΩ');
    expect(formatParam(1e-6, 'F')).toBe('1\u00a0µF');
    expect(formatParam(1000, 'ns')).toBe('1000\u00a0ns');
    expect(formatParam(0.02, 'A/V²')).toBe('0.02\u00a0A/V²');
    expect(formatParam(0.5)).toBe('0.5');
  });
});

describe('E24', () => {
  test('snaps to the series across decades', () => {
    expect(snapE24(4630)).toBe(4700);
    expect(snapE24(1000)).toBe(1000);
    expect(snapE24(9.7)).toBe(10);
    expect(snapE24(0.00047)).toBeCloseTo(0.00047, 8);
    expect(snapE24(0.95e6)).toBe(910000);
    expect(snapE24(0)).toBe(0);
  });
  test('helpers', () => {
    expect(round3(1234.5678)).toBe(1230);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5)).toBe(-5);
  });
});
