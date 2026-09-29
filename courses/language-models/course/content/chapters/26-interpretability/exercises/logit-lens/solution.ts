/**
 * The logit lens: read a residual-stream vector h (from any layer) as if it were the last layer's — apply the
 * final layer normalisation (γ, β) and the unembedding (the embedding matrix E, one row per token).
 * Returns one logit per token.
 */
export function logitLens(h: number[], gamma: number[], beta: number[], E: number[][], eps = 1e-5): number[] {
  const n = h.length;
  const mean = h.reduce((a, b) => a + b, 0) / n;
  const variance = h.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const x = h.map((v, i) => ((v - mean) / Math.sqrt(variance + eps)) * gamma[i]! + beta[i]!);
  return E.map((row) => row.reduce((a, w, i) => a + w * x[i]!, 0));
}
