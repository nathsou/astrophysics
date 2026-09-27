export function layerNorm(x: Float32Array, rows: number, cols: number, gamma: Float32Array, beta: Float32Array, eps = 1e-5): Float32Array {
  const y = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const o = r * cols;
    let mean = 0;
    for (let j = 0; j < cols; j++) mean += x[o + j]!;
    mean /= cols;
    let v = 0;
    for (let j = 0; j < cols; j++) v += (x[o + j]! - mean) ** 2;
    const inv = 1 / Math.sqrt(v / cols + eps);
    for (let j = 0; j < cols; j++) y[o + j] = (x[o + j]! - mean) * inv * gamma[j]! + beta[j]!;
  }
  return y;
}
