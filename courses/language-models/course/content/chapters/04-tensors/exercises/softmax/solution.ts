export function softmaxRows(x: Float32Array, rows: number, cols: number): Float32Array {
  const out = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const base = r * cols;
    let max = -Infinity;
    for (let j = 0; j < cols; j++) max = Math.max(max, x[base + j]!);
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      const e = Math.exp(x[base + j]! - max); // ≤ 1, so it cannot overflow
      out[base + j] = e;
      sum += e;
    }
    for (let j = 0; j < cols; j++) out[base + j]! /= sum;
  }
  return out;
}
