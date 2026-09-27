export interface Schedule {
  peak: number; //     the maximum learning rate
  warmup: number; //   steps of linear warm-up from ≈0 to peak
  total: number; //    total steps in the run
  minRatio: number; // final learning rate as a fraction of peak
}

/**
 * Linear warm-up to `peak` over the first `warmup` steps (step 0 gets peak/warmup), then cosine
 * decay from peak to minRatio·peak at step `total` (and constant after).
 */
export function lrAt(step: number, s: Schedule): number {
  // TODO
  return s.peak;
}
