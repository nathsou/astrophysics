import { describe, expect, test } from 'vitest';
import { crossoverPt, glucksternMeasurement, glucksternScattering, monteCarloResolution, ptFromRadiusMm, sagittaOf, simulateTrack } from './trackMc.ts';
import { rng } from '../../hep/random/index.ts';

const base = { B: 2, L: 1, n: 20, sigma: 50e-6, x0: 0 };

describe('the toy tracker of Chapter 5', () => {
  test('a track without errors gives back its radius and pT', () => {
    const t = simulateTrack({ ...base, sigma: 0 }, 10, rng(1), { scatter: false });
    // pT = 0.3 B R: R = 10 / (0.2998 × 2) = 16.68 m
    expect(t.R / 1000).toBeCloseTo(16.68, 1);
    expect(ptFromRadiusMm(t.R, 2)).toBeCloseTo(10, 6);
    const last = t.points.at(-1)!;
    expect(Math.hypot(last.x, last.y)).toBeCloseTo(1000, 0);
    // a positive particle turns clockwise: y < 0
    expect(last.y).toBeLessThan(0);
  });
  test('the sagitta rule s = 0.3 B L²/(8 pT)', () => {
    // the sagitta of the exact circle over the chord from the origin to the last point
    const pT = 5;
    const t = simulateTrack({ ...base, sigma: 0 }, pT, rng(1), { scatter: false });
    const s = sagittaOf(pT, 2, 1);
    const R = t.R;
    const exact = R - Math.sqrt(R * R - 500 * 500); // half chord 0.5 m → sagitta of the chord 1 m
    expect(s * 1000).toBeGreaterThan(0);
    expect(Math.abs(exact - s * 1000) / exact).toBeLessThan(0.02);
  });
  test('the measurement term agrees with Gluckstern’s formula within 20 % for N ≥ 10', () => {
    for (const n of [10, 20, 50]) {
      const s = { ...base, n };
      const mc = monteCarloResolution(s, 100, 2500, 7);
      const ratio = mc.sigma68 / glucksternMeasurement(100, s);
      expect(ratio).toBeGreaterThan(0.9);
      expect(ratio).toBeLessThan(1.25);
      expect(Math.abs(mc.mean)).toBeLessThan(0.15 * mc.sigma68);
    }
  });
  test('the measurement term scales as pT / (B L²) and as 1/√N', () => {
    const a = glucksternMeasurement(100, base);
    expect(glucksternMeasurement(200, base) / a).toBeCloseTo(2, 10);
    expect(glucksternMeasurement(100, { ...base, B: 4 }) / a).toBeCloseTo(0.5, 10);
    expect(glucksternMeasurement(100, { ...base, L: 2 }) / a).toBeCloseTo(0.25, 10);
    expect(glucksternMeasurement(100, { ...base, n: 76 }) / a).toBeCloseTo(Math.sqrt(24 / 80), 10);
  });
  test('the scattering term agrees with the Monte Carlo within 10 % and does not depend on pT', () => {
    for (const n of [10, 30]) {
      const s = { ...base, n, sigma: 1e-9, x0: 0.05 };
      const mc = monteCarloResolution(s, 5, 2500, 3);
      expect(mc.sigma68 / glucksternScattering(5, s)).toBeGreaterThan(0.9);
      expect(mc.sigma68 / glucksternScattering(5, s)).toBeLessThan(1.1);
    }
    const s = { ...base, sigma: 1e-9, x0: 0.05 };
    const lo = monteCarloResolution(s, 3, 2000, 4);
    const hi = monteCarloResolution(s, 12, 2000, 4);
    expect(hi.sigma68 / lo.sigma68).toBeGreaterThan(0.85);
    expect(hi.sigma68 / lo.sigma68).toBeLessThan(1.15);
  });
  test('the crossover where the two terms are equal', () => {
    const s = { ...base, x0: 0.05 };
    const p = crossoverPt(s);
    expect(glucksternMeasurement(p, s)).toBeCloseTo(glucksternScattering(p, s), 10);
    expect(p).toBeGreaterThan(1);
    expect(p).toBeLessThan(100);
  });
  test('it is deterministic for a seed', () => {
    const a = monteCarloResolution(base, 50, 50, 11);
    const b = monteCarloResolution(base, 50, 50, 11);
    expect(a.sigma68).toBe(b.sigma68);
  });
});
