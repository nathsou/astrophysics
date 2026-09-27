/**
 * C = A · B for row-major matrices A (m×k) and B (k×n). Returns C (m×n) as a new Float32Array.
 * Use the cache-friendly i-k-j loop order: for each (i, k), add A[i][k] times row k of B to row i of C.
 */
export function matmul(a: Float32Array, b: Float32Array, m: number, k: number, n: number): Float32Array {
  const c = new Float32Array(m * n);
  // TODO
  return c;
}
