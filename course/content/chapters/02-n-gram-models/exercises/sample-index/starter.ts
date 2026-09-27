/**
 * Sample an index from a discrete distribution using a uniform random number u ∈ [0, 1).
 * Inverse-CDF method: walk the cumulative sum and return the first index where it exceeds u.
 * The probabilities may not sum to exactly 1 (floating-point round-off) — scale u by their sum.
 */
export function sampleIndex(probs: ArrayLike<number>, u: number): number {
  // TODO
  return 0;
}
