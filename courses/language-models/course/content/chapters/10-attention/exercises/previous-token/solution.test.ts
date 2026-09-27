import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { previousTokenHead } from './solution.ts';

const V = 4, T = 6;
const tokens = [2, 0, 3, 3, 1, 2];
const x = new Tensor(Float32Array.from({ length: T * (V + T) }, (_, i) => {
  const t = Math.floor(i / (V + T)), c = i % (V + T);
  return c < V ? (tokens[t] === c ? 1 : 0) : c - V === t ? 1 : 0;
}), [T, V + T]);

function attend(q: Tensor, k: Tensor, v: Tensor): Tensor {
  const mask = new Tensor(Float32Array.from({ length: T * T }, (_, i) => (i % T > Math.floor(i / T) ? -Infinity : 0)), [T, T]);
  return q.matmul(k.T).add(mask).softmax(-1).matmul(v);
}

test('the output at every position i ≥ 1 is the previous token', () => {
  const { Wq, Wk, Wv } = previousTokenHead(V, T);
  expect(Wv.shape).toEqual([V + T, V]);
  const out = attend(x.matmul(Wq), x.matmul(Wk), x.matmul(Wv));
  for (let i = 1; i < T; i++) {
    for (let c = 0; c < V; c++) expect(out.get(i, c)).toBeCloseTo(tokens[i - 1] === c ? 1 : 0, 2);
  }
});

test('works for other sizes and a gentler β', () => {
  const V2 = 3, T2 = 8, toks = [0, 1, 2, 2, 1, 0, 0, 1];
  const x2 = new Tensor(Float32Array.from({ length: T2 * (V2 + T2) }, (_, i) => {
    const t = Math.floor(i / (V2 + T2)), c = i % (V2 + T2);
    return c < V2 ? (toks[t] === c ? 1 : 0) : c - V2 === t ? 1 : 0;
  }), [T2, V2 + T2]);
  const { Wq, Wk, Wv } = previousTokenHead(V2, T2, 12);
  const mask = new Tensor(Float32Array.from({ length: T2 * T2 }, (_, i) => (i % T2 > Math.floor(i / T2) ? -Infinity : 0)), [T2, T2]);
  const out = x2.matmul(Wq).matmul(x2.matmul(Wk).T).add(mask).softmax(-1).matmul(x2.matmul(Wv));
  for (let i = 1; i < T2; i++) expect(out.get(i, toks[i - 1]!)).toBeGreaterThan(0.99);
});
