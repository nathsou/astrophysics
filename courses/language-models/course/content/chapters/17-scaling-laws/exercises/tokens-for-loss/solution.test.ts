import { expect, test } from '@lm/test';
import { tokensForLoss } from './solution.ts';

const law = { E: 1.69, A: 406.4, B: 410.7, alpha: 0.34, beta: 0.28 };
const L = (N: number, D: number) => law.E + law.A / N ** law.alpha + law.B / D ** law.beta;

test('inverts the law', () => {
  const D = tokensForLoss(7e9, 2.1, law);
  expect(L(7e9, D)).toBeCloseTo(2.1, 8);
});

test('smaller models need more data for the same loss', () => {
  expect(tokensForLoss(1e9, 2.3, law)).toBeGreaterThan(tokensForLoss(8e9, 2.3, law));
});

test('a loss below what the model size allows is unreachable', () => {
  expect(tokensForLoss(1e6, 2.0, law)).toBe(Infinity);
});
