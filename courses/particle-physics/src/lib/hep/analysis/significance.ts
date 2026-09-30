/**
 * Significance: how surprising is an excess of events if there is no signal?
 *
 * Three levels, from the simplest to the one used at the LHC:
 *
 *  1. `simpleZ` s/√b: valid only when b is large and s ≪ b.
 *  2. `significance(s, b)`: the Asimov (median expected) significance of a counting experiment, derived below.
 *  3. The profile-likelihood ratio q₀ and its asymptotic distribution (Cowan, Cranmer, Gross and Vitells,
 *     Eur. Phys. J. C 71 (2011) 1554), for binned shapes and nuisance parameters: `discovery(model, data)`.
 *
 * And the exact answers to compare with: the Poisson tail (`pValueCounting`) and pseudo-experiments (`pseudoExperiments`).
 */
import { hook } from '../hooks.ts';
import type { Rng } from '../random/index.ts';
import { poissonSample, poissonTail, pToZ, zToP } from './counting.ts';
import { asimovData, qZero, type CountingModel } from './likelihood.ts';
import { normalPdf } from './special.ts';

/** s/√b, the rule of thumb. It overstates the significance when b is small (for s = b = 1 it gives 1.00, while `significance` gives 0.88). */
export const simpleZ = (s: number, b: number): number => (b > 0 ? s / Math.sqrt(b) : Infinity);

/**
 * Reference for the hook `analysis.significance`: the median expected significance of a counting experiment with expected signal s
 * and known expected background b.
 *
 *     Z = √( 2 ( (s + b) ln(1 + s/b) − s ) ).
 *
 * Derivation. The data are n ~ Poisson(μ s + b). The likelihood ratio for the background-only hypothesis (μ = 0) against the best fit
 * (μ̂ = (n − b)/s) is λ = L(0)/L(μ̂) = b^n e^(−b) / (n^n e^(−n)). Wilks' theorem says that −2 ln λ is asymptotically χ² with one degree of
 * freedom, so Z = √(−2 ln λ) = √(2(n ln(n/b) − n + b)) for an excess (n > b). To get the *median* experiment without simulating
 * anything, replace the random n by its expectation under the signal hypothesis, n = s + b (the "Asimov data set"). Then
 *
 *     q₀,A = 2((s + b) ln((s + b)/b) − s) = 2((s + b) ln(1 + s/b) − s),
 *
 * and Z = √q₀,A. For s ≪ b, expand ln(1 + s/b) = s/b − s²/2b² + s³/3b³ − …: (s + b)(s/b − s²/2b² + …) − s = s²/2b + O(s³/b²), so
 * Z → s/√b, which is where the rule of thumb comes from.
 */
export function significanceReference(s: number, b: number): number {
  if (!(s > 0)) return 0;
  if (!(b > 0)) return Infinity;
  return Math.sqrt(2 * ((s + b) * Math.log1p(s / b) - s));
}
/** `significanceReference`, or the reader's own version if installed as the hook `analysis.significance`. Signature: `(s, b) => Z`. */
export function significance(s: number, b: number): number {
  return hook('analysis.significance', significanceReference)(s, b);
}

/**
 * The Asimov significance when the background is uncertain by σ_b (absolute), as when it is estimated from a control region:
 *
 *     Z = [ 2 ( (s + b) ln[ (s + b)(b + σ_b²) / (b² + (s + b) σ_b²) ] − (b²/σ_b²) ln[ 1 + σ_b² s / (b (b + σ_b²)) ] ) ]^(1/2).
 *
 * It is the profile-likelihood Asimov result for the "on/off" problem (n ~ Poisson(s + b) in the signal region, m ~ Poisson(τ b) in a control region with
 * τ = b/σ_b²), from Cowan, Cranmer, Gross and Vitells (2011) and Cousins, Linnemann and Tucker (2008). It reduces to `significance(s, b)` when σ_b → 0
 * and to s/σ_b when σ_b ≫ b. (A Gaussian-constrained normalisation, as in `CountingModel.nuisance`, gives the same answer to about 1 % for uncertainties up to 10 %, and differs by a few per cent more beyond.)
 */
export function significanceWithUncertainty(s: number, b: number, sigmaB: number): number {
  if (!(s > 0)) return 0;
  if (!(sigmaB > 0)) return significanceReference(s, b);
  const v = sigmaB * sigmaB;
  const t1 = (s + b) * Math.log(((s + b) * (b + v)) / (b * b + (s + b) * v));
  const t2 = ((b * b) / v) * Math.log1p((v * s) / (b * (b + v)));
  return Math.sqrt(Math.max(0, 2 * (t1 - t2)));
}

/** The exact p-value of observing n or more events when b are expected from background alone: P(N ≥ n | b). */
export function pValueCounting(nObs: number, b: number): number {
  return poissonTail(nObs, b);
}

/**
 * The p-value when the background itself is uncertain: the Poisson tail averaged over a Gaussian distribution of the true
 * background (mean b, standard deviation σ_b, truncated at zero). This is the "prior-predictive" p-value of Cousins and Highland.
 */
export function pValueWithUncertainty(nObs: number, b: number, sigmaB: number): number {
  if (!(sigmaB > 0)) return poissonTail(nObs, b);
  const N = 400;
  const lo = Math.max(1e-9, b - 6 * sigmaB), hi = b + 6 * sigmaB;
  const h = (hi - lo) / N;
  let num = 0, den = 0;
  for (let k = 0; k <= N; k++) {
    const x = lo + k * h;
    const w = (k === 0 || k === N ? 1 : k % 2 ? 4 : 2) * normalPdf((x - b) / sigmaB);
    num += w * poissonTail(nObs, x);
    den += w;
  }
  return num / den;
}

export interface DiscoveryResult {
  /** The profile-likelihood ratio test statistic q₀ (0 if the fitted signal is not positive). */
  q0: number;
  /** √q₀: the asymptotic significance in standard deviations. */
  z: number;
  /** The asymptotic p-value 1 − Φ(√q₀). */
  p0: number;
}

/**
 * The discovery test on observed data: q₀, and from it the asymptotic p-value and significance. `data` are the observed counts in
 * each bin of the model (signal shape, background, optional background-normalisation uncertainty).
 */
export function discovery(model: CountingModel, data: ArrayLike<number>): DiscoveryResult {
  const q0 = qZero(model, data);
  const z = Math.sqrt(q0);
  return { q0, z, p0: zToP(z) };
}

/** The median expected discovery significance for signal strength μ (default 1), from the Asimov data set. */
export function expectedDiscovery(model: CountingModel, mu = 1): DiscoveryResult {
  return discovery(model, asimovData(model, mu));
}

/**
 * Pseudo-experiments. With an array of expected counts, every bin is Poisson-fluctuated independently (exact sampler);
 * with a function, it is called once per experiment with the random generator and may return anything (a histogram, a list of masses).
 *
 *     pseudoExperiments([10, 12, 9], 1000, rng(1))            // 1000 arrays of three counts
 *     pseudoExperiments((r) => generateSample(r), 200, rng(1))
 */
export function pseudoExperiments(model: ArrayLike<number>, n: number, rng: Rng): number[][];
export function pseudoExperiments<T>(model: (rng: Rng) => T, n: number, rng: Rng): T[];
export function pseudoExperiments<T>(model: ArrayLike<number> | ((rng: Rng) => T), n: number, rng: Rng): number[][] | T[] {
  if (typeof model === 'function') return Array.from({ length: n }, () => model(rng));
  const out: number[][] = new Array(n);
  for (let k = 0; k < n; k++) {
    const row = new Array<number>(model.length);
    for (let i = 0; i < model.length; i++) row[i] = poissonSample(rng, model[i]!);
    out[k] = row;
  }
  return out;
}

/**
 * The empirical p-value of an observed value of a test statistic from pseudo-experiments under the null:
 * the fraction of toys with statistic ≥ observed, with the +1 convention (never exactly zero): (1 + #{t ≥ obs})/(1 + N).
 */
export function toyPValue(observed: number, toys: ArrayLike<number>): number {
  let k = 0;
  for (let i = 0; i < toys.length; i++) if (toys[i]! >= observed) k++;
  return (1 + k) / (1 + toys.length);
}

// ── look-elsewhere ──────────────────────────────────────────────────────────────────────────────

export interface LookElsewhereResult {
  pLocal: number;
  zLocal: number;
  /** Probability that at least one of the effective trials fluctuates at least this much. */
  pGlobal: number;
  zGlobal: number;
  /** pGlobal / pLocal: how much the look-elsewhere effect inflates the p-value. */
  trialsFactor: number;
}

/**
 * The look-elsewhere effect with a number of *independent* trials: if a bump can appear in N places, the chance that some place
 * fluctuates to local p is 1 − (1 − p)^N ≈ N p. `nTrialsEffective` is the number of independent mass windows the search could
 * have fired in (about the mass range divided by the resolution, times a factor of order one for overlapping windows). Without `zLocal` it returns the
 * conversion as a function: `lookElsewhere(100)(3)`.
 */
export function lookElsewhere(nTrialsEffective: number): (zLocal: number) => LookElsewhereResult;
export function lookElsewhere(nTrialsEffective: number, zLocal: number): LookElsewhereResult;
export function lookElsewhere(nTrialsEffective: number, zLocal?: number): LookElsewhereResult | ((zLocal: number) => LookElsewhereResult) {
  if (zLocal === undefined) return (z: number) => lookElsewhere(nTrialsEffective, z);
  const pLocal = zToP(zLocal);
  const pGlobal = -Math.expm1(nTrialsEffective * Math.log1p(-pLocal));
  return { pLocal, zLocal, pGlobal, zGlobal: pToZ(pGlobal), trialsFactor: pGlobal / pLocal };
}

/**
 * The Gross–Vitells estimate of the global p-value (Eur. Phys. J. C 70 (2010) 525) for a scan over a continuous parameter such as
 * the mass. In the background-only scan the local statistic q(m) wanders like a χ²₁ random field; the average number of
 * upcrossings of a level u falls as ⟨N(u)⟩ = ⟨N(u₀)⟩ e^(−(u − u₀)/2), measured at a low level u₀ (where there are plenty of upcrossings
 * in a handful of toys) and extrapolated to the observed level u = Z². Then p_global ≈ p_local + ⟨N(u)⟩.
 */
export function grossVitells(zLocal: number, upcrossings: { meanCount: number; level: number }): LookElsewhereResult {
  const u = zLocal * zLocal;
  const pLocal = zToP(zLocal);
  const n = upcrossings.meanCount * Math.exp(-(u - upcrossings.level) / 2);
  const pGlobal = Math.min(1, pLocal + n);
  return { pLocal, zLocal, pGlobal, zGlobal: pToZ(pGlobal), trialsFactor: pGlobal / pLocal };
}
