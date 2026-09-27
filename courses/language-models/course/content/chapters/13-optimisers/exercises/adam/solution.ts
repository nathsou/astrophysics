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
  private readonly m: Float32Array[];
  private readonly v: Float32Array[];

  constructor(sizes: number[], lr: number, b1 = 0.9, b2 = 0.999, eps = 1e-8) {
    this.lr = lr;
    this.b1 = b1;
    this.b2 = b2;
    this.eps = eps;
    this.m = sizes.map((n) => new Float32Array(n));
    this.v = sizes.map((n) => new Float32Array(n));
  }

  step(params: Float32Array[], grads: Float32Array[]): void {
    this.t++;
    // The moments start at zero, so early averages are biased towards zero; these undo that.
    const c1 = 1 - this.b1 ** this.t, c2 = 1 - this.b2 ** this.t;
    params.forEach((w, p) => {
      const m = this.m[p]!, v = this.v[p]!, g = grads[p]!;
      for (let i = 0; i < w.length; i++) {
        m[i] = this.b1 * m[i]! + (1 - this.b1) * g[i]!;
        v[i] = this.b2 * v[i]! + (1 - this.b2) * g[i]! * g[i]!;
        w[i]! -= (this.lr * (m[i]! / c1)) / (Math.sqrt(v[i]! / c2) + this.eps);
      }
    });
  }
}
