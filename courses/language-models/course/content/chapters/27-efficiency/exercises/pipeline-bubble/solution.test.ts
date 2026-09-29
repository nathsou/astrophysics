import { expect, test } from '@lm/test';
import { bubble } from './solution.ts';

test('one stage never waits', () => {
  expect(bubble(1, 4)).toBe(0);
});

test('four stages, one micro-batch: idle three quarters of the time', () => {
  expect(bubble(4, 1)).toBe(0.75);
});

test('more micro-batches shrink the bubble', () => {
  expect(bubble(4, 12)).toBeCloseTo(3 / 15, 12);
  expect(bubble(8, 64)).toBeLessThan(0.1);
});
