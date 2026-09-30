import { expect, test } from '@lm/test';
import { dpoLoss } from './solution.ts';

test('at the start (policy = reference) the loss is log 2', () => {
  const r = dpoLoss(-40, -35, -40, -35, 0.1);
  expect(r.loss).toBeCloseTo(Math.log(2), 12);
  expect(r.rewardChosen).toBe(0);
});

test('raising the chosen response relative to the reference lowers the loss', () => {
  expect(dpoLoss(-38, -35, -40, -35, 0.1).loss).toBeLessThan(Math.log(2));
});

test('what matters is the change from the reference, not absolute probability', () => {
  // The rejected response is more likely than the chosen one, but the policy moved towards the chosen one.
  const r = dpoLoss(-50, -20, -60, -20, 0.1);
  expect(r.rewardChosen).toBeCloseTo(1, 12);
  expect(r.loss).toBeCloseTo(Math.log1p(Math.exp(-1)), 12);
});
