/**
 * Singular value decomposition by one-sided Jacobi rotations (Appendix A). Simple and accurate,
 * and fast enough for the matrices the course visualises (up to ~100 × 100).
 *
 * Returns A = U · diag(S) · Vᵀ with singular values in decreasing order; U is (m × k), V is
 * (n × k) and k = min(m, n). All matrices are row-major Float64Arrays.
 */
export interface Svd {
  U: Float64Array;
  S: Float64Array;
  V: Float64Array;
  m: number;
  n: number;
  k: number;
}

export function svd(A: ArrayLike<number>, m: number, n: number, { sweeps = 30, tol = 1e-12 } = {}): Svd {
  // Work on the tall orientation: if m < n, decompose Aᵀ and swap U and V at the end.
  if (m < n) {
    const At = new Float64Array(m * n);
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) At[j * m + i] = A[i * n + j]!;
    const r = svd(At, n, m, { sweeps, tol });
    return { U: r.V, S: r.S, V: r.U, m, n, k: r.k };
  }
  const k = n;
  // Columns of W are rotated until mutually orthogonal; V accumulates the rotations.
  const W = Float64Array.from(A as ArrayLike<number>);
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let alpha = 0, beta = 0, gamma = 0;
        for (let i = 0; i < m; i++) {
          const a = W[i * n + p]!, b = W[i * n + q]!;
          alpha += a * a;
          beta += b * b;
          gamma += a * b;
        }
        if (Math.abs(gamma) <= tol * Math.sqrt(alpha * beta) || gamma === 0) continue;
        off = Math.max(off, Math.abs(gamma) / Math.sqrt(alpha * beta));
        // The rotation that zeroes the (p, q) entry of WᵀW.
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t), s = c * t;
        for (let i = 0; i < m; i++) {
          const a = W[i * n + p]!, b = W[i * n + q]!;
          W[i * n + p] = c * a - s * b;
          W[i * n + q] = s * a + c * b;
        }
        for (let i = 0; i < n; i++) {
          const a = V[i * n + p]!, b = V[i * n + q]!;
          V[i * n + p] = c * a - s * b;
          V[i * n + q] = s * a + c * b;
        }
      }
    }
    if (off < tol) break;
  }
  // Singular values are the column norms; U's columns are the normalised columns.
  const norms = Array.from({ length: n }, (_, j) => {
    let s = 0;
    for (let i = 0; i < m; i++) s += W[i * n + j]! ** 2;
    return Math.sqrt(s);
  });
  const order = norms.map((_, j) => j).sort((a, b) => norms[b]! - norms[a]!);
  const U = new Float64Array(m * k), S = new Float64Array(k), Vs = new Float64Array(n * k);
  order.forEach((j, r) => {
    S[r] = norms[j]!;
    for (let i = 0; i < m; i++) U[i * k + r] = norms[j]! > 0 ? W[i * n + j]! / norms[j]! : 0;
    for (let i = 0; i < n; i++) Vs[i * k + r] = V[i * n + j]!;
  });
  return { U, S, V: Vs, m, n, k };
}

/** The best rank-r approximation of the decomposed matrix (Eckart–Young), row-major m × n. */
export function lowRank({ U, S, V, m, n, k }: Svd, r: number): Float64Array {
  const out = new Float64Array(m * n);
  for (let t = 0; t < Math.min(r, k); t++) {
    const s = S[t]!;
    if (s === 0) continue;
    for (let i = 0; i < m; i++) {
      const u = U[i * k + t]! * s;
      for (let j = 0; j < n; j++) out[i * n + j]! += u * V[j * k + t]!;
    }
  }
  return out;
}
