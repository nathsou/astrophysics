import { expect, test } from '@lm/test';
import { Tensor, nn } from '@lm/core/tensor';
import { mulberry32 } from '@lm/core';
import { rnnForward, type RnnParams } from './solution.ts';

const V = 5, D = 3, H = 4;
const make = (): RnnParams => {
  const rng = mulberry32(3);
  const r = (shape: number[]) => Tensor.randn(shape, { rng, std: 0.7, requiresGrad: true });
  return { E: r([V, D]), W: r([D, H]), b: r([H]), U: r([H, H]), Wy: r([H, V]), by: r([V]) };
};
const ids = [[0, 1, 2, 3], [4, 4, 0, 1]];

test('returns time-major logits (T·B, V) and the final state (B, H)', () => {
  const { logits, h } = rnnForward(make(), ids, Tensor.zeros([2, H]));
  expect(logits.shape).toEqual([8, V]);
  expect(h.shape).toEqual([2, H]);
});

test('matches the recurrence computed by hand', () => {
  const p = make();
  const at = (t: Tensor, ...i: number[]) => t.get(...i);
  // Sequence 1 (the second row), by explicit loops.
  const seq = ids[1]!;
  let h = new Array(H).fill(0);
  const want: number[][] = [];
  for (const x of seq) {
    h = Array.from({ length: H }, (_, j) => {
      let z = at(p.b, j);
      for (let d = 0; d < D; d++) z += at(p.E, x, d) * at(p.W, d, j);
      for (let i = 0; i < H; i++) z += h[i]! * at(p.U, i, j);
      return Math.tanh(z);
    });
    want.push(Array.from({ length: V }, (_, v) => h.reduce((a, hi, i) => a + hi * at(p.Wy, i, v), at(p.by, v))));
  }
  const { logits } = rnnForward(p, ids, Tensor.zeros([2, H]));
  want.forEach((row, t) => row.forEach((v, k) => expect(logits.get(t * 2 + 1, k)).toBeCloseTo(v, 4)));
});

test('carrying the state across chunks equals running the whole sequence', () => {
  const p = make();
  const whole = rnnForward(p, ids, Tensor.zeros([2, H]));
  const first = rnnForward(p, ids.map((s) => s.slice(0, 2)), Tensor.zeros([2, H]));
  const second = rnnForward(p, ids.map((s) => s.slice(2)), first.h);
  expect(Math.max(...Array.from(whole.h.toFloat32Array(), Math.abs))).toBeGreaterThan(0);
  expect(Array.from(second.h.toFloat32Array()).map((x) => +x.toFixed(5))).toEqual(Array.from(whole.h.toFloat32Array()).map((x) => +x.toFixed(5)));
});

test('gradients reach the recurrent weights', () => {
  const p = make();
  const { logits } = rnnForward(p, ids, Tensor.zeros([2, H]));
  nn.crossEntropy(logits, [1, 4, 2, 0, 3, 1, 4, 2]).backward();
  expect(p.U.grad).toBeDefined();
  expect(Math.max(...Array.from(p.U.grad!.toFloat32Array(), Math.abs))).toBeGreaterThan(0);
});
