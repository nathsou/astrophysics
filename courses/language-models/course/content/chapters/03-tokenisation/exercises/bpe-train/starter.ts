/**
 * Train byte-pair encoding the simple way: on the UTF-8 bytes of the whole text (no
 * pre-tokenisation), recounting all pairs after every merge.
 *
 * Merge i creates token 256 + i. Choose the pair with the highest count; break ties by the
 * smallest first id, then the smallest second id. Stop early if no adjacent pair remains.
 *
 * Returns the list of merged pairs, in order.
 */
export function trainBpe(text: string, numMerges: number): [number, number][] {
  let ids = Array.from(new TextEncoder().encode(text));
  const merges: [number, number][] = [];
  // TODO: repeat numMerges times — count pairs, pick the best, merge it everywhere.
  return merges;
}
