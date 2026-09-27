/**
 * Softmax of each row of a row-major (rows × cols) matrix: exp(x_j) / Σ_k exp(x_k).
 * It must not overflow for large inputs such as [1000, 1001, 1002] — softmax is unchanged by
 * subtracting a constant from every element of a row.
 */
export function softmaxRows(x: Float32Array, rows: number, cols: number): Float32Array {
  const out = new Float32Array(rows * cols);
  // TODO
  return out;
}
