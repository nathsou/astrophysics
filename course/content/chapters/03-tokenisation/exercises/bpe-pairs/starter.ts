/**
 * The two primitive operations of BPE.
 * Pairs are keyed as "a,b" strings to keep things simple.
 */

/** Count every adjacent pair (overlapping: "aaa" contains the pair (a, a) twice). */
export function countPairs(ids: number[]): Map<string, number> {
  const counts = new Map<string, number>();
  // TODO
  return counts;
}

/** Replace every occurrence of the pair (a, b), scanning left to right, with `newId`. */
export function mergePair(ids: number[], a: number, b: number, newId: number): number[] {
  // TODO
  return ids;
}
