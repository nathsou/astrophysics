/// <reference types="node" />
/**
 * Every operation and its gradient checked against PyTorch (fixture: training/lmcourse/fixtures.py).
 * Inputs are float64 in PyTorch and float32 here, so we compare with a relative tolerance.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Tensor } from './tensor.ts';
import { crossEntropy, embedding, layerNorm } from './nn.ts';

interface Enc {
  shape: number[];
  data: number[];
}
interface Case {
  name: string;
  inputs: Enc[];
  out: Enc;
  upstream: Enc;
  grads: (Enc | null)[];
  targets?: number[];
  ids?: number[];
}

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const { cases } = JSON.parse(readFileSync(root('training/fixtures/tensor_ops.json'), 'utf8')) as { cases: Case[] };

const OPS: Record<string, (x: Tensor[], c: Case) => Tensor> = {
  add_broadcast: ([a, b]) => a!.add(b!),
  sub: ([a, b]) => a!.sub(b!),
  mul_broadcast: ([a, b]) => a!.mul(b!),
  div: ([a, b]) => a!.div(b!),
  pow3: ([a]) => a!.pow(3),
  exp: ([a]) => a!.exp(),
  log: ([a]) => a!.log(),
  sqrt: ([a]) => a!.sqrt(),
  tanh: ([a]) => a!.tanh(),
  sigmoid: ([a]) => a!.sigmoid(),
  relu: ([a]) => a!.relu(),
  gelu: ([a]) => a!.gelu(),
  sum_all: ([a]) => a!.sum(),
  sum_dim1: ([a]) => a!.sum(1),
  sum_dims02_keep: ([a]) => a!.sum([0, 2], true),
  mean_last: ([a]) => a!.mean(-1),
  max_dim1: ([a]) => a!.max(1),
  logsumexp_last: ([a]) => a!.logsumexp(-1),
  softmax_last: ([a]) => a!.softmax(-1),
  softmax_dim0: ([a]) => a!.softmax(0),
  log_softmax_last: ([a]) => a!.logSoftmax(-1),
  matmul_2d: ([a, b]) => a!.matmul(b!),
  matmul_batched: ([a, b]) => a!.matmul(b!),
  matmul_broadcast_batch: ([a, b]) => a!.matmul(b!),
  matmul_vec_mat: ([a, b]) => a!.matmul(b!),
  matmul_mat_vec: ([a, b]) => a!.matmul(b!),
  transpose_matmul: ([a, b]) => a!.T.matmul(b!),
  permute_reshape: ([a]) => a!.permute(2, 0, 1).reshape(4, 6).mul(2),
  slice_mul: ([a]) => a!.slice(1, 1, 3).mul(a!.slice(1, 0, 2)),
  expand_add: ([a, b]) => a!.expand(3, 4).add(b!),
  cross_entropy: ([z], c) => crossEntropy(z!, c.targets!),
  embedding: ([w], c) => embedding(w!, c.ids!),
  layer_norm: ([x, g, b]) => layerNorm(x!, g!, b!, 1e-5),
  mlp_loss: ([x, w1, b1, w2], c) => crossEntropy(x!.matmul(w1!).add(b1!).tanh().matmul(w2!), c.targets!),
};

const close = (got: ArrayLike<number>, want: number[], tol = 2e-4) => {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) {
    const err = Math.abs(got[i]! - want[i]!) / Math.max(1, Math.abs(want[i]!));
    if (err > tol) throw new Error(`element ${i}: got ${got[i]}, want ${want[i]} (rel. error ${err.toExponential(2)})`);
  }
};

describe('tensor ops match PyTorch (forward and backward)', () => {
  it('covers every fixture case', () => {
    expect(cases.map((c) => c.name).filter((n) => !OPS[n])).toEqual([]);
  });
  for (const c of cases) {
    it(c.name, () => {
      const inputs = c.inputs.map((e) => Tensor.from(e.data, e.shape, { requiresGrad: true }));
      const out = OPS[c.name]!(inputs, c);
      expect(out.shape).toEqual(c.out.shape);
      close(out.toFloat32Array(), c.out.data);
      const loss = out.size === 1 && out.ndim === 0 ? out : out.mul(Tensor.from(c.upstream.data, c.upstream.shape)).sum();
      loss.backward();
      c.grads.forEach((g, i) => {
        if (!g) return;
        const got = inputs[i]!.grad;
        if (!got) throw new Error(`no gradient for input ${i}`);
        expect(got.shape).toEqual(g.shape);
        close(got.toFloat32Array(), g.data);
      });
    });
  }
});
