import { expect, test } from '@lm/test';
import { btLoss, preferProbability } from './solution.ts';

test('equal rewards: a coin toss', () => {
  expect(preferProbability(3, 3)).toBe(0.5);
  expect(btLoss(1, 1)).toBeCloseTo(Math.log(2), 12);
});

test('only the difference matters', () => {
  expect(preferProbability(5, 3)).toBeCloseTo(preferProbability(102, 100), 12);
  expect(preferProbability(2, 0)).toBeCloseTo(1 / (1 + Math.exp(-2)), 12);
});

test('the loss is stable for confident mistakes', () => {
  expect(btLoss(-800, 0)).toBeCloseTo(800, 6);
  expect(btLoss(800, 0)).toBeCloseTo(0, 12);
});
