import { expect, test } from '@lm/test';
import { lrAt } from './solution.ts';

const s = { peak: 1e-3, warmup: 100, total: 1100, minRatio: 0.1 };

test('warms up linearly', () => {
  expect(lrAt(0, s)).toBeCloseTo(1e-5, 9);
  expect(lrAt(49, s)).toBeCloseTo(5e-4, 9);
  expect(lrAt(99, s)).toBeCloseTo(1e-3, 9);
});

test('decays along a cosine to the floor, halfway at the midpoint', () => {
  expect(lrAt(100, s)).toBeCloseTo(1e-3, 9);
  expect(lrAt(600, s)).toBeCloseTo(1e-3 * (0.1 + 0.9 * 0.5), 9);
  expect(lrAt(1100, s)).toBeCloseTo(1e-4, 9);
  expect(lrAt(5000, s)).toBeCloseTo(1e-4, 9);
});

test('never increases after the warm-up, and does decrease', () => {
  expect(lrAt(1000, s)).toBeLessThan(lrAt(200, s));
  for (let t = 100; t < 1200; t += 7) expect(lrAt(t + 7, s)).toBeLessThanOrEqual(lrAt(t, s) + 1e-15);
});
