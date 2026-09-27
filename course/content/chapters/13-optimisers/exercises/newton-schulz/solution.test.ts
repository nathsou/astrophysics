import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32, svd } from '@lm/core';
import { newtonSchulz } from './solution.ts';

const rng = mulberry32(2);
const G = Tensor.randn([8, 12], { rng });

test('pushes every singular value into roughly [0.7, 1.2]', () => {
  const { S } = svd(newtonSchulz(G).toFloat32Array(), 8, 12);
  for (const s of S) {
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThan(1.25);
  }
});

test('keeps the singular vectors: X is close in direction to U Vᵀ', () => {
  const d = svd(G.toFloat32Array(), 8, 12);
  // U Vᵀ from the exact SVD
  const uv = new Float32Array(8 * 12);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 12; j++) for (let k = 0; k < d.k; k++) uv[i * 12 + j]! += d.U[i * d.k + k]! * d.V[j * d.k + k]!;
  const x = newtonSchulz(G).toFloat32Array();
  let dot = 0, nx = 0, nu = 0;
  for (let i = 0; i < x.length; i++) {
    dot += x[i]! * uv[i]!;
    nx += x[i]! ** 2;
    nu += uv[i]! ** 2;
  }
  expect(dot / Math.sqrt(nx * nu)).toBeGreaterThan(0.95);
});

test('one step is not enough', () => {
  const { S } = svd(newtonSchulz(G, 1).toFloat32Array(), 8, 12);
  expect(Math.min(...S)).toBeLessThan(0.5);
});
