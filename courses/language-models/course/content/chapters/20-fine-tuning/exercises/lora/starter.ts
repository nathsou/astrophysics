/**
 * LoRA (Hu et al., 2022) for one input row x (length n): y = x·W + (α/r)·(x·A)·B, where W is n × m and frozen,
 * A is n × r and B is r × m. Matrices are row-major arrays.
 */
export function loraForward(x: Float32Array, W: Float32Array, A: Float32Array, B: Float32Array, n: number, m: number, r: number, alpha: number): Float32Array {
  // TODO
  return new Float32Array(m);
}

/** The merged matrix W + (α/r)·A·B, so the adapted layer costs no more than the original at inference. */
export function merge(W: Float32Array, A: Float32Array, B: Float32Array, n: number, m: number, r: number, alpha: number): Float32Array {
  // TODO
  return Float32Array.from(W);
}
