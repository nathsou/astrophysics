import { expect, test } from '@lm/test';
import { pca, mulberry32 } from '@lm/core';
import { pcaTop2 } from './solution.ts';

/** |correlation| between two columns — principal components are only defined up to sign. */
function absCorr(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let sab = 0, saa = 0, sbb = 0;
  a.forEach((x, i) => {
    sab += (x - ma) * (b[i]! - mb);
    saa += (x - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  });
  return Math.abs(sab / Math.sqrt(saa * sbb));
}

const rng = mulberry32(6);
const [rows, cols] = [80, 6];
// Data with clearly separated variances along a few random directions.
const data = new Float64Array(rows * cols);
for (let r = 0; r < rows; r++) {
  const a = (rng() - 0.5) * 10, b = (rng() - 0.5) * 4, c = (rng() - 0.5) * 0.5;
  for (let j = 0; j < cols; j++) data[r * cols + j] = a * Math.cos(j) + b * Math.sin(2 * j) + c * (j % 2) + 3;
}

test('returns rows × 2 projections', () => {
  expect(pcaTop2(data, rows, cols)).toHaveLength(rows * 2);
});

test('matches the library’s components (up to sign)', () => {
  const mine = pcaTop2(data, rows, cols);
  const ref = pca(data, rows, cols, 2).projected;
  for (const k of [0, 1]) {
    const a = Array.from({ length: rows }, (_, r) => mine[r * 2 + k]!);
    const b = Array.from({ length: rows }, (_, r) => ref[r * 2 + k]!);
    expect(absCorr(a, b)).toBeGreaterThan(0.999);
  }
});

test('the first component captures more variance than the second', () => {
  const p = pcaTop2(data, rows, cols);
  let v0 = 0, v1 = 0;
  for (let r = 0; r < rows; r++) {
    v0 += p[r * 2]! ** 2;
    v1 += p[r * 2 + 1]! ** 2;
  }
  expect(v0).toBeGreaterThan(v1);
});
