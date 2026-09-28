export interface Law {
  E: number;
  A: number;
  B: number;
  alpha: number;
  beta: number;
}

/**
 * The compute-optimal model size N and number of training tokens D for a budget of C FLOPs, given
 * L(N, D) = E + A / N^α + B / D^β and the cost C = 6·N·D. Also returns the loss the law predicts.
 */
export function allocate(C: number, law: Law): { N: number; D: number; loss: number } {
  // TODO
  return { N: NaN, D: NaN, loss: NaN };
}
