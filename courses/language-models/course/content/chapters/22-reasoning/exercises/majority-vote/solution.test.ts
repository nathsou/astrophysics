import { expect, test } from '@lm/test';
import { majorityVote, passAtK } from './solution.ts';

test('the most common answer wins', () => {
  expect(majorityVote([12, 13, 12, null, 11])).toBe(12);
  expect(majorityVote([null, null])).toBe(null);
});

test('ties go to the answer seen first', () => {
  expect(majorityVote([5, 6, 6, 5])).toBe(5);
});

test('pass@1 is the fraction correct', () => {
  expect(passAtK(10, 3, 1)).toBeCloseTo(0.3, 12);
});

test('pass@k from the binomials', () => {
  // 1 − C(7, 2) / C(10, 2) = 1 − 21/45
  expect(passAtK(10, 3, 2)).toBeCloseTo(1 - 21 / 45, 12);
  expect(passAtK(10, 3, 8)).toBe(1);
  expect(passAtK(10, 0, 5)).toBe(0);
});
