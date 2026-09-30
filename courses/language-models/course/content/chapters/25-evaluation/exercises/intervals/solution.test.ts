import { expect, test } from '@lm/test';
import { accuracyInterval, pairedDifference } from './solution.ts';

test('70% on 1,000 items is ±2.8 points', () => {
  const [lo, hi] = accuracyInterval(700, 1000);
  expect(lo).toBeCloseTo(0.7 - 1.96 * Math.sqrt(0.21 / 1000), 10);
  expect(hi - lo).toBeCloseTo(2 * 1.96 * Math.sqrt(0.21 / 1000), 10);
});

test('four times the items halve the interval', () => {
  const w = (k: number, n: number) => {
    const [lo, hi] = accuracyInterval(k, n);
    return hi - lo;
  };
  expect(w(400, 500) / w(1600, 2000)).toBeCloseTo(2, 10);
});

test('paired differences', () => {
  const a = [1, 1, 0, 1, 0, 1, 1, 0];
  const b = [1, 0, 0, 1, 0, 1, 0, 0];
  const r = pairedDifference(a, b);
  expect(r.diff).toBeCloseTo(0.25, 12);
  // differences: 0,1,0,0,0,0,1,0 → sample variance 0.2143, standard error √(0.2143/8)
  const se = Math.sqrt((6 * 0.25 ** 2 + 2 * 0.75 ** 2) / 7 / 8);
  expect(r.hi - r.diff).toBeCloseTo(1.96 * se, 10);
});
