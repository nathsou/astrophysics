import { expect, test } from '@lm/test';
import { compare } from './solution.ts';

test('identical arrays are close, with zero error', () => {
  expect(compare([1, -2, 3], [1, -2, 3])).toEqual({ maxAbs: 0, maxRel: 0, worst: 0, ok: true });
});

test('the relative tolerance scales with the expected value', () => {
  expect(compare([1000.001], [1000], 1e-5, 0).ok).toBe(true); // error 1e-3 ≤ 1e-5 · 1000
  expect(compare([1.001], [1], 1e-5, 0).ok).toBe(false); // error 1e-3 > 1e-5 · 1
});

test('the absolute tolerance rescues values near zero', () => {
  expect(compare([1e-9], [0], 1e-5, 0).ok).toBe(false);
  expect(compare([1e-9], [0], 1e-5, 1e-8).ok).toBe(true);
});

test('reports the largest errors and the worst element', () => {
  const r = compare([1, 2.5, 10.1, 0], [1, 2, 10, 0], 1e-3, 1e-6);
  expect(r.maxAbs).toBeCloseTo(0.5, 9);
  expect(r.maxRel).toBeCloseTo(0.25, 9);
  expect(r.worst).toBe(1);
  expect(r.ok).toBe(false);
});

test('NaN is never close', () => {
  const r = compare([1, NaN, 3], [1, 2, 3]);
  expect(r.ok).toBe(false);
  expect(r.worst).toBe(1);
});

test('mismatched lengths throw', () => {
  expect(() => compare([1, 2], [1])).toThrow();
});
