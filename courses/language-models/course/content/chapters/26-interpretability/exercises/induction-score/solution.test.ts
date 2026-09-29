import { expect, test } from '@lm/test';
import { inductionScore } from './solution.ts';

const L = 4;
const T = 2 * L + 1;
const pattern = (target: (i: number) => number) =>
  Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j === target(i) ? 1 : 0)));

test('a perfect induction head scores 1', () => {
  expect(inductionScore(pattern((i) => (i > L ? i - L + 1 : 0)), L)).toBe(1);
});

test('a previous-token head scores 0', () => {
  expect(inductionScore(pattern((i) => Math.max(0, i - 1)), L)).toBe(0);
});

test('a head that attends to the matching token itself (not the one after) scores 0', () => {
  expect(inductionScore(pattern((i) => (i > L ? i - L : 0)), L)).toBe(0);
});
