import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { matmulBackward } from './solution.ts';

test('matches the library autograd', () => {
  const rng = mulberry32(3);
  const [m, k, n] = [4, 3, 5];
  const A = Float32Array.from({ length: m * k }, () => rng() - 0.5);
  const B = Float32Array.from({ length: k * n }, () => rng() - 0.5);
  const dC = Float32Array.from({ length: m * n }, () => rng() - 0.5);
  const a = new Tensor(A.slice(), [m, k], undefined, 0, true);
  const b = new Tensor(B.slice(), [k, n], undefined, 0, true);
  a.matmul(b).backward(new Tensor(dC, [m, n]));
  const { dA, dB } = matmulBackward(A, B, dC, m, k, n);
  a.grad!.toFloat32Array().forEach((v, i) => expect(dA[i]!).toBeCloseTo(v, 5));
  b.grad!.toFloat32Array().forEach((v, i) => expect(dB[i]!).toBeCloseTo(v, 5));
});

test('shapes are those of A and B', () => {
  const { dA, dB } = matmulBackward(new Float32Array(6), new Float32Array(12), new Float32Array(8), 2, 3, 4);
  expect(dA).toHaveLength(6);
  expect(dB).toHaveLength(12);
});
