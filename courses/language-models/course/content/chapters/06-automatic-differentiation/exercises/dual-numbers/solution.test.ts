import { expect, test } from '@lm/test';
import { Dual, derivative } from './solution.ts';

const c = (k: number) => new Dual(k, 0); // a constant has zero derivative

test('product rule', () => {
  expect(derivative((x) => x.mul(x), 3)).toBeCloseTo(6, 12);
  expect(derivative((x) => x.mul(x).mul(x).add(c(5).mul(x)), 2)).toBeCloseTo(3 * 4 + 5, 12);
});

test('chain rule through sin and exp', () => {
  expect(derivative((x) => x.sin(), 0.4)).toBeCloseTo(Math.cos(0.4), 12);
  expect(derivative((x) => x.mul(x).exp(), 0.7)).toBeCloseTo(2 * 0.7 * Math.exp(0.49), 12);
  expect(derivative((x) => x.exp().sin(), 1.1)).toBeCloseTo(Math.cos(Math.exp(1.1)) * Math.exp(1.1), 12);
});

test('the value is carried along too', () => {
  const r = new Dual(0.7, 1).mul(new Dual(0.7, 1)).exp();
  expect(r.v).toBeCloseTo(Math.exp(0.49), 12);
});
