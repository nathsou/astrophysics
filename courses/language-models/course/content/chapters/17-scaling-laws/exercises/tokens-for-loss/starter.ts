export interface Law {
  E: number;
  A: number;
  B: number;
  alpha: number;
  beta: number;
}

/**
 * The number of training tokens a model of N parameters needs to reach `target` loss under
 * L(N, D) = E + A / N^α + B / D^β, or Infinity if it can never get there.
 */
export function tokensForLoss(N: number, target: number, law: Law): number {
  // TODO
  return NaN;
}
