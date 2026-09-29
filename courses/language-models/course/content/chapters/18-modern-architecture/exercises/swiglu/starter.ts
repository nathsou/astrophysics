/**
 * The SwiGLU MLP (Shazeer, 2020): out = W2ᵀ · (SiLU(x·Wg) ⊙ x·W1), with SiLU(z) = z·σ(z).
 * Wg and W1 are (C, H), W2 is (H, C), all row-major (inputs, outputs), as in our models.
 */
export function swiglu(x: Float32Array, Wg: Float32Array, W1: Float32Array, W2: Float32Array, H: number): Float32Array {
  const C = x.length;
  // TODO
  return new Float32Array(C);
}
