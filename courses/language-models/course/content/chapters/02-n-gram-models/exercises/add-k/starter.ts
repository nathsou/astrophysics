/**
 * Add-k smoothing of one context's next-token counts.
 *
 *   P(w | h) = (c(h, w) + k) / (c(h) + k·V)
 *
 * `counts[w]` is c(h, w) for every w in the vocabulary (so V = counts.length).
 * If c(h) + k·V is 0 (unseen context, k = 0), return the uniform distribution.
 */
export function addK(counts: number[], k: number): number[] {
  // TODO
  return counts;
}
