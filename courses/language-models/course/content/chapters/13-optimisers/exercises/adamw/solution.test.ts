import { expect, test } from '@lm/test';
import { step } from './solution.ts';

/** Train a weight whose gradient is pure noise of a given scale, with decay, and return |w|. */
function drift(mode: 'l2' | 'adamw', noise: number): number {
  let w = 1;
  const s = { m: 0, v: 0, t: 0 };
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < 2000; i++) w = step(w, noise * rnd(), s, 1e-3, 0.1, mode);
  return Math.abs(w);
}

test('with no gradient, AdamW decays the weight by exactly (1 − lr·wd) per step, after a zero Adam step', () => {
  const s = { m: 0, v: 0, t: 0 };
  expect(step(2, 0, s, 0.01, 0.5, 'adamw')).toBeCloseTo(2 * (1 - 0.005), 8);
});

test('L2 decay is normalised away: it barely shrinks weights with large, noisy gradients', () => {
  expect(step(1, 1, { m: 0, v: 0, t: 0 }, 0.01, 0, 'l2')).toBeCloseTo(0.99, 6); // a plain Adam step first
  expect(drift('l2', 100)).toBeGreaterThan(0.5);
});

test('AdamW decays every weight at the same rate, however noisy its gradient', () => {
  expect(drift('adamw', 100)).toBeLessThan(0.9);
  expect(Math.abs(drift('adamw', 100) - drift('adamw', 0.01))).toBeLessThan(0.1);
});
