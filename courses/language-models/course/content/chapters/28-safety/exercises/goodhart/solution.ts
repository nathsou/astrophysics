/**
 * Choose the k candidates with the highest proxy score (what we can measure: a reward model's score, a benchmark,
 * a metric), and return the mean of their true values (what we actually care about).
 */
export function selectByProxy(trueValues: number[], proxy: number[], k: number): number {
  const chosen = proxy
    .map((_, i) => i)
    .sort((a, b) => proxy[b]! - proxy[a]!)
    .slice(0, k);
  return chosen.reduce((s, i) => s + trueValues[i]!, 0) / chosen.length;
}
