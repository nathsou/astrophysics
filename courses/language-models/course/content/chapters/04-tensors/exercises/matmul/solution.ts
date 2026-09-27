export function matmul(a: Float32Array, b: Float32Array, m: number, k: number, n: number): Float32Array {
  const c = new Float32Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a[i * k + p]!;
      for (let j = 0; j < n; j++) c[i * n + j]! += aip * b[p * n + j]!;
    }
  }
  return c;
}
