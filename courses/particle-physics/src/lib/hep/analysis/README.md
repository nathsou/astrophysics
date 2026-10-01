# `hep/analysis`: histograms, selections, fits, significance and limits

The statistics of the course, as importable TypeScript: `import { Hist1D, fitBinned, significance } from 'hep/analysis'` (in the reader's code) or
`'$lib/hep/analysis'` (in widgets). Pure functions and small classes; no DOM, no Node APIs; every random number comes from a seeded `Rng`
(`hep/random`). Tests sit next to each module (`*.test.ts`); `npx vitest run src/lib/hep/analysis` runs them (about 30 s, most of it the toy studies).

## Modules

| File | Contents |
|---|---|
| `special.ts` | `erf`, `erfc`, `normalCdf`, `normalSf`, `normalPdf`, `normalQuantile`, `normalUpperQuantile`, `lnGamma`, `lnFactorial`, `gammaP`, `gammaQ`, `betaInc`, `chi2Sf`, `chi2Cdf`, `bisect` |
| `counting.ts` | `pToZ`, `zToP` (one-sided by default), `poissonPmf/Cdf/Sf/Tail/Quantile`, `poissonSample` (exact), `poissonFluctuate`, `garwood`, `clopperPearson` |
| `hist.ts` | `Hist1D`, `Hist2D`, `cumulative`, `cumulativeEfficiency` |
| `select.ts` | `cut`, `passing`, `objects`, `Cutflow`, `applyCuts` |
| `minimize.ts` | `minimize`, `profile`, `minos`, `hessianAt`, `invertSPD` |
| `models.ts` | shapes (`gaussian`, `crystalBall`, `breitWigner`, `exponential`, `flat`, `chebyshev`, `bernstein`, `template`), `extendedModel`, `shapeModel`, `namedModel`, `integrate` |
| `fit.ts` | `fitBinned`, `fitUnbinned`, `fitChi2`, `fitLikelihood` (hook), `poissonNll`, `likelihoodChi2`, `pearsonChi2`, `pulls`, `guessStart`, `profileParameter`, `fitTable` |
| `likelihood.ts` | the counting-experiment likelihood with a background-normalisation `Nuisance`: `fitMu`, `profileTheta`, `qZero`, `qMuTilde`, `asimovData`, `medianDiscoveryZ`, `muUncertainty` |
| `significance.ts` | `significance` (hook), `significanceWithUncertainty`, `simpleZ`, `pValueCounting`, `pValueWithUncertainty`, `discovery`, `expectedDiscovery`, `pseudoExperiments`, `toyPValue`, `lookElsewhere`, `grossVitells` |
| `limits.ts` | `cls` (hook), `clsCounting`, `upperLimitCounting`, `expectedLimitsCounting`, `clsModel`, `upperLimit`, `expectedUpperLimit` |
| `bumphunt.ts` | `bumpHunt`, `scanWindows`, `bestWindow`, `maxLocalZ`, `lookElsewhereScan`, `localScan`, `upcrossings` |
| `optimise.ts` | `selectionOptimiser`, `evaluateSelection`, `scanCut`, `parSignificance`, `sampleFromTable`, `BlindedSample`, `blindTable` |

## Histograms

```ts
const h = new Hist1D(60, 100, 160);            // 60 even bins; or new Hist1D([0, 1, 3, 10]) for variable bins; Hist1D.logBins(n, lo, hi)
h.fill(x, w);  h.fillArray(xs, ws?);           // weights and sumw2 (error² of each bin) are kept; underflow/overflow in h.underflow/h.overflow
h.mean(); h.std(); h.integral({ width?: boolean, flow?: boolean }); h.integralRange(xlo, xhi)
h.add(other, k); h.scale(k); h.normalise(1, /* width */ true); h.toDensity(); h.rebin(2); h.rebin(edges); h.slice(lo, hi); h.clone()
h.binCenter(i); h.binWidth(i); h.centres(); h.widths(); h.error(i); h.errors()
h.toSeries()   // { edges: number[], counts: number[] }, the shape HepHist.svelte draws;  h.toArrays() adds errors, centres, widths
h.cumulative('forward' | 'backward')           // running sums; `cumulative(array)` for plain arrays
```

`Hist2D(nx, xlo, xhi, ny, ylo, yhi)` has `fill`, `get`, `projectionX/Y`, `add`, `scale`, `toMatrix`. 10⁶ events fill in about 85 ms on the development machine (limit asserted: 400 ms).

## Selections

```ts
const good = cut(table, (i) => pt[i]! > 25 && Math.abs(eta[i]!) < 2.4);   // an EventTable
const mus = objects(event, 'muon', { ptMin: 20, etaMax: 2.4, isolationMax: 0.15 });   // RecoEvent or FullEvent, sorted by pT
const { table, cutflow } = applyCuts(tab, [{ name: 'pT > 20', pass: (i, t) => t.col('pt')[i]! > 20 }, …]);
console.log(cutflow.toString());               // cut, count, relative and cumulative efficiency
```

## Minimiser

`minimize(fn, x0, { lower, upper, fixed, step, method: 'auto' | 'bfgs' | 'nelder-mead', errorDef, tol, hessian })` returns
`{ x, fval, converged, edm, hessian, covariance, errors, covValid, nEval }`. BFGS with central-difference gradients (one-sided far from the minimum) and a backtracking
line search, Nelder–Mead when BFGS does not converge, MINUIT-style transformations for limits, fixed parameters left out of the search. At the minimum
the Hessian H of second derivatives is computed by finite differences and the covariance is cov = 2·errorDef·H⁻¹ (`errorDef` 0.5 for −ln L, 1 for χ²).
`profile(fn, index, grid, { best })` re-minimises over the other parameters along a grid and returns Δ(−2 ln L) (`delta`); `minos(fn, best, index)` finds the
asymmetric interval where it crosses 1.

## Models and fits

```ts
const model = extendedModel([{ label: 'sig', shape: gaussian() }, { label: 'bkg', shape: exponential() }]);
model.paramNames   // ['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield', 'bkg.slope']
namedModel('cb+cheb2')                         // the same from a name: gauss|cb|bw|bwrel + exp|flat|chebN|bernN

const fit = fitBinned(hist, model, p0, { fixed, lower, upper, range: [lo, hi], minos: true });
fit.params, fit.errors, fit.covariance, fit.nll, fit.chi2, fit.ndf, fit.pValue, fit.pulls, fit.get('sig.yield')
fitUnbinned(values, model, p0, [lo, hi])       // extended for a Model with yields; also a plain (x, p) => density, normalised numerically
fitChi2(hist, model, p0, { variance: 'neyman' | 'pearson' })   // for comparison: biased at low counts
guessStart(hist, model)                        // peak finder for interactive use
profileParameter(fit, index, grid)             // profile likelihood of one fitted parameter
```

Conventions. Binned: −ln L = Σ(ν − n ln ν + ln n!) with ν the model integrated over each bin (exact erf/atan integrals, not bin-centre values); weighted histograms
use effective counts n²/Σw². The goodness of fit is the Baker–Cousins likelihood-ratio χ² (`fit.chi2`, `ndf` = bins − free parameters) and Pearson pulls. Crystal Ball:
Gaussian core with a power-law tail below mean − ασ. The yield of a component is ≥ 0 and widths are bounded by the fit range unless overridden.

## Significance

```ts
significance(s, b)          // Asimov Z = √(2((s+b) ln(1+s/b) − s)): the median expected discovery significance (derivation in the source)
significanceWithUncertainty(s, b, sigmaB)      // closed form with an uncertain background
pToZ(2.87e-7)  // 5; zToP(3) // 1.35e-3 (one-sided; pass true as the second argument for two-sided)

const model = { signal: [0, 2, 6, 10, 6, 2, 0], background: [...], nuisance: { name: 'bkg', relUnc: 0.1 } };   // CountingModel
discovery(model, data)      // { q0, z, p0 }: profile-likelihood ratio and the asymptotic p-value of Cowan, Cranmer, Gross, Vitells (2011)
expectedDiscovery(model)    // the same on the Asimov data set: the median expected significance
pseudoExperiments([10, 12, 9], 1000, rng(1))   // Poisson-fluctuated copies; or a function (rng) => anything
lookElsewhere(N, zLocal)    // global p = 1 − (1 − p)^N; grossVitells(zLocal, { meanCount, level }); lookElsewhereScan(expected, widths, zLocal, nToys, rng)
```

## Limits

```ts
cls(nObs, s, b)                    // CLs = P(N ≤ nObs | s+b)/P(N ≤ nObs | b) for a counting experiment (hook)
upperLimitCounting(nObs, b, 0.95)  // the s with CLs = 0.05;   expectedLimitsCounting(b) → median and ±1σ, ±2σ bands
upperLimit(model, data, { method: 'auto' | 'exact' | 'asymptotic' | 'toys', nToys, rng, cl })   // observed and expected limit on μ with bands
clsModel(model, data, mu, opts)    // { cls, clsb, clb, q }
```

## Hooks (the reader's code replaces the reference through `hook(name, reference)`)

| Hook | Signature | Exported wrapper |
|---|---|---|
| `analysis.fitLikelihood` | `(data: number[], model: (p: number[]) => number[], p0: number[]) => { params: number[]; nll: number; errors: number[] }` | `fitLikelihood` (reference: `fitLikelihoodReference`) |
| `analysis.significance` | `(s: number, b: number) => number` | `significance` (reference: `significanceReference`) |
| `analysis.cls` | `(nObs: number, s: number, b: number) => number` | `cls` (reference: `clsReference`) |

Internal code (the fits, the optimiser, the widgets) calls the references directly, so a wrong solution cannot break the library.

## Helpers for the chapters

* `selectionOptimiser(sig, bkg, [{ column: 'm', kind: 'window' }, { column: 'd', kind: 'min' }], opts)`: coordinate descent over cut thresholds (quantiles of the signal), several starts; the figure
  of merit is the Asimov Z (optionally with a background uncertainty). `parSignificance(...)` is 0.9 of the optimum, the "par" of a cuts exercise. Samples are `{ columns, n, weight }`
  (`sampleFromTable(table, weight)`): each event stands for `weight` expected events.
* `BlindedSample(values, [lo, hi])`: `sidebands()` always works; `signalRegion()`, `all()` and `count()` throw `BlindingError` until `unblind(reason)`, which is logged.
* `bumpHunt(hist, [2, 3, 4, 6], { background })`: best window and local p-value; `maxLocalZ` is the fast path used for thousands of pseudo-experiments.

## Validation (all in the tests, fixed seeds)

* Fits: 500 toys each of a Gaussian + exponential, binned (60 bins) and unbinned: pull means within ±0.15 of zero and central widths 0.93–1.06 for all five parameters.
* Asymptotics: the q₀ distribution of 2000 background-only toys with a nuisance parameter matches ½χ²₁ within statistics; the median toy significance for s = 20, b = 100 agrees with the Asimov
  value within 0.15σ; |Z_exact − Z_asymptotic| is 0.03σ at b = 100 and 0.016σ at b = 400; the closed form with a background uncertainty equals the exact on/off Asimov result.
* CLs: a counting example (b = 3, n = 3) is computed by direct Poisson sums in the test (95 % limit s = 5.395); n = 0 gives s = −ln 0.05 = 2.9957 for any b; the asymptotic, toy and exact CLs agree within
  10 %; toy limits fall on the ±1σ, ±2σ bands.
* Minimiser: Rosenbrock (2-D and 10-D), a correlated quadratic form (covariance = 2·errorDef·H⁻¹), parameter limits, fixed parameters, non-smooth functions, MINOS on a Poisson likelihood.
* Performance: 10⁶ events histogrammed in ≈ 85 ms; an unbinned Gaussian + exponential fit of 10⁵ events in ≈ 0.75–1.1 s (asserted under 3 s).
