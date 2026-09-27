export function sampleIndex(probs: ArrayLike<number>, u: number): number {
  let total = 0;
  for (let i = 0; i < probs.length; i++) total += probs[i]!;
  const target = u * total;
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]!;
    if (target < acc) return i;
  }
  // Round-off can leave target ≥ acc at the very end: return the last index with mass.
  for (let i = probs.length - 1; i >= 0; i--) if (probs[i]! > 0) return i;
  return probs.length - 1;
}
