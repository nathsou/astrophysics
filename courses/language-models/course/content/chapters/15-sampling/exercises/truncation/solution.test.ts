import { expect, test } from '@lm/test';
import { minP, topK, topP } from './solution.ts';

const P = [0.1, 0.5, 0.05, 0.2, 0.15];
const kept = (p: ArrayLike<number>) => Array.from(p, (x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
const sum = (p: ArrayLike<number>) => Array.from(p).reduce((a, b) => a + b, 0);

test('top-k keeps the k most probable, renormalised', () => {
  const p = topK(P, 2);
  expect(kept(p)).toEqual([1, 3]);
  expect(p[1]).toBeCloseTo(0.5 / 0.7, 10);
  expect(sum(p)).toBeCloseTo(1, 10);
});

test('top-k keeps ties with the k-th token, and k = 0 keeps everything', () => {
  expect(kept(topK([0.4, 0.2, 0.2, 0.2], 2))).toEqual([0, 1, 2, 3]);
  expect(kept(topK(P, 0))).toEqual([0, 1, 2, 3, 4]);
});

test('top-p keeps the smallest set reaching p', () => {
  expect(kept(topP(P, 0.5))).toEqual([1]);
  expect(kept(topP(P, 0.51))).toEqual([1, 3]);
  expect(kept(topP(P, 0.8))).toEqual([1, 3, 4]);
  expect(kept(topP(P, 1))).toEqual([0, 1, 2, 3, 4]);
  expect(sum(topP(P, 0.8))).toBeCloseTo(1, 10);
});

test('top-p adapts to the shape of the distribution', () => {
  const peaked = [0.95, 0.02, 0.01, 0.01, 0.01];
  const flat = [0.2, 0.2, 0.2, 0.2, 0.2];
  expect(kept(topP(peaked, 0.9))).toHaveLength(1);
  expect(kept(topP(flat, 0.9))).toHaveLength(5);
});

test('min-p keeps tokens within a factor of the most probable', () => {
  expect(kept(minP(P, 0.3))).toEqual([1, 3, 4]); // ≥ 0.15
  expect(kept(minP(P, 0.2))).toEqual([0, 1, 3, 4]); // ≥ 0.1
  expect(sum(minP(P, 0.2))).toBeCloseTo(1, 10);
});
