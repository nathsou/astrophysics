import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { lstmStep } from './solution.ts';

const sig = (x: number) => 1 / (1 + Math.exp(-x));

test('computes the gates and states for one unit by the formulas', () => {
  // B = 1, H = 1: z = [i, f, o, g] pre-activations.
  const { h, c } = lstmStep(Tensor.from([[0.5, 2, -1, 0.3]]), Tensor.from([[0.8]]));
  const cn = sig(2) * 0.8 + sig(0.5) * Math.tanh(0.3);
  expect(c.item()).toBeCloseTo(cn, 5);
  expect(h.item()).toBeCloseTo(sig(-1) * Math.tanh(cn), 5);
});

test('keeps rows and units separate (B = 2, H = 2)', () => {
  const z = Tensor.from([[0, 0, 10, 10, 10, -10, 1, 1], [-10, -10, 10, 10, -10, -10, 0, 0]]);
  const { h, c } = lstmStep(z, Tensor.from([[1, 2], [3, 4]]));
  // Row 0: forget ≈ 1, input 0.5, candidate tanh(1). Row 1: input ≈ 0 so c′ ≈ c; output ≈ 0 so h′ ≈ 0.
  expect(c.get(0, 0)).toBeCloseTo(1 + 0.5 * Math.tanh(1), 3);
  expect(c.get(0, 1)).toBeCloseTo(2 + 0.5 * Math.tanh(1), 3);
  expect(c.get(1, 1)).toBeCloseTo(4, 3);
  expect(Math.abs(h.get(1, 0))).toBeLessThan(1e-3);
  expect(h.get(0, 1)).toBeCloseTo(sig(-10) * Math.tanh(2 + 0.5 * Math.tanh(1)), 5);
});

test('with the forget gate open and nothing written, the cell carries its gradient unchanged', () => {
  const c = Tensor.from([[0.3, -0.7]], undefined, { requiresGrad: true });
  const z = Tensor.from([[-30, -30, 30, 30, 0, 0, 0, 0]]);
  const out = lstmStep(z, c);
  expect(out.h.get(0, 0)).toBeCloseTo(0.5 * Math.tanh(0.3), 4); // output gate σ(0) = 0.5
  out.c.sum().backward();
  expect(Array.from(c.grad!.toFloat32Array()).map((x) => +x.toFixed(4))).toEqual([1, 1]);
});
