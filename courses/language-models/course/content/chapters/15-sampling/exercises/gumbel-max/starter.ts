/**
 * The Gumbel-max trick: argmaxᵢ (zᵢ / T + gᵢ), where the gᵢ are independent Gumbel(0, 1) noise, is a sample
 * from softmax(z / T). `rng` returns uniform numbers in [0, 1).
 */
export function gumbelSample(logits: ArrayLike<number>, temperature: number, rng: () => number): number {
  // TODO
  return 0;
}
