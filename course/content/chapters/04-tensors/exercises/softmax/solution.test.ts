import { expect, test } from '@lm/test';
import { softmaxRows } from './solution.ts';

test('rows are probability distributions', () => {
  const p = softmaxRows(Float32Array.of(1, 2, 3, 0, 0, 0), 2, 3);
  expect(p[0]! + p[1]! + p[2]!).toBeCloseTo(1, 6);
  expect(p[3]).toBeCloseTo(1 / 3, 6);
  expect(p[2]!).toBeGreaterThan(p[1]!);
});

test('matches the formula on small inputs', () => {
  const p = softmaxRows(Float32Array.of(0, Math.log(3)), 1, 2);
  expect(p[0]).toBeCloseTo(0.25, 6);
  expect(p[1]).toBeCloseTo(0.75, 6);
});

test('does not overflow on large logits', () => {
  const p = softmaxRows(Float32Array.of(1000, 1001, 1002), 1, 3);
  for (const v of p) expect(Number.isFinite(v)).toBe(true);
  expect(p[2]).toBeCloseTo(Math.exp(2) / (1 + Math.exp(1) + Math.exp(2)), 5);
});

test('handles very negative logits', () => {
  const p = softmaxRows(Float32Array.of(-1000, -1000), 1, 2);
  expect(p[0]).toBeCloseTo(0.5, 6);
});
