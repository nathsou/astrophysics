import { Tensor, nn } from '@lm/core/tensor';

export interface BlockParams {
  ln1g: Tensor; ln1b: Tensor; //   (C) LayerNorm before attention
  W: { q: Tensor; k: Tensor; v: Tensor; o: Tensor }; // (C, C) each
  ln2g: Tensor; ln2b: Tensor; //   (C) LayerNorm before the MLP
  W1: Tensor; //                   (C, 4C)
  W2: Tensor; //                   (4C, C)
}

/** Given: causal multi-head attention (Chapter 10) with projections W = { q, k, v, o }. */
function attention(x: Tensor, W: { q: Tensor; k: Tensor; v: Tensor; o: Tensor }, heads: number): Tensor {
  const [B, T, C] = x.shape as [number, number, number];
  const d = C / heads;
  const split = (t: Tensor) => t.reshape(B, T, heads, d).permute(0, 2, 1, 3);
  const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
  const a = split(x.matmul(W.q)).matmul(split(x.matmul(W.k)).transpose(-1, -2)).mul(1 / Math.sqrt(d)).add(mask).softmax(-1);
  return a.matmul(split(x.matmul(W.v))).permute(0, 2, 1, 3).reshape(B, T, C).matmul(W.o);
}

/**
 * One pre-norm Transformer block on x (B, T, C):
 *   x ← x + Attention(LN₁(x))
 *   x ← x + W₂ · GELU(W₁ · LN₂(x))
 */
export function block(x: Tensor, p: BlockParams, heads: number): Tensor {
  // TODO
  return x;
}
