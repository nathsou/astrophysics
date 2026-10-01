import { describe, expect, test } from 'vitest';
import { rng, type Rng } from '../random/index.ts';
import { chi2Sf } from '../analysis/index.ts';
import { setOverride } from '../hooks.ts';
import * as S from './index.ts';

const T = 5.5; // MeV, an alpha from americium-241
const D = S.closestApproachFm(2, 79, T);

/** χ² of the angles transformed by their own cumulative distribution against a uniform histogram with `bins` bins. */
function chi2Uniform(samples: number[], thetaMin: number, bins = 50): { chi2: number; p: number } {
  const c = new Array<number>(bins).fill(0);
  for (const t of samples) c[Math.min(bins - 1, Math.floor(S.rutherfordAngleCdf(t, thetaMin) * bins))]!++;
  const e = samples.length / bins;
  const chi2 = c.reduce((a, o) => a + (o - e) ** 2 / e, 0);
  return { chi2, p: chi2Sf(chi2, bins - 1) };
}

describe('the classical orbit', () => {
  test('closest approach of a 5.5 MeV alpha to a gold nucleus is 41.4 fm; 7.7 MeV gives 29.6 fm', () => {
    expect(D).toBeCloseTo(41.37, 1);
    expect(S.closestApproachFm(2, 79, 7.69)).toBeCloseTo(29.6, 1);
  });
  test('α ħc = 1.44 MeV·fm', () => {
    expect(S.ALPHA_HBARC_MEV_FM).toBeCloseTo(1.43996, 4);
  });
  test('b(θ) and θ(b) are inverses; b = d/2 gives 90°', () => {
    for (const th of [0.05, 0.4, 1, Math.PI / 2, 2.5, 3.1]) {
      expect(S.deflectionAngle(S.impactParameterFm(th, 2, 79, T), 2, 79, T)).toBeCloseTo(th, 10);
    }
    expect(S.impactParameterFm(Math.PI / 2, 2, 79, T)).toBeCloseTo(D / 2, 10);
    expect(S.deflectionAngle(D / 2, 2, 79, T)).toBeCloseTo(Math.PI / 2, 10);
  });
  test('closest approach equals d for a head-on collision and grows at smaller angles', () => {
    expect(S.minApproachFm(Math.PI, 2, 79, T)).toBeCloseTo(D, 10);
    expect(S.minApproachFm(Math.PI / 2, 2, 79, T)).toBeCloseTo(D / 2 + D / 2 / Math.SQRT1_2 * 1, 6);
    expect(S.minApproachFm(0.3, 2, 79, T)).toBeGreaterThan(S.minApproachFm(1, 2, 79, T));
  });
  test('the cross-section is what the orbit gives: dσ/dΩ = (b / sinθ)|db/dθ|', () => {
    for (const th of [0.2, 0.9, 2.0, 3.0]) {
      const h = 1e-6;
      const b = (t: number) => S.impactParameterFm(t, 2, 79, T);
      const dbdth = (b(th + h) - b(th - h)) / (2 * h);
      expect(S.rutherfordDiffXsecFm2(th, 2, 79, T)).toBeCloseTo((b(th) / Math.sin(th)) * Math.abs(dbdth), 4);
    }
  });
  test('the 1/sin⁴(θ/2) law: 30° to 60° falls by 13.9', () => {
    const r = S.rutherfordDiffXsecFm2(Math.PI / 6, 2, 79, T) / S.rutherfordDiffXsecFm2(Math.PI / 3, 2, 79, T);
    expect(r).toBeCloseTo((Math.sin(Math.PI / 6) / Math.sin(Math.PI / 12)) ** 4, 10);
    expect(r).toBeCloseTo(13.9, 1);
  });
  test('dσ/dΩ at 90° for 5.5 MeV alphas on gold is 428 fm² per steradian', () => {
    expect(S.rutherfordDiffXsecFm2(Math.PI / 2, 2, 79, T)).toBeCloseTo(427.9, 0);
  });
  test('σ(θ > θ₀) = π b² and the bin formula agree with numerical integration', () => {
    const th0 = 0.3;
    let sum = 0;
    const n = 200000;
    // substitute u = cos θ to keep the integrand smooth enough for a midpoint rule
    for (let i = 0; i < n; i++) {
      const c = Math.cos(th0) - ((i + 0.5) / n) * (Math.cos(th0) + 1);
      const th = Math.acos(c);
      sum += S.rutherfordDiffXsecFm2(th, 2, 79, T) * 2 * Math.PI * ((Math.cos(th0) + 1) / n);
    }
    expect(sum / S.rutherfordXsecAboveFm2(th0, 2, 79, T)).toBeCloseTo(1, 4);
    expect(S.rutherfordXsecBinFm2(th0, Math.PI, 2, 79, T)).toBeCloseTo(S.rutherfordXsecAboveFm2(th0, 2, 79, T), 8);
  });
  test('the nuclear radius shows up when the alpha energy reaches Z z α ħc / R (about 33 MeV for gold)', () => {
    const R = 1.2 * Math.cbrt(196.97);
    expect(S.closestApproachFm(2, 79, 32.5)).toBeCloseTo(R, 0);
  });
  test('the screening angle is of order 10⁻³ rad', () => {
    const a = S.screeningAngle(2, 79, T);
    expect(a).toBeGreaterThan(1e-3);
    expect(a).toBeLessThan(1e-2);
    expect(S.thomasFermiRadiusFm(79)).toBeGreaterThan(1e4);
  });
});

describe('the angle distribution', () => {
  test('the pdf integrates to one and matches the cdf', () => {
    const tm = 0.2;
    let s = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) s += S.rutherfordAnglePdf(tm + ((i + 0.5) / n) * (Math.PI - tm), tm) * ((Math.PI - tm) / n);
    expect(s).toBeCloseTo(1, 4);
    expect(S.rutherfordAngleCdf(1, tm)).toBeGreaterThan(0.9);
  });

  test('the importance envelope 16/θ³ is never below the density (acceptance probability at most 1)', () => {
    for (let i = 1; i <= 100000; i++) {
      const x = ((i / 100000) * Math.PI) / 2;
      const acc = Math.cos(x) * (x / Math.sin(x)) ** 3;
      expect(acc).toBeLessThanOrEqual(1 + 1e-12);
      expect(acc).toBeCloseTo(S.rutherfordAngleDensity(2 * x) / (16 / (2 * x) ** 3), 9);
    }
  });

  for (const [name, sampler] of [
    ['importance sampling', (r: Rng, tm: number) => S.sampleImportance(r, tm).theta],
    ['inverse transform', (r: Rng, tm: number) => S.sampleRutherfordInverse(r, tm)],
    ['the reference sampler', (r: Rng, tm: number) => S.sampleRutherfordAngle(r, tm)],
  ] as const) {
    test(`${name}: χ² test against the analytic distribution`, () => {
      for (const tm of [0.001, 0.05, 0.5, 2]) {
        const r = rng(42);
        const xs = Array.from({ length: 100000 }, () => sampler(r, tm));
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(tm);
        expect(Math.max(...xs)).toBeLessThanOrEqual(Math.PI);
        const { chi2, p } = chi2Uniform(xs, tm);
        expect(p, `θmin = ${tm}: χ² = ${chi2.toFixed(1)} for 49 dof`).toBeGreaterThan(1e-3);
      }
    });
  }

  test('flat accept–reject is correct but inefficient: trials per sample ≈ 2π/θmin', () => {
    const tm = 0.1;
    const r = rng(7);
    let trials = 0;
    const xs: number[] = [];
    for (let i = 0; i < 20000; i++) {
      const s = S.sampleFlatAcceptReject(r, tm);
      trials += s.trials;
      xs.push(s.theta);
    }
    expect(chi2Uniform(xs, tm).p).toBeGreaterThan(1e-3);
    const eff = 20000 / trials;
    expect(eff / S.flatEfficiency(tm)).toBeCloseTo(1, 1);
    expect(S.flatEfficiency(tm)).toBeCloseTo(tm / (2 * Math.PI), 2);
    expect(S.flatEfficiency(0.001)).toBeLessThan(2e-4);
  });

  test('importance sampling is efficient at every θmin', () => {
    for (const tm of [0.001, 0.01, 0.1, 0.5]) {
      const r = rng(3);
      let trials = 0;
      for (let i = 0; i < 20000; i++) trials += S.sampleImportance(r, tm).trials;
      const eff = 20000 / trials;
      expect(eff).toBeGreaterThan(0.8);
      expect(eff / S.importanceEfficiency(tm)).toBeCloseTo(1, 1);
    }
  });

  test('determinism: the same seed gives the same angles', () => {
    const a = Array.from({ length: 5 }, ((r) => () => S.sampleRutherfordAngle(r, 0.1))(rng(9)));
    const b = Array.from({ length: 5 }, ((r) => () => S.sampleRutherfordAngle(r, 0.1))(rng(9)));
    expect(a).toEqual(b);
  });
  test('thetaMin must be positive', () => {
    expect(() => S.sampleRutherfordAngle(rng(1), 0)).toThrow();
  });
});

describe('the foil experiment', () => {
  test('nuclei per fm² of a 0.4 µm gold foil: 2.4 × 10⁻⁸', () => {
    expect(S.nucleiPerFm2(S.GOLD)).toBeCloseTo(2.36e-8, 10);
  });
  test('the fraction scattered beyond 90° in 1 µm of gold at 5.5 MeV is about 8 × 10⁻⁵ (1 in 12,600)', () => {
    const f = { ...S.GOLD, thicknessUm: 1 };
    const p = S.scatterProbability(f, T, Math.PI / 2);
    expect(p).toBeCloseTo(7.9e-5, 6);
    expect(1 / p).toBeGreaterThan(12000);
    expect(1 / p).toBeLessThan(13500);
  });
  test('Poisson counts from the sampler match the analytic expectation in every bin', () => {
    const edges = [10, 20, 40, 70, 110, 160].map((d) => (d * Math.PI) / 180);
    const tm = edges[0]!;
    const run = S.fireAlphas(rng(11), S.GOLD, 7.7, 2e8, tm, edges);
    for (let i = 0; i < run.counts.length; i++) {
      const mu = S.expectedCountsInBin(S.GOLD, 7.7, 2e8, edges[i]!, edges[i + 1]!);
      expect(Math.abs(run.counts[i]! - mu), `bin ${i}: ${run.counts[i]} against ${mu.toFixed(1)}`).toBeLessThan(5 * Math.sqrt(mu));
    }
  });
  test('a wrong sampler (θ uniform) is visible in the counts', () => {
    setOverride('scattering.sampleRutherfordAngle', ((r: Rng, tm: number) => tm + (Math.PI - tm) * r()) as never);
    try {
      const edges = [10, 20, 40, 70, 110, 160].map((d) => (d * Math.PI) / 180);
      const run = S.fireAlphas(rng(11), S.GOLD, 7.7, 2e8, edges[0]!, edges);
      const mu0 = S.expectedCountsInBin(S.GOLD, 7.7, 2e8, edges[0]!, edges[1]!);
      expect(run.counts[0]!).toBeLessThan(0.5 * mu0);
    } finally {
      setOverride('scattering.sampleRutherfordAngle', undefined);
    }
  });
  test('silver scatters (47/79)² as much as gold per nucleus', () => {
    const a = S.rutherfordDiffXsecFm2(1, 2, 47, T) / S.rutherfordDiffXsecFm2(1, 2, 79, T);
    expect(a).toBeCloseTo((47 / 79) ** 2, 10);
  });
});

describe('fitting the angular law', () => {
  const edges = Array.from({ length: 14 }, (_, i) => ((10 + i * 10) * Math.PI) / 180);
  test('an exponent of 4 is recovered without bias, with pulls of unit width over many experiments', () => {
    const pulls: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const run = S.fireAlphas(rng(seed), S.GOLD, 7.7, 3e7, edges[0]!, edges);
      const fit = S.fitAnglePower(edges, run.counts);
      pulls.push((fit.p - 4) / ((fit.pHi - fit.pLo) / 2));
    }
    const mean = pulls.reduce((a, b) => a + b, 0) / pulls.length;
    const sd = Math.sqrt(pulls.reduce((a, b) => a + (b - mean) ** 2, 0) / pulls.length);
    expect(Math.abs(mean)).toBeLessThan(0.3);
    expect(sd).toBeGreaterThan(0.7);
    expect(sd).toBeLessThan(1.3);
  });
  test('the fit rejects a flat distribution in angle', () => {
    const counts = edges.slice(0, -1).map((e, i) => 1000 * S.ringSolidAngle(e, edges[i + 1]!));
    const fit = S.fitAnglePower(edges, counts);
    expect(fit.p).toBeLessThan(0.5);
  });
  test('the K fitted with p fixed to 4 predicts the counts', () => {
    const exact = edges.slice(0, -1).map((_, i) => S.expectedCountsInBin(S.GOLD, 7.7, 1e9, edges[i]!, edges[i + 1]!));
    const fit = S.fitAnglePower(edges, exact);
    expect(fit.p).toBeCloseTo(4, 6);
    expect(fit.K4).toBeCloseTo(1e9 * S.nucleiPerFm2(S.GOLD) * (S.closestApproachFm(2, 79, 7.7) / 4) ** 2, -1);
  });
});

describe('electrons and form factors', () => {
  const rms = 0.84;
  test('F(0) = 1 and F ≈ 1 − q²⟨r²⟩/6 (ħc = 1) at small q for every shape', () => {
    for (const shape of ['uniform', 'exponential', 'gaussian'] as const) {
      const q = 0.01; // GeV, λ = 20 fm
      const k = q / 0.1973269804;
      expect(S.formFactor(shape, 0, rms)).toBeCloseTo(1, 12);
      expect(1 - S.formFactor(shape, q, rms), shape).toBeCloseTo((k * k * rms * rms) / 6, 5);
    }
  });
  test('a point charge has F = 1; the uniform sphere has its first zero at x = 4.493', () => {
    expect(S.formFactor('point', 3, 0.84)).toBe(1);
    const R = Math.sqrt(5 / 3) * rms;
    const q = (4.493409 / R) * 0.1973269804;
    expect(Math.abs(S.formFactor('uniform', q, rms))).toBeLessThan(1e-5);
  });
  test('the dipole with the proton radius has Λ² = 0.66 GeV² (the standard 0.71 GeV² corresponds to 0.81 fm)', () => {
    expect(S.dipoleLambda2(0.84)).toBeCloseTo(0.662, 2);
    expect(S.dipoleLambda2(0.811)).toBeCloseTo(0.71, 2);
    // F = 1/(1 + Q²/Λ²)² is the same function
    const q = 0.5;
    expect(S.formFactor('exponential', q, 0.84)).toBeCloseTo(1 / (1 + (q * q) / S.dipoleLambda2(0.84)) ** 2, 10);
  });
  test('elastic ep kinematics: 500 MeV electrons through 60° leave with 394.8 MeV and resolve 0.44 fm', () => {
    const E = 0.5;
    const Ep = S.elasticScatteredEnergy(E, Math.PI / 3, 0.938272);
    expect(Ep).toBeCloseTo(0.3948, 3);
    const Q2 = S.elasticQ2(E, Math.PI / 3, 0.938272);
    expect(Math.sqrt(Q2)).toBeCloseTo(0.444, 3);
    expect(S.resolutionFm(Math.sqrt(Q2))).toBeCloseTo(0.444, 2);
    // W = M for elastic scattering
    expect(S.hadronicMass(0.938272, E - Ep, Q2)).toBeCloseTo(0.938272, 6);
  });
  test('Mott: equals Rutherford with pv → E, times cos²(θ/2)', () => {
    const th = 1.1, E = 0.5;
    const ruth = S.rutherfordDiffXsecFm2(th, 1, 1, (E * 1000) / 2); // nonrelativistic form with 2T = pv = E
    expect(S.mottDiffXsecFm2(th, 1, E)).toBeCloseTo(ruth * Math.cos(th / 2) ** 2, 8);
  });
  test('the de Broglie wavelength of a 5.5 MeV alpha is 1 fm, far below the 41 fm closest approach (so the classical orbit is reliable)', () => {
    const p = Math.sqrt(2 * 3.727379 * 5.5e-3 + (5.5e-3) ** 2 * 0) ; // GeV, non-relativistic
    expect(S.reducedWavelengthFm(p)).toBeCloseTo(0.97, 1);
    expect(S.reducedWavelengthFm(p)).toBeLessThan(D / 20);
  });
});
