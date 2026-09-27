/**
 * Average cross-entropy, in bits per token, of a model on a sequence:
 *
 *   H = −(1/T) Σ_t log₂ P(ids[t] | the contextLength tokens before t)
 *
 * Predict every position t from `contextLength` onwards (so each prediction has a full context).
 * If any probability is 0, the cross-entropy is Infinity.
 */
export function crossEntropyBits(
  prob: (context: number[], next: number) => number,
  ids: number[],
  contextLength: number,
): number {
  // TODO
  return 0;
}
