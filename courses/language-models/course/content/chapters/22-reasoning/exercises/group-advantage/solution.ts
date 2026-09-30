/**
 * GRPO's advantages for one group of sampled answers to the same prompt: each reward minus the group's mean,
 * divided by the group's standard deviation plus ε.
 */
export function groupAdvantages(rewards: number[], eps = 1e-4): number[] {
  const n = rewards.length;
  const mean = rewards.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(rewards.reduce((a, r) => a + (r - mean) ** 2, 0) / n);
  // The group is its own baseline: no value network is needed to say what reward was expected.
  return rewards.map((r) => (r - mean) / (std + eps));
}
