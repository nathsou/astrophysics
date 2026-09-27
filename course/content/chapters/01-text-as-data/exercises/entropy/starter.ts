/**
 * Shannon entropy of a distribution given by (unnormalised) counts:
 *
 *   H = −Σ p·log_b(p),   where p = count / total
 *
 * Outcomes with zero count contribute nothing. An empty or all-zero input has entropy 0.
 */
export function entropy(counts: number[], base = 2): number {
  // TODO
  return 0;
}
