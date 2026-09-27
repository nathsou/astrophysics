/** SGD with heavy-ball momentum on flat parameter arrays: v ← βv + g;  w ← w − lr·v. */
export class Momentum {
  lr: number;
  readonly beta: number;

  constructor(sizes: number[], lr: number, beta = 0.9) {
    this.lr = lr;
    this.beta = beta;
    // TODO: one velocity array per parameter
  }

  /** Update every parameter in place from its gradient. */
  step(params: Float32Array[], grads: Float32Array[]): void {
    // TODO
  }
}
