import { expect, test } from '@lm/test';
import { bestOfN, bestOfNKl } from './solution.ts';

test('picks the highest reward, first on ties', () => {
  expect(bestOfN([0.1, 2, -1, 2])).toBe(1);
  expect(bestOfN([5])).toBe(0);
});

test('best-of-1 is the base model', () => {
  expect(bestOfNKl(1)).toBe(0);
});

test('the divergence grows only logarithmically', () => {
  expect(bestOfNKl(2)).toBeCloseTo(Math.log(2) - 0.5, 12);
  expect(bestOfNKl(1024) - bestOfNKl(512)).toBeLessThan(0.7);
});
