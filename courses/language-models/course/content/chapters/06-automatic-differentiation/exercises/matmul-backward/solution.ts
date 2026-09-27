export function matmulBackward(A: Float32Array, B: Float32Array, dC: Float32Array, m: number, k: number, n: number): { dA: Float32Array; dB: Float32Array } {
  const dA = new Float32Array(m * k);
  const dB = new Float32Array(k * n);
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += dC[i * n + j]! * B[p * n + j]!;
      dA[i * k + p] = s;
      const a = A[i * k + p]!;
      for (let j = 0; j < n; j++) dB[p * n + j]! += a * dC[i * n + j]!;
    }
  }
  return { dA, dB };
}
