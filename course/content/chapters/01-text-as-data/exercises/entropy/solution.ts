export function entropy(counts: number[], base = 2): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  }
  // Change of base: log_b(x) = ln(x) / ln(b).
  return h / Math.log(base);
}
