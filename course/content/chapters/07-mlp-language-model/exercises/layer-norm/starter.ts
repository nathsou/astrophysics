/**
 * Layer normalisation of each row of a (rows × cols) matrix:
 *   y = (x − mean) / √(var + eps) · gamma + beta
 * where mean and var (the biased variance, dividing by cols) are computed per row.
 */
export function layerNorm(x: Float32Array, rows: number, cols: number, gamma: Float32Array, beta: Float32Array, eps = 1e-5): Float32Array {
  const y = new Float32Array(rows * cols);
  // TODO
  return y;
}
