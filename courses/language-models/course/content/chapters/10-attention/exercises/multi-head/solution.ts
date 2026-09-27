import { Tensor } from '@lm/core/tensor';

/**
 * Multi-head causal self-attention.
 * x: (B, T, C); Wq, Wk, Wv, Wo: (C, C); C divisible by `heads`, head size d = C / heads.
 *   1. project: q = x Wq, k = x Wk, v = x Wv          (B, T, C)
 *   2. split into heads                               (B, heads, T, d)
 *   3. causal attention in every head at once         (B, heads, T, d)
 *   4. merge the heads back and project: … Wo         (B, T, C)
 */
export function multiHead(x: Tensor, Wq: Tensor, Wk: Tensor, Wv: Tensor, Wo: Tensor, heads: number): Tensor {
  const [B, T, C] = x.shape as [number, number, number];
  const d = C / heads;
  const split = (t: Tensor) => t.reshape(B, T, heads, d).permute(0, 2, 1, 3);
  const q = split(x.matmul(Wq)), k = split(x.matmul(Wk)), v = split(x.matmul(Wv));
  const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
  const weights = q.matmul(k.transpose(-1, -2)).mul(1 / Math.sqrt(d)).add(mask).softmax(-1); // (B, heads, T, T)
  return weights.matmul(v).permute(0, 2, 1, 3).reshape(B, T, C).matmul(Wo);
}
