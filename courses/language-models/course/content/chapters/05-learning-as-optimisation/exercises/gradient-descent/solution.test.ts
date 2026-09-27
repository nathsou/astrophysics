import { expect, test } from '@lm/test';
import { gradientDescent } from './solution.ts';

// f(x, y) = x² + 10 y², minimum at the origin.
const grad = ([x, y]: number[]) => [2 * x!, 20 * y!];

test('returns steps + 1 points starting at x0', () => {
  const p = gradientDescent(grad, [1, 1], 0.01, 5);
  expect(p).toHaveLength(6);
  expect(p[0]).toEqual([1, 1]);
});

test('does not modify earlier points', () => {
  const p = gradientDescent(grad, [1, 1], 0.01, 2);
  expect(p[1]![0]).toBeCloseTo(0.98, 10);
  expect(p[2]![0]).toBeCloseTo(0.98 * 0.98, 10);
});

test('converges with a small learning rate', () => {
  const end = gradientDescent(grad, [1, 1], 0.04, 200).at(-1)!;
  expect(Math.abs(end[0]!)).toBeLessThan(1e-3);
  expect(Math.abs(end[1]!)).toBeLessThan(1e-3);
});

test('diverges when η exceeds 2 / (largest curvature)', () => {
  // Curvature along y is 20, so η > 0.1 makes |y| grow each step.
  const end = gradientDescent(grad, [1, 1], 0.11, 50).at(-1)!;
  expect(Math.abs(end[1]!)).toBeGreaterThan(1);
});
