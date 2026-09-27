import { expect, test } from '@lm/test';
import { mostLikely } from './solution.ts';

test('finds the largest probability', () => {
  expect(mostLikely([0.1, 0.6, 0.3])).toBe(1);
  expect(mostLikely([0.05, 0.05, 0.9])).toBe(2);
});

test('the first of equal probabilities wins', () => {
  expect(mostLikely([0.4, 0.2, 0.4])).toBe(0);
});

test('works for a single token', () => {
  expect(mostLikely([1])).toBe(0);
});
