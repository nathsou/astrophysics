/**
 * One attention head during generation. Each step brings the new token's query, key and value; the
 * keys and values of all earlier tokens are kept, so they never have to be recomputed.
 */
export class HeadCache {
  readonly keys: Float32Array[] = [];
  readonly values: Float32Array[] = [];

  /** Append k and v, then return the attention output for q over every cached position. */
  step(q: Float32Array, k: Float32Array, v: Float32Array): Float32Array {
    // TODO
    return new Float32Array(v.length);
  }
}
