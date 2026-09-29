/**
 * The SwiGLU MLP (Shazeer, 2020): out = W2ᵀ · (SiLU(x·Wg) ⊙ x·W1), with SiLU(z) = z·σ(z).
 * Wg and W1 are (C, H), W2 is (H, C), all row-major (inputs, outputs), as in our models.
 */
export function swiglu(x: Float32Array, Wg: Float32Array, W1: Float32Array, W2: Float32Array, H: number): Float32Array {
  const C = x.length;
  const u = new Float32Array(H);
  for (let j = 0; j < H; j++) {
    let a = 0, b = 0;
    for (let i = 0; i < C; i++) {
      a += x[i]! * Wg[i * H + j]!;
      b += x[i]! * W1[i * H + j]!;
    }
    u[j] = (a / (1 + Math.exp(-a))) * b; // the gate SiLU(a) scales the value b
  }
  const out = new Float32Array(C);
  for (let j = 0; j < H; j++) for (let i = 0; i < C; i++) out[i]! += u[j]! * W2[j * C + i]!;
  return out;
}
