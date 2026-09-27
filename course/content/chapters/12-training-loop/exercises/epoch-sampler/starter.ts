import { mulberry32 } from '@lm/core';

/**
 * Hands out batches of window start positions for a token array of length `n`, with windows of
 * T + 1 tokens (inputs and shifted targets) at multiples of T that fit entirely: 0, T, 2T, …
 * Each epoch visits every window exactly once, in a fresh random order.
 */
export class EpochSampler {
  epoch = 0;
  readonly T: number;
  private starts: number[] = [];
  private pos = 0;
  private rng: () => number;

  constructor(n: number, T: number, seed = 1) {
    this.T = T;
    this.rng = mulberry32(seed);
    // TODO: fill this.starts and shuffle it
  }

  /** The next B window starts (continuing into the next epoch if this one runs out). */
  next(B: number): number[] {
    // TODO
    return [];
  }
}
