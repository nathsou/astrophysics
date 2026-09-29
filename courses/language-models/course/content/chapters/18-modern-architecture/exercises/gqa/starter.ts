/**
 * Grouped-query attention for the last position of a sequence. `q` holds h query heads for that position
 * (h × d). `K` and `V` hold g key/value heads for every position 0 … T−1 (each T × g × d, row-major:
 * position, then head, then dimension). Query head i uses key/value head ⌊i / (h/g)⌋.
 * Returns the h × d output.
 */
export function gqaAttention(q: Float32Array, K: Float32Array, V: Float32Array, h: number, g: number, d: number): Float32Array {
  const T = K.length / (g * d);
  // TODO
  return new Float32Array(h * d);
}
