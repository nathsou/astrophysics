export interface GptShape {
  L: number; //   blocks
  C: number; //   width
  V: number; //   vocabulary
  T: number; //   context length (learned position embeddings)
  r: number; //   MLP expansion (hidden width r·C)
  bias: boolean; // biases on every linear layer (GPT-2 has them)
  tied: boolean; // output layer shares the token embedding matrix
}

/**
 * Count the parameters of a pre-norm GPT: token and position embeddings, L blocks (four C × C
 * attention projections, a C → rC → C MLP, two LayerNorms with gain and bias), a final LayerNorm,
 * and the output layer (none extra if tied; V × C, plus V if biased, otherwise).
 */
export function countParams(s: GptShape): number {
  const { L, C, V, T, r } = s;
  const b = s.bias ? 1 : 0;
  const embeddings = V * C + T * C;
  const attention = 4 * C * C + b * 4 * C;
  const mlp = 2 * r * C * C + b * (r * C + C);
  const norms = 2 * 2 * C;
  const output = s.tied ? 0 : V * C + b * V;
  return embeddings + L * (attention + mlp + norms) + 2 * C + output;
}
