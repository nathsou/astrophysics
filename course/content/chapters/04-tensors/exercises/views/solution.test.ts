import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { transpose, slice, isContiguous, type View } from './solution.ts';

const x: View = { shape: [2, 3, 4], strides: [12, 4, 1], offset: 0 };
const asView = (t: Tensor): View => ({ shape: t.shape, strides: t.strides, offset: t.offset });

test('transpose swaps sizes and strides', () => {
  expect(transpose(x, 1, 2)).toEqual({ shape: [2, 4, 3], strides: [12, 1, 4], offset: 0 });
});

test('transpose does not modify its input', () => {
  transpose(x, 0, 2);
  expect(x.shape).toEqual([2, 3, 4]);
});

test('slice moves the offset and shrinks one dimension', () => {
  expect(slice(x, 1, 1, 3)).toEqual({ shape: [2, 2, 4], strides: [12, 4, 1], offset: 4 });
  expect(slice(x, 2, 2, 4)).toEqual({ shape: [2, 3, 2], strides: [12, 4, 1], offset: 2 });
});

test('matches the library on a chain of views', () => {
  const t = Tensor.arange(24).reshape(2, 3, 4).transpose(0, 2).slice(1, 1, 3);
  expect(slice(transpose(x, 0, 2), 1, 1, 3)).toEqual(asView(t));
});

test('detects contiguity', () => {
  expect(isContiguous(x)).toBe(true);
  expect(isContiguous(transpose(x, 1, 2))).toBe(false);
  expect(isContiguous(slice(x, 0, 1, 2))).toBe(true); // one whole block
  expect(isContiguous(slice(x, 2, 0, 2))).toBe(false); // gaps between rows
  expect(isContiguous({ shape: [1, 4], strides: [99, 1], offset: 0 })).toBe(true);
});
