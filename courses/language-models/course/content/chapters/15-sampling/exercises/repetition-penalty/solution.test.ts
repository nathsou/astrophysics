import { expect, test } from '@lm/test';
import { frequencyPresencePenalty, repetitionPenalty } from './solution.ts';

test('positive logits are divided, negative ones multiplied', () => {
  expect(Array.from(repetitionPenalty([3, -1, 2], [0, 1], 1.5))).toEqual([2, -1.5, 2]);
});

test('a token counts once however often it occurred', () => {
  expect(Array.from(repetitionPenalty([4, 0], [0, 0, 0], 2))).toEqual([2, 0]);
});

test('θ = 1 changes nothing, and the input is not modified', () => {
  const z = Float64Array.of(1, -2);
  expect(Array.from(repetitionPenalty(z, [0, 1], 1))).toEqual([1, -2]);
  repetitionPenalty(z, [0, 1], 3);
  expect(Array.from(z)).toEqual([1, -2]);
});

test('frequency grows with the count; presence is paid once', () => {
  expect(Array.from(frequencyPresencePenalty([0, 0, 0], [0, 1, 1, 1], 0.5, 1))).toEqual([-1.5, -2.5, 0]);
});
