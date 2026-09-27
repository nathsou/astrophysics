import { Tensor } from '@lm/core/tensor';

/**
 * Causal scaled dot-product attention for one head.
 * q, k, v: (T, d). Position i may attend only to positions 0 … i.
 *   out = softmax(q kᵀ / √d + mask) v
 * Return the output (T, d) and the attention weights (T, T).
 */
export function causalAttention(q: Tensor, k: Tensor, v: Tensor): { out: Tensor; weights: Tensor } {
  const [T, d] = q.shape as [number, number];
  // TODO
  return { out: v, weights: Tensor.zeros([T, T]) };
}
