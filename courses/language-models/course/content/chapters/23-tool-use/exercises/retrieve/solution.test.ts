import { expect, test } from '@lm/test';
import { topK } from './solution.ts';

test('nearest by angle, not length', () => {
  const docs = [
    [1, 0, 0],
    [10, 1, 0],
    [0, 1, 0],
    [0, 0, 5],
  ];
  expect(topK([1, 0, 0], docs, 2)).toEqual([0, 1]);
  expect(topK([0, 0, 1], docs, 1)).toEqual([3]);
});

test('zero vectors score 0, and ties keep the lower index', () => {
  expect(topK([1, 1], [[0, 0], [1, 1], [2, 2]], 3)).toEqual([1, 2, 0]);
});
