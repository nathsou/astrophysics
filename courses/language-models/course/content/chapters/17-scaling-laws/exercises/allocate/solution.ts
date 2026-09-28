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
  const { E, A, B, alpha, beta } = law;
  // Setting dL/dN = 0 along N·D = C/6 gives N^(α+β) = (αA / βB)·(C/6)^β.
  const G = ((alpha * A) / (beta * B)) ** (1 / (alpha + beta));
  const N = G * (C / 6) ** (beta / (alpha + beta));
  const D = C / (6 * N);
  return { N, D, loss: E + A / N ** alpha + B / D ** beta };
}
