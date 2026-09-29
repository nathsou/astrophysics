import { expect, test } from '@lm/test';
import { swiglu } from './solution.ts';

const silu = (z: number) => z / (1 + Math.exp(-z));

test('one input, one hidden unit, one output', () => {
  // x = 2, Wg = 1.5, W1 = −0.5, W2 = 3  →  3 · silu(3) · (−1)
  const y = swiglu(Float32Array.of(2), Float32Array.of(1.5), Float32Array.of(-0.5), Float32Array.of(3), 1);
  expect(y[0]!).toBeCloseTo(3 * silu(3) * -1, 5);
});

test('a closed gate blocks the value', () => {
  // A very negative gate pre-activation makes SiLU ≈ 0, whatever the value path says.
  const y = swiglu(Float32Array.of(1), Float32Array.of(-40), Float32Array.of(100), Float32Array.of(1), 1);
  expect(Math.abs(y[0]!)).toBeLessThan(1e-12 * 100 + 1e-9);
});

test('matches a direct computation for C = 2, H = 3', () => {
  const x = Float32Array.of(0.5, -1);
  const Wg = Float32Array.of(1, 0, -1, 2, 1, 0), W1 = Float32Array.of(0.5, 1, 1, -1, 0, 2), W2 = Float32Array.of(1, 0, 0, 1, 1, 1);
  const u = [0, 1, 2].map((j) => silu(x[0]! * Wg[j]! + x[1]! * Wg[3 + j]!) * (x[0]! * W1[j]! + x[1]! * W1[3 + j]!));
  const y = swiglu(x, Wg, W1, W2, 3);
  expect(y[0]!).toBeCloseTo(u[0]! + u[2]!, 5);
  expect(y[1]!).toBeCloseTo(u[1]! + u[2]!, 5);
});
