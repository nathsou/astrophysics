import { describe, expect, test } from 'vitest';
import { rng } from '$lib/hep/random';
import { particle } from '$lib/hep/particles';
import {
  betaMeanEnergy, betaSpectrum, forwardFraction, meanFreePathCm, muonLifetimeFermi, pionDecayLepton, pionLeptonicRatio,
  pionRatioFactors, protonsPerCm3Water, sampleCosTheta, twoBodyElectronEnergy, wuAsymmetry,
} from './weak';

describe('beta decay', () => {
  test('the spectrum vanishes at both ends and peaks inside', () => {
    const T0 = 1.16e-3;
    expect(betaSpectrum(0, T0)).toBe(0);
    expect(betaSpectrum(T0, T0)).toBe(0);
    const mid = betaSpectrum(0.3 * T0, T0);
    expect(mid).toBeGreaterThan(betaSpectrum(0.05 * T0, T0));
    expect(mid).toBeGreaterThan(betaSpectrum(0.9 * T0, T0));
  });
  test('the mean energy is far below the end-point (well under half)', () => {
    const T0 = 1.16e-3; // a 1.16 MeV end-point
    const f = betaMeanEnergy(T0) / T0;
    expect(f).toBeGreaterThan(0.25);
    expect(f).toBeLessThan(0.45);
  });
  test('a two-body n → p e would give a single line at 0.78 MeV', () => {
    const T = twoBodyElectronEnergy(particle(2112).mass, particle(2212).mass);
    expect(T * 1e3).toBeCloseTo(0.7816, 3);
  });
});

describe("Wu's angular distribution", () => {
  test('the sampler reproduces 1 + a cosθ: mean cosθ = a/3, forward fraction (1 + a/2)/2', () => {
    const r = rng(3);
    for (const a of [-1, -0.4, 0, 0.6]) {
      let s = 0, fwd = 0;
      const n = 200000;
      for (let i = 0; i < n; i++) {
        const c = sampleCosTheta(r, a);
        s += c;
        if (c > 0) fwd++;
      }
      expect(s / n).toBeCloseTo(a / 3, 2);
      expect(fwd / n).toBeCloseTo(forwardFraction(a), 2);
    }
  });
  test('the asymmetry parameter is A P β', () => {
    expect(wuAsymmetry(-1, 0.6, 0.8)).toBeCloseTo(-0.48, 12);
  });
});

describe('helicity suppression in pion decay', () => {
  test('leading-order ratio 1.283e-4', () => {
    expect(pionLeptonicRatio()).toBeCloseTo(1.2833e-4, 8);
    const f = pionRatioFactors();
    expect(f.helicity * f.phaseSpace).toBeCloseTo(pionLeptonicRatio(), 14);
    expect(f.helicity).toBeCloseTo(2.339e-5, 8);
    expect(f.phaseSpace).toBeCloseTo(5.487, 2);
  });
  test('agrees with the particle table branching fractions to their two digits', () => {
    const br = particle(211).decays;
    const mu = br.find((d) => d.products.includes(-13))!.br;
    const e = br.find((d) => d.products.includes(-11))!.br;
    expect(e / mu).toBeGreaterThan(1.15e-4);
    expect(e / mu).toBeLessThan(1.3e-4);
    // the table value is 4 % below the tree-level ratio: radiative corrections
    expect(pionLeptonicRatio() / (e / mu)).toBeGreaterThan(1.03);
    expect(pionLeptonicRatio() / (e / mu)).toBeLessThan(1.10);
  });
  test('the ratio of the rate factors is the same number', () => {
    const e = pionDecayLepton(particle(11).mass), m = pionDecayLepton(particle(13).mass);
    expect(e.rateFactor / m.rateFactor).toBeCloseTo(pionLeptonicRatio(), 14);
  });
  test('kinematics: the positron is ultra-relativistic, the muon is not; a tau is forbidden', () => {
    const e = pionDecayLepton(particle(11).mass), m = pionDecayLepton(particle(13).mass);
    expect(e.p * 1e3).toBeCloseTo(69.78, 2);
    expect(m.p * 1e3).toBeCloseTo(29.79, 2);
    expect(m.beta).toBeCloseTo(0.2714, 4);
    expect(e.wrongHelicity).toBeCloseTo(1.34e-5, 7);
    expect(m.wrongHelicity).toBeCloseTo(0.364, 3);
    expect(pionDecayLepton(particle(15).mass).rateFactor).toBe(0);
  });
});

describe("Fermi's constant", () => {
  test('τ_μ from G_F at leading order is within 0.5 % of the measured lifetime', () => {
    const t = muonLifetimeFermi();
    expect(t / particle(13).lifetime).toBeGreaterThan(0.99);
    expect(t / particle(13).lifetime).toBeLessThan(1.0);
    expect(t * 1e6).toBeCloseTo(2.187, 3);
  });
  test('the neutrino mean free path in water is hundreds of light-years', () => {
    const L = meanFreePathCm(protonsPerCm3Water(), 6.3e-44);
    const ly = L / 100 / 9.4607304726e15;
    expect(ly).toBeGreaterThan(200);
    expect(ly).toBeLessThan(300);
  });
});
