/**
 * Adam on flat parameter arrays:
 *   m ← β₁m + (1 − β₁)g,   v ← β₂v + (1 − β₂)g²,   t ← t + 1
 *   w ← w − lr · m̂ / (√v̂ + ε),   with m̂ = m / (1 − β₁ᵗ), v̂ = v / (1 − β₂ᵗ)
 */
export class Adam {
  lr: number;
  t = 0;
  readonly b1: number;
  readonly b2: number;
  readonly eps: number;

  constructor(sizes: number[], lr: number, b1 = 0.9, b2 = 0.999, eps = 1e-8) {
    this.lr = lr;
    this.b1 = b1;
    this.b2 = b2;
    this.eps = eps;
    // TODO: moment arrays
  }

  step(params: Float32Array[], grads: Float32Array[]): void {
    // TODO
  }
}
