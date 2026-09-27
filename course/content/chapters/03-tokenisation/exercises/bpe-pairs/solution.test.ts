import { expect, test } from '@lm/test';
import { countPairs, mergePair } from './solution.ts';

test('counts adjacent pairs', () => {
  const c = countPairs([1, 2, 3, 1, 2]);
  expect(c.get('1,2')).toBe(2);
  expect(c.get('2,3')).toBe(1);
  expect(c.get('3,1')).toBe(1);
  expect(c.size).toBe(3);
});

test('counts overlapping pairs', () => {
  expect(countPairs([7, 7, 7]).get('7,7')).toBe(2);
});

test('handles short inputs', () => {
  expect(countPairs([]).size).toBe(0);
  expect(countPairs([5]).size).toBe(0);
});

test('merges every occurrence', () => {
  expect(mergePair([1, 2, 3, 1, 2], 1, 2, 99)).toEqual([99, 3, 99]);
});

test('merges left to right without overlaps', () => {
  expect(mergePair([7, 7, 7], 7, 7, 8)).toEqual([8, 7]);
  expect(mergePair([7, 7, 7, 7], 7, 7, 8)).toEqual([8, 8]);
});

test('leaves the input unchanged when the pair is absent', () => {
  expect(mergePair([1, 3, 2], 1, 2, 9)).toEqual([1, 3, 2]);
});
