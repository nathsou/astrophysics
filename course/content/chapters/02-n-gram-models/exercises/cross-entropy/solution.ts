export function crossEntropyBits(prob: (context: number[], next: number) => number, ids: number[], contextLength: number): number {
  let total = 0;
  let count = 0;
  for (let t = contextLength; t < ids.length; t++) {
    const p = prob(ids.slice(t - contextLength, t), ids[t]!);
    if (p <= 0) return Infinity;
    total -= Math.log2(p);
    count++;
  }
  return count ? total / count : 0;
}
