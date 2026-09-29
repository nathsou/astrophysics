import { expect, test } from '@lm/test';
import { topkSae } from './solution.ts';

// Three feature directions in 2-D (more features than dimensions), tied encoder and decoder.
const s = Math.sqrt(3) / 2;
const Wdec = [
  [1, 0],
  [-0.5, s],
  [-0.5, -s],
];
const Wenc = [
  [1, -0.5, -0.5],
  [0, s, -s],
];
const zero = [0, 0, 0];

test('one active feature is recovered exactly with k = 1', () => {
  const r = topkSae([-0.75, 1.5 * s], Wenc, zero, Wdec, [0, 0], 1); // 1.5 × feature 1
  expect(r.features[1]).toBeCloseTo(1.5, 10);
  expect(r.features[0]).toBe(0);
  expect(r.reconstruction[0]).toBeCloseTo(-0.75, 10);
});

test('k limits how many features fire', () => {
  const r = topkSae([1, 0.2], Wenc, zero, Wdec, [0, 0], 2);
  expect(r.features.filter((f) => f > 0).length).toBeLessThanOrEqual(2);
});

test('the decoder bias is subtracted before encoding and added back', () => {
  const r = topkSae([5, 5], Wenc, zero, Wdec, [5, 5], 1);
  expect(r.features).toEqual([0, 0, 0]);
  expect(r.reconstruction).toEqual([5, 5]);
});
