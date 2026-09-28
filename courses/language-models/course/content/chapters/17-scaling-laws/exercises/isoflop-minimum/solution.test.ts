import { expect, test } from '@lm/test';
import { isoflopMinimum } from './solution.ts';

test('recovers the vertex of an exact parabola in ln N', () => {
  const sizes = [1e6, 2e6, 4e6, 8e6, 16e6];
  const losses = sizes.map((n) => 2 + 0.1 * (Math.log(n) - Math.log(5e6)) ** 2);
  const r = isoflopMinimum(sizes, losses);
  expect(r.size / 5e6).toBeCloseTo(1, 6);
  expect(r.loss).toBeCloseTo(2, 8);
});

test('averages out noise', () => {
  const sizes = [1e6, 1.5e6, 2e6, 3e6, 4e6, 6e6, 8e6, 12e6];
  const noise = [0.004, -0.003, 0.002, -0.004, 0.003, -0.002, 0.001, -0.001];
  const losses = sizes.map((n, i) => 1.8 + 0.08 * (Math.log(n) - Math.log(3.3e6)) ** 2 + noise[i]!);
  const r = isoflopMinimum(sizes, losses);
  expect(Math.abs(Math.log(r.size / 3.3e6))).toBeLessThan(0.15);
  expect(r.loss).toBeCloseTo(1.8, 2);
});

test('no minimum when the curve bends the wrong way', () => {
  const r = isoflopMinimum([1, 2, 4], [1, 2, 1]);
  expect(r.size).toBeNaN();
});
