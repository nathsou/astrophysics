import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { clopperPearson, garwood, poissonCdf, poissonPmf, poissonQuantile, poissonSample, poissonSf, poissonTail, pToZ, zToP } from './counting.ts';
import { betaInc, chi2Sf, erf, erfc, gammaP, gammaQ, lnGamma, normalCdf, normalQuantile, normalSf, normalUpperQuantile } from './special.ts';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe('special functions', () => {
  test('erf and erfc against known values', () => {
    expect(erf(0)).toBe(0);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 14);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 14);
    expect(erf(-1.5)).toBeCloseTo(-0.9661051464753108, 14);
    expect(rel(erfc(3), 2.209049699858544e-5)).toBeLessThan(1e-12);
    expect(rel(erfc(5), 1.5374597944280349e-12)).toBeLessThan(1e-12);
    expect(rel(erfc(10), 2.088487583762545e-45)).toBeLessThan(1e-12);
  });
  test('erf is continuous across the switch between the series and the continued fraction', () => {
    const a = erfc(1.999999), b = erfc(2.000001);
    expect(rel(a, 4.677734981047266e-3)).toBeLessThan(1e-5);
    expect(a).toBeGreaterThan(b);
    expect(erfc(2)).toBeCloseTo(0.004677734981047266, 14);
  });
  test('Φ and Φ⁻¹ round trip over 40 orders of magnitude', () => {
    for (const z of [-12, -8, -5, -3, -1, 0, 0.3, 1, 2.5, 5]) expect(normalQuantile(normalCdf(z))).toBeCloseTo(z, 9);
    for (const z of [0, 1, 5, 8, 12, 20]) expect(normalUpperQuantile(normalSf(z))).toBeCloseTo(z, 9);
    for (const p of [0.5, 0.1, 1e-3, 1e-7, 1e-12, 1e-30, 1e-100]) expect(rel(zToP(pToZ(p)), p)).toBeLessThan(1e-10);
  });
  test('the conventional thresholds: 3σ ↔ 1.35e-3 and 5σ ↔ 2.87e-7 (one-sided)', () => {
    expect(zToP(3)).toBeCloseTo(1.3498980316300946e-3, 12);
    expect(rel(zToP(5), 2.866515718791933e-7)).toBeLessThan(1e-9);
    expect(pToZ(2.8665157187919e-7)).toBeCloseTo(5, 8);
    expect(pToZ(1.3498980316e-3)).toBeCloseTo(3, 8);
    expect(zToP(1.6448536269514722)).toBeCloseTo(0.05, 10);
    // Two-sided: 3σ ↔ 2.70e-3.
    expect(zToP(3, true)).toBeCloseTo(2.6997960632601866e-3, 12);
    expect(pToZ(zToP(2, true), true)).toBeCloseTo(2, 9);
  });
  test('lnΓ', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 13);
    expect(lnGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 13);
    expect(lnGamma(6)).toBeCloseTo(Math.log(120), 12);
    expect(lnGamma(101)).toBeCloseTo(363.73937555556347, 10);
  });
  test('incomplete gamma: P + Q = 1 and the χ² survival function', () => {
    expect(gammaP(2.5, 1.3) + gammaQ(2.5, 1.3)).toBeCloseTo(1, 14);
    expect(gammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 14);
    // χ² with 2 dof: SF = e^(−x/2); with 1 dof at 3.841 → 0.05.
    expect(chi2Sf(6, 2)).toBeCloseTo(Math.exp(-3), 13);
    expect(chi2Sf(3.841458820694124, 1)).toBeCloseTo(0.05, 10);
  });
  test('incomplete beta: I_x(1, 1) = x, I_x(2, 1) = x²', () => {
    expect(betaInc(0.3, 1, 1)).toBeCloseTo(0.3, 13);
    expect(betaInc(0.3, 2, 1)).toBeCloseTo(0.09, 13);
    expect(betaInc(0.3, 3, 4) + betaInc(0.7, 4, 3)).toBeCloseTo(1, 13);
  });
});

describe('Poisson and binomial', () => {
  test('cdf, tail and pmf agree with direct sums', () => {
    const mu = 4.3;
    let cum = 0;
    for (let k = 0; k <= 15; k++) {
      cum += poissonPmf(k, mu);
      expect(poissonCdf(k, mu)).toBeCloseTo(cum, 12);
      expect(poissonSf(k, mu)).toBeCloseTo(1 - cum, 12);
      expect(poissonTail(k + 1, mu)).toBeCloseTo(1 - cum, 12);
    }
    expect(poissonTail(0, mu)).toBe(1);
  });
  test('quantile', () => {
    for (const q of [0.05, 0.5, 0.95]) {
      const k = poissonQuantile(q, 7.2);
      expect(poissonCdf(k, 7.2)).toBeGreaterThanOrEqual(q);
      expect(poissonCdf(k - 1, 7.2)).toBeLessThan(q);
    }
  });
  test('the sampler is exact: mean, variance and the pmf of a mean-50 Poisson, and a tail probability', () => {
    const r = rng(11);
    for (const mu of [0.7, 12, 50, 400]) {
      const N = 60000;
      let s = 0, s2 = 0;
      for (let i = 0; i < N; i++) { const k = poissonSample(r, mu); s += k; s2 += k * k; }
      expect(Math.abs(s / N - mu)).toBeLessThan(5 * Math.sqrt(mu / N));
      expect(Math.abs(s2 / N - (s / N) ** 2 - mu) / mu).toBeLessThan(0.03);
    }
    // Tail: P(N ≥ 70 | 50) from the sampler against the exact value (~0.0044).
    const N = 400000;
    let hit = 0;
    for (let i = 0; i < N; i++) if (poissonSample(r, 50) >= 70) hit++;
    const p = poissonTail(70, 50);
    expect(Math.abs(hit / N - p)).toBeLessThan(5 * Math.sqrt((p * (1 - p)) / N));
  });
  test('Garwood interval: n = 0 gives [0, 1.84], and it covers with the stated probability', () => {
    const g0 = garwood(0);
    expect(g0.lo).toBe(0);
    expect(g0.hi).toBeCloseTo(1.841, 2);
    const g = garwood(10);
    // Endpoints satisfy the defining tail probabilities.
    const alpha = 1 - 0.6826894921370859;
    expect(poissonTail(10, g.lo)).toBeCloseTo(alpha / 2, 8);
    expect(poissonCdf(10, g.hi)).toBeCloseTo(alpha / 2, 8);
    expect(g.lo).toBeLessThan(10 - 2.5);
    expect(g.hi).toBeGreaterThan(10 + 3);
  });
  test('Clopper–Pearson: k = 0 gives [0, 1 − α/2^(1/n)], tails match the defining sums', () => {
    const cp0 = clopperPearson(0, 10);
    expect(cp0.lo).toBe(0);
    expect(cp0.hi).toBeCloseTo(1 - ((1 - 0.6826894921370859) / 2) ** (1 / 10), 10);
    const cp = clopperPearson(7, 20);
    // P(X ≥ 7 | p_lo) = α/2 and P(X ≤ 7 | p_hi) = α/2, by direct binomial sums.
    const binom = (k: number, n: number, p: number) => Math.exp(lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
    let up = 0, dn = 0;
    for (let k = 7; k <= 20; k++) up += binom(k, 20, cp.lo);
    for (let k = 0; k <= 7; k++) dn += binom(k, 20, cp.hi);
    expect(up).toBeCloseTo((1 - 0.6826894921370859) / 2, 8);
    expect(dn).toBeCloseTo((1 - 0.6826894921370859) / 2, 8);
    expect(cp.eff).toBe(0.35);
  });
});
