/**
 * Return the index of the most probable token. If several are equally probable, return the first.
 * (This is greedy decoding; Chapter 15 explores better ways to choose.)
 */
export function mostLikely(probs: number[]): number {
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i]! > probs[best]!) best = i;
  return best;
}
