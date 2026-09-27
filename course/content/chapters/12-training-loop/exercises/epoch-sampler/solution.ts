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
    for (let s = 0; s + T + 1 <= n; s += T) this.starts.push(s);
    this.shuffle();
  }

  private shuffle(): void {
    // Fisher–Yates: every order equally likely.
    for (let i = this.starts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.starts[i], this.starts[j]] = [this.starts[j]!, this.starts[i]!];
    }
  }

  /** The next B window starts (continuing into the next epoch if this one runs out). */
  next(B: number): number[] {
    const out: number[] = [];
    while (out.length < B) {
      if (this.pos === this.starts.length) {
        this.epoch++;
        this.pos = 0;
        this.shuffle();
      }
      out.push(this.starts[this.pos++]!);
    }
    return out;
  }
}
