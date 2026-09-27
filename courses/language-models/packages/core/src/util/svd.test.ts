import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random.ts';
import { lowRank, svd } from './svd.ts';

const rand = (m: number, n: number, seed = 1) => {
  const rng = mulberry32(seed);
  return Float64Array.from({ length: m * n }, () => rng() * 2 - 1);
};

describe('svd', () => {
  for (const [m, n] of [[5, 3], [3, 5], [8, 8], [1, 4]] as const) {
    it(`reconstructs a random ${m} × ${n} matrix with orthonormal factors`, () => {
      const A = rand(m, n, m * 10 + n);
      const r = svd(A, m, n);
      const B = lowRank(r, r.k);
      for (let i = 0; i < A.length; i++) expect(B[i]!).toBeCloseTo(A[i]!, 10);
      for (let a = 0; a < r.k; a++)
        for (let b = 0; b < r.k; b++) {
          let uu = 0, vv = 0;
          for (let i = 0; i < m; i++) uu += r.U[i * r.k + a]! * r.U[i * r.k + b]!;
          for (let j = 0; j < n; j++) vv += r.V[j * r.k + a]! * r.V[j * r.k + b]!;
          expect(vv).toBeCloseTo(a === b ? 1 : 0, 10);
          if (r.S[a]! > 1e-9 && r.S[b]! > 1e-9) expect(uu).toBeCloseTo(a === b ? 1 : 0, 10);
        }
      for (let t = 1; t < r.k; t++) expect(r.S[t]!).toBeLessThanOrEqual(r.S[t - 1]!);
    });
  }

  it('finds the rank of an outer product and its singular value', () => {
    const u = [1, 2, 3], v = [4, 0, -1, 2];
    const A = Float64Array.from({ length: 12 }, (_, i) => u[Math.floor(i / 4)]! * v[i % 4]!);
    const { S } = svd(A, 3, 4);
    expect(S[0]!).toBeCloseTo(Math.hypot(...u) * Math.hypot(...v), 10);
    expect(S[1]!).toBeCloseTo(0, 10);
  });
});
