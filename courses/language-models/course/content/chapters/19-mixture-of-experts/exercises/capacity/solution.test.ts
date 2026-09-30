import { expect, test } from '@lm/test';
import { dispatch } from './solution.ts';

test('balanced routing fits exactly at factor 1', () => {
  expect(dispatch([0, 1, 0, 1], 2, 1)).toEqual([0, 0, 1, 1]);
});

test('overflow tokens are dropped, in order', () => {
  // 6 tokens, 2 experts, factor 1 → capacity 3 each; expert 0 is asked 5 times.
  expect(dispatch([0, 0, 1, 0, 0, 0], 2, 1)).toEqual([0, 1, 0, 2, -1, -1]);
});

test('a larger capacity factor drops fewer', () => {
  const choice = [0, 0, 0, 0, 1, 2];
  const dropped = (f: number) => dispatch(choice, 3, f).filter((s) => s < 0).length;
  expect(dropped(1)).toBe(2);
  expect(dropped(2)).toBe(0);
});
