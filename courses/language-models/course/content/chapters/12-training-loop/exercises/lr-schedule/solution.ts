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
  if (step < s.warmup) return (s.peak * (step + 1)) / s.warmup;
  const p = Math.min(1, (step - s.warmup) / Math.max(1, s.total - s.warmup));
  return s.peak * (s.minRatio + (1 - s.minRatio) * 0.5 * (1 + Math.cos(Math.PI * p)));
}
