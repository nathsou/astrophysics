import { expect, test } from '@lm/test';
import { decodeSafetensors } from '@lm/core';
import { encode } from './solution.ts';

const tensors: [string, { shape: number[]; data: Float32Array }][] = [
  ['tok', { shape: [2, 3], data: Float32Array.from([1, 2, 3, 4, 5, 6]) }],
  ['h0.ln1.g', { shape: [3], data: Float32Array.from([0.5, -1, 1e-3]) }],
];

test('the header length is little-endian and the data starts on an 8-byte boundary', () => {
  const bytes = encode(tensors);
  const n = Number(new DataView(bytes.buffer).getBigUint64(0, true));
  expect((8 + n) % 8).toBe(0);
  expect(bytes.length).toBe(8 + n + 9 * 4);
});

test('the library’s reader (and so PyTorch’s) decodes it', () => {
  const { tensors: back } = decodeSafetensors(encode(tensors));
  expect([...back.keys()]).toEqual(['tok', 'h0.ln1.g']);
  expect(back.get('tok')!.shape).toEqual([2, 3]);
  expect(Array.from(back.get('h0.ln1.g')!.data)).toEqual(Array.from(tensors[1]![1].data));
});
