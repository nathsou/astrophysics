import { Tensor } from '@lm/core/tensor';

/**
 * The mean squared error of a linear model, (X W − y)², averaged over rows.
 * Compute its gradient with respect to W by splitting the N rows of X (and y) into k equal
 * micro-batches, back-propagating each one separately, and letting the gradients accumulate in
 * W.grad — so that the result equals the gradient of the loss over the whole batch.
 * W must require gradients; start from W.grad = null.
 */
export function accumulateGradient(W: Tensor, X: Tensor, y: Tensor, k: number): Tensor {
  const n = X.shape[0]! / k;
  W.zeroGrad();
  for (let i = 0; i < k; i++) {
    const Xi = X.slice(0, i * n, (i + 1) * n), yi = y.slice(0, i * n, (i + 1) * n);
    const err = Xi.matmul(W).sub(yi);
    // Each micro-batch's mean, divided by k: the sum of these is the mean over all k·n rows.
    err.mul(err).mean().div(k).backward();
  }
  return W.grad!;
}
