/** The 95% normal-approximation interval for an accuracy of k correct out of n. */
export function accuracyInterval(k: number, n: number): [number, number] {
  // TODO
  return [k / n, k / n];
}

/**
 * Two models scored on the same items (1 = right, 0 = wrong). Return the difference in accuracy (a − b) and its
 * 95% interval, from the per-item differences. Pairing removes the variation due to which items are hard.
 */
export function pairedDifference(a: number[], b: number[]): { diff: number; lo: number; hi: number } {
  // TODO
  return { diff: 0, lo: 0, hi: 0 };
}
