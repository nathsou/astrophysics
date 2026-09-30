/**
 * Counting statistics: the Poisson distribution (pmf, cdf, quantile, an exact sampler), the Garwood interval for a Poisson
 * count, and the Clopper–Pearson interval for an efficiency. Also the conversion between p-values and Z-values.
 */
import type { Rng } from '../random/index.ts';
import { bisect, betaInc, gammaP, gammaQ, lnFactorial, lnGamma, normalSf, normalUpperQuantile } from './special.ts';

// ── p-values and Z-values ────────────────────────────────────────────────────────────────────────

/**
 * Converts a p-value into a significance Z: the number of standard deviations such that a normal variable's
 * upper-tail probability is p. One-sided by default (the convention of particle physics: 5σ ↔ 2.87e-7);
 * with `twoSided` the two-tailed probability is used (3σ ↔ 2.7e-3).
 */
export function pToZ(p: number, twoSided = false): number {
  return normalUpperQuantile(twoSided ? p / 2 : p);
}
/** Converts a significance Z into a p-value (the inverse of `pToZ`). */
export function zToP(z: number, twoSided = false): number {
  const p = normalSf(z);
  return twoSided ? 2 * p : p;
}

// ── Poisson ──────────────────────────────────────────────────────────────────────────────────────

/** P(N = k | μ). */
export function poissonPmf(k: number, mu: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (mu <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mu) - mu - lnFactorial(k));
}
/** P(N ≤ k | μ) = Q(k + 1, μ). */
export function poissonCdf(k: number, mu: number): number {
  if (k < 0) return 0;
  if (mu <= 0) return 1;
  return gammaQ(Math.floor(k) + 1, mu);
}
/** P(N > k | μ) = P(k + 1, μ) (the upper tail, exact for small values). */
export function poissonSf(k: number, mu: number): number {
  if (k < 0) return 1;
  if (mu <= 0) return 0;
  return gammaP(Math.floor(k) + 1, mu);
}
/** P(N ≥ k | μ): the p-value of observing k or more events when μ are expected. */
export function poissonTail(k: number, mu: number): number {
  if (k <= 0) return 1;
  return poissonSf(k - 1, mu);
}
/** The smallest integer k with P(N ≤ k | μ) ≥ q. */
export function poissonQuantile(q: number, mu: number): number {
  if (mu <= 0 || q <= 0) return 0;
  if (q >= 1) return Infinity;
  let k = Math.max(0, Math.floor(mu + Math.sqrt(mu) * (q > 0.5 ? 1 : -1)));
  while (k > 0 && poissonCdf(k - 1, mu) >= q) k--;
  while (poissonCdf(k, mu) < q) k++;
  return k;
}

/**
 * An exact Poisson sampler. Knuth's product method below 30; above, Hörmann's transformed rejection with squeeze (PTRS,
 * 1993), which is exact in the tails (unlike a rounded normal) and needs about 1.2 uniforms per sample.
 */
export function poissonSample(r: Rng, mean: number): number {
  if (!(mean > 0)) return 0;
  if (mean < 30) {
    const L = Math.exp(-mean);
    let k = 0;
    let p = r();
    while (p > L) {
      k++;
      p *= r();
    }
    return k;
  }
  const slam = Math.sqrt(mean);
  const loglam = Math.log(mean);
  const b = 0.931 + 2.53 * slam;
  const a = -0.059 + 0.02483 * b;
  const invalpha = 1.1239 + 1.1328 / (b - 3.4);
  const vr = 0.9277 - 3.6224 / (b - 2);
  for (;;) {
    const U = r() - 0.5;
    const V = r();
    const us = 0.5 - Math.abs(U);
    const k = Math.floor(((2 * a) / us + b) * U + mean + 0.43);
    if (us >= 0.07 && V <= vr) return k;
    if (k < 0 || (us < 0.013 && V > us)) continue;
    if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -mean + k * loglam - lnGamma(k + 1)) return k;
  }
}

/** A Poisson-fluctuated copy of an array of expected counts. */
export function poissonFluctuate(r: Rng, expected: ArrayLike<number>): number[] {
  const out = new Array<number>(expected.length);
  for (let i = 0; i < expected.length; i++) out[i] = poissonSample(r, expected[i]!);
  return out;
}

/**
 * The Garwood (central, frequentist) confidence interval for the Poisson mean given n observed events.
 * Lower: the μ for which P(N ≥ n | μ) = α/2; upper: the μ for which P(N ≤ n | μ) = α/2. The default level is the
 * one-standard-deviation coverage 68.27 %, for which the interval is close to n ± √n for large n, and is asymmetric for small n
 * (for n = 0 the lower edge is 0 and the upper edge is 1.84).
 */
export function garwood(n: number, level = 0.6826894921370859): { lo: number; hi: number } {
  const alpha = 1 - level;
  const lo = n === 0 ? 0 : bisect((mu) => gammaP(n, mu) - alpha / 2, 1e-12, n + 10 * Math.sqrt(n) + 20);
  const hi = bisect((mu) => gammaQ(n + 1, mu) - alpha / 2, n + 1e-9, n + 10 * Math.sqrt(n + 1) + 30);
  return { lo, hi };
}

// ── Binomial ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The Clopper–Pearson "exact" interval for a binomial proportion (an efficiency): k successes in n trials. It is the
 * central interval whose coverage is at least `level` for every true efficiency, so it is conservative; it stays inside [0, 1]
 * and is sensible at k = 0 and k = n, where the naive √(ε(1 − ε)/n) gives zero.
 */
export function clopperPearson(k: number, n: number, level = 0.6826894921370859): { eff: number; lo: number; hi: number } {
  const alpha = 1 - level;
  const eff = n > 0 ? k / n : 0;
  if (n <= 0) return { eff: 0, lo: 0, hi: 1 };
  // Lower: I_p(k, n − k + 1) = α/2 ; upper: I_p(k + 1, n − k) = 1 − α/2.
  const lo = k <= 0 ? 0 : bisect((p) => betaInc(p, k, n - k + 1) - alpha / 2, 0, 1, 1e-14);
  const hi = k >= n ? 1 : bisect((p) => betaInc(p, k + 1, n - k) - (1 - alpha / 2), 0, 1, 1e-14);
  return { eff, lo, hi };
}
