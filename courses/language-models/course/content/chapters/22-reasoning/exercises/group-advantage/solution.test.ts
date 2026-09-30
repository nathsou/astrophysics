import { expect, test } from '@lm/test';
import { groupAdvantages } from './solution.ts';

test('one right answer out of four', () => {
  const a = groupAdvantages([0, 1, 0, 0]);
  // mean 0.25, std √(3/16) ≈ 0.433
  expect(a[1]).toBeCloseTo(0.75 / Math.sqrt(3 / 16), 3);
  expect(a[0]).toBeCloseTo(-0.25 / Math.sqrt(3 / 16), 3);
});

test('advantages sum to zero', () => {
  const a = groupAdvantages([1, 0, 1, 1, 0, 0, 0, 1]);
  expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(0, 9);
});

test('a group that all agrees teaches nothing', () => {
  expect(groupAdvantages([1, 1, 1, 1])).toEqual([0, 0, 0, 0]);
  expect(groupAdvantages([0, 0, 0])).toEqual([0, 0, 0]);
});
