import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { initWeights, expectedInitialLoss } from './solution.ts';

const std = (xs: Float32Array) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);

test('shape and gradient flag', () => {
  const w = initWeights(64, 32, 1, mulberry32(1));
  expect(w.shape).toEqual([64, 32]);
  expect(w.requiresGrad).toBe(true);
});

test('std is gain / √fanIn', () => {
  expect(std(initWeights(256, 256, 1, mulberry32(1)).toFloat32Array())).toBeCloseTo(1 / 16, 2);
  expect(std(initWeights(100, 400, 5 / 3, mulberry32(2)).toFloat32Array())).toBeCloseTo(5 / 30, 2);
});

test('preserves the scale of a linear layer’s output', () => {
  const x = Tensor.randn([512, 300], { rng: mulberry32(3) });
  const y = x.matmul(initWeights(300, 300, 1, mulberry32(4)));
  expect(std(y.toFloat32Array())).toBeCloseTo(1, 1);
});

test('expected initial loss is ln V', () => {
  expect(expectedInitialLoss(65)).toBeCloseTo(4.174, 3);
});
