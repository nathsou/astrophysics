import { expect, test } from '@lm/test';
import { rmsNorm } from './solution.ts';

const ones = (n: number) => new Float32Array(n).fill(1);

test('the output has root mean square 1 (with unit gains)', () => {
  const y = rmsNorm(Float32Array.of(3, -4, 1, 2), ones(4), 0);
  expect(Math.sqrt(y.reduce((a, v) => a + v * v, 0) / 4)).toBeCloseTo(1, 6);
});

test('it does not subtract the mean: a constant vector stays constant (and positive)', () => {
  expect(Array.from(rmsNorm(Float32Array.of(5, 5, 5), ones(3), 0))).toEqual([1, 1, 1]);
});

test('gains scale each coordinate', () => {
  const y = rmsNorm(Float32Array.of(1, -1), Float32Array.of(2, 3), 0);
  expect(Array.from(y)).toEqual([2, -3]);
});

test('scaling the input does not change the output', () => {
  const a = rmsNorm(Float32Array.of(0.1, 0.4, -0.3), ones(3), 0), b = rmsNorm(Float32Array.of(10, 40, -30), ones(3), 0);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));
});
