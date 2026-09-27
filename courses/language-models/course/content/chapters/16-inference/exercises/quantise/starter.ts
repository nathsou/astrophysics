/**
 * Symmetric absmax quantisation to `bits`-bit signed integers, in groups of `group` consecutive values,
 * each group with its own float scale. Returns the integers, the scales, and the dequantised values
 * (q · scale) that a kernel would compute with.
 */
export function quantise(w: Float32Array, bits: number, group: number): { q: Int8Array; scales: Float32Array; dequantised: Float32Array } {
  // TODO
  return { q: new Int8Array(w.length), scales: new Float32Array(Math.ceil(w.length / group)), dequantised: Float32Array.from(w) };
}
