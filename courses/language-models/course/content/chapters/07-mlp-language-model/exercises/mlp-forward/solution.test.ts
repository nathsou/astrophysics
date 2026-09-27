import { expect, test } from '@lm/test';
import { Tensor, nn } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { mlpLogits, type MlpParams } from './solution.ts';

const [V, d, n, h, B] = [7, 3, 4, 5, 6];
function params(): MlpParams {
  const rng = mulberry32(2);
  return {
    C: Tensor.randn([V, d], { rng, requiresGrad: true }),
    W1: Tensor.randn([n * d, h], { rng, std: 0.5, requiresGrad: true }),
    b1: Tensor.randn([h], { rng, std: 0.1, requiresGrad: true }),
    W2: Tensor.randn([h, V], { rng, std: 0.5, requiresGrad: true }),
    b2: Tensor.randn([V], { rng, std: 0.1, requiresGrad: true }),
  };
}
const X = Int32Array.from({ length: B * n }, (_, i) => (i * 5 + 3) % V);

test('returns (B, V) logits', () => {
  expect(mlpLogits(params(), X, B, n).shape).toEqual([B, V]);
});

test('matches a hand computation for the first example', () => {
  const p = params();
  const z = mlpLogits(p, X, B, n).toFloat32Array();
  const C = p.C.toFloat32Array(), W1 = p.W1.toFloat32Array(), b1 = p.b1.toFloat32Array(), W2 = p.W2.toFloat32Array(), b2 = p.b2.toFloat32Array();
  const e: number[] = [];
  for (let k = 0; k < n; k++) for (let j = 0; j < d; j++) e.push(C[X[k]! * d + j]!);
  const hid = Array.from({ length: h }, (_, u) => Math.tanh(b1[u]! + e.reduce((s, x, i) => s + x * W1[i * h + u]!, 0)));
  for (let v = 0; v < V; v++) expect(z[v]!).toBeCloseTo(b2[v]! + hid.reduce((s, x, u) => s + x * W2[u * V + v]!, 0), 4);
});

test('gradients reach every parameter', () => {
  const p = params();
  nn.crossEntropy(mlpLogits(p, X, B, n), Int32Array.from({ length: B }, (_, i) => i % V)).backward();
  for (const t of [p.C, p.W1, p.b1, p.W2, p.b2]) expect(t.grad).not.toBeNull();
});
