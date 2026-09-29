import { expect, test } from '@lm/test';
import { sftExample } from './solution.ts';

test('targets are the next tokens, masked inside the prompt', () => {
  // prompt [9, 1, 2], response [5, 6], eot 0 → ids [9, 1, 2, 5, 6, 0]
  expect(sftExample([9, 1, 2], [5, 6], 0, 100)).toEqual({ input: [9, 1, 2, 5, 6], target: [-100, -100, 5, 6, 0] });
});

test('the model learns to stop: the end-of-text token is a target', () => {
  const { target } = sftExample([1], [2], 0, 100);
  expect(target.at(-1)).toBe(0);
});

test('cut to the context length', () => {
  const r = sftExample([1, 2], [3, 4, 5, 6], 0, 3);
  expect(r.input).toEqual([1, 2, 3]);
  expect(r.target).toEqual([-100, 3, 4]);
});
