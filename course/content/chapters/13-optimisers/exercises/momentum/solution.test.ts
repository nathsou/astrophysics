import { expect, test } from '@lm/test';
import { Momentum } from './solution.ts';

test('the first step is plain SGD; later steps build up speed', () => {
  const w = [Float32Array.of(1)];
  const opt = new Momentum([1], 0.1, 0.9);
  opt.step(w, [Float32Array.of(1)]);
  expect(w[0]![0]!).toBeCloseTo(0.9, 6);
  opt.step(w, [Float32Array.of(1)]); // v = 0.9 + 1 = 1.9
  expect(w[0]![0]!).toBeCloseTo(0.9 - 0.19, 6);
});

test('with a constant gradient, the step approaches lr·g / (1 − β)', () => {
  const w = [Float32Array.of(0)];
  const opt = new Momentum([1], 0.01, 0.9);
  let prev = 0;
  for (let i = 0; i < 200; i++) {
    prev = w[0]![0]!;
    opt.step(w, [Float32Array.of(1)]);
  }
  expect(prev - w[0]![0]!).toBeCloseTo(0.1, 4);
});

test('minimises an ill-conditioned quadratic faster than SGD at the same stable learning rate', () => {
  const run = (beta: number) => {
    const w = [Float32Array.of(5, 5)];
    const opt = new Momentum([2], 0.015, beta);
    for (let i = 0; i < 100; i++) opt.step(w, [Float32Array.of(w[0]![0]! * 1, w[0]![1]! * 100)]);
    return Math.hypot(w[0]![0]!, w[0]![1]!);
  };
  expect(run(0.9)).toBeLessThan(run(0) / 10);
});
