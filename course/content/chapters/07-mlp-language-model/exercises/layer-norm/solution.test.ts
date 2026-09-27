import { expect, test } from '@lm/test';
import { Tensor, nn } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { layerNorm } from './solution.ts';

test('each row has mean 0 and variance 1 (with gamma = 1, beta = 0)', () => {
  const x = Float32Array.of(1, 2, 3, 4, 10, 10, 10, 30);
  const y = layerNorm(x, 2, 4, new Float32Array(4).fill(1), new Float32Array(4));
  for (let r = 0; r < 2; r++) {
    const row = Array.from(y.slice(r * 4, r * 4 + 4));
    expect(row.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(0, 5);
    expect(row.reduce((a, b) => a + b * b, 0) / 4).toBeCloseTo(1, 3);
  }
});

test('matches the library, including gamma and beta', () => {
  const rng = mulberry32(8);
  const [rows, cols] = [5, 6];
  const x = Float32Array.from({ length: rows * cols }, () => (rng() - 0.5) * 8);
  const g = Float32Array.from({ length: cols }, () => rng() + 0.5);
  const b = Float32Array.from({ length: cols }, () => rng() - 0.5);
  const want = nn.layerNorm(new Tensor(x, [rows, cols]), new Tensor(g, [cols]), new Tensor(b, [cols])).toFloat32Array();
  const got = layerNorm(x, rows, cols, g, b);
  want.forEach((v, i) => expect(got[i]!).toBeCloseTo(v, 4));
});

test('a constant row does not divide by zero', () => {
  const y = layerNorm(Float32Array.of(3, 3, 3), 1, 3, new Float32Array(3).fill(1), new Float32Array(3));
  expect(Array.from(y)).toEqual([0, 0, 0]);
});
