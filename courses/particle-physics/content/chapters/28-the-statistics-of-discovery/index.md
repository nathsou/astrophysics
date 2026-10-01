---
number: 28
title: The statistics of discovery
summary: Counting events, fitting a peak, turning an excess into a p-value and a number of standard deviations, and the ways an excess can fool you. Plus what to do when nothing is found, and two famous false alarms.
duration: About 3 hours
prerequisites: [a-needle-in-a-haystack, quantum-essentials]
---

An experiment expects 3.5 background events in a region of its histogram and finds 9. Nothing in the detector suggests anything wrong. Is that a new particle? The honest answer is a number, and the numbers have conventions. A physicist says that 3σ is "evidence", that 5σ is a "discovery", and that an excess which has disappeared when more data came in was a "fluctuation". All of these phrases are precise statements in probability theory, and all of them have been misused. This chapter derives them, because the next one claims a discovery and the claim has to mean something exact.

```predict
q: 'The background in a region is expected to be 3.5 events, with no signal. You observe 9. About how likely is it that background alone produces 9 or more events there?'
options:
  - text: About 1 in 10.
    why: 'That is the probability of a fluctuation of about one standard deviation. The excess here is 5.5 events, and the standard deviation of a Poisson count of 3.5 is √3.5 = 1.9, so it is nearly three of them.'
  - text: About 1 in 100.
    correct: true
    why: 'The exact Poisson tail is P(N ≥ 9 | 3.5) = 0.0099, a little under one in a hundred. That is 2.3σ by the conventions of this chapter. The naive estimate (9 − 3.5)/√3.5 = 2.9 overstates it, because a Poisson distribution with a small mean has a long tail on the high side.'
  - text: About 1 in a million.
    why: 'That would be nearly five standard deviations. With so few expected events, the tail of the Poisson distribution is long, and 9 is not as far out as it looks.'
```

::p-value{n="28.1" b=3.5 observed=9 caption="The p-value of a counting experiment. The bars are the Poisson distribution of the background-only count; the shaded tail is the probability of seeing the observed number or more. Drag b and the observed count. The 3σ and 5σ thresholds are marked, and the naive (N − b)/√b is shown beside the right answer. Add an uncertainty on b and the p-value grows."}

## Counting

Particles arrive independently, at a constant average rate. Whatever is being counted (muon pairs in a mass window, photons in a detector) follows the **Poisson distribution**. If the expected number of events is $\mu$, the probability of observing exactly $n$ is

:::equation{#poisson caption="The Poisson distribution: the probability of n events when μ are expected, for independent events at a steady average rate."}
$$P(\term{n}{n}\mid\term{mu}{\mu}) = \frac{\mu^{n}\,e^{-\mu}}{n!}$$

```terms
n:
  label: 'n, the observed count'
  what: A whole number of events: 0, 1, 2, … It is what the experiment sees in a bin, or in a whole region.
  why: Every analysis in the next chapter ends with counts: how many events in this window, in this bin.
  effect: For the same μ, the probability is largest near n = μ and falls off on both sides.
mu:
  label: 'μ, the expected count'
  what: The mean number of events, a positive real number, which need not be an integer. It is a property of the process: its cross-section times the luminosity times the efficiency.
  why: It is the prediction. The Poisson distribution turns a prediction of a rate into a prediction of how the counts will scatter about it.
  effect: The mean of the distribution is μ, and so is its variance, so the standard deviation is √μ. A count of 100 is known to ±10, a count of 4 to ±2.
```
:::

The rule "the error on a count of $N$ is $\sqrt N$" comes from the equality of the mean and the variance. It is an approximation that is good for large counts. For small ones it is bad: the distribution of 3.5 expected events is not symmetric, it cannot go below zero, and the probability of 9 or more is nearly four times larger than a Gaussian with the same mean and width would say. Particle physics is full of small counts, so this matters.

The Poisson distribution also has a derivation that is worth knowing because it says when it applies. Divide a time interval into $M$ small pieces, each of which contains an event with a small probability $\mu/M$, independently of all the others. The number of pieces with an event is binomial. Let $M$ grow and the binomial distribution converges to the Poisson. A proton–proton collision that makes a Higgs boson is exactly this kind of event: each of the $10^{9}$ collisions is an independent chance of a probability of about $10^{-9}$.

## Likelihoods and fits

Suppose the data are the counts $n_i$ in the bins of a histogram, and a model predicts the expected count $\nu_i(\theta)$ in each bin from a set of parameters $\theta$ (the size and position of a peak, the level and slope of a background). The probability of the data is the product of the Poisson probabilities of the bins. Regarded as a function of $\theta$ with the data held fixed, that probability is the **likelihood** of the parameters, and the best estimate of the parameters is the one that makes the observed data most probable. Products are awkward and so the logarithm is taken:

:::equation{#nll caption="The negative logarithm of the likelihood of binned Poisson data. The parameters that minimise it are the maximum-likelihood estimates."}
$$-\ln L(\term{theta}{\theta}) = \sum_{i}\Big[\term{nu}{\nu_i(\theta)} - \term{ni}{n_i}\,\ln\nu_i(\theta) + \ln n_i!\Big]$$

```terms
theta:
  label: 'θ, the parameters'
  what: The numbers the model depends on: for a peak on a background, the signal yield, the peak's position and width, and the background's level and slope.
  why: The fit's job is to find θ. The one that minimises −ln L is the maximum-likelihood estimate.
  effect: Move the peak's position away from where the data have it, and −ln L rises.
nu:
  label: 'ν_i(θ), the expected count in bin i'
  what: The model's prediction for the bin: the integral of the signal and background shapes over the bin's width, times the yields.
  why: It is where the physics enters. Change the model and the same data give different parameters.
  effect: ν_i must be positive (a count cannot be negative). A fit that steps to parameters where ν_i ≤ 0 has left the allowed region.
ni:
  label: 'n_i, the observed count in bin i'
  what: The number of events in the bin. It is a whole number, possibly zero.
  why: The data. The last term, ln n_i!, does not depend on θ, so it does not move the minimum, but it makes the value the true −ln L.
  effect: Bins with no events still contribute: the term ν_i says that a bin that was expected to have many, but had none, is unlikely.
```
:::

How uncertain is the answer? Near the minimum, $-\ln L$ is a parabola in each parameter. Its curvature tells how sharply the data prefer the best value. The uncertainty on a parameter is the distance over which $-\ln L$ rises by $\tfrac12$ (or $-2\ln L$ by 1), and for several parameters the covariance matrix is the inverse of the matrix of second derivatives (the Hessian). The library's `minimize` computes the Hessian at the minimum and returns the errors.

Why not minimise a sum of squares, $\sum (n_i - \nu_i)^2/n_i$, the χ² of a school laboratory? Because it is biased when counts are small. A bin with a fluctuation low weighs more, since its error $\sqrt{n_i}$ is smaller, and a bin with no events has infinite weight or is dropped. A fit of a peak on a falling background by χ² systematically underestimates the background and overestimates the signal; the Poisson likelihood does not. With 1,000 events in a bin the two agree; with 3 they do not.

::fit-explorer{mode="diphoton" n="28.2" caption="A toy histogram of a peak on a falling background, fitted by Poisson maximum likelihood. Drag the position, width and yield of the peak; the background is re-fitted at every step. −2 ln L tells you how far you are from the best fit, and the surface on the right is the likelihood in position and yield, with the contours at which −2 ln L has risen by 1 and 4 (one and two standard deviations for one parameter). Press Fit and the library's fitBinned finds the minimum."}

```fit
id: fit-peak-toy
title: Fit a peak in a low-statistics histogram
prompt: 'The histogram is a toy four-lepton mass spectrum with 24 bins between 100 and 160 GeV: a peak near 125 GeV and a falling background, with only 51 events in all. Fit a Gaussian peak on an exponential background by the Poisson likelihood, and submit the fitted signal yield (the number of events in the peak).'
model: gauss+exp
data:
  seed: 3
  range: [100, 160]
  bins: 24
  model: gauss+exp
  truth:
    sig.yield: 18
    sig.mean: 125
    sig.sigma: 1.8
    bkg.yield: 30
    bkg.slope: -0.012
  xLabel: 'm4ℓ [GeV]'
  unit: GeV
config:
  parameter: sig.yield
  methods: [nll, chi2]
  minPValue: 0.05
tolerance:
  abs: 2.5
answer: 24.4
explain: 'The maximum-likelihood fit gives a signal yield of 24.4 ± 5.5. The true value in the simulation is 18: the fit is 1.2 standard deviations above it, which is ordinary for a peak of 18 events. Try the χ² method: with so few events per bin it gives a different background and a different yield, and the discrepancy grows as the statistics fall.'
```

### Write it yourself

The library has a Poisson maximum-likelihood fitter. Here is the core of it, for you to write. Your function will join the pipeline's analysis stage: fits in the Higgs analysis of Chapter 29 will call it.

```code
id: fit-likelihood
title: A Poisson likelihood fit
hook: analysis.fitLikelihood
prompt: |
  Implement `fitLikelihood(data, model, p0)`. `data` are the observed counts in each bin. `model(p)` returns the expected count in each bin for parameters `p`.
  `p0` is the starting point. Return `{ params, nll, errors }`: the best parameters, the **negative log-likelihood** at the minimum, and the uncertainty on each parameter.

  - Write the negative log-likelihood of the equation above, including the `ln n!` term (`lnFactorial` is in `hep/analysis`).
  - A model that predicts `ν ≤ 0` in a bin where events were seen has zero likelihood: return `Infinity`. A bin with `n = 0` and `ν = 0` contributes nothing. The minimiser will visit parameters where the model misbehaves: your function must not return `NaN`.
  - Minimise it with `minimize` from `hep/analysis`. The errors of a −ln L minimisation correspond to a rise of ½ (the default).
starter: |
  import { lnFactorial, minimize } from 'hep/analysis';

  export function fitLikelihood(
    data: number[],
    model: (p: number[]) => number[],
    p0: number[],
  ): { params: number[]; nll: number; errors: number[] } {
    // −ln L(p) = Σ [ ν − n ln ν + ln n! ]
    const nll = (p: number[]): number => {
      return 0;
    };
    const r = minimize(nll, p0);
    return { params: r.x, nll: r.fval, errors: r.errors };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { fitLikelihood } from 'solution';
  import { fitLikelihoodReference, poissonSample } from 'hep/analysis';
  import { rng } from 'hep/random';

  test('one parameter that scales a shape: the fit is the ratio of the sums', () => {
    // ν = a × (1, 2, 3); data 10, 20, 30 → a = 60/6 = 10, and the error is a/√(Σn) = 10/√60
    const r = fitLikelihood([10, 20, 30], (p) => [p[0]!, 2 * p[0]!, 3 * p[0]!], [5]);
    expect(r.params[0]!).toBeCloseTo(10, 3);
    expect(r.errors[0]!).toBeCloseTo(10 / Math.sqrt(60), 3);
  });

  test('the error on a Poisson mean from one bin of 100 events is 10 (a rise of ½ in −ln L, not of 1)', () => {
    const r = fitLikelihood([100], (p) => [p[0]!], [80]);
    expect(r.params[0]!).toBeCloseTo(100, 2);
    expect(r.errors[0]!).toBeCloseTo(10, 1);
  });

  test('the value of −ln L includes the ln n! term', () => {
    // data 3, 0, 7 with a constant ν: the best ν is 10/3. −ln L = Σ(ν − n ln ν + ln n!)
    const nu = 10 / 3;
    const want = 3 * nu - 10 * Math.log(nu) + Math.log(6) + 0 + Math.log(5040);
    const r = fitLikelihood([3, 0, 7], (p) => [p[0]!, p[0]!, p[0]!], [1]);
    expect(r.params[0]!).toBeCloseTo(nu, 3);
    expect(r.nll).toBeCloseTo(want, 5);
  });

  test('it survives parameters where the model predicts ν ≤ 0', () => {
    // ν = a + b·x: the region a < 0 is forbidden. Start badly.
    const r = rng(5);
    const x = Array.from({ length: 10 }, (_, i) => i);
    const data = x.map((xi) => poissonSample(r, 5 + 2 * xi));
    const fit = fitLikelihood(data, (p) => x.map((xi) => p[0]! + p[1]! * xi), [0.5, 0.1]);
    const ref = fitLikelihoodReference(data, (p) => x.map((xi) => p[0]! + p[1]! * xi), [0.5, 0.1]);
    expect(Number.isFinite(fit.nll)).toBe(true);
    expect(fit.params[0]!).toBeCloseTo(ref.params[0]!, 2);
    expect(fit.params[1]!).toBeCloseTo(ref.params[1]!, 2);
  });

  test('a peak on a flat background: the fit matches the library and recovers the truth within its errors', () => {
    const r = rng(21);
    const edges = Array.from({ length: 41 }, (_, i) => 100 + 1.5 * i);
    const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
    const erf = (x: number) => {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
    };
    const model = (p: number[]) => edges.slice(0, -1).map((lo, i) => p[0]! + p[1]! * (Phi((edges[i + 1]! - p[2]!) / 2) - Phi((lo - p[2]!) / 2)));
    const truth = [12, 120, 130];
    const data = model(truth).map((nu) => poissonSample(r, nu));
    const fit = fitLikelihood(data, model, [8, 60, 128]);
    const ref = fitLikelihoodReference(data, model, [8, 60, 128]);
    for (let k = 0; k < 3; k++) {
      expect(fit.params[k]!).toBeCloseTo(ref.params[k]!, 1);
      expect(fit.errors[k]!).toBeGreaterThan(0.9 * ref.errors[k]!);
      expect(fit.errors[k]!).toBeLessThan(1.1 * ref.errors[k]!);
      expect(Math.abs(fit.params[k]! - truth[k]!)).toBeLessThan(4 * fit.errors[k]!);
    }
    expect(fit.nll).toBeCloseTo(ref.nll, 2);
  });
solution: |
  import { lnFactorial, minimize } from 'hep/analysis';

  export function fitLikelihood(
    data: number[],
    model: (p: number[]) => number[],
    p0: number[],
  ): { params: number[]; nll: number; errors: number[] } {
    const nll = (p: number[]): number => {
      const nu = model(p);
      let s = 0;
      for (let i = 0; i < data.length; i++) {
        const n = data[i]!;
        const v = nu[i]!;
        if (v > 0) s += v - n * Math.log(v) + lnFactorial(n);
        else if (n > 0 || v < 0) return Infinity; // zero likelihood
      }
      return s;
    };
    const r = minimize(nll, p0, { errorDef: 0.5 });
    return { params: r.x, nll: r.fval, errors: r.errors };
  }
hints:
  - 'In the sum, a bin with ν > 0 contributes `ν − n·Math.log(ν) + lnFactorial(n)`. Everything else is a special case: ν ≤ 0 with events is impossible.'
  - 'The fit is one line: `minimize(nll, p0)` returns `{ x, fval, errors }`. The errors are already for −ln L.'
```

## From a count to a number of standard deviations

Back to the nine events. The question is a precise one: if there were no signal, how often would the background alone fluctuate to 9 or more events? That probability is the **p-value**. For a counting experiment with a known expected background $b$ and $n_\mathrm{obs}$ observed events,

:::equation{#pvalue caption="The p-value, and its conversion to a significance Z: the number of standard deviations of a Gaussian with the same one-sided tail."}
$$\term{p}{p} = \sum_{k\ge n_\mathrm{obs}}\frac{e^{-b}\,b^{k}}{k!}, \qquad p = \int_{\term{Z}{Z}}^{\infty}\frac{e^{-x^2/2}}{\sqrt{2\pi}}\,dx = \tfrac12\operatorname{erfc}\!\left(\frac{Z}{\sqrt2}\right)$$

```terms
p:
  label: 'p, the p-value'
  what: The probability, calculated under the hypothesis that there is only background, of an outcome at least as extreme as the one observed. For a counting experiment, the chance of n_obs or more events.
  why: It measures how surprising the data are if there is nothing new. A small value makes the no-signal hypothesis hard to believe.
  effect: For b = 3.5 and 9 events, p = 0.0099. For the same b and 15 events, p = 1.5 × 10⁻⁵.
Z:
  label: 'Z, the significance'
  what: A re-expression of p in units of standard deviations: the number of σ for which a Gaussian has a one-sided upper tail of p.
  why: It gives one scale for every kind of measurement, counting or fitting, and it is the scale physicists use to say 'evidence' or 'discovery'.
  effect: 3σ is p = 1.35 × 10⁻³. 5σ is p = 2.87 × 10⁻⁷, about one in 3.5 million.
```
:::

Three cautions. First, the p-value is **not** the probability that there is no signal. It is the probability of the data if there is none. To get the probability of the hypothesis you would need a prior, and physicists do not quote it. Second, it is one-sided for a search: an excess counts and a deficit does not, which is why the conversion takes the upper tail only. (A two-sided convention doubles the p-value, and the same Z corresponds to twice the probability.) Third, the conversion is a convention, not a law. The convention that a discovery needs $Z \ge 5$ is partly history and partly prudence: a 5σ claim is one that is wrong, if the calculation is right, about once in 3.5 million such trials. The reasons that have been given for so strict a threshold are the ones that the rest of this chapter describes: a search looks in many places (the look-elsewhere effect), the systematic uncertainties are harder to model than the statistical ones and have tails that are not Gaussian, and a false claim of discovery costs a lot. An evidence level of 3σ has been reached many times by effects that then went away.:cite[lyons2008]

| Z (σ) | One-sided p | About 1 in |
|---|---|---|
| 1 | 0.159 | 6 |
| 2 | 0.0228 | 44 |
| 3 | 1.35 × 10⁻³ | 741 |
| 4 | 3.17 × 10⁻⁵ | 31,600 |
| 5 | 2.87 × 10⁻⁷ | 3,490,000 |

The two experiments' discovery papers of July 2012 report, for the excess that became the Higgs boson, a local p-value of $1.7\times10^{-9}$ for ATLAS (quoted there as 5.9σ), and 5.0σ for CMS.:cite[atlashiggs2012,cmshiggs2012] A p-value of $1.7\times10^{-9}$ is, by the formula above, 5.91σ.

### The significance you expect before you look

Before taking the data, an experiment wants to know how significant a signal of size $s$ would be on top of a background $b$: the **expected** significance, used to plan an analysis and to choose cuts (Chapter 29). The simplest rule of thumb is $Z \approx s/\sqrt b$. It is wrong when $b$ is small. A better answer comes from the likelihood ratio.

:::equation{#asimov caption="The median significance expected for a signal s over a known background b (the 'Asimov' significance)."}
$$\term{Za}{Z} = \sqrt{2\left[(s+b)\,\ln\!\left(1+\frac{\term{s}{s}}{\term{b}{b}}\right) - s\right]}$$

```terms
Za:
  label: 'Z, the expected significance'
  what: The median number of standard deviations at which experiments with this signal and background would reject the no-signal hypothesis.
  why: It is how you compare two selections before opening the data, without simulating thousands of experiments.
  effect: For s = 10 and b = 10 it is 2.78σ, while s/√b says 3.16. For s ≪ b the two agree.
s:
  label: 's, the expected signal'
  what: The expected number of signal events that survive the selection.
  why: It is the cross-section times the luminosity times the efficiency of the selection (Chapter 27).
  effect: Z grows about in proportion to s when s ≪ b, and about as √s when s ≫ b.
b:
  label: 'b, the expected background'
  what: The expected number of background events that survive the selection, taken here as known exactly.
  why: A large background hides a signal. Improving the selection, at the cost of some signal, often raises Z.
  effect: Halving b at fixed s raises Z by about 40 % when b ≫ s.
```
:::

:::deeper[Where the Asimov formula comes from]
Let the data be a single count $n \sim \mathrm{Poisson}(\mu s + b)$, with $\mu = 1$ for signal and $\mu = 0$ for background only. The likelihood ratio of the background-only hypothesis to the best-fit signal strength is $\lambda = L(0)/L(\hat\mu)$. The best fit has $\hat\mu s + b = n$, so $L(\hat\mu) = e^{-n}n^n/n!$ and $L(0) = e^{-b}b^n/n!$, giving $\lambda = (b/n)^n e^{\,n-b}$. By Wilks' theorem, for large samples $-2\ln\lambda$ follows a $\chi^2$ distribution with one degree of freedom, so the significance of an excess is $Z = \sqrt{-2\ln\lambda} = \sqrt{2\,[\,n\ln(n/b) - n + b\,]}$.:cite[cowan2011]

That depends on the random $n$. To get the median experiment without simulating anything, replace $n$ by its expectation if the signal is present, $n = s + b$: the **Asimov data set**, named after a short story in which a data set's expectation is used as the data. Then $Z = \sqrt{2[(s+b)\ln((s+b)/b) - s]}$, which is the formula above. For $s \ll b$, expand $\ln(1 + s/b) = s/b - s^2/2b^2 + \dots$ and the bracket becomes $s^2/2b + O(s^3/b^2)$, so $Z \to s/\sqrt b$, which is the rule of thumb.
:::

You can now write the function that decides, in the pipeline, which selection is better. The numerical detail is in the small-signal limit: the bracket is the difference of two nearly equal numbers, and computing it naively loses all its digits.

```code
id: significance
title: The expected significance
hook: analysis.significance
prompt: |
  Implement `significance(s, b)`: the median expected significance of a signal of `s` events over an expected background of `b` events,
  `Z = √(2((s + b) ln(1 + s/b) − s))`.

  - No signal (`s ≤ 0`): return 0. No background and some signal (`b ≤ 0`, `s > 0`): return `Infinity`.
  - For a tiny signal the bracket is the difference of two numbers that are nearly equal. Try `s = 1e-9`, `b = 1`: the answer is very close to `s/√b = 1e-9`. There is a standard-library function that computes `ln(1 + x)` accurately for small `x`.
starter: |
  export function significance(s: number, b: number): number {
    // Z = sqrt(2 ((s + b) ln(1 + s/b) − s))
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { significance } from 'solution';
  import { significanceReference } from 'hep/analysis';

  test('known values', () => {
    expect(significance(10, 10)).toBeCloseTo(2.7795480248, 6);
    expect(significance(1, 1)).toBeCloseTo(0.8789702624, 6);
    expect(significance(20, 4)).toBeCloseTo(6.7826583664, 6);
    expect(significance(5, 100)).toBeCloseTo(0.4959178113, 6);
  });

  test('it tends to s/√b when the background is large, and is smaller than s/√b when b is small', () => {
    expect(significance(1, 10000)).toBeCloseTo(0.01, 4);
    expect(significance(10, 2)).toBeLessThan(10 / Math.sqrt(2));
  });

  test('no signal gives zero, no background gives infinity', () => {
    expect(significance(0, 10)).toBe(0);
    expect(significance(-3, 10)).toBe(0);
    expect(significance(5, 0)).toBe(Infinity);
  });

  test('a very small signal does not lose its digits', () => {
    const z = significance(1e-9, 1);
    expect(Number.isNaN(z)).toBe(false);
    expect(Math.abs(z / 1e-9 - 1)).toBeLessThan(1e-3);
    expect(Math.abs(significance(1e-6, 100) / 1e-7 - 1)).toBeLessThan(1e-3);
  });

  test('it agrees with the library over a grid, and grows with s', () => {
    let last = 0;
    for (const b of [0.1, 1, 10, 1000]) {
      last = 0;
      for (const s of [0.01, 0.1, 1, 10, 100, 1e4]) {
        const z = significance(s, b);
        expect(z).toBeCloseTo(significanceReference(s, b), 9);
        expect(z).toBeGreaterThan(last);
        last = z;
      }
    }
  });
solution: |
  export function significance(s: number, b: number): number {
    if (!(s > 0)) return 0;
    if (!(b > 0)) return Infinity;
    // log1p(x) = ln(1 + x) without the rounding error of forming 1 + x first
    return Math.sqrt(2 * ((s + b) * Math.log1p(s / b) - s));
  }
hints:
  - '`Math.log1p(x)` is `ln(1 + x)` computed accurately for small x. Write `Math.log1p(s / b)`.'
  - 'Test the two edge cases first: s ≤ 0 and b ≤ 0. The formula itself divides by b.'
```

## The look-elsewhere effect

The p-value above assumed that the location of the bump was decided before the data were looked at. A search for a new particle of unknown mass does not do that. It looks for a bump **anywhere** in a spectrum, and some bin will have the largest fluctuation. Flip a fair coin a hundred times and the chance of *some* run of seven heads is large, even though a run of seven at a particular place is unlikely. The p-value of a particular bin, found after looking, is the **local** p-value. The probability that *somewhere* in the search range the background fluctuates at least as much is the **global** p-value, and it is larger.

If there are $N$ independent places to look, each with local probability $p_\mathrm{local}$, the chance that at least one fluctuates that far is

:::equation{#lee caption="The global p-value for N independent looks: the chance that some place in the spectrum fluctuates as much as the observed one."}
$$\term{pg}{p_\text{global}} = 1 - \left(1 - \term{pl}{p_\text{local}}\right)^{\term{N}{N}} \;\approx\; N\,p_\text{local}$$

```terms
pg:
  label: 'p_global, the global p-value'
  what: The probability that, with only background and with the freedom to look anywhere in the search range, the most significant bump is at least as significant as the observed one.
  why: It is the number that says whether the bump is surprising given that you looked in N places.
  effect: A 3σ local excess among 100 independent looks has a global p-value of 0.13, which is 1.1σ. That is an ordinary fluctuation.
pl:
  label: 'p_local, the local p-value'
  what: The p-value of the bump calculated as if its position had been chosen in advance.
  why: It is what the fit reports at the bump.
  effect: A local p-value of 1.35 × 10⁻³ is a 3σ effect.
N:
  label: 'N, the number of independent looks'
  what: The effective number of independent places that a bump of this width could have appeared, roughly the width of the search range divided by the width of the resolution.
  why: It is the trials factor. For a search in a mass range of 100 GeV, for a resonance with a width of 2 GeV, it is of order 50.
  effect: The bigger the range searched, or the narrower the peak, the bigger N and the weaker the global significance of a given local one.
```
:::

The effective $N$ is not simply the number of bins: neighbouring windows overlap. For a scan the trials factor can be estimated from the number of times the local significance curve crosses a low level (Gross and Vitells), or from a large number of pseudo-experiments with no signal, and the second is what the flagship figure below does.:cite[grossvitells2010]

::bump-hunter{n="28.3" signal=0 seed=2 toys=2000 caption="The bump hunter. A smoothly falling background with a signal you can inject (set it to 0 to see a pure-background spectrum), scanned with windows of several widths. The most significant window is reported with its local p-value. Then 2,000 signal-free pseudo-experiments, run here from a fixed seed, are scanned in the same way: the distribution of their largest local significance shows how often fluctuations alone fake a bump somewhere in the spectrum. The fraction at least as extreme as yours is the global p-value. Press the seed button and look at how often a 'discovery' of 2σ or 3σ appears from nothing."}

::look-elsewhere{n="28.4" windows=100 z=3 caption="Local against global significance. Drag the number of independent windows and the local significance and read the global one. The 'scenario' button loads a schematic story of the kind told in the next box: the numbers are illustrative and of the order of the ones reported, not the experiments' own."}

:::history{year=2016 title="The 750 GeV bump" people="The ATLAS and CMS collaborations" source="Sources: ATLAS (2016) JHEP 09, 001; CMS (2016) Phys. Rev. Lett. 117, 051802; ATLAS-CONF-2016-059; CMS-PAS-EXO-16-027."}
On 15 December 2015, at a seminar at CERN, ATLAS and CMS each showed a small excess of events in the mass spectrum of pairs of photons, near 750 GeV. The data were the first 13 TeV collisions of Run 2: about 3 fb⁻¹ in each experiment. The local significance was about 3.9σ in ATLAS (for a particular width of the resonance) and 2.6σ in CMS.:cite[atlasdiphoton2016,cmsdiphoton2016] The search had been made over a wide mass range and several widths, so the global significances were a good deal smaller: about 2σ for ATLAS. Both were still well below 5σ, and both collaborations said so. The excess nevertheless attracted a great deal of attention, and a large number of theory papers proposed particles that would explain it.

In August 2016 both experiments presented the analysis of the larger data set of 2016, several times the size. The excess was not there: with more data, in both experiments, the bump at 750 GeV had gone.:cite[atlasdiphoton2016conf,cmsdiphoton2016conf] The excess had been a fluctuation, and in the terms of this chapter it was a textbook case: a local significance that looked interesting, a look-elsewhere effect that made the global one modest, a number of events so small (a few tens in the region) that a Poisson fluctuation of a few events was enough, and no way to distinguish a fluctuation from a particle other than to take more data. Nobody had made a mistake, and the procedure worked: the conventions of this chapter are what stopped a fluctuation from being called a discovery.
:::

## Systematic uncertainties and nuisance parameters

Everything so far has assumed that $b$, the expected background, is known exactly. It never is. The background comes from a simulation with its own uncertainties, or from a fit to the sidebands, or from a measurement elsewhere, and the **systematic** uncertainty on it does not shrink with more data in the signal region. (A **statistical** uncertainty does: it is the scatter of the counts themselves.) Examples are the uncertainty on the luminosity, on the efficiency of the trigger and of the selection, on the energy scale of the detector, and on the theory's cross-sections.

The standard way to include them is to add a **nuisance parameter** $\theta$, a parameter of the model that is not of interest but that the data can constrain. For a background known to a relative uncertainty $\delta$, write $b \to b(1 + \delta\theta)$ and put a Gaussian constraint on $\theta$ of mean 0 and width 1, which says what was known about it beforehand. The fit then adjusts $\theta$ to suit the data while paying a penalty for going far from 0, and the uncertainty of the quantity of interest (the signal strength μ) is found by **profiling**: at each value of μ, minimise over $\theta$. Its effect on a counting experiment is to add, in quadrature, the uncertainty on $b$ to the statistical one:

:::equation{#syst caption="The uncertainty on a measured signal strength μ from a counting experiment: the statistical and systematic parts add in quadrature."}
$$\term{sigmu}{\sigma_\mu}^2 \approx \frac{s + b}{s^2} + \left(\frac{\term{delta}{\delta}\,b}{s}\right)^{2}$$

```terms
sigmu:
  label: 'σ_μ, the uncertainty on the signal strength'
  what: The standard deviation of the measured ratio μ of the observed signal to the expected one, for a counting experiment.
  why: It says how well the size of the signal is known. A discovery needs μ to be several σ_μ from zero.
  effect: With s = 50 and b = 200 and no systematic, σ_μ = 0.32. With a 10 % systematic on b, it is 0.46.
delta:
  label: 'δ, the relative systematic uncertainty on b'
  what: The fractional uncertainty on the expected background: 0.1 for 10 %.
  why: It does not depend on the amount of data. More luminosity reduces the first term and leaves this one.
  effect: When δb is larger than the statistical √(s+b), the measurement is systematics-limited, and collecting more of the same data no longer helps.
```
:::

::systematics{n="28.5" caption="Left: a counting experiment measuring a signal strength μ. The background is known only to within a fraction δ, modelled by a nuisance parameter with a Gaussian constraint. Profiling the nuisance parameter widens the likelihood curve of μ: the statistical and systematic parts add in quadrature. Right: the published LEP result for the number of light neutrino types, before and after a correction to the calculation behind the luminosity measurement (Chapter 23)."}

The right-hand panel of the figure is a real example. The number of light neutrino species measured from the width of the Z at LEP was $N_\nu = 2.9840 \pm 0.0082$ in the 2006 combination of the four experiments.:cite[lepewwg2006] In 2020 Janot and Jadach improved the calculation of the Bhabha scattering cross-section, the process that LEP used to measure its luminosity, and the result moved to $2.9963 \pm 0.0074$, closer to 3 by about 1.5 standard deviations of the old error.:cite[janotjadach2020] Nothing was wrong with the data. What changed was the model of a process that entered the normalisation. That is what a systematic uncertainty is: **a model that might be wrong**.

:::programmer
A systematic uncertainty is the error bar on the *specification*, not on the program. A test suite that passes tells you nothing if the tests encode a wrong idea of what the software should do. The physicist's version of the test that matters is the **validation in a control region**: a part of the data where the signal is known to be absent, in which the background model's prediction can be compared with the real data. If it fails there, the nuisance parameters are too tightly constrained, or there is a missing one. In software terms the nuisance parameters are the configuration values you do not know exactly, and profiling is reporting the answer over their plausible range instead of for one default.
:::

:::history{year=2011 title="Neutrinos that seemed to outrun light" people="The OPERA collaboration" source="Sources: Adam et al. (OPERA), arXiv:1109.4897 and JHEP 10 (2012) 093."}
In September 2011 the OPERA experiment, a detector at the Gran Sasso laboratory in Italy, reported that muon neutrinos sent from CERN, 730 km away, arrived earlier than light would have taken to travel the same distance. The difference was $60.7 \pm 6.9\ (\text{stat.}) \pm 7.4\ (\text{syst.})$ ns. Light takes 2.435 ms to go 730 km, so 60.7 ns is a relative difference of $2.5\times10^{-5}$: the statistical and systematic errors added in quadrature give 10.1 ns and 6.0σ. By the convention of this chapter, that is a discovery. The collaboration did not claim one: they said they had found no explanation and asked others to check.:cite[opera2012]

In 2012 the collaboration found two problems with the timing. A fibre-optic cable that carried the timing signal from the GPS receiver to the experiment's clock had not been fully connected, which delayed the signal and biased the flight time in the direction of making the neutrinos look early. A second effect, from an oscillator in the clock, went the other way and was smaller. After correction the result was compatible with neutrinos travelling at the speed of light, which was also what other experiments in the same laboratory measured.:cite[opera2012] This is a systematic uncertainty in the sense of the chapter: a significance of 6σ was a statement about the statistical fluctuations of the measurement, and the real uncertainty was in the apparatus, which was not in the Gaussian error bar. The extraordinary claim received extraordinary scrutiny, and the lesson applies to a discovery of any size.
:::

## Blinding

There is a subtler way to fool yourself than a fluctuation, and it needs no mistakes in calculation. If an analyst looks at the signal region and adjusts the selection, the binning, the range of the fit or the choice of background model until the excess grows, the final p-value no longer means what the formula says: it is the p-value of the most favourable of many analyses, which is another look-elsewhere effect, hidden in the choices. The remedy is **blinding**. The signal region of the data is hidden while the analysis is developed, on simulation and on the sidebands, and the selection and the background model are then frozen. Only after that is the box opened. It is the held-out test set of machine learning: the data you tune on and the data you report on must be different, and the test set is looked at once.

```ts
const d = new BlindedSample(masses, [120, 130]);
d.sidebands();                 // always available
d.signalRegion();              // throws BlindingError: the events inside the window are hidden
d.count();                     // throws too: the total would reveal how many are inside
d.unblind('analysis frozen, approved at review 12');   // irreversible, and logged
```

:::hood[A blinded sample that refuses to show you the signal region]
The library's `BlindedSample` (in `hep/analysis`) keeps the events in a private array and makes every accessor that could reveal something about the signal region throw until `unblind(reason)` is called. Note what has to be blocked: not only the events in the window, but `count()`, because the total minus the sidebands is the count in the window, and `histogram()`, where a bin that straddles the window's edge would leak its content (those bins are emptied too). The reason has to be given, because the log is the record of when and why the box was opened. The code is small; what matters is that every method had to be examined for a side channel, which is the same thing a security review does.
:::

## Limits: what to say when there is nothing

Most searches find nothing. That is also a result, and it has to be stated as a number. The standard form is an **upper limit**: signals larger than some size are excluded at 95 % confidence. The plain approach would be to ask how probable the observed number of events would be if a signal of size $s$ were present, $\mathrm{CL}_{s+b} = P(N \le n_\mathrm{obs} \mid s + b)$, and to exclude the $s$ at which it falls below 5 %. It has a flaw. If the data fluctuate *down*, to a count well below the background expectation, every $s$ is excluded, including signals so small that the experiment could never have seen them. The method claims a sensitivity it does not have.

The fix used at LEP, the Tevatron and the LHC is to divide by how probable the same outcome is **without** a signal, $\mathrm{CL}_b = P(N \le n_\mathrm{obs}\mid b)$:

:::equation{#cls caption="The CLs ratio: the probability of a result this low with signal, divided by its probability with background only."}
$$\mathrm{CL}_s = \frac{\term{clsb}{\mathrm{CL}_{s+b}}}{\term{clb}{\mathrm{CL}_b}}, \qquad \text{excluded at 95 \% if } \mathrm{CL}_s < 0.05$$

```terms
clsb:
  label: 'CLs+b, the signal-plus-background probability'
  what: The probability, if the signal is present with size s, of observing at most the observed number of events.
  why: A small value means the data have too few events for this signal to be there.
  effect: For a signal of zero size it equals CLb.
clb:
  label: 'CLb, the background-only probability'
  what: The probability of observing at most the observed number of events if there is only background.
  why: When the data fluctuate low, CLb is small, and dividing by it keeps the ratio from collapsing. It is the protection against excluding signals the experiment could not have seen.
  effect: A downward fluctuation of the data that would exclude everything by CLs+b alone barely changes CLs.
```
:::

The price is that the limit is **conservative**: it excludes slightly less than 95 % of the cases it is meant to, and in return it never excludes what the experiment could not test. The method was introduced by Read and, in an earlier form, Junk.:cite[read2002,junk1999] For an observation of zero events, the limit comes out the same whatever the background: the 95 % limit is $s < -\ln 0.05 = 3.0$ events.

::limit-explorer{n="28.6" caption="CLs limits for a counting experiment. The white curve is CLs as a function of the signal size; the limit is where it crosses 0.05. The dashed curve is CLs+b alone, which is the quantity not to quote. The blue band is the range of limits that an experiment with no signal and this background would get, to ±1σ. Set N to 0 and the limit is 3.0 whatever b. Set b large and N small: CLs+b alone would exclude everything, and CLs does not."}

:::experiments
In the LHC experiments the p-values and limits are not calculated with the Poisson sums of this chapter but with a **profile likelihood** over a model with hundreds of bins and hundreds of nuisance parameters, using the asymptotic formulae of Cowan, Cranmer, Gross and Vitells, which replace millions of pseudo-experiments by a formula that holds when the statistics are large.:cite[cowan2011] The fitting tool in the two experiments is **RooFit**, part of ROOT (Chapter 27), with **RooStats** for the statistics, both written by members of the collaborations, and the combination of ATLAS and CMS for the Higgs discovery was made with a common, agreed statistical procedure (the LHC Higgs Combination Group's) so that results could be added. The profile-likelihood ratio is the quantity that this chapter's `hep/analysis` computes (`discovery`, `upperLimit`) for a simple counting model; the reference implementation of a limit on a signal strength uses the same CLs formula. The 5σ convention is applied to the **local** significance in the Higgs papers, and their global significance is quoted separately.
:::

## What comes next

The tools are in place: the Poisson count, the likelihood, the significance, the look-elsewhere effect, the nuisance parameter and the limit. [Chapter 29](/chapters/finding-the-higgs/) uses them in earnest. It fits a peak in a mass spectrum produced by the whole of the pipeline, machine, generator, detector, reconstruction and trigger, and then does the same analysis on real data, and reports the result with its uncertainty, honestly.

## Further reading

- Cowan, Cranmer, Gross and Vitells: *Asymptotic formulae for likelihood-based tests of new physics* (:cite[cowan2011]). The standard reference for significance and limits at the LHC.
- Lyons: *Open statistical issues in particle physics*, on 5σ, the look-elsewhere effect and systematics (:cite[lyons2008]).
- Gross and Vitells on the look-elsewhere effect (:cite[grossvitells2010]); Read on CLs (:cite[read2002]).
- The OPERA paper for the full account of the timing problem (:cite[opera2012]).
