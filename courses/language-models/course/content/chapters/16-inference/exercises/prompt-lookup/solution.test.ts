import { expect, test } from '@lm/test';
import { promptLookup } from './solution.ts';

test('proposes what followed the last occurrence of the final n-gram', () => {
  //            Lily  and   the   cat   .     Lily  and
  const ids = [10, 11, 12, 13, 14, 10, 11];
  expect(promptLookup(ids, 2, 3)).toEqual([12, 13, 14]);
});

test('uses the most recent match and stops at the end of the context', () => {
  const ids = [1, 2, 7, 1, 2, 8, 9, 1, 2];
  expect(promptLookup(ids, 2, 5)).toEqual([8, 9, 1, 2]);
});

test('no earlier occurrence: no draft', () => {
  expect(promptLookup([1, 2, 3, 4], 2, 3)).toEqual([]);
  expect(promptLookup([5], 2, 3)).toEqual([]);
});
