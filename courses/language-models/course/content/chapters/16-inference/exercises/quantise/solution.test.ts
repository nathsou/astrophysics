import { expect, test } from '@lm/test';
import { quantise } from './solution.ts';

test('int8: the largest magnitude of each group maps to ±127', () => {
  const { q, scales } = quantise(Float32Array.of(0.5, -1, 0.25, 4, -3, 1), 8, 3);
  expect(Array.from(q)).toEqual([64, -127, 32, 127, -95, 32]);
  expect(scales[0]).toBeCloseTo(1 / 127, 7);
  expect(scales[1]).toBeCloseTo(4 / 127, 7);
});

test('int4 has only 15 levels, so the rounding error is larger', () => {
  const w = Float32Array.from({ length: 64 }, (_, i) => Math.sin(i * 1.7));
  const err = (bits: number) => quantise(w, bits, 64).dequantised.reduce((a, x, i) => Math.max(a, Math.abs(x - w[i]!)), 0);
  expect(err(4)).toBeLessThanOrEqual(1 / 7 / 2 + 1e-6); // at most half a step of max/7
  expect(err(8)).toBeLessThan(err(4) / 10);
  expect(new Set(quantise(w, 4, 64).q).size).toBeLessThanOrEqual(15);
});

test('smaller groups isolate outliers', () => {
  const w = Float32Array.from({ length: 64 }, (_, i) => (i === 0 ? 50 : Math.cos(i) * 0.1));
  const err = (group: number) => quantise(w, 4, group).dequantised.reduce((a, x, i) => a + Math.abs(x - w[i]!), 0);
  expect(err(8)).toBeLessThan(err(64) / 3);
});

test('an all-zero group stays zero', () => {
  expect(Array.from(quantise(new Float32Array(4), 4, 2).dequantised)).toEqual([0, 0, 0, 0]);
});
