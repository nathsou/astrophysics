import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { matmul } from './solution.ts';

test('a 2×2 example', () => {
  const c = matmul(Float32Array.of(1, 2, 3, 4), Float32Array.of(5, 6, 7, 8), 2, 2, 2);
  expect(Array.from(c)).toEqual([19, 22, 43, 50]);
});

test('identity leaves a matrix unchanged', () => {
  const a = Float32Array.of(1, 2, 3, 4, 5, 6);
  expect(Array.from(matmul(a, Float32Array.of(1, 0, 0, 0, 1, 0, 0, 0, 1), 2, 3, 3))).toEqual(Array.from(a));
});

test('non-square shapes', () => {
  const c = matmul(Float32Array.of(1, 2, 3), Float32Array.of(4, 5, 6), 1, 3, 1);
  expect(Array.from(c)).toEqual([32]);
  expect(matmul(Float32Array.of(1, 2, 3), Float32Array.of(4, 5, 6), 3, 1, 3)).toHaveLength(9);
});

test('matches the library on random matrices', () => {
  const rng = mulberry32(4);
  const [m, k, n] = [7, 11, 5];
  const a = Float32Array.from({ length: m * k }, () => rng() - 0.5);
  const b = Float32Array.from({ length: k * n }, () => rng() - 0.5);
  const want = new Tensor(a, [m, k]).matmul(new Tensor(b, [k, n])).toFloat32Array();
  const got = matmul(a, b, m, k, n);
  for (let i = 0; i < want.length; i++) expect(got[i]!).toBeCloseTo(want[i]!, 5);
});
