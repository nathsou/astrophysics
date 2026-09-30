import { describe, expect, test } from 'vitest';
import { besselI, besselI0, besselI1, besselIScaled, besselRatio } from './bessel.ts';

/** Independent check: I_n(x) = (1/π) ∫₀^π e^{x cos θ} cos(nθ) dθ, by the trapezoid rule (exponentially convergent). */
function integral(n: number, x: number, N = 4000): number {
  let s = 0;
  for (let j = 0; j <= N; j++) {
    const th = (Math.PI * j) / N;
    const w = j === 0 || j === N ? 0.5 : 1;
    s += w * Math.exp(x * (Math.cos(th) - 1)) * Math.cos(n * th);
  }
  return (s / N) ; // e^{-x} I_n(x)
}

describe('modified Bessel functions', () => {
  test('known values', () => {
    expect(besselI0(1)).toBeCloseTo(1.2660658777520082, 12);
    expect(besselI1(1)).toBeCloseTo(0.5651591039924851, 12);
    expect(besselI0(2)).toBeCloseTo(2.2795853023360673, 12);
    expect(besselI1(2)).toBeCloseTo(1.5906368546373291, 12);
    expect(besselI0(5) / 27.239871823604442).toBeCloseTo(1, 13);
    expect(besselI1(5) / 24.335642142450527).toBeCloseTo(1, 13);
    expect(besselI0(10) / 2815.7166284662544).toBeCloseTo(1, 13);
    expect(besselI1(10) / 2670.988303701254).toBeCloseTo(1, 13);
    expect(besselI0(0)).toBe(1);
    expect(besselI1(0)).toBe(0);
  });
  test('agrees with the integral representation across the series/asymptotic switch', () => {
    for (const n of [0, 1, 2, 3]) {
      for (const x of [0.01, 0.5, 3, 12, 29.9, 30.1, 45, 100, 400]) {
        const ref = integral(n, x, 6000);
        // the integral itself loses relative accuracy for tiny I_n (cancellation), so compare with I_0 as the scale
        expect(Math.abs(besselIScaled(n, x) - ref)).toBeLessThan(1e-12 * integral(0, x, 6000));
      }
    }
  });
  test('recurrence I_{n−1} − I_{n+1} = (2n/x) I_n, including the asymptotic branch', () => {
    for (const x of [0.3, 2, 20, 35, 80, 250]) {
      for (const n of [1, 2, 4]) {
        const lhs = besselIScaled(n - 1, x) - besselIScaled(n + 1, x);
        const rhs = ((2 * n) / x) * besselIScaled(n, x);
        expect(lhs / rhs).toBeCloseTo(1, 9);
      }
    }
  });
  test('derivative I0′ = I1 and the limits of the ratio', () => {
    for (const x of [0.5, 4, 40]) {
      const h = 1e-5 * x;
      const d = (besselI(0, x + h) - besselI(0, x - h)) / (2 * h);
      expect(d / besselI1(x)).toBeCloseTo(1, 7);
    }
    expect(besselRatio(1e-3)).toBeCloseTo(0.5e-3, 8);
    expect(besselRatio(1000)).toBeCloseTo(1 - 1 / 2000 - 1 / (8 * 1e6), 6);
    expect(besselRatio(1)).toBeCloseTo(0.4463899658, 9);
  });
  test('no overflow in the scaled function', () => {
    expect(Number.isFinite(besselIScaled(0, 5000))).toBe(true);
    expect(besselIScaled(0, 5000)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI * 5000), 4);
  });
});
