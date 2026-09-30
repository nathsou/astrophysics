/**
 * Top-k routing for one token: softmax the router's scores over the experts, keep the k most probable,
 * and renormalise their probabilities to sum to 1 (as Mixtral does). Returns the chosen experts, most
 * probable first, and their gates.
 */
export function route(scores: number[], k: number): { experts: number[]; gates: number[] } {
  // TODO
  return { experts: [], gates: [] };
}
