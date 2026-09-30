import { expect, test } from '@lm/test';
import { patchify } from './solution.ts';

test('a 4 × 4 single-channel image into 2 × 2 patches', () => {
  const img = Float32Array.from({ length: 16 }, (_, i) => i);
  const p = patchify(img, 4, 4, 1, 2);
  expect(p.length).toBe(4);
  expect([...p[0]!]).toEqual([0, 1, 4, 5]);
  expect([...p[1]!]).toEqual([2, 3, 6, 7]);
  expect([...p[3]!]).toEqual([10, 11, 14, 15]);
});

test('channels stay together', () => {
  // 2 × 2 RGB image; pixel i has channels (10i, 10i + 1, 10i + 2).
  const img = Float32Array.from({ length: 12 }, (_, k) => 10 * Math.floor(k / 3) + (k % 3));
  const [p] = patchify(img, 2, 2, 3, 2);
  expect([...p!]).toEqual([0, 1, 2, 10, 11, 12, 20, 21, 22, 30, 31, 32]);
});

test('a 224 × 224 image in 16 × 16 patches is 196 tokens of 768 numbers', () => {
  const p = patchify(new Float32Array(224 * 224 * 3), 224, 224, 3, 16);
  expect(p.length).toBe(196);
  expect(p[0]!.length).toBe(768);
});
