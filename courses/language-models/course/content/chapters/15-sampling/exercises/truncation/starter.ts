/**
 * Truncation rules for sampling. Each takes a probability distribution and returns a new one in which
 * the discarded tokens have probability 0 and the survivors are renormalised to sum to 1.
 */

/** Keep the k most probable tokens, plus any tied with the k-th. k ≤ 0 or k ≥ length: keep all. */
export function topK(p: ArrayLike<number>, k: number): Float64Array {
  // TODO
  return Float64Array.from(p);
}

/** Keep the smallest set of most probable tokens whose total probability is at least `top` (≥ 1: keep all). */
export function topP(p: ArrayLike<number>, top: number): Float64Array {
  // TODO
  return Float64Array.from(p);
}

/** Keep the tokens whose probability is at least `ratio` times the largest probability. */
export function minP(p: ArrayLike<number>, ratio: number): Float64Array {
  // TODO
  return Float64Array.from(p);
}
