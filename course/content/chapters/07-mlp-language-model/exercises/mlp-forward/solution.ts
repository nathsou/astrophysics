import { Tensor, nn } from '@lm/core/tensor';

export interface MlpParams {
  C: Tensor;
  W1: Tensor;
  b1: Tensor;
  W2: Tensor;
  b2: Tensor;
}

export function mlpLogits(p: MlpParams, X: Int32Array, B: number, n: number): Tensor {
  const d = p.C.shape[1]!;
  const e = nn.embedding(p.C, X, [B, n]).reshape(B, n * d); // concatenation = flattening the context
  const h = e.matmul(p.W1).add(p.b1).tanh();
  return h.matmul(p.W2).add(p.b2);
}
