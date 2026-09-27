import { expect, test } from '@lm/test';
import { numericalGradient } from './solution.ts';

test('gradient of a quadratic', () => {
  const g = numericalGradient(([x, y]) => x! * x! + 3 * x! * y!, [2, -1]);
  expect(g[0]).toBeCloseTo(2 * 2 + 3 * -1, 6);
  expect(g[1]).toBeCloseTo(3 * 2, 6);
});

test('gradient of a non-polynomial function', () => {
  const g = numericalGradient(([x]) => Math.sin(x!) * Math.exp(x!), [0.7]);
  expect(g[0]).toBeCloseTo(Math.exp(0.7) * (Math.sin(0.7) + Math.cos(0.7)), 6);
});

test('does not modify its input', () => {
  const x = [1, 2, 3];
  numericalGradient((v) => v.reduce((a, b) => a + b * b, 0), x);
  expect(x).toEqual([1, 2, 3]);
});

test('central differences are accurate to O(ε²)', () => {
  // For f = x³ at x = 1 the one-sided error would be ~3ε; central is ~ε².
  const g = numericalGradient(([x]) => x! ** 3, [1], 1e-3);
  expect(Math.abs(g[0]! - 3)).toBeLessThan(1e-5);
});
