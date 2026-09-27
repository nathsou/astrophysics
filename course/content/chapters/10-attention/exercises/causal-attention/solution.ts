import { Tensor } from '@lm/core/tensor';

/**
 * Causal scaled dot-product attention for one head.
 * q, k, v: (T, d). Position i may attend only to positions 0 … i.
 *   out = softmax(q kᵀ / √d + mask) v
 * Return the output (T, d) and the attention weights (T, T).
 */
export function causalAttention(q: Tensor, k: Tensor, v: Tensor): { out: Tensor; weights: Tensor } {
  const [T, d] = q.shape as [number, number];
  const scores = q.matmul(k.transpose(-1, -2)).mul(1 / Math.sqrt(d)); // (T, T): every query · every key
  const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
  const weights = scores.add(mask).softmax(-1); // future keys get e^−∞ = 0
  return { out: weights.matmul(v), weights };
}
