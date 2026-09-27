/**
 * Project the rows of a (rows × cols) matrix onto its top two principal components.
 * 1. Centre each column.
 * 2. Form the covariance matrix (cols × cols).
 * 3. Power iteration: v ← Σv / ‖Σv‖, repeated, converges to the top eigenvector.
 * 4. Deflate: Σ ← Σ − λ·v·vᵀ, and repeat for the second component.
 * Return the (rows × 2) projections, row-major.
 */
export function pcaTop2(data: ArrayLike<number>, rows: number, cols: number): Float64Array {
  const out = new Float64Array(rows * 2);
  // TODO
  return out;
}
