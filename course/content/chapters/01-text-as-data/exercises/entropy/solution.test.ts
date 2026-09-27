import { expect, test } from '@lm/test';
import { entropy } from './solution.ts';

test('a fair coin has 1 bit of entropy', () => {
  expect(entropy([1, 1])).toBeCloseTo(1, 10);
});

test('a uniform choice among 8 has 3 bits', () => {
  expect(entropy([5, 5, 5, 5, 5, 5, 5, 5])).toBeCloseTo(3, 10);
});

test('a certain outcome has 0 bits', () => {
  expect(entropy([7])).toBe(0);
  expect(entropy([0, 3, 0])).toBe(0);
});

test('works with unnormalised counts', () => {
  expect(entropy([90, 10])).toBeCloseTo(0.4690, 3);
});

test('supports other bases (nats)', () => {
  expect(entropy([1, 1], Math.E)).toBeCloseTo(Math.log(2), 10);
});

test('empty input has 0 entropy (not NaN)', () => {
  expect(entropy([])).toBe(0);
  expect(entropy([0, 0])).toBe(0);
});
