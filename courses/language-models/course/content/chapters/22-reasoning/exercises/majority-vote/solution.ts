/** The most common answer among the samples (ignoring nulls, which failed to parse); first seen on ties. */
export function majorityVote(answers: (number | null)[]): number | null {
  const counts = new Map<number, number>(); // Maps keep insertion order: first seen comes first
  for (const a of answers) if (a !== null) counts.set(a, (counts.get(a) ?? 0) + 1);
  let best: number | null = null;
  for (const [a, c] of counts) if (best === null || c > counts.get(best)!) best = a;
  return best;
}

/** The unbiased estimate of pass@k from n samples of which c are correct (Chen et al., 2021). */
export function passAtK(n: number, c: number, k: number): number {
  if (n - c < k) return 1; // every set of k samples contains a correct one
  // 1 − C(n − c, k) / C(n, k), as a product.
  let allWrong = 1;
  for (let i = 0; i < k; i++) allWrong *= (n - c - i) / (n - i);
  return 1 - allWrong;
}
