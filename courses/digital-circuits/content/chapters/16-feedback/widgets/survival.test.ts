import { describe, expect, test } from 'vitest';
import { meanTime, oneIn, resolutionTimes, survival } from './survival';

describe('metastable resolution times', () => {
  const times = resolutionTimes(2, 1500, 5);
  test('every release is undecided for a while, and all are timed', () => {
    expect(times).toHaveLength(1500);
    expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
  });
  test('the mean is τ, to within a few per cent', () => {
    expect(meanTime(times)).toBeGreaterThan(1.85);
    expect(meanTime(times)).toBeLessThan(2.15);
  });
  test('the fraction still undecided after k τ is e^−k', () => {
    const k = [1, 2, 3];
    const p = survival(times, k.map((x) => x * 2));
    k.forEach((x, i) => expect(p[i]!).toBeCloseTo(Math.exp(-x), 1));
    expect(p[0]!).toBeGreaterThan(p[1]!);
    expect(p[1]!).toBeGreaterThan(p[2]!);
  });
  test('the same seed gives the same times, another seed gives others', () => {
    expect(resolutionTimes(2, 20, 5)).toEqual(times.slice(0, 20));
    expect(resolutionTimes(2, 20, 6)).not.toEqual(times.slice(0, 20));
  });
  test('τ scales the times', () => {
    expect(meanTime(resolutionTimes(4, 800, 3)) / meanTime(resolutionTimes(1, 800, 3))).toBeGreaterThan(3.3);
  });
});

test('one in n', () => {
  expect(oneIn(Math.exp(-10))).toBe('1 in 22,026');
  expect(oneIn(0.6)).toBe('60 in 100');
  expect(oneIn(Math.exp(-50))).toMatch(/^1 in 5\.\d×10\^21$/);
});
