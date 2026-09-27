import { expect, test } from '@lm/test';
import { crossEntropyBits } from './solution.ts';

test('a uniform model over 8 symbols costs 3 bits per token', () => {
  expect(crossEntropyBits(() => 1 / 8, [1, 2, 3, 4, 5, 6], 0)).toBeCloseTo(3, 10);
});

test('a perfect model costs 0 bits', () => {
  expect(crossEntropyBits(() => 1, [0, 1, 0, 1], 1)).toBe(0);
});

test('averages over predicted positions only', () => {
  // P = 1/2 for the first prediction, 1/4 for the second → (1 + 2) / 2 = 1.5 bits
  const probs = [0.5, 0.25];
  let i = 0;
  expect(crossEntropyBits(() => probs[i++]!, [9, 9, 9], 1)).toBeCloseTo(1.5, 10);
});

test('passes exactly the previous contextLength tokens', () => {
  const seen: number[][] = [];
  crossEntropyBits((ctx) => (seen.push(ctx), 1), [10, 11, 12, 13], 2);
  expect(seen).toEqual([
    [10, 11],
    [11, 12],
  ]);
});

test('any zero probability makes it infinite', () => {
  expect(crossEntropyBits((_, x) => (x === 3 ? 0 : 0.5), [1, 2, 3], 0)).toBe(Infinity);
});
