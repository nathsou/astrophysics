import { expect, test } from '@lm/test';
import { Adam } from './solution.ts';

test('the first step moves each weight by lr in the direction of −sign(g), whatever |g| is', () => {
  const w = [Float32Array.of(0, 0, 0)];
  new Adam([3], 0.01).step(w, [Float32Array.of(1000, -0.001, 3)]);
  expect(Array.from(w[0]!).map((x) => +x.toFixed(5))).toEqual([-0.01, 0.01, -0.01]);
});

test('matches the formulas over three steps', () => {
  const w = [Float32Array.of(1)];
  const opt = new Adam([1], 0.1, 0.9, 0.999, 1e-8);
  const gs = [0.5, -0.2, 0.8];
  let m = 0, v = 0, x = 1;
  gs.forEach((g, i) => {
    m = 0.9 * m + 0.1 * g;
    v = 0.999 * v + 0.001 * g * g;
    x -= (0.1 * (m / (1 - 0.9 ** (i + 1)))) / (Math.sqrt(v / (1 - 0.999 ** (i + 1))) + 1e-8);
    opt.step(w, [Float32Array.of(g)]);
    expect(w[0]![0]!).toBeCloseTo(x, 5);
  });
  expect(opt.t).toBe(3);
});

test('handles several parameter arrays independently', () => {
  const w = [Float32Array.of(1, 1), Float32Array.of(2)];
  new Adam([2, 1], 0.5).step(w, [Float32Array.of(1, 0), Float32Array.of(-1)]);
  expect(w[0]![0]!).toBeCloseTo(0.5, 5);
  expect(w[0]![1]!).toBeCloseTo(1, 5);
  expect(w[1]![0]!).toBeCloseTo(2.5, 5);
});
