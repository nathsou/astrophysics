import { Tensor, nn } from '@lm/core/tensor';

export interface MlpParams {
  C: Tensor; // (V, d) character embeddings
  W1: Tensor; // (n·d, h)
  b1: Tensor; // (h)
  W2: Tensor; // (h, V)
  b2: Tensor; // (V)
}

/**
 * Bengio's MLP: logits = tanh(concat(C[x₁], …, C[xₙ]) · W1 + b1) · W2 + b2.
 * X holds B contexts of n token ids each (row-major, length B·n). Return logits of shape (B, V).
 * Use library operations only, so gradients flow back to every parameter.
 */
export function mlpLogits(p: MlpParams, X: Int32Array, B: number, n: number): Tensor {
  // TODO: nn.embedding(p.C, X, [B, n]) gives (B, n, d); reshape it to (B, n·d) to concatenate.
  return Tensor.zeros([B, p.W2.shape[1]!]);
}
