/**
 * Top-k routing for one token: softmax the router's scores over the experts, keep the k most probable,
 * and renormalise their probabilities to sum to 1 (as Mixtral does). Returns the chosen experts, most
 * probable first, and their gates.
 */
export function route(scores: number[], k: number): { experts: number[]; gates: number[] } {
  const m = Math.max(...scores);
  const e = scores.map((s) => Math.exp(s - m));
  const z = e.reduce((a, b) => a + b, 0);
  const p = e.map((v) => v / z);
  const experts = p.map((_, i) => i).sort((a, b) => p[b]! - p[a]! || a - b).slice(0, k);
  const kept = experts.reduce((a, i) => a + p[i]!, 0);
  return { experts, gates: experts.map((i) => p[i]! / kept) };
}
