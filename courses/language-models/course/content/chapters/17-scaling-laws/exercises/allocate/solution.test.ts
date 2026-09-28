import { expect, test } from '@lm/test';
import { allocate } from './solution.ts';

// Hoffmann et al.'s fitted law (nats per token on their data).
const chinchilla = { E: 1.69, A: 406.4, B: 410.7, alpha: 0.34, beta: 0.28 };

test('spends exactly the budget', () => {
  const { N, D } = allocate(1e21, chinchilla);
  expect((6 * N * D) / 1e21).toBeCloseTo(1, 10);
});

test('is a minimum: nudging N either way along the budget raises the loss', () => {
  const C = 1e20;
  const law = (N: number, D: number) => chinchilla.E + chinchilla.A / N ** chinchilla.alpha + chinchilla.B / D ** chinchilla.beta;
  const { N, loss } = allocate(C, chinchilla);
  expect(loss).toBeCloseTo(law(N, C / (6 * N)), 10);
  for (const f of [0.8, 1.25]) expect(law(N * f, C / (6 * N * f))).toBeGreaterThan(loss);
});

test('equal exponents split compute evenly: N and D both grow as √C', () => {
  const law = { E: 1, A: 100, B: 100, alpha: 0.3, beta: 0.3 };
  const a = allocate(1e18, law), b = allocate(4e18, law);
  expect(b.N / a.N).toBeCloseTo(2, 8);
  expect(b.D / a.D).toBeCloseTo(2, 8);
});
