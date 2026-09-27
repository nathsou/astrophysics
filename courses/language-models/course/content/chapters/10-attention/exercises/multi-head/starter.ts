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
  // TODO
  return x;
}
