/**
 * The logit lens: read a residual-stream vector h (from any layer) as if it were the last layer's — apply the
 * final layer normalisation (γ, β) and the unembedding (the embedding matrix E, one row per token).
 * Returns one logit per token.
 */
export function logitLens(h: number[], gamma: number[], beta: number[], E: number[][], eps = 1e-5): number[] {
  // TODO
  return E.map(() => 0);
}
