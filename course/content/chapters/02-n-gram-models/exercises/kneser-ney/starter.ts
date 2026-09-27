/**
 * Interpolated Kneser–Ney for bigrams.
 *
 *   P_KN(w | v) = max(c(v w) − d, 0) / c(v •)  +  d · N₁₊(v •) / c(v •) · P_cont(w)
 *   P_cont(w)   = N₁₊(• w) / N₁₊(• •)
 *
 *   c(v •)    = number of bigrams starting with v
 *   N₁₊(v •)  = number of *distinct* words that follow v
 *   N₁₊(• w)  = number of *distinct* words that precede w
 *   N₁₊(• •)  = number of distinct bigram types
 *
 * If v never starts a bigram, return P_cont(w).
 */
export function kneserNeyBigram(ids: number[], V: number, d: number): (prev: number, next: number) => number {
  // TODO: count bigrams, then precompute c(v •), N₁₊(v •), N₁₊(• w) and N₁₊(• •).
  return () => 1 / V;
}
