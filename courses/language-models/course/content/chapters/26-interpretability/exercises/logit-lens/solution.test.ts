import { expect, test } from '@lm/test';
import { logitLens } from './solution.ts';

const E = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

test('normalises, then unembeds', () => {
  const z = logitLens([3, 1, 2], [1, 1, 1], [0, 0, 0], E);
  const sd = Math.sqrt(2 / 3 + 1e-5);
  expect(z[0]).toBeCloseTo(1 / sd, 6);
  expect(z[1]).toBeCloseTo(-1 / sd, 6);
  expect(z[2]).toBeCloseTo(0, 6);
});

test('the scale of h does not matter, its direction does', () => {
  const a = logitLens([3, 1, 2], [1, 2, 1], [0.5, 0, 0], E);
  const b = logitLens([30, 10, 20], [1, 2, 1], [0.5, 0, 0], E);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 3));
});
