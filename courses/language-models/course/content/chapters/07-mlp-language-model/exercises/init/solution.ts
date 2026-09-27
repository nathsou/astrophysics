import { Tensor } from '@lm/core/tensor';
import type { Rng } from '@lm/core';

export function initWeights(fanIn: number, fanOut: number, gain: number, rng: Rng): Tensor {
  return Tensor.randn([fanIn, fanOut], { rng, std: gain / Math.sqrt(fanIn), requiresGrad: true });
}

export function expectedInitialLoss(V: number): number {
  return Math.log(V); // −log(1/V)
}
