import { expect, test } from '@lm/test';
import { route } from './solution.ts';

test('picks the k highest-scoring experts, best first', () => {
  expect(route([0.1, 2, -1, 1.5], 2).experts).toEqual([1, 3]);
});

test('the gates are the chosen probabilities renormalised', () => {
  const { gates } = route([Math.log(4), Math.log(1), Math.log(3)], 2); // probabilities 0.5, 0.125, 0.375
  expect(gates[0]!).toBeCloseTo(0.5 / 0.875, 10);
  expect(gates[1]!).toBeCloseTo(0.375 / 0.875, 10);
});

test('top-1 gives the chosen expert a gate of 1', () => {
  expect(route([3, 1, 2], 1)).toEqual({ experts: [0], gates: [1] });
});
