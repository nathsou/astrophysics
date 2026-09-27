import { expect, test } from '@lm/test';
import { mulberry32 } from '@lm/core';
import { gumbelSample } from './solution.ts';

function frequencies(logits: number[], T: number, n: number): number[] {
  const rng = mulberry32(42);
  const counts = logits.map(() => 0);
  for (let i = 0; i < n; i++) counts[gumbelSample(logits, T, rng)]!++;
  return counts.map((c) => c / n);
}
const softmax = (z: number[], T: number) => {
  const e = z.map((x) => Math.exp(x / T));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

test('samples follow softmax(z)', () => {
  const z = [1, 0, -1, 2];
  const want = softmax(z, 1);
  frequencies(z, 1, 40000).forEach((f, i) => expect(f).toBeCloseTo(want[i]!, 1));
});

test('temperature sharpens or flattens the distribution', () => {
  const z = [1, 0, -1, 2];
  const cold = frequencies(z, 0.25, 20000), hot = frequencies(z, 4, 20000);
  expect(cold[3]!).toBeGreaterThan(0.95);
  softmax(z, 4).forEach((p, i) => expect(hot[i]!).toBeCloseTo(p, 1));
});

test('never picks a token with logit −∞', () => {
  expect(frequencies([0, -Infinity, 0], 1, 5000)[1]).toBe(0);
});
