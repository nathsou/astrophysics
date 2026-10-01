/**
 * The likelihood of a binned counting experiment with one signal-strength parameter μ and, optionally, one nuisance
 * parameter θ: a Gaussian-constrained uncertainty on the normalisation of the background.
 *
 * Expected counts: ν_i(μ, θ) = μ s_i + b_i (1 + δ θ), where s_i and b_i are the signal (for μ = 1) and background
 * expectations, δ is the relative background uncertainty (for example 0.1 for ±10 %), and θ has a unit Gaussian
 * constraint, from an auxiliary measurement. The likelihood of the observed counts n_i is
 *
 *     L(μ, θ) = Π_i Pois(n_i | ν_i(μ, θ)) · Gauss(θ | 0, 1),     −ln L = Σ_i (ν_i − n_i ln ν_i) + θ²/2 + const.
 *
 * Everything below is built on the profile likelihood ratio: hats mean "fitted with everything free", double hats
 * "fitted with μ fixed and θ free":
 *
 *     λ(μ) = L(μ, θ̂̂(μ)) / L(μ̂, θ̂),   q_μ = −2 ln λ(μ).
 *
 * The nuisance parameter is profiled by solving ∂(−ln L)/∂θ = 0, which has one root because −ln L is convex in (μ, θ); μ̂ is found
 * by bisection on the derivative of the profiled likelihood, which is monotonic for the same reason. No generic minimiser is
 * needed, so these functions are fast enough to run thousands of pseudo-experiments in the browser.
 */

/** A systematic uncertainty on the background normalisation. */
export interface Nuisance {
  name: string;
  /** Relative size of one standard deviation (0.1 = ±10 %). */
  relUnc: number;
}

export interface CountingModel {
  /** Expected signal in each bin for μ = 1. */
  signal: number[];
  /** Expected background in each bin (θ = 0). */
  background: number[];
  /** Optional background normalisation uncertainty. */
  nuisance?: Nuisance;
}

const delta = (m: CountingModel): number => m.nuisance?.relUnc ?? 0;

/** Expected counts ν_i(μ, θ). */
export function expectedCounts(m: CountingModel, mu: number, theta = 0): number[] {
  const d = delta(m);
  return m.signal.map((s, i) => mu * s + m.background[i]! * (1 + d * theta));
}

/** −ln L up to a constant: Σ(ν − n ln ν) + θ²/2. */
export function nllCounting(m: CountingModel, data: ArrayLike<number>, mu: number, theta = 0): number {
  const d = delta(m);
  let v = 0;
  for (let i = 0; i < m.signal.length; i++) {
    const nu = mu * m.signal[i]! + m.background[i]! * (1 + d * theta);
    const n = data[i]!;
    if (nu > 0) v += nu - (n > 0 ? n * Math.log(nu) : 0);
    else if (n > 0 || nu < 0) return Infinity;
  }
  return d > 0 ? v + 0.5 * theta * theta : v;
}

/** The θ that minimises −ln L at fixed μ (the conditional maximum-likelihood estimate θ̂̂(μ)). */
export function profileTheta(m: CountingModel, data: ArrayLike<number>, mu: number): { theta: number; nll: number } {
  const d = delta(m);
  if (!(d > 0)) return { theta: 0, nll: nllCounting(m, data, mu, 0) };
  const s = m.signal, b = m.background;
  // ν_i > 0 requires θ > −(b_i + μ s_i)/(b_i δ) for every bin with b_i > 0.
  let lo = -Infinity;
  for (let i = 0; i < b.length; i++) if (b[i]! > 0) lo = Math.max(lo, -(b[i]! + mu * s[i]!) / (b[i]! * d));
  if (!Number.isFinite(lo)) return { theta: 0, nll: nllCounting(m, data, mu, 0) };
  const D = (t: number): number => {
    let v = t;
    for (let i = 0; i < b.length; i++) {
      const nu = mu * s[i]! + b[i]! * (1 + d * t);
      const n = data[i]!;
      if (n > 0 && nu <= 0) return -Infinity;
      v += d * b[i]! * (1 - (n > 0 ? n / nu : 0));
    }
    return v;
  };
  let a = lo + 1e-12 * Math.max(1, Math.abs(lo));
  if (D(a) >= 0) return { theta: a, nll: nllCounting(m, data, mu, a) };
  let c = Math.max(a + 1, 1);
  for (let k = 0; k < 80 && D(c) < 0; k++) c = a + 2 * (c - a);
  let t = Math.min(c, Math.max(a, 0));
  for (let k = 0; k < 200; k++) {
    const f = D(t);
    if (f === 0) break;
    if (f < 0) a = t;
    else c = t;
    // Newton step with D' = 1 + δ² Σ b_i² n_i/ν_i²; bisect if it leaves the bracket.
    let dp = 1;
    for (let i = 0; i < b.length; i++) {
      const nu = mu * s[i]! + b[i]! * (1 + d * t);
      if (nu > 0 && data[i]! > 0) dp += (d * b[i]!) ** 2 * data[i]! / (nu * nu);
    }
    let tn = t - f / dp;
    if (!(tn > a && tn < c)) tn = 0.5 * (a + c);
    if (Math.abs(tn - t) < 1e-13 * Math.max(1, Math.abs(t))) {
      t = tn;
      break;
    }
    t = tn;
  }
  return { theta: t, nll: nllCounting(m, data, mu, t) };
}

/** ∂(−ln L)/∂μ at the conditional θ̂̂(μ): Σ s_i (1 − n_i/ν_i). The derivative of the profiled likelihood (envelope theorem). */
function dProfile(m: CountingModel, data: ArrayLike<number>, mu: number): number {
  const { theta } = profileTheta(m, data, mu);
  const d = delta(m);
  let v = 0;
  for (let i = 0; i < m.signal.length; i++) {
    const nu = mu * m.signal[i]! + m.background[i]! * (1 + d * theta);
    const n = data[i]!;
    if (n > 0 && nu <= 0) return -Infinity;
    v += m.signal[i]! * (1 - (n > 0 ? n / nu : 0));
  }
  return v;
}

/**
 * The unconditional fit of μ (and θ) with μ ≥ 0: μ̂ = 0 when the data are at or below the background expectation.
 * Returns the estimates and the minimum of −ln L.
 */
export function fitMu(m: CountingModel, data: ArrayLike<number>): { mu: number; theta: number; nll: number } {
  if (!(m.signal.some((s) => s > 0))) return { mu: 0, ...profileTheta(m, data, 0) };
  if (dProfile(m, data, 0) >= 0) {
    const p = profileTheta(m, data, 0);
    return { mu: 0, theta: p.theta, nll: p.nll };
  }
  // The root is bracketed above by a μ at which the derivative is positive; start from the excess over the background.
  let hi = 1;
  const nTot = Array.from(data).reduce((a, v) => a + v, 0);
  const sTot = m.signal.reduce((a, v) => a + v, 0);
  hi = Math.max(1, (2 * nTot) / sTot);
  for (let k = 0; k < 100 && dProfile(m, data, hi) < 0; k++) hi *= 2;
  let lo = 0;
  for (let k = 0; k < 100; k++) {
    const mid = 0.5 * (lo + hi);
    if (dProfile(m, data, mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-11 * Math.max(1, hi)) break;
  }
  const mu = 0.5 * (lo + hi);
  const p = profileTheta(m, data, mu);
  return { mu, theta: p.theta, nll: p.nll };
}

/** The Asimov data set for signal strength μ′: every bin at its expectation, n_i = μ′ s_i + b_i (Cowan et al. 2011). */
export function asimovData(m: CountingModel, mu = 0): number[] {
  return m.signal.map((s, i) => mu * s + m.background[i]!);
}

/**
 * The discovery test statistic q₀ = −2 ln λ(0) when μ̂ ≥ 0, else 0: how badly the background-only hypothesis describes an excess.
 * Asymptotically q₀ has the distribution ½δ(q₀) + ½χ²₁ under the background-only hypothesis, so p₀ = 1 − Φ(√q₀) and Z = √q₀.
 */
export function qZero(m: CountingModel, data: ArrayLike<number>): number {
  const fit = fitMu(m, data);
  if (fit.mu <= 0) return 0;
  const cond = profileTheta(m, data, 0);
  return Math.max(0, 2 * (cond.nll - fit.nll));
}

/**
 * The test statistic for upper limits, q̃_μ: zero when μ̂ > μ (an excess is never evidence against a larger signal),
 * −2 ln[L(μ, θ̂̂(μ))/L(0, θ̂̂(0))] when μ̂ < 0 (μ̂ is held at its physical boundary 0), and −2 ln λ(μ) otherwise.
 */
export function qMuTilde(m: CountingModel, data: ArrayLike<number>, mu: number): number {
  const fit = fitMu(m, data);
  if (fit.mu > mu) return 0;
  const cond = profileTheta(m, data, mu);
  return Math.max(0, 2 * (cond.nll - fit.nll));
}

/** q̃_μ evaluated on the background-only Asimov data set: sets the width σ of the asymptotic distribution, σ² = μ²/q_{μ,A}. */
export function qMuAsimov(m: CountingModel, mu: number): number {
  return qMuTilde(m, asimovData(m, 0), mu);
}

/**
 * The median (expected) discovery significance for signal strength μ′ (default 1): √q₀ on the Asimov data set n_i = μ′ s_i + b_i.
 * Without a nuisance parameter and with one bin this is exactly √(2((s + b) ln(1 + s/b) − s)).
 */
export function medianDiscoveryZ(m: CountingModel, mu = 1): number {
  return Math.sqrt(Math.max(0, qZero(m, asimovData(m, mu))));
}

/**
 * The expected uncertainty on μ from the Fisher information at μ′ (default 0), with the nuisance parameter profiled:
 * σ_μ² = [I⁻¹]_μμ with I_μμ = Σ s²/ν, I_μθ = Σ s δ b/ν, I_θθ = Σ (δ b)²/ν + 1 and ν = μ′ s + b. A background uncertainty
 * δ adds (δ b_tot/s_tot)² in quadrature when the signal and background shapes are alike.
 */
export function muUncertainty(m: CountingModel, muPrime = 0): number {
  const d = delta(m);
  let imm = 0, imt = 0, itt = d > 0 ? 1 : 0;
  for (let i = 0; i < m.signal.length; i++) {
    const nu = muPrime * m.signal[i]! + m.background[i]!;
    if (!(nu > 0)) continue;
    imm += (m.signal[i]! * m.signal[i]!) / nu;
    imt += (m.signal[i]! * d * m.background[i]!) / nu;
    itt += (d * m.background[i]!) ** 2 / nu;
  }
  const v = d > 0 ? imm - (imt * imt) / itt : imm;
  return v > 0 ? 1 / Math.sqrt(v) : Infinity;
}
