/**
 * LoRA (Hu et al., 2022) for one input row x (length n): y = x·W + (α/r)·(x·A)·B, where W is n × m and frozen,
 * A is n × r and B is r × m. Matrices are row-major arrays.
 */
export function loraForward(x: Float32Array, W: Float32Array, A: Float32Array, B: Float32Array, n: number, m: number, r: number, alpha: number): Float32Array {
  const y = new Float32Array(m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) y[j]! += x[i]! * W[i * m + j]!;
  // The low-rank path: n·r + r·m multiplications instead of the n·m of a full update.
  const u = new Float32Array(r);
  for (let i = 0; i < n; i++) for (let k = 0; k < r; k++) u[k]! += x[i]! * A[i * r + k]!;
  const scale = alpha / r;
  for (let k = 0; k < r; k++) for (let j = 0; j < m; j++) y[j]! += scale * u[k]! * B[k * m + j]!;
  return y;
}

/** The merged matrix W + (α/r)·A·B, so the adapted layer costs no more than the original at inference. */
export function merge(W: Float32Array, A: Float32Array, B: Float32Array, n: number, m: number, r: number, alpha: number): Float32Array {
  const out = Float32Array.from(W), scale = alpha / r;
  for (let i = 0; i < n; i++) for (let k = 0; k < r; k++) for (let j = 0; j < m; j++) out[i * m + j]! += scale * A[i * r + k]! * B[k * m + j]!;
  return out;
}
