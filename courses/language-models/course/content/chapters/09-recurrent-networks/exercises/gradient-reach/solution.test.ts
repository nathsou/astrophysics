import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { influence } from './solution.ts';

const H = 8, T = 20;
const eye = (s: number) => Tensor.eye(H).mul(s);
const zeros = Array.from({ length: T }, () => Tensor.zeros([1, H]));
const v = Tensor.full([1, H], 1 / Math.sqrt(H)); // a unit vector

test('k = 0: the gradient of v · h_T with respect to h_T is v itself', () => {
  expect(influence(eye(0.5), zeros, v, 0)).toBeCloseTo(1, 5);
});

test('with U = ρI and zero inputs (so tanh′ = 1), the influence is exactly ρ^k', () => {
  for (const k of [1, 3, 10]) expect(influence(eye(0.5), zeros, v, k)).toBeCloseTo(0.5 ** k, 6);
  expect(influence(eye(1.2), zeros, v, 10)).toBeCloseTo(1.2 ** 10, 3);
});

test('saturating inputs make the gradient vanish even when ρ = 1', () => {
  const rng = mulberry32(2);
  const loud = Array.from({ length: T }, () => Tensor.randn([1, H], { rng, std: 4 }));
  const g = influence(eye(1), loud, v, 10);
  expect(g).toBeGreaterThan(0);
  expect(g).toBeLessThan(1e-3);
});
