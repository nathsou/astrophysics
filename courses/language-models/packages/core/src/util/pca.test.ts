import { describe, expect, it } from 'vitest';
import { pca, cosineRows } from './pca.ts';
import { mulberry32 } from './random.ts';

describe('pca', () => {
  it('finds the dominant direction of elongated data', () => {
    const rng = mulberry32(1);
    const rows = 500, data = new Float64Array(rows * 3);
    for (let r = 0; r < rows; r++) {
      const t = (rng() - 0.5) * 10, u = (rng() - 0.5) * 1;
      // Mostly along (1, 1, 0)/√2, a little along (0, 0, 1).
      data[r * 3] = t / Math.SQRT2;
      data[r * 3 + 1] = t / Math.SQRT2;
      data[r * 3 + 2] = u;
    }
    const res = pca(data, rows, 3, 2);
    const [c0, c1] = res.components as [Float64Array, Float64Array];
    expect(Math.abs(c0[0]!)).toBeCloseTo(1 / Math.SQRT2, 2);
    expect(Math.abs(c0[2]!)).toBeLessThan(0.05);
    expect(Math.abs(c1[2]!)).toBeCloseTo(1, 2);
    expect(res.explained[0]!).toBeGreaterThan(0.95);
  });

  it('computes cosine similarity of rows', () => {
    expect(cosineRows([1, 0, 1, 1], 2, 0, 1)).toBeCloseTo(Math.SQRT1_2, 10);
  });
});
