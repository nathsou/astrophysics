import { Tensor } from '@lm/core/tensor';
import type { Rng } from '@lm/core';

/**
 * A (fanIn × fanOut) weight matrix with entries ~ N(0, σ²), σ = gain / √fanIn.
 * This keeps the variance of W·x equal to gain² · Var(x): no growth or decay with width.
 */
export function initWeights(fanIn: number, fanOut: number, gain: number, rng: Rng): Tensor {
  // TODO: use Tensor.randn with the right std, and requiresGrad: true.
  return Tensor.zeros([fanIn, fanOut]);
}

/** The loss a model should start from if its initial predictions are uniform over V outcomes. */
export function expectedInitialLoss(V: number): number {
  // TODO
  return 0;
}
