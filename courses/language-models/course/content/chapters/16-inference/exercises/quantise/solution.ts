/**
 * Symmetric absmax quantisation to `bits`-bit signed integers, in groups of `group` consecutive values,
 * each group with its own float scale. Returns the integers, the scales, and the dequantised values
 * (q · scale) that a kernel would compute with.
 */
export function quantise(w: Float32Array, bits: number, group: number): { q: Int8Array; scales: Float32Array; dequantised: Float32Array } {
  const qmax = 2 ** (bits - 1) - 1;
  const groups = Math.ceil(w.length / group);
  const q = new Int8Array(w.length), scales = new Float32Array(groups), dequantised = new Float32Array(w.length);
  for (let g = 0; g < groups; g++) {
    const start = g * group, end = Math.min(w.length, start + group);
    let max = 0;
    for (let i = start; i < end; i++) max = Math.max(max, Math.abs(w[i]!));
    const scale = max / qmax || 1; // an all-zero group: any scale works
    scales[g] = scale;
    for (let i = start; i < end; i++) {
      q[i] = Math.max(-qmax, Math.min(qmax, Math.round(w[i]! / scale)));
      dequantised[i] = q[i]! * scale;
    }
  }
  return { q, scales, dequantised };
}
