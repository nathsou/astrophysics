import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import { rng } from '../random/index.ts';
import { poissonCdf, poissonPmf, poissonSample, poissonTail, pToZ, zToP } from './counting.ts';
import { asimovData, fitMu, medianDiscoveryZ, muUncertainty, nllCounting, profileTheta, qZero, type CountingModel } from './likelihood.ts';
import { discovery, expectedDiscovery, grossVitells, lookElsewhere, pseudoExperiments, pValueCounting, pValueWithUncertainty, significance, significanceReference, significanceWithUncertainty, simpleZ, toyPValue } from './significance.ts';
import { lookElsewhereScan, localScan, upcrossings } from './bumphunt.ts';
import { chi2Sf } from './special.ts';

describe('counting significance', () => {
  test('Z = √(2((s+b)ln(1+s/b) − s)): known values and the s/√b limit', () => {
    expect(significanceReference(1, 1)).toBeCloseTo(Math.sqrt(2 * (2 * Math.log(2) - 1)), 12);
    expect(significanceReference(10, 100)).toBeCloseTo(1.0, 1);
    // For s ≪ b: Z → s/√b.
    expect(significanceReference(1, 1e4) / simpleZ(1, 1e4)).toBeCloseTo(1, 3);
    // For s ≫ b the simple formula badly overstates.
    expect(simpleZ(50, 1)).toBeGreaterThan(2 * significanceReference(50, 1));
    expect(significanceReference(0, 5)).toBe(0);
    expect(significanceReference(3, 0)).toBe(Infinity);
    expect(significanceReference(5, 5) > significanceReference(3, 5)).toBe(true);
  });
  test('the Asimov Z is the median experiment: it equals √q₀ of the profile-likelihood ratio on the data n = s + b', () => {
    for (const [s, b] of [[5, 10], [20, 100], [3, 1], [50, 7]] as const) {
      const m: CountingModel = { signal: [s], background: [b] };
      expect(medianDiscoveryZ(m, 1)).toBeCloseTo(significanceReference(s, b), 6);
    }
  });
  test('the hook replaces significance', () => {
    setOverride('analysis.significance', () => 42);
    try {
      expect(significance(1, 1)).toBe(42);
    } finally {
      setOverride('analysis.significance', undefined);
    }
    expect(significance(1, 1)).toBeCloseTo(0.879, 3);
  });
  test('q₀ of one bin with known background is 2(n ln(n/b) − n + b) for an excess and 0 for a deficit', () => {
    const m: CountingModel = { signal: [1], background: [50] };
    expect(qZero(m, [70])).toBeCloseTo(2 * (70 * Math.log(70 / 50) - 20), 7);
    expect(qZero(m, [50])).toBe(0);
    expect(qZero(m, [30])).toBe(0);
    expect(discovery(m, [70]).p0).toBeCloseTo(zToP(Math.sqrt(qZero(m, [70]))), 12);
  });
  test('asymptotic p-value vs the exact Poisson tail: within 0.25σ at b = 100, and improving with b', () => {
    const cases: [number, number][] = [[100, 135], [400, 470]];
    const dz: number[] = [];
    for (const [b, n] of cases) {
      const exact = pToZ(pValueCounting(n, b));
      const asym = discovery({ signal: [1], background: [b] }, [n]).z;
      dz.push(Math.abs(exact - asym));
    }
    console.log('|Z_exact − Z_asymptotic| at b = 100, 400:', dz.map((v) => v.toFixed(3)).join(', '));
    expect(dz[0]).toBeLessThan(0.25);
    expect(dz[1]).toBeLessThan(dz[0]! + 0.02);
  });
  test('background uncertainty: the closed form is the exact on/off Asimov result; the Gaussian-θ profile model agrees to 1 % for uncertainties up to 10 %', () => {
    for (const [s, b, rel] of [[10, 100, 0.1], [30, 50, 0.3], [5, 20, 0.05], [100, 400, 0.2]] as const) {
      const sigmaB = rel * b;
      const closed = significanceWithUncertainty(s, b, sigmaB);
      // On/off problem: n ~ Pois(s + b), control region m ~ Pois(τ b) with τ = b/σ_b². For μ = 0 the profiled background is (n + m)/(1 + τ).
      const tau = b / sigmaB ** 2, n = s + b, m = tau * b;
      const bHat = (n + m) / (1 + tau);
      const onOff = Math.sqrt(2 * (n * Math.log(n / bHat) + m * Math.log(m / (tau * bHat))));
      expect(closed).toBeCloseTo(onOff, 9);
      const gaussianTheta = medianDiscoveryZ({ signal: [s], background: [b], nuisance: { name: 'bkg', relUnc: rel } }, 1);
      expect(Math.abs(gaussianTheta / closed - 1)).toBeLessThan(rel <= 0.1 ? 0.012 : 0.15);
      expect(closed).toBeLessThan(significanceReference(s, b));
    }
    expect(significanceWithUncertainty(10, 100, 1e-9)).toBeCloseTo(significanceReference(10, 100), 6);
    // A large systematic makes the significance approach s/σ_b.
    expect(significanceWithUncertainty(10, 100, 100)).toBeCloseTo(0.1, 1);
  });
  test('p-value with an uncertain background is larger than with a known one', () => {
    expect(pValueWithUncertainty(150, 100, 10)).toBeGreaterThan(pValueCounting(150, 100));
    expect(pValueWithUncertainty(150, 100, 1e-12)).toBeCloseTo(pValueCounting(150, 100), 10);
  });
});

describe('profile likelihood machinery', () => {
  const shape: CountingModel = {
    signal: [0, 1, 4, 10, 4, 1, 0, 0],
    background: [50, 45, 42, 38, 35, 32, 30, 28],
    nuisance: { name: 'bkg norm', relUnc: 0.1 },
  };
  test('profileTheta minimises −ln L over θ: nearby values are higher', () => {
    const data = [55, 50, 47, 45, 38, 33, 31, 30];
    const p = profileTheta(shape, data, 0.5);
    for (const d of [-0.05, 0.05]) expect(nllCounting(shape, data, 0.5, p.theta + d)).toBeGreaterThan(p.nll);
    // Data above the prediction pull θ up.
    expect(p.theta).toBeGreaterThan(0);
  });
  test('fitMu: on the Asimov data for μ′ it returns μ′ and θ = 0; on background-only it returns 0', () => {
    const a = fitMu(shape, asimovData(shape, 1.7));
    expect(a.mu).toBeCloseTo(1.7, 6);
    expect(a.theta).toBeCloseTo(0, 6);
    expect(fitMu(shape, asimovData(shape, 0)).mu).toBe(0);
    expect(fitMu(shape, shape.background.map((b) => b * 0.8)).mu).toBe(0);
  });
  test('fitMu agrees with a brute-force minimisation of the profiled −ln L', () => {
    const r = rng(6);
    const data = pseudoExperiments(asimovData(shape, 0.8), 1, r)[0]!;
    const fit = fitMu(shape, data);
    let bestMu = 0, bestNll = Infinity;
    for (let mu = 0; mu <= 6; mu += 0.001) {
      const p = profileTheta(shape, data, mu);
      if (p.nll < bestNll) { bestNll = p.nll; bestMu = mu; }
    }
    expect(fit.mu).toBeCloseTo(bestMu, 2);
    expect(fit.nll).toBeCloseTo(bestNll, 6);
  });
  test('Fisher σ_μ: with no nuisance it is 1/√Σ(s²/b); a nuisance increases it', () => {
    const plain = { ...shape, nuisance: undefined };
    const I = shape.signal.reduce((s, v, i) => s + (v * v) / shape.background[i]!, 0);
    expect(muUncertainty(plain)).toBeCloseTo(1 / Math.sqrt(I), 12);
    expect(muUncertainty(shape)).toBeGreaterThan(muUncertainty(plain));
  });
  test('q₀ is distributed as ½δ(0) + ½χ²₁ under background only (2000 toys, 8 bins, with a nuisance parameter)', () => {
    const r = rng(314);
    const N = 2000;
    const q: number[] = [];
    for (let k = 0; k < N; k++) {
      const theta = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
      const mean = shape.background.map((b) => b * (1 + 0.1 * theta));
      q.push(qZero(shape, mean.map((m) => poissonSample(r, m))));
    }
    const frac = (c: number) => q.filter((v) => v > c).length / N;
    const half = (c: number) => 0.5 * chi2Sf(c, 1);
    for (const c of [0.0001, 1, 2.706, 4]) {
      const p = half(c);
      console.log(`P(q₀ > ${c}) = ${frac(c).toFixed(4)}  (asymptotic ${p.toFixed(4)})`);
      expect(Math.abs(frac(c) - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N) + 0.01);
    }
  });
  test('the median of the toys from s + b agrees with the Asimov significance (s = 20, b = 100, 4000 toys)', () => {
    const m: CountingModel = { signal: [20], background: [100] };
    const r = rng(5);
    const toys = pseudoExperiments([120], 4000, r).map((t) => Math.sqrt(qZero(m, t)));
    toys.sort((a, b) => a - b);
    const median = toys[Math.floor(toys.length / 2)]!;
    expect(Math.abs(median - expectedDiscovery(m).z)).toBeLessThan(0.15);
    // And the mean of q₀ over signal toys is close to q₀,A (the Asimov value is the expected data, not the expected q₀, hence the looser tolerance).
    const meanZ = toys.reduce((a, b) => a + b, 0) / toys.length;
    expect(Math.abs(meanZ - expectedDiscovery(m).z)).toBeLessThan(0.3);
  });
});

describe('pseudo-experiments and trials', () => {
  test('pseudoExperiments with an array: means and variances of each bin are Poisson; with a function it calls the model', () => {
    const r = rng(1);
    const toys = pseudoExperiments([4, 40, 0.5], 20000, r);
    for (let i = 0; i < 3; i++) {
      const col = toys.map((t) => t[i]!);
      const mean = col.reduce((a, b) => a + b, 0) / col.length;
      const v = col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
      expect(mean).toBeCloseTo([4, 40, 0.5][i]!, 0);
      expect(Math.abs(v / mean - 1)).toBeLessThan(0.06);
    }
    const f = pseudoExperiments((q) => q() < 0.5, 10, rng(2));
    expect(f.length).toBe(10);
    expect(pseudoExperiments([5, 5], 4, rng(9))).toEqual(pseudoExperiments([5, 5], 4, rng(9)));
  });
  test('toyPValue uses the +1 convention', () => {
    expect(toyPValue(10, [1, 2, 3])).toBeCloseTo(1 / 4, 12);
    expect(toyPValue(2, [1, 2, 3])).toBeCloseTo(3 / 4, 12);
  });
  test('lookElsewhere: N = 1 changes nothing, large N turns 3σ local into a weak global effect', () => {
    const one = lookElsewhere(1, 3);
    expect(one.pGlobal).toBeCloseTo(one.pLocal, 12);
    expect(one.zGlobal).toBeCloseTo(3, 9);
    const hundred = lookElsewhere(100, 3);
    expect(hundred.pGlobal).toBeCloseTo(1 - (1 - zToP(3)) ** 100, 10);
    expect(hundred.zGlobal).toBeCloseTo(1.14, 1);
    expect(hundred.trialsFactor).toBeCloseTo(hundred.pGlobal / hundred.pLocal, 12);
    expect(lookElsewhere(1e6, 5).zGlobal).toBeLessThan(2);
  });
  test('brute-force look-elsewhere with independent bins equals 1 − (1 − q)^N, q computed from the Poisson tail (3000 toys)', () => {
    const expected = new Array(40).fill(8);
    const zLocal = 2.5;
    const scan = lookElsewhereScan(expected, [1], zLocal, 3000, rng(123));
    // Smallest count whose tail probability is at most zToP(2.5):
    let k = 0;
    while (poissonTail(k, 8) > zToP(zLocal)) k++;
    const q = poissonTail(k, 8);
    const analytic = 1 - (1 - q) ** 40;
    const se = Math.sqrt((analytic * (1 - analytic)) / 3000);
    console.log(`independent bins: pGlobal ${scan.pGlobal.toFixed(4)} vs analytic ${analytic.toFixed(4)} (q = ${q.toExponential(2)}); local Z ${zLocal}, global Z ${scan.zGlobal.toFixed(2)}`);
    expect(Math.abs(scan.pGlobal - analytic)).toBeLessThan(4 * se + 0.005);
    expect(scan.pGlobal).toBeGreaterThan(5 * scan.pLocal);
    expect(scan.zGlobal).toBeLessThan(scan.zLocal);
    expect(scan.maxZ.length).toBe(3000);
  });
  test('Gross–Vitells upcrossing estimate agrees with the brute-force scan within a factor 1.6 for a wide-window scan', () => {
    const expected = new Array(120).fill(60);
    const r = rng(77);
    // Upcrossings of q = Z² at u0 = 0.5 in a few hundred toys (the cheap measurement).
    const nTraining = 400;
    let total = 0;
    for (let k = 0; k < nTraining; k++) {
      const toy = expected.map((e) => poissonSample(r, e));
      total += upcrossings(localScan(toy, expected, 4).map((z) => z * z), 0.5);
    }
    const meanCount = total / nTraining;
    const zLocal = 3;
    const gv = grossVitells(zLocal, { meanCount, level: 0.5 });
    const brute = lookElsewhereScan(expected, [4], zLocal, 2500, rng(78));
    console.log(`GV: ⟨N(0.5)⟩ = ${meanCount.toFixed(2)}, pGlobal ${gv.pGlobal.toFixed(4)}; brute force ${brute.pGlobal.toFixed(4)}`);
    const ratio = gv.pGlobal / brute.pGlobal;
    expect(ratio).toBeGreaterThan(1 / 1.6);
    expect(ratio).toBeLessThan(1.6);
  });
  test('p ↔ Z used for the conventions: 5σ is 2.87e-7 and 3σ is 1.35e-3', () => {
    expect(zToP(5)).toBeCloseTo(2.8665e-7, 10);
    expect(zToP(3)).toBeCloseTo(1.3499e-3, 7);
    expect(poissonCdf(3, 2) + poissonTail(4, 2)).toBeCloseTo(1, 12);
    expect(poissonPmf(0, 0)).toBe(1);
  });
});
