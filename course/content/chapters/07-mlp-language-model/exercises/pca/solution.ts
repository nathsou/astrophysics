export function pcaTop2(data: ArrayLike<number>, rows: number, cols: number): Float64Array {
  const mean = new Float64Array(cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) mean[c]! += data[r * cols + c]! / rows;
  const cov = new Float64Array(cols * cols);
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < cols; j++) cov[i * cols + j]! += ((data[r * cols + i]! - mean[i]!) * (data[r * cols + j]! - mean[j]!)) / rows;
  const out = new Float64Array(rows * 2);
  for (let k = 0; k < 2; k++) {
    let v = Float64Array.from({ length: cols }, (_, i) => Math.sin(i + 1 + k)); // any start not orthogonal to the answer
    let lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = new Float64Array(cols);
      for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) w[i]! += cov[i * cols + j]! * v[j]!;
      lambda = Math.hypot(...w) || 1;
      v = w.map((x) => x / lambda);
    }
    for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) cov[i * cols + j]! -= lambda * v[i]! * v[j]!;
    for (let r = 0; r < rows; r++) {
      let s = 0;
      for (let j = 0; j < cols; j++) s += (data[r * cols + j]! - mean[j]!) * v[j]!;
      out[r * 2 + k] = s;
    }
  }
  return out;
}
