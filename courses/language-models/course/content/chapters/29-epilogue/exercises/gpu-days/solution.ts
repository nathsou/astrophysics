/**
 * Days to train a model with `params` parameters on `tokens` tokens, on one GPU with a peak of `peak` floating-point
 * operations per second running at `mfu` (model FLOPs utilisation, between 0 and 1).
 */
export function gpuDays(params: number, tokens: number, peak: number, mfu: number): number {
  const flops = 6 * params * tokens; // forward and backward passes (Chapter 11)
  return flops / (peak * mfu) / 86_400;
}
