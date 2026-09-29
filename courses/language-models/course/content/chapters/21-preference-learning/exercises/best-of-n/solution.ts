/** The index of the highest-reward candidate (the first on ties). */
export function bestOfN(rewards: number[]): number {
  let best = 0;
  for (let i = 1; i < rewards.length; i++) if (rewards[i]! > rewards[best]!) best = i;
  return best;
}

/** The upper bound on KL(best-of-n ‖ base) in nats: log n − (n − 1)/n. */
export function bestOfNKl(n: number): number {
  // Picking one of n samples can only move the distribution so far from the base: logarithmically in n.
  return Math.log(n) - (n - 1) / n;
}
