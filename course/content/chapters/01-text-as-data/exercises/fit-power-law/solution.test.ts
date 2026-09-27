import { expect, test } from '@lm/test';
import { fitPowerLaw } from './solution.ts';

const ranks = Array.from({ length: 200 }, (_, i) => i + 1);

test('recovers an exact power law', () => {
  const fit = fitPowerLaw(ranks, ranks.map((r) => 500 / r ** 1.2));
  expect(fit.s).toBeCloseTo(1.2, 6);
  expect(fit.C).toBeCloseTo(500, 3);
  expect(fit.r2).toBeCloseTo(1, 6);
});

test('handles noisy data', () => {
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.2;
  const fit = fitPowerLaw(ranks, ranks.map((r) => (1000 / r) * Math.exp(noise())));
  expect(fit.s).toBeCloseTo(1, 1);
  expect(fit.r2).toBeGreaterThan(0.95);
  expect(fit.r2).toBeLessThan(1);
});

test('ignores non-positive points', () => {
  const fit = fitPowerLaw([0, 1, 2, 4, -3], [5, 8, 4, 2, 9]);
  expect(fit.s).toBeCloseTo(1, 6);
  expect(fit.C).toBeCloseTo(8, 6);
});
