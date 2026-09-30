import { expect, test } from '@lm/test';
import { pickOption } from './solution.ts';

const opts = [
  { logprob: -12, tokens: 4 }, // −3 per token
  { logprob: -20, tokens: 10 }, // −2 per token
  { logprob: -15, tokens: 3 }, // −5 per token
];

test('the sum favours short, likely options', () => {
  expect(pickOption(opts, 'sum')).toBe(0);
});

test('the mean favours the best per-token fit', () => {
  expect(pickOption(opts, 'mean')).toBe(1);
});

test('ties go to the first option', () => {
  expect(pickOption([{ logprob: -4, tokens: 2 }, { logprob: -4, tokens: 2 }], 'sum')).toBe(0);
});
