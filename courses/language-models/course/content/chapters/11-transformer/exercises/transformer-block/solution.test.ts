import { expect, test } from '@lm/test';
import { Tensor, nn } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { block, type BlockParams } from './solution.ts';

const B = 2, T = 3, C = 8, heads = 2;
const rng = mulberry32(21);
const r = (shape: number[], std = 0.3) => Tensor.randn(shape, { rng, std });
const p: BlockParams = {
  ln1g: Tensor.ones([C]), ln1b: Tensor.zeros([C]),
  W: { q: r([C, C]), k: r([C, C]), v: r([C, C]), o: r([C, C]) },
  ln2g: Tensor.ones([C]), ln2b: Tensor.zeros([C]),
  W1: r([C, 4 * C]), W2: r([4 * C, C]),
};
const x = r([B, T, C], 1);

test('keeps the shape of the residual stream', () => {
  const y = block(x, p, heads);
  expect(y.shape).toEqual([B, T, C]);
  expect(Math.abs(y.get(0, 0, 0) - x.get(0, 0, 0))).toBeGreaterThan(1e-5);
});

test('with zero output projections the block is the identity (the residual path)', () => {
  const zero = { ...p, W: { ...p.W, o: Tensor.zeros([C, C]) }, W2: Tensor.zeros([4 * C, C]) };
  const y = block(x, zero, heads);
  expect(Math.abs(block(x, p, heads).get(1, 2, 3) - x.get(1, 2, 3))).toBeGreaterThan(1e-5); // …and not otherwise
  for (let i = 0; i < B * T * C; i++) expect(y.toFloat32Array()[i]!).toBeCloseTo(x.toFloat32Array()[i]!, 6);
});

test('the MLP branch sees a normalised input: scaling x by 100 does not blow it up', () => {
  const noAttn = { ...p, W: { ...p.W, o: Tensor.zeros([C, C]) } };
  const big = x.mul(100);
  const branch = block(big, noAttn, heads).sub(big); // just the MLP's contribution
  const small = block(x, noAttn, heads).sub(x);
  expect(Math.max(...Array.from(small.toFloat32Array(), Math.abs))).toBeGreaterThan(1e-3);
  for (let i = 0; i < 10; i++) expect(branch.toFloat32Array()[i]!).toBeCloseTo(small.toFloat32Array()[i]!, 2);
});

test('is causal: the first position ignores later ones', () => {
  const x2 = x.clone();
  for (let c = 0; c < C; c++) x2.set(3, 0, T - 1, c);
  const a = block(x, p, heads), b = block(x2, p, heads);
  for (let c = 0; c < C; c++) expect(b.get(0, 0, c)).toBeCloseTo(a.get(0, 0, c), 5);
  expect(Math.abs(a.get(0, 0, 0) - x.get(0, 0, 0))).toBeGreaterThan(1e-5);
  void nn;
});
