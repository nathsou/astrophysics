import { expect, test } from '@lm/test';
import { sinusoidal } from './solution.ts';

test('position 0 is [0, 1, 0, 1, …]', () => {
  const pe = sinusoidal(10, 8);
  expect(pe.shape).toEqual([10, 8]);
  expect(Array.from(pe.toFloat32Array().slice(0, 8))).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
});

test('the first pair oscillates with period 2π; the last pair barely moves', () => {
  const pe = sinusoidal(50, 16);
  expect(pe.get(3, 0)).toBeCloseTo(Math.sin(3), 5);
  expect(pe.get(3, 1)).toBeCloseTo(Math.cos(3), 5);
  expect(pe.get(49, 15)).toBeGreaterThan(0.99);
});

test('the dot product of two positions depends only on their distance', () => {
  const pe = sinusoidal(40, 32);
  const dot = (a: number, b: number) => Array.from({ length: 32 }, (_, k) => pe.get(a, k) * pe.get(b, k)).reduce((x, y) => x + y);
  expect(dot(3, 10)).toBeCloseTo(dot(20, 27), 3);
  expect(dot(0, 5)).toBeCloseTo(dot(30, 35), 3);
  expect(Math.abs(dot(3, 10) - dot(3, 12))).toBeGreaterThan(1e-3);
});
