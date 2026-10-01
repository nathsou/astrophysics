import { describe, expect, test } from 'vitest';
import { diverging, fmt, mix, parseRGB } from './canvas.ts';

describe('canvas helpers', () => {
  test('parseRGB reads the forms getComputedStyle returns', () => {
    expect(parseRGB('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(parseRGB('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    const c = parseRGB('color(srgb 0.5 0.25 1)');
    expect(c[0]).toBeCloseTo(127.5, 6);
    expect(c[2]).toBeCloseTo(255, 6);
  });
  test('diverging ramp: zero is the neutral colour, ±1 the ends', () => {
    const n: [number, number, number] = [250, 250, 250];
    const a: [number, number, number] = [0, 0, 255];
    const b: [number, number, number] = [255, 0, 0];
    expect(diverging(0, a, n, b)).toEqual(n);
    expect(diverging(-1, a, n, b)).toEqual(a);
    expect(diverging(2, a, n, b)).toEqual(b);
    expect(mix(a, b, 0.5)).toEqual([127.5, 0, 127.5]);
  });
  test('number formatting', () => {
    expect(fmt(0.123456, 3)).toBe('0.123');
    expect(fmt(12345678, 3)).toBe('1.23×10⁷');
    expect(fmt(2.9e-6, 2)).toBe('2.9×10⁻⁶');
    expect(fmt(NaN)).toBe('–');
  });
});
