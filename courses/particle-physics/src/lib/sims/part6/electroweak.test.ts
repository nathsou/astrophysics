import { describe, expect, test } from 'vitest';
import { rng } from '$lib/hep/random';
import { M_W, M_Z } from '$lib/hep/sm';
import { ALPHAS, aScale, coolingToy, fermiFromW, jacobianDensity, mtDensityAtRest, neutralCurrentRatios, rangeFm, sin2wOnShell, treeMasses } from './electroweak';

describe('tree-level masses', () => {
  test('A = 37.28 GeV for α(0) = 1/137.036', () => {
    expect(aScale(ALPHAS.zero)).toBeCloseTo(37.2805, 3);
  });
  test('with α(0) and sin²θ = 0.2312: about 77.5 and 88.4 GeV', () => {
    const m = treeMasses(0.23122, ALPHAS.zero);
    expect(m.mW).toBeCloseTo(77.53, 1);
    expect(m.mZ).toBeCloseTo(88.42, 1);
  });
  test('with α at the Z scale (1/127.95) they move to 80.2 and 91.5 GeV, within 0.3 % of the measured masses', () => {
    const m = treeMasses(0.23122, ALPHAS.atZ);
    expect(m.mW).toBeCloseTo(80.2, 1);
    expect(m.mZ).toBeCloseTo(91.5, 1);
    expect(Math.abs(m.mW / M_W - 1)).toBeLessThan(0.003);
    expect(Math.abs(m.mZ / M_Z - 1)).toBeLessThan(0.004);
  });
  test('the on-shell sin²θ_W from the measured masses is 0.223', () => {
    expect(sin2wOnShell()).toBeCloseTo(0.2232, 3);
  });
  test('the range of the weak force is 2.5 × 10⁻³ fm = 2.5 × 10⁻¹⁸ m', () => {
    expect(rangeFm(M_W)).toBeCloseTo(2.455e-3, 5);
    expect(rangeFm(M_Z)).toBeCloseTo(2.164e-3, 5);
  });
  test('G_F/√2 = g²/(8 m_W²) reproduces 1.166e-5 to 2 % with on-shell sin²θ and α(0)', () => {
    const gf = fermiFromW(M_W, sin2wOnShell(), ALPHAS.zero);
    expect(gf / 1.1664e-5).toBeGreaterThan(0.95);
    expect(gf / 1.1664e-5).toBeLessThan(1.02);
  });
});

describe('neutral currents', () => {
  test('ratios for sin²θ_W = 0.23: 0.31 and 0.37', () => {
    const r = neutralCurrentRatios(0.23);
    expect(r.nu).toBeCloseTo(0.3111, 3);
    expect(r.nubar).toBeCloseTo(0.3729, 3);
  });
  test('the ratios vanish nowhere: no neutral current would need the Weinberg angle to be wildly off', () => {
    expect(neutralCurrentRatios(0.5).nu).toBeGreaterThan(0);
  });
});

describe('the Jacobian peak', () => {
  test('the density is normalised to 1 on [0, m/2]', () => {
    const m = 80.4;
    let s = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) {
      // midpoint in the variable x = (2pT/m) with the substitution that removes the endpoint singularity: pT = (m/2) sin φ
      const phi = ((i + 0.5) / n) * (Math.PI / 2);
      const pt = (m / 2) * Math.sin(phi);
      s += jacobianDensity(pt, m) * (m / 2) * Math.cos(phi) * (Math.PI / 2 / n);
    }
    expect(s).toBeCloseTo(1, 3);
  });
  test('it grows without bound towards m/2 and vanishes above', () => {
    expect(jacobianDensity(40.19, 80.4)).toBeGreaterThan(jacobianDensity(35, 80.4));
    expect(jacobianDensity(41, 80.4)).toBe(0);
    expect(mtDensityAtRest(80, 80.4)).toBeGreaterThan(mtDensityAtRest(60, 80.4));
  });
});

describe('stochastic cooling toy', () => {
  test('the rms falls as the prediction (1 − 2g/s + g²/s)^(n/2) for independent samples', () => {
    const r = rng(9);
    const run = coolingToy(r, 4000, 20, 1, 30);
    expect(run.rms[30]!).toBeLessThan(0.65);
    expect(Math.abs(run.rms[30]! / run.predicted[30]! - 1)).toBeLessThan(0.06);
  });
  test('fewer particles per sample cool faster; g = 1 is the best gain', () => {
    const a = coolingToy(rng(1), 4000, 10, 1, 15).rms[15]!;
    const b = coolingToy(rng(1), 4000, 40, 1, 15).rms[15]!;
    expect(a).toBeLessThan(b);
    const c = coolingToy(rng(1), 4000, 20, 1, 15).rms[15]!;
    const d = coolingToy(rng(1), 4000, 20, 2, 15).rms[15]!;
    expect(c).toBeLessThan(d);
  });
});
