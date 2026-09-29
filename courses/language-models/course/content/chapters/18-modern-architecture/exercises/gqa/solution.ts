/**
 * Grouped-query attention for the last position of a sequence. `q` holds h query heads for that position
 * (h × d). `K` and `V` hold g key/value heads for every position 0 … T−1 (each T × g × d, row-major:
 * position, then head, then dimension). Query head i uses key/value head ⌊i / (h/g)⌋.
 * Returns the h × d output.
 */
export function gqaAttention(q: Float32Array, K: Float32Array, V: Float32Array, h: number, g: number, d: number): Float32Array {
  const T = K.length / (g * d);
  const out = new Float32Array(h * d);
  for (let i = 0; i < h; i++) {
    const kv = Math.floor(i / (h / g)); // consecutive query heads share a key/value head
    const s = new Float64Array(T);
    for (let t = 0; t < T; t++) {
      let dot = 0;
      for (let c = 0; c < d; c++) dot += q[i * d + c]! * K[(t * g + kv) * d + c]!;
      s[t] = dot / Math.sqrt(d);
    }
    const m = Math.max(...s);
    let z = 0;
    for (let t = 0; t < T; t++) z += s[t] = Math.exp(s[t]! - m);
    for (let t = 0; t < T; t++) for (let c = 0; c < d; c++) out[i * d + c]! += (s[t]! / z) * V[(t * g + kv) * d + c]!;
  }
  return out;
}
