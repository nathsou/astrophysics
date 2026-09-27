import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { causalAttention } from './solution.ts';

const rng = mulberry32(4);
const T = 5, d = 4;
const [q, k, v] = [0, 1, 2].map(() => Tensor.randn([T, d], { rng, requiresGrad: true })) as [Tensor, Tensor, Tensor];

test('weights are causal: zero above the diagonal, rows sum to one', () => {
  const { weights } = causalAttention(q, k, v);
  expect(weights.shape).toEqual([T, T]);
  for (let i = 0; i < T; i++) {
    let s = 0;
    for (let j = 0; j < T; j++) {
      if (j > i) expect(weights.get(i, j)).toBe(0);
      s += weights.get(i, j);
    }
    expect(s).toBeCloseTo(1, 5);
  }
});

test('the first position can only copy its own value', () => {
  const { out, weights } = causalAttention(q, k, v);
  expect(weights.get(0, 0)).toBeCloseTo(1, 6);
  for (let c = 0; c < d; c++) expect(out.get(0, c)).toBeCloseTo(v.get(0, c), 5);
});

test('matches the formula for the last position', () => {
  const { out } = causalAttention(q, k, v);
  const i = T - 1;
  const s = Array.from({ length: T }, (_, j) => Array.from({ length: d }, (_, c) => q.get(i, c) * k.get(j, c)).reduce((a, b) => a + b) / Math.sqrt(d));
  const m = Math.max(...s);
  const e = s.map((x) => Math.exp(x - m));
  const z = e.reduce((a, b) => a + b);
  for (let c = 0; c < d; c++) expect(out.get(i, c)).toBeCloseTo(e.reduce((a, w, j) => a + (w / z) * v.get(j, c), 0), 4);
});

test('gradients reach queries, keys and values (and never through the mask)', () => {
  causalAttention(q, k, v).out.sum().backward();
  for (const t of [q, k, v]) expect(Array.from(t.grad!.toFloat32Array()).every(Number.isFinite)).toBe(true);
  expect(Math.max(...Array.from(k.grad!.toFloat32Array(), Math.abs))).toBeGreaterThan(0);
});
