import { expect, test } from 'vitest';
import { intensityCoherent, intensityWhichPath, phaseDifference, phasors } from './phasor.ts';

const s = { aOverLambda: 4, ratio: 1 };
test('equal amplitudes: |A₁+A₂|² = 2 + 2 cos δ, from 0 to 4', () => {
  for (const th of [0, 0.1, 0.25, 0.4]) {
    const d = phaseDifference(s, th);
    expect(intensityCoherent(s, th)).toBeCloseTo(2 + 2 * Math.cos(d), 12);
  }
  expect(intensityCoherent(s, 0)).toBeCloseTo(4, 12);
  // first dark fringe: δ = π → sin θ = 1/(2 a/λ)
  expect(intensityCoherent(s, Math.asin(1 / (2 * s.aOverLambda)))).toBeCloseTo(0, 10);
});
test('unequal amplitudes leave the dark fringes partly filled; recording the path removes the fringes and conserves the average', () => {
  const u = { aOverLambda: 4, ratio: 0.5 };
  expect(intensityCoherent(u, Math.asin(1 / 8))).toBeCloseTo((1 - 0.5) ** 2, 12);
  expect(intensityWhichPath(u)).toBeCloseTo(1.25, 12);
  // the average of the coherent pattern over a full fringe equals the which-path value
  let sum = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) sum += intensityCoherent({ aOverLambda: 1, ratio: 0.5 }, Math.asin((i + 0.5) / n));
  expect(sum / n).toBeCloseTo(1.25, 2);
  const ph = phasors(u, 0.3);
  expect(Math.hypot(...ph.a1)).toBeCloseTo(1, 12);
  expect(Math.hypot(...ph.a2)).toBeCloseTo(0.5, 12);
});
