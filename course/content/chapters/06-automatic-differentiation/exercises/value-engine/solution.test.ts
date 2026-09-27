import { expect, test } from '@lm/test';
import { Tensor } from '@lm/core/tensor';
import { Value } from './solution.ts';

test('a single neuron: tanh(w·x + b)', () => {
  const w = new Value(0.8), x = new Value(2), b = new Value(-0.5);
  const y = w.mul(x).add(b).tanh();
  y.backward();
  const t = Math.tanh(0.8 * 2 - 0.5);
  expect(y.data).toBeCloseTo(t, 12);
  expect(w.grad).toBeCloseTo((1 - t * t) * 2, 12);
  expect(x.grad).toBeCloseTo((1 - t * t) * 0.8, 12);
  expect(b.grad).toBeCloseTo(1 - t * t, 12);
});

test('a value used twice accumulates both paths', () => {
  const x = new Value(3);
  x.mul(x).add(x).backward(); // d/dx (x² + x) = 2x + 1
  expect(x.grad).toBeCloseTo(7, 12);
});

test('diamond-shaped graphs are handled in topological order', () => {
  const a = new Value(2);
  const b = a.mul(3);
  const c = a.pow(2);
  const d = b.mul(c).exp().pow(0.5); // e^{3a³/2}
  d.backward();
  expect(a.grad).toBeCloseTo(Math.exp(1.5 * 8) * 4.5 * 4, 6);
});

test('matches the course library on a composite expression', () => {
  const [av, bv, cv] = [0.3, -1.2, 0.8];
  const a = new Value(av), b = new Value(bv), c = new Value(cv);
  a.mul(b).add(c).tanh().sub(a.exp().mul(c)).pow(2).backward();
  const A = Tensor.from([av], []).requiresGrad_(), B = Tensor.from([bv], []).requiresGrad_(), C = Tensor.from([cv], []).requiresGrad_();
  A.mul(B).add(C).tanh().sub(A.exp().mul(C)).pow(2).backward();
  expect(a.grad).toBeCloseTo(A.grad!.item(), 5);
  expect(b.grad).toBeCloseTo(B.grad!.item(), 5);
  expect(c.grad).toBeCloseTo(C.grad!.item(), 5);
});
