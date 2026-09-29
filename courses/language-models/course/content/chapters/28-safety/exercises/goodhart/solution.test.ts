import { expect, test } from '@lm/test';
import { selectByProxy } from './solution.ts';

test('a perfect proxy picks the best', () => {
  expect(selectByProxy([1, 5, 3], [1, 5, 3], 1)).toBe(5);
  expect(selectByProxy([1, 5, 3], [1, 5, 3], 2)).toBe(4);
});

test('a proxy with one huge error picks the wrong candidate', () => {
  // Candidate 0 is bad but its proxy score is an outlier.
  expect(selectByProxy([-2, 5, 3], [100, 5, 3], 1)).toBe(-2);
});
