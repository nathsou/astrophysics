import { expect, test } from '@lm/test';
import { mulberry32, sampleIndex } from '@lm/core';
import { verify } from './solution.ts';

test('the first token is distributed as the target, however bad the draft', () => {
  const p = [0.6, 0.3, 0.1], q = [0.05, 0.15, 0.8];
  const rng = mulberry32(5);
  const counts = [0, 0, 0];
  const n = 30000;
  for (let i = 0; i < n; i++) counts[verify([p, p], [q], [sampleIndex(q, rng())], rng)[0]!]!++;
  counts.forEach((c, i) => expect(c / n).toBeCloseTo(p[i]!, 1));
});

test('a perfect draft is always accepted, plus a bonus token', () => {
  const p = [0, 0, 1];
  expect(verify([p, p, p, p], [p, p, p], [2, 2, 2], mulberry32(1))).toEqual([2, 2, 2, 2]);
});

test('stops at the first rejection', () => {
  // The draft proposes token 0, which the target never produces: rejected, replaced by token 1.
  const p = [0, 1], q = [1, 0];
  expect(verify([p, p, p], [q, q], [0, 0], mulberry32(2))).toEqual([1]);
});
