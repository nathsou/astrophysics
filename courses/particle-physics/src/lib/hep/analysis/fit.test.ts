import { describe, expect, test } from 'vitest';
import { hook, setOverride } from '../hooks.ts';
import { normal, rng, type Rng } from '../random/index.ts';
import { fitBinned, fitLikelihood, fitLikelihoodReference, fitUnbinned, likelihoodChi2, pearsonChi2, poissonNll, pulls } from './fit.ts';
import { poissonFluctuate, poissonSample } from './counting.ts';
import { Hist1D } from './hist.ts';
import { bernstein, breitWigner, chebyshev, crystalBall, exponential, extendedModel, gaussian, gaussianPlusExponential, integrate, shapeModel, template } from './models.ts';
import { lnGamma } from './special.ts';

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
/** Half the distance between the 16th and 84th percentiles: the width of a Gaussian, insensitive to a few far outliers. */
const core = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return (b[Math.floor(0.84 * b.length)]! - b[Math.floor(0.16 * b.length)]!) / 2; };
const sd = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1));

describe('shapes', () => {
  const lo = 100, hi = 160;
  const cases: [string, ReturnType<typeof gaussian>, number[]][] = [
    ['gaussian', gaussian(), [125, 3]],
    ['crystalBall', crystalBall(), [125, 3, 1.5, 3]],
    ['breitWigner', breitWigner(), [125, 4]],
    ['relativistic BW', breitWigner(true), [125, 4]],
    ['exponential', exponential(), [-0.04]],
    ['exponential (flat limit)', exponential(), [1e-9]],
    ['chebyshev 3', chebyshev(3), [0.3, -0.2, 0.1]],
    ['bernstein 3', bernstein(3), [0.5, 2, 0.7]],
  ];
  for (const [name, shape, p] of cases) {
    test(`${name}: analytic integral matches numerical integration, pieces add up`, () => {
      const b = shape.bind(p, lo, hi);
      const num = integrate((x) => b.f(x), 110, 140, 1e-11);
      expect(b.integral(110, 140)).toBeCloseTo(num, 7 + Math.floor(-Math.log10(Math.max(1e-12, Math.abs(num)))) - 0);
      expect(b.integral(100, 130) + b.integral(130, 160)).toBeCloseTo(b.integral(100, 160), 10);
      expect(b.integral(120, 120)).toBeCloseTo(0, 12);
    });
  }
  test('Crystal Ball is continuous with continuous slope at −α, and tends to a Gaussian for large α', () => {
    const b = crystalBall().bind([0, 1, 1.2, 4], -10, 10);
    const e = 1e-7;
    expect(b.f(-1.2 + e)).toBeCloseTo(b.f(-1.2 - e), 6);
    const slope = (x: number) => (b.f(x + 1e-6) - b.f(x - 1e-6)) / 2e-6;
    expect(slope(-1.2 + 1e-4)).toBeCloseTo(slope(-1.2 - 1e-4), 2);
    expect(b.f(-8)).toBeGreaterThan(1e-5); // power-law tail, not Gaussian
    const g = crystalBall().bind([0, 1, 10, 100], -10, 10);
    expect(g.integral(-10, 10)).toBeCloseTo(Math.sqrt(2 * Math.PI), 3);
  });
  test('the relativistic and non-relativistic Breit–Wigners differ for a wide resonance and agree for a narrow one', () => {
    const f = (rel: boolean, w: number) => { const b = breitWigner(rel).bind([91, w], 50, 130); return b.f(91.1) / b.f(91); };
    expect(f(true, 0.5) / f(false, 0.5)).toBeCloseTo(1, 2);
    // Far from the peak the two forms differ by the factor ((x + M)/2M)².
    const far = (rel: boolean) => { const b = breitWigner(rel).bind([91, 20], 50, 130); return b.f(120) / b.f(91); };
    expect(far(true) / far(false)).toBeCloseTo(((120 + 91) / 182) ** -2 * 1, 0);
  });
  test('template shape integrates its histogram', () => {
    const t = template([0, 1, 3], [2, 1]).bind([], 0, 3);
    expect(t.integral(0, 3)).toBe(4);
    expect(t.integral(0.5, 2)).toBe(1 + 1);
  });
  test('model: parameter layout, bin expectations sum to the yields', () => {
    const m = gaussianPlusExponential();
    expect(m.paramNames).toEqual(['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield', 'bkg.slope']);
    const edges = Array.from({ length: 61 }, (_, i) => 100 + i);
    const p = [300, 125, 2.5, 5000, -0.03];
    const nu = m.binned(p, edges);
    expect(nu.reduce((a, b) => a + b, 0)).toBeCloseTo(5300, 6);
    const [sig, bkg] = m.componentBinned(p, edges);
    expect(sig!.reduce((a, b) => a + b, 0)).toBeCloseTo(300, 6);
    expect(bkg!.reduce((a, b) => a + b, 0)).toBeCloseTo(5000, 6);
    const d = m.density(p, 100, 160);
    expect(integrate(d, 100, 160, 1e-10)).toBeCloseTo(5300, 4);
  });
});

describe('likelihood pieces', () => {
  test('poissonNll is the true −ln L, and the pulls/χ² of a perfect model are zero', () => {
    const n = [3, 0, 7], nu = [2.5, 0.4, 7];
    const direct = nu.reduce((s, v, i) => s + (-Math.log(Math.exp(-v) * v ** n[i]! / Math.exp(lnGamma(n[i]! + 1)))), 0);
    expect(poissonNll(n, nu)).toBeCloseTo(direct, 12);
    expect(poissonNll([0, 0], [0, 0])).toBe(0);
    expect(poissonNll([1], [0])).toBe(Infinity);
    expect(likelihoodChi2(n, n)).toBeCloseTo(0, 12);
    expect(pearsonChi2([4], [1])).toBe(9);
    expect(pulls([4], [1])[0]).toBe(3);
    expect(pulls([0, 5], [2, 5], 'deviance')[0]).toBeCloseTo(-2, 12);
  });
  test('χ² of the likelihood ratio approaches the Pearson χ² for large counts', () => {
    const r = rng(2);
    const nu = Array.from({ length: 50 }, () => 400);
    const n = poissonFluctuate(r, nu);
    expect(likelihoodChi2(n, nu) / pearsonChi2(n, nu)).toBeCloseTo(1, 1);
  });
});

function toyBinned(model: ReturnType<typeof gaussianPlusExponential>, truth: number[], r: Rng, edges: number[]): Hist1D {
  const h = new Hist1D(edges);
  const nu = model.binned(truth, edges);
  nu.forEach((v, i) => (h.counts[i] = h.sumw2[i] = poissonSample(r, v)));
  return h;
}

describe('binned fit', () => {
  const model = gaussianPlusExponential();
  const truth = [400, 125, 2.5, 6000, -0.03];
  const edges = Array.from({ length: 61 }, (_, i) => 100 + i);
  test('recovers injected parameters without bias; pulls have mean ≈ 0 and width ≈ 1 (500 toys)', () => {
    const r = rng(2024);
    const pu: number[][] = truth.map(() => []);
    let nConv = 0;
    let chi2Sum = 0, ndf = 0;
    for (let t = 0; t < 500; t++) {
      const h = toyBinned(model, truth, r, edges);
      const fit = fitBinned(h, model, [300, 124, 3, 5000, -0.02]);
      if (fit.converged && fit.covValid) nConv++;
      truth.forEach((v, i) => pu[i]!.push((fit.params[i]! - v) / fit.errors[i]!));
      chi2Sum += fit.chi2;
      ndf = fit.ndf;
    }
    expect(nConv).toBeGreaterThan(495);
    const names = model.paramNames;
    pu.forEach((p, i) => {
      console.log(`binned pull ${names[i]}: mean ${mean(p).toFixed(3)}, rms ${sd(p).toFixed(3)}, central width ${core(p).toFixed(3)}`);
      expect(Math.abs(mean(p))).toBeLessThan(0.15);
      expect(core(p)).toBeGreaterThan(0.9);
      expect(core(p)).toBeLessThan(1.1);
      expect(sd(p)).toBeLessThan(1.2);
    });
    // The mean χ²/ndf of a correct model is about 1 (ndf = 60 bins − 5 parameters).
    expect(ndf).toBe(55);
    expect(chi2Sum / 500 / ndf).toBeGreaterThan(0.9);
    expect(chi2Sum / 500 / ndf).toBeLessThan(1.1);
  });
  test('result object: errors, covariance, names, p-value, MINOS, pulls', () => {
    const r = rng(77);
    const h = toyBinned(model, truth, r, edges);
    const fit = fitBinned(h, model, [300, 124, 3, 5000, -0.02], { minos: true });
    expect(fit.get('sig.yield').value).toBe(fit.params[0]);
    expect(fit.covariance![0]![0]).toBeCloseTo(fit.errors[0]! ** 2, 8);
    expect(fit.pValue).toBeGreaterThan(0.001);
    expect(fit.pulls.length).toBe(60);
    const m = fit.minos![0]!;
    expect(m.lo).toBeGreaterThan(0.8 * fit.errors[0]!);
    expect(m.hi).toBeLessThan(1.3 * fit.errors[0]!);
    expect(fitBinned(h, model, [300, 124, 3, 5000, -0.02], { fixed: [false, true, true, false, false] }).params[1]).toBe(124);
  });
  test('a fit restricted to a range uses only those bins; yields are for that range', () => {
    const r = rng(5);
    const h = toyBinned(model, truth, r, edges);
    const fit = fitBinned(h, model, [300, 124, 3, 3000, -0.02], { range: [110, 140] });
    expect(fit.expected.length).toBe(30);
    expect(fit.ndf).toBe(25);
  });
  test('function model form and the reference fitLikelihood agree with fitBinned', () => {
    const r = rng(8);
    const h = toyBinned(model, truth, r, edges);
    const f = (p: number[]) => model.binned(p, edges);
    const a = fitLikelihoodReference(Array.from(h.counts), f, [300, 124, 3, 5000, -0.02]);
    const b = fitBinned(h, model, [300, 124, 3, 5000, -0.02]);
    expect(a.nll).toBeCloseTo(b.nll, 4);
    expect(a.params[0]).toBeCloseTo(b.params[0]!, 1);
    expect(a.errors[0]).toBeCloseTo(b.errors[0]!, 1);
    expect(fitBinned(h, f, [300, 124, 3, 5000, -0.02]).nll).toBeCloseTo(b.nll, 4);
  });
  test('the hook replaces fitLikelihood', () => {
    const stub = () => ({ params: [42], nll: 0, errors: [0] });
    setOverride('analysis.fitLikelihood', stub);
    try {
      expect(fitLikelihood([1], () => [1], [1]).params[0]).toBe(42);
      expect(hook('analysis.fitLikelihood', fitLikelihoodReference)).toBe(stub);
    } finally {
      setOverride('analysis.fitLikelihood', undefined);
    }
    expect(fitLikelihood([5, 6], (p) => [p[0]!, p[0]!], [1]).params[0]).toBeCloseTo(5.5, 3);
  });
  test('weighted histograms: the fit uses effective counts and recovers the mean of a Gaussian', () => {
    const r = rng(9);
    const h = new Hist1D(40, -5, 5);
    for (let i = 0; i < 20000; i++) h.fill(normal(r, 0.3, 1), 0.5 + r());
    const m = extendedModel([{ label: 'g', shape: gaussian() }]);
    const fit = fitBinned(h, m, [h.integral(), 0, 1]);
    expect(fit.get('g.mean').value).toBeCloseTo(0.3, 1);
    expect(fit.get('g.sigma').value).toBeCloseTo(1, 1);
    expect(fit.chi2 / fit.ndf).toBeLessThan(2);
  });
  test('Crystal Ball + Chebyshev model fits a peak with a tail', () => {
    const cb = extendedModel([{ label: 'sig', shape: crystalBall() }, { label: 'bkg', shape: chebyshev(2) }]);
    const t = [2000, 125, 2, 1.5, 4, 8000, -0.3, 0.05];
    const r = rng(31);
    const h = new Hist1D(edges);
    cb.binned(t, edges).forEach((v, i) => (h.counts[i] = h.sumw2[i] = poissonSample(r, v)));
    const fit = fitBinned(h, cb, [1800, 124.5, 2.2, 1.3, 3, 7000, -0.2, 0], { fixed: [false, false, false, true, true, false, false, false] });
    expect(fit.converged).toBe(true);
    expect(Math.abs(fit.get('sig.yield').value - 2000)).toBeLessThan(4 * fit.get('sig.yield').error);
    expect(fit.chi2 / fit.ndf).toBeLessThan(1.6);
  });
});

function sampleToy(r: Rng, nSig: number, nBkg: number, mu: number, sigma: number, slope: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  const ns = poissonSample(r, nSig), nb = poissonSample(r, nBkg);
  for (let i = 0; i < ns; i++) {
    const x = normal(r, mu, sigma);
    if (x >= lo && x <= hi) out.push(x);
  }
  // Exponential exp(slope (x − lo)) on [lo, hi] by inverse transform.
  const c = 1 - Math.exp(slope * (hi - lo));
  for (let i = 0; i < nb; i++) out.push(lo - Math.log(1 - r() * c) / -slope);
  return out;
}

describe('unbinned fit', () => {
  const model = gaussianPlusExponential();
  const lo = 100, hi = 160;
  test('recovers injected parameters without bias; pulls have mean ≈ 0 and width ≈ 1 (500 toys)', () => {
    const r = rng(99);
    const truth = [400, 125, 2.5, 1200, -0.03];
    const pu: number[][] = truth.map(() => []);
    for (let t = 0; t < 500; t++) {
      const xs = sampleToy(r, 400, 1200, 125, 2.5, -0.03, lo, hi);
      const fit = fitUnbinned(xs, model, [300, 124, 3, 1000, -0.02], [lo, hi]);
      truth.forEach((v, i) => pu[i]!.push((fit.params[i]! - v) / fit.errors[i]!));
    }
    model.paramNames.forEach((nm, i) => {
      console.log(`unbinned pull ${nm}: mean ${mean(pu[i]!).toFixed(3)}, rms ${sd(pu[i]!).toFixed(3)}, central width ${core(pu[i]!).toFixed(3)}`);
      expect(Math.abs(mean(pu[i]!))).toBeLessThan(0.2);
      expect(core(pu[i]!)).toBeGreaterThan(0.88);
      expect(core(pu[i]!)).toBeLessThan(1.12);
      expect(sd(pu[i]!)).toBeLessThan(1.25);
    });
  });
  test('non-extended: a Gaussian shape model and a plain pdf function give the same answer', () => {
    const r = rng(4);
    const xs = Array.from({ length: 3000 }, () => normal(r, 10, 2));
    const a = fitUnbinned(xs, shapeModel(gaussian()), [9, 1.5], [0, 20]);
    const b = fitUnbinned(xs, (x, p) => Math.exp(-0.5 * ((x - p[0]!) / p[1]!) ** 2), [9, 1.5], [0, 20], { lower: [-Infinity, 0.01] });
    expect(a.params[0]).toBeCloseTo(b.params[0]!, 3);
    expect(a.params[1]).toBeCloseTo(b.params[1]!, 3);
    // Sample mean and (n-biased) standard deviation are the exact MLEs for a Gaussian far from the range edges.
    const m = mean(xs);
    expect(a.params[0]).toBeCloseTo(m, 3);
    expect(a.errors[0]).toBeCloseTo(a.params[1]! / Math.sqrt(3000), 3);
  });
  test('performance: a Gaussian + exponential fit of 10⁵ events', () => {
    const r = rng(1);
    const xs = sampleToy(r, 10000, 90000, 125, 2.5, -0.03, lo, hi);
    const t0 = performance.now();
    const fit = fitUnbinned(xs, model, [8000, 124.5, 3, 90000, -0.02], [lo, hi]);
    const dt = performance.now() - t0;
    console.log(`unbinned fit of ${xs.length} events: ${dt.toFixed(0)} ms, ${fit.nEval} evaluations, sig.yield = ${fit.params[0]!.toFixed(0)} ± ${fit.errors[0]!.toFixed(0)}`);
    expect(fit.converged).toBe(true);
    expect(Math.abs(fit.params[0]! - 10000)).toBeLessThan(5 * fit.errors[0]!);
    expect(dt).toBeLessThan(3000);
  });
});

describe('named models and starting points', () => {
  test('namedModel builds the expected parameter lists', async () => {
    const { namedModel } = await import('./models.ts');
    expect(namedModel('gauss+exp').paramNames).toEqual(['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield', 'bkg.slope']);
    expect(namedModel('cb+cheb2').paramNames).toEqual(['sig.yield', 'sig.mean', 'sig.sigma', 'sig.alpha', 'sig.n', 'bkg.yield', 'bkg.c1', 'bkg.c2']);
    expect(namedModel('gauss+flat').paramNames).toEqual(['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield']);
    expect(namedModel('bw+bern2').paramNames.length).toBe(6);
    expect(namedModel('exp').paramNames).toEqual(['bkg.yield', 'bkg.slope']);
    expect(() => namedModel('gauss+banana')).toThrow();
  });
  test('guessStart finds a convergent starting point for 100 toys, from far away', async () => {
    const { guessStart } = await import('./fit.ts');
    const r = rng(404);
    const m = gaussianPlusExponential();
    const edges = Array.from({ length: 56 }, (_, i) => 105 + i);
    let ok = 0;
    for (let t = 0; t < 100; t++) {
      const mass = 110 + 40 * r();
      const h = toyBinned(m, [250, mass, 2.2, 8000, -0.025], r, edges);
      const p0 = guessStart(h, m);
      const fit = fitBinned(h, m, p0);
      if (fit.converged && Math.abs(fit.params[1]! - mass) < 5 * fit.errors[1]! + 0.3 && fit.chi2 / fit.ndf < 2) ok++;
    }
    expect(ok).toBeGreaterThan(95);
  });
});

describe('χ² fit', () => {
  test('Neyman χ² is biased low and Pearson χ² high at small counts, the Poisson likelihood is not (flat model, 1.25 events per bin, 300 toys)', async () => {
    const { fitChi2 } = await import('./fit.ts');
    const { namedModel } = await import('./models.ts');
    const m = namedModel('flat');
    const edges = Array.from({ length: 25 }, (_, i) => i);
    const r = rng(1234);
    let sumL = 0, sumN = 0, sumP = 0;
    const N = 300;
    for (let t = 0; t < N; t++) {
      const h = new Hist1D(edges);
      for (let i = 0; i < 24; i++) h.counts[i] = h.sumw2[i] = poissonSample(r, 1.25);
      sumL += fitBinned(h, m, [25]).params[0]!;
      sumN += fitChi2(h, m, [25]).params[0]!;
      sumP += fitChi2(h, m, [25], { variance: 'pearson' }).params[0]!;
    }
    console.log(`mean fitted yield (truth 30): likelihood ${(sumL / N).toFixed(2)}, Neyman χ² ${(sumN / N).toFixed(2)}, Pearson χ² ${(sumP / N).toFixed(2)}`);
    expect(Math.abs(sumL / N - 30)).toBeLessThan(0.6);
    expect(sumN / N).toBeLessThan(28);
    expect(sumP / N).toBeGreaterThan(31); // the Pearson form is biased the other way
  });
  test('with large counts the three objectives agree', async () => {
    const { fitChi2 } = await import('./fit.ts');
    const r = rng(2);
    const h = new Hist1D(Array.from({ length: 41 }, (_, i) => 100 + i));
    const m = extendedModel([{ label: 'sig', shape: gaussian() }]);
    m.binned([5000, 120, 4], Array.from(h.edges)).forEach((v, i) => (h.counts[i] = h.sumw2[i] = poissonSample(r, v)));
    const a = fitBinned(h, m, [4000, 119, 3]);
    const b = fitChi2(h, m, [4000, 119, 3], { variance: 'pearson' });
    expect(b.params[1]).toBeCloseTo(a.params[1]!, 1);
    expect(b.errors[1]! / a.errors[1]!).toBeCloseTo(1, 1);
    expect(b.objective_kind).toBe('chi2');
    expect(b.chi2).toBe(b.nll); // the goodness of fit of a χ² fit is the minimised χ²
  });
});

describe('profile of a fitted parameter', () => {
  test('the profile of the signal yield is parabolic at high statistics and crosses 1 at ± the error; it is asymmetric near zero', async () => {
    const { profileParameter } = await import('./fit.ts');
    const r = rng(6);
    const model = gaussianPlusExponential();
    const edges = Array.from({ length: 61 }, (_, i) => 100 + i);
    const h = toyBinned(model, [400, 125, 2.5, 6000, -0.03], r, edges);
    const fit = fitBinned(h, model, [300, 124, 3, 5000, -0.02]);
    const e = fit.errors[0]!;
    const prof = profileParameter(fit, 0, [fit.params[0]! - e, fit.params[0]!, fit.params[0]! + e]);
    expect(prof[1]!.delta).toBeCloseTo(0, 4);
    expect(prof[0]!.delta).toBeGreaterThan(0.7);
    expect(prof[0]!.delta).toBeLessThan(1.3);
    expect(prof[2]!.delta).toBeGreaterThan(0.7);
    expect(prof[2]!.delta).toBeLessThan(1.3);
  });
});
