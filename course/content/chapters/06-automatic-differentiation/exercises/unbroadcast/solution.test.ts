import { expect, test } from '@lm/test';
import { Tensor, sumTo } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { unbroadcast } from './solution.ts';

test('bias gradient sums over the batch', () => {
  const g = Float32Array.of(1, 2, 3, 10, 20, 30);
  expect(Array.from(unbroadcast(g, [2, 3], [3]))).toEqual([11, 22, 33]);
});

test('a keepdim-style (N, 1) tensor sums over columns', () => {
  const g = Float32Array.of(1, 2, 3, 10, 20, 30);
  expect(Array.from(unbroadcast(g, [2, 3], [2, 1]))).toEqual([6, 60]);
});

test('no broadcasting leaves the gradient unchanged', () => {
  const g = Float32Array.of(1, 2, 3, 4);
  expect(Array.from(unbroadcast(g, [2, 2], [2, 2]))).toEqual([1, 2, 3, 4]);
});

test('matches the library for a 3-d case', () => {
  const rng = mulberry32(5);
  const gradShape = [2, 3, 4], shape = [3, 1];
  const g = Float32Array.from({ length: 24 }, () => rng());
  const want = sumTo(new Tensor(g, gradShape), shape).toFloat32Array();
  const got = unbroadcast(g, gradShape, shape);
  want.forEach((v, i) => expect(got[i]!).toBeCloseTo(v, 5));
});
