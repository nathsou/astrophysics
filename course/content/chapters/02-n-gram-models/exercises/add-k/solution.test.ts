import { expect, test } from '@lm/test';
import { addK } from './solution.ts';

test('k = 0 is maximum likelihood', () => {
  expect(addK([2, 1, 0], 0)).toEqual([2 / 3, 1 / 3, 0]);
});

test('k = 1 is Laplace smoothing', () => {
  const p = addK([2, 1, 0], 1);
  expect(p[0]).toBeCloseTo(3 / 6, 12);
  expect(p[2]).toBeCloseTo(1 / 6, 12);
});

test('always sums to 1', () => {
  for (const k of [0.001, 0.5, 3]) expect(addK([5, 0, 0, 9, 1], k).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
});

test('large k approaches uniform', () => {
  const p = addK([100, 0, 0, 0], 1e9);
  for (const x of p) expect(x).toBeCloseTo(0.25, 6);
});

test('an unseen context with k = 0 is uniform', () => {
  expect(addK([0, 0, 0, 0], 0)).toEqual([0.25, 0.25, 0.25, 0.25]);
});
