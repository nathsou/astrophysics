/**
 * Dynamic loss scaling for float16 training, as in torch.amp.GradScaler. The loss is multiplied by
 * `scale` before the backward pass, so small gradients do not underflow to zero in float16. Before the
 * optimiser step, the gradients are divided by `scale` again, and the scale adapts:
 *
 *   - if any gradient overflowed (±∞ or NaN), skip this step and shrink the scale (× backoff);
 *   - after `growthInterval` steps in a row without overflow, grow it (× growth).
 */
export class LossScaler {
  scale: number;
  /** Good steps since the last overflow or growth. */
  goodSteps = 0;
  readonly growth: number;
  readonly backoff: number;
  readonly growthInterval: number;

  constructor(scale = 2 ** 16, growthInterval = 2000, growth = 2, backoff = 0.5) {
    this.scale = scale;
    this.growthInterval = growthInterval;
    this.growth = growth;
    this.backoff = backoff;
  }

  /**
   * Called with the gradients of (loss × scale). Unscales them in place and returns true if the
   * optimiser should step; returns false (gradients untouched) if any of them overflowed.
   */
  update(grads: Float32Array[]): boolean {
    // TODO
    return true;
  }
}
