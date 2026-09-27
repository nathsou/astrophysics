import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { accumulateGradient } from './solution.ts';

const rng = mulberry32(9);
const X = Tensor.randn([24, 3], { rng });
const y = Tensor.randn([24, 2], { rng });

function fullBatch(): number[] {
  const W = Tensor.randn([3, 2], { rng: mulberry32(1), requiresGrad: true });
  const err = X.matmul(W).sub(y);
  err.mul(err).mean().backward();
  return Array.from(W.grad!.toFloat32Array());
}

for (const k of [1, 2, 4, 8]) {
  test(`k = ${k} micro-batches give the full-batch gradient`, () => {
    const W = Tensor.randn([3, 2], { rng: mulberry32(1), requiresGrad: true });
    const g = Array.from(accumulateGradient(W, X, y, k).toFloat32Array());
    fullBatch().forEach((v, i) => expect(g[i]!).toBeCloseTo(v, 5));
  });
}
