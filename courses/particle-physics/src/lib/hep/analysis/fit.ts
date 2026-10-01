/**
 * Maximum-likelihood fits of histograms and of lists of values.
 *
 * Binned: the number of events n_i in bin i is Poisson with mean ν_i(θ) (the model's expectation for the parameters θ), so
 *     −ln L(θ) = Σ_i [ ν_i − n_i ln ν_i + ln n_i! ].
 * Unbinned (extended): every event x_j contributes its density, and the total number of events is Poisson with mean ν = Σν_k,
 *     −ln L(θ) = ν − Σ_j ln( Σ_k ν_k f_k(x_j) ) (+ constants).
 * Both are minimised with `minimize` (errorDef ½), and the parameter errors are the square roots of the diagonal of the covariance
 * matrix 2·errorDef·H⁻¹ from the Hessian at the minimum.
 *
 * Goodness of fit: for a binned fit the likelihood-ratio χ² of Baker and Cousins (1984), 2 Σ [ν − n + n ln(n/ν)], which for large counts
 * is χ²-distributed with (bins − free parameters) degrees of freedom, and the Pearson χ² Σ (n − ν)²/ν.
 */
import { hook } from '../hooks.ts';
import { Hist1D } from './hist.ts';
import { minimize, minos as minosFn, profile, type MinimizeOptions, type MinimizeResult, type ProfilePoint } from './minimize.ts';
import { extendedModel, type Model } from './models.ts';
import { chi2Sf, lnFactorial, lnGamma } from './special.ts';

// ── Poisson likelihood pieces ───────────────────────────────────────────────────────────────────

/**
 * The Poisson negative log-likelihood of observed bin counts given the expected counts:
 *     −ln L = Σ_i ( ν_i − n_i ln ν_i + ln n_i! ).
 * A bin with n_i = 0 and ν_i = 0 contributes 0; a bin with n_i > 0 and ν_i ≤ 0 makes the likelihood zero (returns Infinity).
 * The ln n! term does not depend on the parameters and does not move the minimum, but it makes the value the true −ln L.
 */
export function poissonNll(counts: ArrayLike<number>, expected: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i]!, nu = expected[i]!;
    if (nu > 0) s += nu - n * Math.log(nu) + lnFactorial(n);
    else if (n > 0 || nu < 0) return Infinity;
  }
  return s;
}

/** Baker–Cousins likelihood-ratio χ²: −2 ln(L(ν)/L(n)) = 2 Σ [ν − n + n ln(n/ν)]. */
export function likelihoodChi2(counts: ArrayLike<number>, expected: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i]!, nu = expected[i]!;
    if (nu > 0) s += nu - n + (n > 0 ? n * Math.log(n / nu) : 0);
    else if (n > 0) return Infinity;
  }
  return 2 * s;
}

/** Pearson χ² = Σ (n − ν)²/ν over the bins with ν > 0. */
export function pearsonChi2(counts: ArrayLike<number>, expected: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < counts.length; i++) if (expected[i]! > 0) s += (counts[i]! - expected[i]!) ** 2 / expected[i]!;
  return s;
}

/**
 * Normalised residuals of each bin. `pearson`: (n − ν)/√ν. `deviance`: sign(n − ν)·√(2(ν − n + n ln(n/ν))), which is closer to a
 * unit normal variable for small counts. A well-fitting model has pulls with mean 0 and width 1.
 */
export function pulls(counts: ArrayLike<number>, expected: ArrayLike<number>, kind: 'pearson' | 'deviance' = 'pearson'): number[] {
  const out = new Array<number>(counts.length);
  for (let i = 0; i < counts.length; i++) {
    const n = counts[i]!, nu = expected[i]!;
    if (!(nu > 0)) out[i] = 0;
    else if (kind === 'pearson') out[i] = (n - nu) / Math.sqrt(nu);
    else out[i] = Math.sign(n - nu) * Math.sqrt(Math.max(0, 2 * (nu - n + (n > 0 ? n * Math.log(n / nu) : 0))));
  }
  return out;
}

// ── results ──────────────────────────────────────────────────────────────────────────────────────

export interface FitResult {
  names: string[];
  params: number[];
  errors: number[];
  covariance: number[][] | null;
  /** The minimum of the objective: −ln L for likelihood fits, χ² for `fitChi2`. */
  nll: number;
  /** Which objective was minimised. */
  objective_kind?: 'nll' | 'chi2';
  /** Goodness of fit of a binned fit: the Baker–Cousins likelihood-ratio χ² (for `fitChi2`, the minimised χ²). NaN for unbinned fits. */
  chi2: number;
  pearson: number;
  ndf: number;
  /** p-value of the χ² for ndf degrees of freedom (binned fits). */
  pValue: number;
  /** Expected counts per bin at the best fit, and the Pearson pull of each bin (binned fits). */
  expected: number[];
  pulls: number[];
  converged: boolean;
  covValid: boolean;
  /** Asymmetric MINOS errors (distances below and above the best value), if requested. */
  minos?: { lo: number; hi: number }[];
  nEval: number;
  /** The objective function (−ln L) in the full parameter vector, for profiles and scans. */
  objective: (p: number[]) => number;
  /** The lower and upper limits used. */
  lower: number[];
  upper: number[];
  fixed: boolean[];
  /** Value and error of a named parameter. */
  get(name: string): { value: number; error: number };
}

export interface FitOptions extends MinimizeOptions {
  /** Restrict a binned fit to bins whose centres lie in [lo, hi]. */
  range?: [number, number];
  /** Treat histogram contents as weighted (scale each bin to its effective count). Default: detected from the sum of squared weights. */
  weighted?: boolean;
  /** Compute asymmetric MINOS errors for all free parameters. */
  minos?: boolean;
  /** Names for a function model's parameters. */
  names?: string[];
}

function finish(
  names: string[],
  objective: (p: number[]) => number,
  p0: number[],
  opts: FitOptions,
  lower: number[],
  upper: number[],
  extras: { expected?: number[]; counts?: ArrayLike<number>; expectedAt?: (p: number[]) => number[] },
): FitResult {
  const fixed = p0.map((_, i) => !!opts.fixed?.[i]);
  const r: MinimizeResult = minimize(objective, p0, { ...opts, lower, upper, fixed });
  const res: FitResult = {
    names,
    params: r.x,
    errors: r.errors,
    covariance: r.covariance,
    nll: r.fval,
    chi2: NaN,
    pearson: NaN,
    ndf: NaN,
    pValue: NaN,
    expected: [],
    pulls: [],
    converged: r.converged,
    covValid: r.covValid,
    nEval: r.nEval,
    objective,
    lower,
    upper,
    fixed,
    get(name) {
      const i = names.indexOf(name);
      if (i < 0) throw new Error(`no parameter ${name}; have ${names.join(', ')}`);
      return { value: r.x[i]!, error: r.errors[i]! };
    },
  };
  if (extras.counts && extras.expectedAt) {
    const exp = extras.expectedAt(r.x);
    const nFree = fixed.filter((f) => !f).length;
    res.expected = exp;
    res.chi2 = likelihoodChi2(extras.counts, exp);
    res.pearson = pearsonChi2(extras.counts, exp);
    res.ndf = Math.max(0, extras.counts.length - nFree);
    res.pValue = res.ndf > 0 ? chi2Sf(res.chi2, res.ndf) : NaN;
    res.pulls = pulls(extras.counts, exp);
  }
  if (opts.minos && r.covValid) {
    res.minos = r.x.map((_, i) => (fixed[i] ? { lo: 0, hi: 0 } : (({ lo, hi }) => ({ lo, hi }))(minosFn(objective, r, i, { ...opts, lower, upper, fixed }))));
  }
  return res;
}

// ── χ² fit (for comparison) ─────────────────────────────────────────────────────────────────────

/**
 * A least-squares fit of a histogram, for comparison with the likelihood fit: minimise χ² = Σ (n_i − ν_i)²/σ_i², with σ_i² = max(n_i, 1) (`neyman`: the
 * observed count, the usual default of plotting programs) or σ_i² = ν_i (`pearson`). With large counts all three agree. With small counts the Neyman χ²
 * is biased low, because bins that fluctuate down get a small error and so a large weight, and the Pearson form is biased high (for a flat model it returns the root mean square of the counts,
 * not their mean): this is why counting experiments use the Poisson likelihood.
 * Errors use Δχ² = 1.
 */
export function fitChi2(hist: Hist1D, model: Model | ((p: number[]) => number[]), p0: number[], opts: FitOptions & { variance?: 'neyman' | 'pearson' } = {}): FitResult {
  const counts = Array.from(hist.counts);
  const edges = Array.from(hist.edges);
  const expectedOf: (p: number[]) => number[] = typeof model === 'function' ? model : (p) => (model as Model).binned(p, edges);
  const names = typeof model === 'function' ? (opts.names ?? p0.map((_, i) => `p${i}`)) : model.paramNames;
  const lim = typeof model === 'function' ? null : model.limits(edges[0]!, edges[edges.length - 1]!);
  const lower = p0.map((_, i) => opts.lower?.[i] ?? lim?.lower[i] ?? -Infinity);
  const upper = p0.map((_, i) => opts.upper?.[i] ?? lim?.upper[i] ?? Infinity);
  const pearson = opts.variance === 'pearson';
  const objective = (p: number[]) => {
    const nu = expectedOf(p);
    let v = 0;
    for (let i = 0; i < counts.length; i++) {
      const var_ = pearson ? nu[i]! : Math.max(counts[i]!, 1);
      if (!(var_ > 0)) return Infinity;
      v += (counts[i]! - nu[i]!) ** 2 / var_;
    }
    return v;
  };
  const r = finish(names, objective, p0, { ...opts, errorDef: 1 }, lower, upper, { counts, expectedAt: expectedOf });
  r.objective_kind = 'chi2';
  // For a χ² fit the goodness of fit is the minimised χ² itself (and its p-value), not the likelihood-ratio form.
  r.chi2 = r.nll;
  r.pValue = r.ndf > 0 ? chi2Sf(r.chi2, r.ndf) : NaN;
  return r;
}

// ── the reference fit of the exercise ───────────────────────────────────────────────────────────

export interface LikelihoodFitResult {
  params: number[];
  nll: number;
  errors: number[];
}

/**
 * Reference for the hook `analysis.fitLikelihood`, the function the reader writes in Chapter 28: fit a model to bin counts.
 *
 *     fitLikelihood(data, model, p0) → { params, nll, errors }
 *
 * `data` are the observed counts, `model(p)` returns the expected count in each bin for parameters `p`, `p0` is the starting point.
 * `nll` is the Poisson negative log-likelihood at the minimum (see `poissonNll`) and `errors` the parameter uncertainties.
 */
export function fitLikelihoodReference(data: number[], model: (p: number[]) => number[], p0: number[]): LikelihoodFitResult {
  const r = minimize((p) => poissonNll(data, model(p)), p0, { errorDef: 0.5 });
  return { params: r.x, nll: r.fval, errors: r.errors };
}
/** `fitLikelihoodReference`, or the reader's own version if it has been installed as the hook `analysis.fitLikelihood`. */
export function fitLikelihood(data: number[], model: (p: number[]) => number[], p0: number[]): LikelihoodFitResult {
  return hook('analysis.fitLikelihood', fitLikelihoodReference)(data, model, p0);
}

// ── binned fit ───────────────────────────────────────────────────────────────────────────────────

/**
 * Binned Poisson maximum-likelihood fit of a histogram.
 *
 * `model` is either a `Model` (signal + background shapes, integrated over each bin) or a function `(p) => expected counts`
 * (the same shape as in `fitLikelihood`). Limits, fixed parameters and the starting steps are in `opts`; a `Model`'s own default limits
 * (yields ≥ 0, widths > 0, …) apply unless overridden. For weighted histograms each bin is scaled to its effective number of entries
 * n²/Σw², the usual approximation.
 */
export function fitBinned(hist: Hist1D, model: Model | ((p: number[]) => number[]), p0: number[], opts: FitOptions = {}): FitResult {
  // Bins in range.
  let i0 = 0, i1 = hist.nbins;
  if (opts.range) {
    i0 = hist.nbins;
    i1 = 0;
    for (let i = 0; i < hist.nbins; i++) {
      const c = hist.binCenter(i);
      if (c >= opts.range[0] && c <= opts.range[1]) {
        i0 = Math.min(i0, i);
        i1 = Math.max(i1, i + 1);
      }
    }
    if (i1 <= i0) throw new Error('fitBinned: no bins in range');
  }
  const counts = Array.from(hist.counts.subarray(i0, i1));
  const edges = Array.from(hist.edges.subarray(i0, i1 + 1));
  const w2 = hist.sumw2.subarray(i0, i1);
  const weighted = opts.weighted ?? counts.some((c, i) => Math.abs(w2[i]! - c) > 1e-9 * Math.max(1, Math.abs(c)));
  // Effective counts and scale factors for weighted bins.
  const s = counts.map((c, i) => (weighted && c > 0 && w2[i]! > 0 ? w2[i]! / c : 1));
  const nEff = counts.map((c, i) => c / s[i]!);
  const expectedOf: (p: number[]) => number[] =
    typeof model === 'function' ? model : (p) => (model as Model).binned(p, edges);
  const names = typeof model === 'function' ? (opts.names ?? p0.map((_, i) => `p${i}`)) : model.paramNames;
  const lim = typeof model === 'function' ? null : model.limits(edges[0]!, edges[edges.length - 1]!);
  const lower = p0.map((_, i) => opts.lower?.[i] ?? lim?.lower[i] ?? -Infinity);
  const upper = p0.map((_, i) => opts.upper?.[i] ?? lim?.upper[i] ?? Infinity);
  const objective = (p: number[]) => {
    const nu = expectedOf(p);
    if (!weighted) return poissonNll(counts, nu);
    let v = 0;
    for (let i = 0; i < counts.length; i++) {
      const m = nu[i]! / s[i]!;
      if (m > 0) v += m - nEff[i]! * Math.log(m) + lnGamma(nEff[i]! + 1);
      else if (nEff[i]! > 0 || m < 0) return Infinity;
    }
    return v;
  };
  return finish(names, objective, p0, opts, lower, upper, { counts: nEff, expectedAt: (p) => expectedOf(p).map((v, i) => v / s[i]!) });
}

// ── unbinned fit ─────────────────────────────────────────────────────────────────────────────────

/** A density function of one value and the parameters; it need not be normalised (the fit normalises it on the range). */
export type PdfFunction = (x: number, p: number[]) => number;

/**
 * Unbinned maximum-likelihood fit of a list of values (only those inside `range` are used).
 *
 * With an extended `Model` the likelihood includes the Poisson fluctuation of the number of events, so the yields are fitted.
 * With a single-shape model (`shapeModel`) or a plain function `(x, p) => density` the likelihood is conditional on the number
 * of events: −ln L = −Σ ln f(x_j; θ) with f normalised to 1 on the range (numerically, for a function).
 */
export function fitUnbinned(values: ArrayLike<number>, model: Model | PdfFunction, p0: number[], range: [number, number], opts: FitOptions = {}): FitResult {
  const [lo, hi] = range;
  const xs: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v >= lo && v <= hi) xs.push(v);
  }
  const x = Float64Array.from(xs);
  const n = x.length;
  let objective: (p: number[]) => number;
  let names: string[];
  let lower: number[], upper: number[];
  if (typeof model === 'function') {
    names = opts.names ?? p0.map((_, i) => `p${i}`);
    lower = p0.map((_, i) => opts.lower?.[i] ?? -Infinity);
    upper = p0.map((_, i) => opts.upper?.[i] ?? Infinity);
    const fn = model;
    objective = (p) => {
      // Normalise numerically: composite Simpson with 400 intervals.
      const N = 400, h = (hi - lo) / N;
      let norm = fn(lo, p) + fn(hi, p);
      for (let k = 1; k < N; k++) norm += (k % 2 ? 4 : 2) * fn(lo + k * h, p);
      norm *= h / 3;
      if (!(norm > 0) || !Number.isFinite(norm)) return Infinity;
      let s = 0;
      for (let j = 0; j < n; j++) {
        const f = fn(x[j]!, p);
        if (!(f > 0)) return Infinity;
        s -= Math.log(f);
      }
      return s + n * Math.log(norm);
    };
  } else {
    names = model.paramNames;
    const lim = model.limits(lo, hi);
    lower = p0.map((_, i) => opts.lower?.[i] ?? lim.lower[i]!);
    upper = p0.map((_, i) => opts.upper?.[i] ?? lim.upper[i]!);
    const m = model;
    objective = (p) => {
      const f = m.pdf(p, lo, hi);
      // Σ ln d_j, taking the logarithm of a running product every 32 events (one log instead of 32; flushed early against underflow).
      let s = 0;
      let prod = 1;
      for (let j = 0; j < n; j++) {
        const d = f(x[j]!);
        if (!(d > 0)) return Infinity;
        prod *= d;
        if ((j & 31) === 31 || prod < 1e-200 || prod > 1e200) {
          s += Math.log(prod);
          prod = 1;
        }
      }
      s += Math.log(prod);
      if (!m.extended) return -s;
      const nu = m.totalYield(p);
      return nu > 0 ? nu - n * Math.log(nu) - s : Infinity;
    };
  }
  return finish(names, objective, p0, opts, lower, upper, {});
}

/** A readable table of a fit result. */
export function fitTable(r: FitResult): string {
  const w = Math.max(...r.names.map((s) => s.length));
  const lines = r.names.map((nm, i) => `${nm.padEnd(w)}  ${r.params[i]!.toPrecision(6).padStart(12)} ± ${r.errors[i]!.toPrecision(3)}${r.fixed[i] ? '  (fixed)' : ''}`);
  lines.push(`−ln L = ${r.nll.toFixed(3)}${Number.isFinite(r.chi2) ? `,  χ²/ndf = ${r.chi2.toFixed(1)}/${r.ndf}  (p = ${r.pValue.toPrecision(2)})` : ''}${r.converged ? '' : '  [did not converge]'}`);
  return lines.join('\n');
}

/** Default starting value of one shape parameter, from coarse features of the histogram. */
function shapeStart(nm: string, shapeName: string, hist: Hist1D, slope: number): number {
  const range = hist.upper - hist.lower;
  if (nm === 'sigma') return range / 50;
  if (nm === 'width') return range / 30;
  if (nm === 'alpha') return 1.5;
  if (nm === 'n') return 3;
  if (nm === 'slope') return slope;
  if (/^c\d+$/.test(nm)) return shapeName.startsWith('bernstein') ? 1 : 0;
  if (nm === 'mean') return 0.5 * (hist.lower + hist.upper);
  return 0;
}

/**
 * A reasonable starting point for a fit of a peak on a smooth background. Shapes with a `mean` parameter are treated as peaks; all others as
 * background. The background alone is fitted first (peak yields zero), and a sliding Gaussian filter of a few widths looks for the largest excess over
 * that fit: its position, width and area start the peak. Meant for interactive tools; a hand-written fit should start from the physics.
 */
export function guessStart(hist: Hist1D, model: Model): number[] {
  const n = hist.nbins;
  const counts = Array.from(hist.counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const range = hist.upper - hist.lower;
  const q = Math.max(1, Math.floor(n / 4));
  const first = counts.slice(0, q).reduce((a, b) => a + b, 0) / q;
  const last = counts.slice(n - q).reduce((a, b) => a + b, 0) / q;
  const slope = first > 0 && last > 0 ? Math.log(last / first) / ((1 - 1 / q) * 0.75 * range) : -1 / range;
  const peaks = model.components.filter((c) => c.shape.paramNames.includes('mean'));
  const others = model.components.filter((c) => !c.shape.paramNames.includes('mean'));
  // Smooth-background proxy: the background-only fit, or the running median if there is no background component.
  let proxy: number[];
  if (others.length) {
    const bm = extendedModel(others.map((c) => ({ label: c.label, shape: c.shape })));
    const b0: number[] = [];
    others.forEach((c) => {
      b0.push(total / others.length);
      c.shape.paramNames.forEach((nm) => b0.push(shapeStart(nm, c.shape.name, hist, slope)));
    });
    const fit = fitBinned(hist, bm, b0);
    proxy = bm.binned(fit.params, Array.from(hist.edges));
  } else {
    proxy = counts.map((_, i) => {
      const w = counts.slice(Math.max(0, i - 12), Math.min(n, i + 13)).sort((a, b) => a - b);
      return w[Math.floor(w.length / 2)]!;
    });
  }
  let peakBin = Math.floor(n / 2), bestScore = -Infinity, excess = 0, sigmaBins = 2;
  for (const sk of [1, 1.5, 2, 3, 4]) {
    for (let i = 0; i < n; i++) {
      let num = 0, den = 0, g2 = 0;
      for (let j = Math.max(0, Math.floor(i - 3 * sk)); j <= Math.min(n - 1, Math.ceil(i + 3 * sk)); j++) {
        const g = Math.exp(-0.5 * ((j - i) / sk) ** 2);
        num += g * (counts[j]! - proxy[j]!);
        den += g * g * (proxy[j]! + 1);
        g2 += g * g;
      }
      const score = num / Math.sqrt(den);
      if (score > bestScore) {
        bestScore = score;
        peakBin = i;
        sigmaBins = sk;
        excess = (num / g2) * sk * Math.sqrt(2 * Math.PI);
      }
    }
  }
  const peakYield = peaks.length ? Math.max(0.02 * total, excess) / peaks.length : 0;
  const otherYield = (total - peakYield * peaks.length) / Math.max(1, others.length);
  const p = new Array<number>(model.paramNames.length).fill(0);
  for (const c of model.components) {
    const isPeak = c.shape.paramNames.includes('mean');
    if (c.yieldIndex >= 0) p[c.yieldIndex] = Math.max(1, isPeak ? peakYield : otherYield);
    c.shape.paramNames.forEach((nm, j) => {
      const i = c.paramIndex[j]!;
      if (nm === 'mean') p[i] = hist.binCenter(peakBin);
      else if (nm === 'sigma') p[i] = sigmaBins * hist.binWidth(peakBin);
      else if (nm === 'width') p[i] = 2 * sigmaBins * hist.binWidth(peakBin);
      else p[i] = shapeStart(nm, c.shape.name, hist, slope);
    });
  }
  return p;
}

/**
 * The profile likelihood of one parameter of a finished fit: for each value on `grid`, the other free parameters are re-fitted, and `delta` is
 * Δ(−2 ln L) = 2(−ln L − (−ln L)_min) (or Δχ² for a χ² fit). The values where it crosses 1 bound the 68 % interval, which is asymmetric when the likelihood is not
 * parabolic (for a yield near zero, for instance). `index` is the position in `fit.names`.
 */
export function profileParameter(fit: FitResult, index: number, grid: number[]): ProfilePoint[] {
  const chi2 = fit.objective_kind === 'chi2';
  const best = { x: fit.params, fval: fit.nll, errors: fit.errors } as MinimizeResult;
  return profile(fit.objective, index, grid, { best, lower: fit.lower, upper: fit.upper, fixed: fit.fixed, errorDef: chi2 ? 1 : 0.5, hessian: false });
}
