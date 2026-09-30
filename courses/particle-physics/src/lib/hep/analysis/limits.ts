/**
 * Upper limits by the CLs method.
 *
 * When a search finds no significant excess, the result is an upper limit: the largest signal strength μ the data still allow. Excluding a
 * hypothesis at 95 % confidence by requiring p < 0.05 has a flaw: if the data fluctuate *below* the background, every signal
 * is "excluded", including one the experiment could not have seen. The CLs prescription (Read 2002, Junk 1999) divides by the
 * probability of that happening to the background alone:
 *
 *     CLs = CLs+b / CLb,    CLs+b = P(q ≥ q_obs | μ s + b),    CLb = P(q ≥ q_obs | b).
 *
 * The signal strength μ is excluded at 95 % if CLs < 0.05. For a counting experiment the test statistic is the number of events
 * itself, and P(q ≥ q_obs) = P(N ≤ n_obs), so everything is a Poisson cdf (`clsCounting`, exact). For a binned shape fit the test statistic
 * is the profile-likelihood ratio q̃_μ and its distribution comes from pseudo-experiments or from the asymptotic formulae of
 * Cowan, Cranmer, Gross and Vitells (2011), which need only one Asimov data set (`clsModel`, `upperLimit`).
 */
import { hook } from '../hooks.ts';
import { rng as makeRng, type Rng } from '../random/index.ts';
import { poissonCdf, poissonQuantile, poissonSample } from './counting.ts';
import { asimovData, expectedCounts, profileTheta, qMuAsimov, qMuTilde, type CountingModel } from './likelihood.ts';
import { normalCdf, normalQuantile, normalSf } from './special.ts';

// ── counting experiment, exact ──────────────────────────────────────────────────────────────────

export interface ClsResult {
  /** CLs+b: the p-value of the signal-plus-background hypothesis. */
  clsb: number;
  /** CLb: the probability of so few events (or fewer) if there were only background. */
  clb: number;
  /** CLs = CLs+b/CLb. */
  cls: number;
}

/**
 * CLs for a counting experiment with known expected background b and expected signal s, after observing nObs events:
 * CLs+b = P(N ≤ nObs | s + b), CLb = P(N ≤ nObs | b).
 */
export function clsCounting(nObs: number, s: number, b: number): ClsResult {
  const clsb = poissonCdf(nObs, s + b);
  const clb = poissonCdf(nObs, b);
  return { clsb, clb, cls: clb > 0 ? clsb / clb : 0 };
}

/**
 * Reference for the hook `analysis.cls`: the CLs value of a counting experiment, `(nObs, s, b) => CLs`, where nObs is the observed count,
 * s the expected signal and b the expected background. Signal strengths with CLs < 0.05 are excluded at 95 % confidence.
 */
export function clsReference(nObs: number, s: number, b: number): number {
  return clsCounting(nObs, s, b).cls;
}
/** `clsReference`, or the reader's own version if installed as the hook `analysis.cls`. */
export function cls(nObs: number, s: number, b: number): number {
  return hook('analysis.cls', clsReference)(nObs, s, b);
}

/** The 95 % CL (by default) upper limit on the expected signal s for a counting experiment: the s at which CLs = 1 − cl. */
export function upperLimitCounting(nObs: number, b: number, cl = 0.95): number {
  const target = 1 - cl;
  const f = (s: number) => clsCounting(nObs, s, b).cls - target;
  let hi = Math.max(1, nObs + 3 * Math.sqrt(nObs + 1) + 5);
  while (f(hi) > 0) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    if (f(mid) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12 * hi) break;
  }
  return 0.5 * (lo + hi);
}

export interface LimitBands {
  median: number;
  /** −2σ, −1σ, +1σ, +2σ of the expected limit under the background-only hypothesis. */
  m2: number;
  m1: number;
  p1: number;
  p2: number;
}

/** The limits one would expect, in the background-only case, for a counting experiment (Poisson quantiles of nObs under b; the bands are discrete). */
export function expectedLimitsCounting(b: number, cl = 0.95): LimitBands {
  const at = (z: number) => upperLimitCounting(poissonQuantile(normalCdf(z), b), b, cl);
  return { median: at(0), m2: at(-2), m1: at(-1), p1: at(1), p2: at(2) };
}

// ── binned model ────────────────────────────────────────────────────────────────────────────────

export interface ClsOptions {
  /** `exact` (one bin, no nuisance), `asymptotic` (CCGV formulae) or `toys`. Default: exact when it applies, else asymptotic. */
  method?: 'auto' | 'exact' | 'asymptotic' | 'toys';
  nToys?: number;
  /** Random generator for the toys. */
  rng?: Rng;
}

const isSingleBin = (m: CountingModel) => m.signal.length === 1 && !(m.nuisance && m.nuisance.relUnc > 0);

/**
 * CLs for signal strength μ given observed binned counts. Returns CLs+b, CLb, CLs and the observed test statistic q̃_μ.
 *
 * `asymptotic`: with q_A = q̃_μ on the background-only Asimov data set (so σ = μ/√q_A), CLs+b = 1 − Φ(√q) and CLb = Φ(√q_A − √q) when
 * q ≤ q_A, and CLs+b = 1 − Φ((q + q_A)/(2√q_A)), CLb = 1 − Φ((q − q_A)/(2√q_A)) above (CCGV eqs. 64–66 and 90).
 * `toys`: the distribution of q̃_μ is sampled with pseudo-experiments, the nuisance parameter fixed at its conditional best-fit values for the
 * observed data, which is the LHC convention.
 */
export function clsModel(model: CountingModel, data: ArrayLike<number>, mu: number, opts: ClsOptions = {}): ClsResult & { q: number; method: string } {
  let method = opts.method ?? 'auto';
  if (method === 'auto') method = isSingleBin(model) ? 'exact' : 'asymptotic';
  if (method === 'exact') {
    if (!isSingleBin(model)) throw new Error('clsModel: the exact method needs one bin and no nuisance parameter');
    const r = clsCounting(data[0]!, mu * model.signal[0]!, model.background[0]!);
    return { ...r, q: NaN, method };
  }
  const q = qMuTilde(model, data, mu);
  if (method === 'asymptotic') {
    const qA = qMuAsimov(model, mu);
    if (!(qA > 0)) return { clsb: 0.5, clb: 0.5, cls: 1, q, method };
    const sA = Math.sqrt(qA);
    let clsb: number, clb: number;
    if (q <= qA) {
      clsb = normalSf(Math.sqrt(q));
      clb = normalCdf(sA - Math.sqrt(q));
    } else {
      clsb = normalSf((q + qA) / (2 * sA));
      clb = normalSf((q - qA) / (2 * sA));
    }
    return { clsb, clb, cls: clb > 0 ? clsb / clb : 0, q, method };
  }
  // Pseudo-experiments.
  const r = opts.rng ?? makeRng(1);
  const nToys = opts.nToys ?? 2000;
  const thSb = profileTheta(model, data, mu).theta;
  const thB = profileTheta(model, data, 0).theta;
  const nuSb = expectedCounts(model, mu, thSb);
  const nuB = expectedCounts(model, 0, thB);
  let hSb = 0, hB = 0;
  const toy = new Array<number>(model.signal.length);
  for (let k = 0; k < nToys; k++) {
    for (let i = 0; i < toy.length; i++) toy[i] = poissonSample(r, nuSb[i]!);
    if (qMuTilde(model, toy, mu) >= q - 1e-12) hSb++;
    for (let i = 0; i < toy.length; i++) toy[i] = poissonSample(r, nuB[i]!);
    if (qMuTilde(model, toy, mu) >= q - 1e-12) hB++;
  }
  const clsb = hSb / nToys, clb = hB / nToys;
  return { clsb, clb, cls: clb > 0 ? clsb / clb : 0, q, method };
}

export interface UpperLimit {
  /** The observed upper limit on the signal strength μ at the chosen confidence level. */
  observed: number;
  /** The expected limit in the background-only case, with ±1σ and ±2σ bands. */
  expected: LimitBands;
  method: string;
}

/** The μ at which CLs = 1 − cl, by bisection on a decreasing function. */
function solveMu(clsOf: (mu: number) => number, target: number): number {
  let hi = 1;
  let k = 0;
  while (clsOf(hi) > target && k++ < 80) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (clsOf(mid) > target) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-9 * hi) break;
  }
  return 0.5 * (lo + hi);
}

/**
 * The upper limit on the signal strength μ at confidence level `cl` (default 95 %): the μ at which CLs = 1 − cl, for the observed data, and the
 * expected limit with its bands. For the asymptotic method the bands are the closed form of CCGV (eq. 91): the limit that an
 * experiment whose μ̂ lands N standard deviations above the background-only expectation would set is
 * μ_up,N = σ (Φ⁻¹(1 − α Φ(N)) + N), with σ² = μ²/q̃_{μ,A} found self-consistently (it depends weakly on μ).
 */
export function upperLimit(model: CountingModel, data: ArrayLike<number>, opts: ClsOptions & { cl?: number } = {}): UpperLimit {
  const cl = opts.cl ?? 0.95;
  const alpha = 1 - cl;
  let method = opts.method ?? 'auto';
  if (method === 'auto') method = isSingleBin(model) ? 'exact' : 'asymptotic';
  if (method === 'exact') {
    const s1 = model.signal[0]!;
    const b = model.background[0]!;
    const e = expectedLimitsCounting(b, cl);
    return { observed: upperLimitCounting(data[0]!, b, cl) / s1, expected: { median: e.median / s1, m2: e.m2 / s1, m1: e.m1 / s1, p1: e.p1 / s1, p2: e.p2 / s1 }, method };
  }
  const observed = solveMu((mu) => clsModel(model, data, mu, { ...opts, method: method as 'asymptotic' | 'toys' }).cls, alpha);
  // Bands from the Asimov σ(μ): solve q̃_{μ,A}(μ) = c_N² with c_N = Φ⁻¹(1 − α Φ(N)) + N.
  const band = (N: number) => {
    const c = normalQuantile(1 - alpha * normalCdf(N)) + N;
    if (!(c > 0)) return 0;
    let hi = 1;
    for (let k = 0; k < 80 && qMuAsimov(model, hi) < c * c; k++) hi *= 2;
    let lo = 0;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (qMuAsimov(model, mid) < c * c) lo = mid;
      else hi = mid;
      if (hi - lo < 1e-10 * hi) break;
    }
    return 0.5 * (lo + hi);
  };
  return { observed, expected: { median: band(0), m2: band(-2), m1: band(-1), p1: band(1), p2: band(2) }, method };
}

/**
 * The 95 % limit an experiment with this model would set on average if the data were exactly the background expectation (the Asimov data set):
 * the quantity used to optimise a selection for exclusion rather than discovery.
 */
export function expectedUpperLimit(model: CountingModel, cl = 0.95): number {
  return upperLimit(model, asimovData(model, 0), { method: 'asymptotic', cl }).expected.median;
}
