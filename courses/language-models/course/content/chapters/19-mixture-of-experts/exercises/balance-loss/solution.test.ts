import { expect, test } from '@lm/test';
import { balanceLoss } from './solution.ts';

test('uniform routing gives exactly 1', () => {
  const probs = [[0.25, 0.25, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]];
  expect(balanceLoss(probs, [[0, 1], [2, 3]])).toBeCloseTo(1, 12);
});

test('collapse onto one expert is penalised', () => {
  const probs = [[0.9, 0.1], [0.9, 0.1], [0.8, 0.2]];
  const collapsed = balanceLoss(probs, [[0], [0], [0]]);
  expect(collapsed).toBeCloseTo(2 * (1 * (2.6 / 3)), 10);
  expect(collapsed).toBeGreaterThan(1.5);
});

test('counts slots, not tokens, with top-2', () => {
  const probs = [[0.5, 0.3, 0.2]];
  // Slots: expert 0 and expert 1 once each, out of 2 → f = [½, ½, 0].
  expect(balanceLoss(probs, [[0, 1]])).toBeCloseTo(3 * (0.5 * 0.5 + 0.5 * 0.3), 10);
});
