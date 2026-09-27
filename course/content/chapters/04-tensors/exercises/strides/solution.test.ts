import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { contiguousStrides, offsetOf } from './solution.ts';

test('strides of common shapes', () => {
  expect(contiguousStrides([3, 4])).toEqual([4, 1]);
  expect(contiguousStrides([2, 3, 4])).toEqual([12, 4, 1]);
  expect(contiguousStrides([5])).toEqual([1]);
  expect(contiguousStrides([])).toEqual([]);
});

test('matches the library for a 4-d shape', () => {
  expect(contiguousStrides([2, 3, 5, 7])).toEqual(Tensor.zeros([2, 3, 5, 7]).strides);
});

test('offsets of a contiguous tensor are row-major positions', () => {
  const s = contiguousStrides([2, 3, 4]);
  expect(offsetOf([0, 0, 0], s)).toBe(0);
  expect(offsetOf([1, 2, 3], s)).toBe(23);
  expect(offsetOf([0, 1, 0], s)).toBe(4);
});

test('offsets respect custom strides and a base offset', () => {
  // A transposed 3×4 matrix: strides [1, 4]
  expect(offsetOf([2, 1], [1, 4])).toBe(6);
  expect(offsetOf([1, 1], [4, 1], 10)).toBe(15);
});
