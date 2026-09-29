/** RMSNorm (Zhang and Sennrich, 2019): x / √(mean(x²) + ε) · g. */
export function rmsNorm(x: Float32Array, g: Float32Array, eps = 1e-5): Float32Array {
  let ss = 0;
  for (const v of x) ss += v * v;
  const inv = 1 / Math.sqrt(ss / x.length + eps);
  return x.map((v, i) => v * inv * g[i]!);
}
