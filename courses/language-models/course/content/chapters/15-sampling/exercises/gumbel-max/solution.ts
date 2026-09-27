/**
 * The Gumbel-max trick: argmaxᵢ (zᵢ / T + gᵢ), where the gᵢ are independent Gumbel(0, 1) noise, is a sample
 * from softmax(z / T). `rng` returns uniform numbers in [0, 1).
 */
export function gumbelSample(logits: ArrayLike<number>, temperature: number, rng: () => number): number {
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    const u = Math.max(rng(), 1e-300); // u = 0 would make the noise −∞
    const score = logits[i]! / temperature - Math.log(-Math.log(u));
    if (score > bestScore) (best = i), (bestScore = score);
  }
  return best;
}
