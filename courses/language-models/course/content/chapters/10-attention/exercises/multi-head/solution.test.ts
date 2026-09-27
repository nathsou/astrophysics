import { expect, test } from '@lm/test';
import { Tensor, cat } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { multiHead } from './solution.ts';

const B = 2, T = 4, C = 6, heads = 3, d = C / heads;
const rng = mulberry32(12);
const x = Tensor.randn([B, T, C], { rng });
const [Wq, Wk, Wv, Wo] = [0, 1, 2, 3].map(() => Tensor.randn([C, C], { rng, std: 0.5 })) as [Tensor, Tensor, Tensor, Tensor];

/** Reference: run each head separately on its slice of the projections, then concatenate. */
function reference(b: number): Tensor {
  const xb = x.slice(0, b, b + 1).reshape(T, C);
  const outs = Array.from({ length: heads }, (_, h) => {
    const cols = (W: Tensor) => xb.matmul(W).slice(1, h * d, (h + 1) * d);
    const q = cols(Wq), k = cols(Wk), v = cols(Wv);
    const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
    return q.matmul(k.T).mul(1 / Math.sqrt(d)).add(mask).softmax(-1).matmul(v);
  });
  return cat(outs, 1).matmul(Wo);
}

test('has shape (B, T, C) and equals running every head separately and concatenating', () => {
  const y = multiHead(x, Wq, Wk, Wv, Wo, heads);
  expect(y.shape).toEqual([B, T, C]);
  for (let b = 0; b < B; b++) {
    const r = reference(b);
    for (let t = 0; t < T; t++) for (let c = 0; c < C; c++) expect(y.get(b, t, c)).toBeCloseTo(r.get(t, c), 4);
  }
});

test('is causal: changing the last position changes its output but no earlier one', () => {
  const y1 = multiHead(x, Wq, Wk, Wv, Wo, heads);
  expect(Math.abs(y1.get(0, 0, 0) - x.get(0, 0, 0))).toBeGreaterThan(1e-4); // it must actually transform x
  const x2 = x.clone();
  for (let c = 0; c < C; c++) x2.set(5, 0, T - 1, c);
  const y2 = multiHead(x2, Wq, Wk, Wv, Wo, heads);
  for (let t = 0; t < T - 1; t++) for (let c = 0; c < C; c++) expect(y2.get(0, t, c)).toBeCloseTo(y1.get(0, t, c), 5);
  expect(Math.abs(y2.get(0, T - 1, 0) - y1.get(0, T - 1, 0))).toBeGreaterThan(1e-4);
});
