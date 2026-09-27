export function addK(counts: number[], k: number): number[] {
  const V = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const denom = total + k * V;
  if (denom === 0) return counts.map(() => 1 / V);
  return counts.map((c) => (c + k) / denom);
}
