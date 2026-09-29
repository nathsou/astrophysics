import { expect, test } from '@lm/test';
import { rope } from './solution.ts';

const dot = (a: Float32Array, b: Float32Array) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const q = Float32Array.of(0.3, -1.2, 0.8, 0.5, 1.1, -0.4, 0.2, 0.9);
const k = Float32Array.of(-0.7, 0.4, 1.3, -0.2, 0.6, 0.8, -1, 0.1);

test('position 0 changes nothing', () => {
  Array.from(rope(q, 0)).forEach((v, i) => expect(v).toBeCloseTo(q[i]!, 6));
});

test('rotation preserves length', () => {
  expect(Math.sqrt(dot(rope(q, 37), rope(q, 37)))).toBeCloseTo(Math.sqrt(dot(q, q)), 5);
});

test('the first pair turns by one radian per position', () => {
  const r = rope(Float32Array.of(1, 0, 0, 0), 1);
  expect(r[0]!).toBeCloseTo(Math.cos(1), 6);
  expect(r[2]!).toBeCloseTo(Math.sin(1), 6);
});

test('scores depend only on the distance between positions', () => {
  expect(dot(rope(q, 12), rope(k, 5))).toBeCloseTo(dot(rope(q, 107), rope(k, 100)), 4);
});
