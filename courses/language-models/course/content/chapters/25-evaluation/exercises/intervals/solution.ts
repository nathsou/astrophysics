/** The 95% normal-approximation interval for an accuracy of k correct out of n. */
export function accuracyInterval(k: number, n: number): [number, number] {
  const p = k / n;
  const se = Math.sqrt((p * (1 - p)) / n);
  return [p - 1.96 * se, p + 1.96 * se];
}

/**
 * Two models scored on the same items (1 = right, 0 = wrong). Return the difference in accuracy (a − b) and its
 * 95% interval, from the per-item differences. Pairing removes the variation due to which items are hard.
 */
export function pairedDifference(a: number[], b: number[]): { diff: number; lo: number; hi: number } {
  const n = a.length;
  const d = a.map((x, i) => x - b[i]!);
  const diff = d.reduce((s, x) => s + x, 0) / n;
  const variance = d.reduce((s, x) => s + (x - diff) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return { diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se };
}
