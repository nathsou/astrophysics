import { expect, test } from '@lm/test';
import { Tensor, nn } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { bigramStep } from './solution.ts';

const V = 7;
const rng = mulberry32(11);
const W0 = Float32Array.from({ length: V * V }, () => rng() - 0.5);
const xs = Int32Array.from({ length: 12 }, () => Math.floor(rng() * V));
const ys = Int32Array.from({ length: 12 }, () => Math.floor(rng() * V));

/** The same step with the library's autograd. */
function reference(W: Float32Array, lr: number, lambda: number): number {
  const w = new Tensor(W, [V, V], undefined, 0, true);
  const data = nn.crossEntropy(nn.embedding(w, xs), ys);
  data.add(w.mul(w).mean().mul(lambda)).backward();
  const g = w.grad!.toFloat32Array();
  for (let i = 0; i < W.length; i++) W[i]! -= lr * g[i]!;
  return data.item();
}

test('returns the mean data loss', () => {
  const W = new Float32Array(V * V);
  expect(bigramStep(W, V, xs, ys, 0, 0)).toBeCloseTo(Math.log(V), 5);
});

test('matches autograd without regularisation', () => {
  const a = W0.slice(), b = W0.slice();
  expect(bigramStep(a, V, xs, ys, 0.5, 0)).toBeCloseTo(reference(b, 0.5, 0), 5);
  for (let i = 0; i < a.length; i++) expect(a[i]!).toBeCloseTo(b[i]!, 5);
});

test('matches autograd with L2 regularisation', () => {
  const a = W0.slice(), b = W0.slice();
  bigramStep(a, V, xs, ys, 0.5, 0.3);
  reference(b, 0.5, 0.3);
  for (let i = 0; i < a.length; i++) expect(a[i]!).toBeCloseTo(b[i]!, 5);
});

test('repeated steps reduce the loss', () => {
  const W = W0.slice();
  const first = bigramStep(W, V, xs, ys, 1, 0);
  let last = first;
  for (let t = 0; t < 50; t++) last = bigramStep(W, V, xs, ys, 1, 0);
  expect(last).toBeLessThan(first);
});
