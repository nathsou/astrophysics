/**
 * GRPO's advantages for one group of sampled answers to the same prompt: each reward minus the group's mean,
 * divided by the group's standard deviation plus ε.
 */
export function groupAdvantages(rewards: number[], eps = 1e-4): number[] {
  // TODO
  return rewards.map(() => 0);
}
