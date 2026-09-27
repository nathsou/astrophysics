/**
 * The attention output for one query,  o = Σᵢ softmax(s)ᵢ vᵢ  with scores  sᵢ = q·kᵢ / √d,  computed in a
 * single pass over blocks of `block` keys. Only one block's scores exist at a time: the running maximum,
 * the running sum of exponentials and the unnormalised output are rescaled whenever the maximum grows.
 * This is the idea at the heart of FlashAttention.
 */
export function attendOnline(q: Float32Array, K: Float32Array[], V: Float32Array[], block: number): Float32Array {
  const d = q.length, dv = V[0]!.length;
  const acc = new Float64Array(dv);
  // TODO
  return Float32Array.from(acc);
}
