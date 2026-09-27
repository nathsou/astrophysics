import { expect, test } from '@lm/test';
import { LossScaler } from './solution.ts';

test('unscales finite gradients in place and allows the step', () => {
  const s = new LossScaler(1024);
  const g = [Float32Array.of(1024, -512), Float32Array.of(2048)];
  expect(s.update(g)).toBe(true);
  expect(Array.from(g[0]!)).toEqual([1, -0.5]);
  expect(g[1]![0]).toBe(2);
  expect(s.scale).toBe(1024);
});

test('an overflow skips the step, leaves the gradients alone and halves the scale', () => {
  const s = new LossScaler(1024);
  const g = [Float32Array.of(1, Infinity)];
  expect(s.update(g)).toBe(false);
  expect(g[0]![0]).toBe(1);
  expect(s.scale).toBe(512);
  expect(s.update([Float32Array.of(NaN)])).toBe(false);
  expect(s.scale).toBe(256);
});

test('grows the scale after growthInterval good steps in a row', () => {
  const s = new LossScaler(8, 3);
  s.update([Float32Array.of(1)]);
  s.update([Float32Array.of(1)]);
  expect(s.scale).toBe(8);
  s.update([Float32Array.of(1)]);
  expect(s.scale).toBe(16);
  expect(s.goodSteps).toBe(0);
});

test('an overflow resets the count of good steps', () => {
  const s = new LossScaler(8, 3);
  s.update([Float32Array.of(1)]);
  s.update([Float32Array.of(1)]);
  s.update([Float32Array.of(-Infinity)]);
  s.update([Float32Array.of(1)]);
  s.update([Float32Array.of(1)]);
  expect(s.scale).toBe(4);
  s.update([Float32Array.of(1)]);
  expect(s.scale).toBe(8);
});
