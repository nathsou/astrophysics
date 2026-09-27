/** SGD with heavy-ball momentum on flat parameter arrays: v ← βv + g;  w ← w − lr·v. */
export class Momentum {
  lr: number;
  readonly beta: number;
  private readonly v: Float32Array[];

  constructor(sizes: number[], lr: number, beta = 0.9) {
    this.lr = lr;
    this.beta = beta;
    this.v = sizes.map((n) => new Float32Array(n));
  }

  /** Update every parameter in place from its gradient. */
  step(params: Float32Array[], grads: Float32Array[]): void {
    params.forEach((w, p) => {
      const v = this.v[p]!, g = grads[p]!;
      for (let i = 0; i < w.length; i++) {
        v[i] = this.beta * v[i]! + g[i]!; // a running sum of past gradients, decaying by β per step
        w[i]! -= this.lr * v[i]!;
      }
    });
  }
}
