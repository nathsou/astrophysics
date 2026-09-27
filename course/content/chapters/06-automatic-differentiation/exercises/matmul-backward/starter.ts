/**
 * The vector–Jacobian product of matrix multiplication.
 * Forward: C = A·B with A (m×k), B (k×n), C (m×n), all row-major.
 * Backward: given dC = ∂L/∂C, return dA = dC · Bᵀ (m×k) and dB = Aᵀ · dC (k×n).
 */
export function matmulBackward(A: Float32Array, B: Float32Array, dC: Float32Array, m: number, k: number, n: number): { dA: Float32Array; dB: Float32Array } {
  const dA = new Float32Array(m * k);
  const dB = new Float32Array(k * n);
  // TODO: dA[i][p] = Σ_j dC[i][j] · B[p][j];  dB[p][j] = Σ_i A[i][p] · dC[i][j]
  return { dA, dB };
}
