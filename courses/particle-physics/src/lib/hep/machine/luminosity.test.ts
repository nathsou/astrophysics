import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import { rng } from '../random/index.ts';
import {
  LHC_DESIGN, RUN3_LIKE, SIGMA_INEL_MB, bunchCrossings, burnOffTime, cm2ToInvFb, collisionVertices, countBunches, fillingPattern, geometricFactor, integratedLuminosity,
  interactionRate, luminosity, luminosityAt, luminousRegionSigmaZ, machineStage, optimalFill, pileup, referenceLuminosity, sigmaStar,
} from './luminosity.ts';
import { beamStoredEnergyMJ, copperMeltedKg, fieldEnergyDensity, storedEnergyMJ, tntKg, trainEnergyMJ, trainSpeedKmH } from './protection.ts';

describe('luminosity', () => {
  test('LHC design parameters give 1.0 × 10³⁴ cm⁻² s⁻¹ (within 15%)', () => {
    const L = luminosity(LHC_DESIGN);
    expect(Math.abs(L / 1e34 - 1)).toBeLessThan(0.15);
    expect(L / 1.009e34).toBeCloseTo(1, 3);
    expect(sigmaStar(LHC_DESIGN) * 1e6).toBeCloseTo(16.6, 1);
    expect(geometricFactor(LHC_DESIGN)).toBeCloseTo(0.84, 2);
  });
  test('scaling: L ∝ N², ∝ n, ∝ 1/β* when the crossing angle is zero; the crossing angle only reduces L', () => {
    const base = { ...LHC_DESIGN, crossingAngle: 0 };
    const L0 = luminosity(base);
    expect(luminosity({ ...base, Nb: base.Nb * 2 }) / L0).toBeCloseTo(4, 10);
    expect(luminosity({ ...base, nb: base.nb / 2 }) / L0).toBeCloseTo(0.5, 10);
    expect(luminosity({ ...base, betaStar: base.betaStar / 2 }) / L0).toBeCloseTo(2, 10);
    expect(luminosity(LHC_DESIGN)).toBeLessThan(L0);
  });
  test('a reader override of the hook is used', () => {
    setOverride('machine.luminosity', (() => 123) as never);
    try {
      expect(luminosity(LHC_DESIGN)).toBe(123);
      expect(machineStage({ beamEnergyGeV: 7000 }).lumi).toBe(123);
    } finally {
      setOverride('machine.luminosity', undefined);
    }
    expect(luminosity(LHC_DESIGN)).toBe(referenceLuminosity(LHC_DESIGN));
  });
});

describe('pile-up and the machine stage', () => {
  test('design pile-up μ ≈ 25 with σ_inel = 80 mb', () => {
    const mu = pileup(luminosity(LHC_DESIGN), 2808, LHC_DESIGN.frev, SIGMA_INEL_MB);
    expect(mu).toBeGreaterThan(24);
    expect(mu).toBeLessThan(27);
    expect(interactionRate(1e34, 80) / 1e9).toBeCloseTo(0.8, 6);
  });
  test('Run-3-like parameters: L ≈ 2 × 10³⁴, μ ≈ 60, √s = 13.6 TeV', () => {
    const st = machineStage();
    expect(st.lumi).toBeGreaterThan(1.8e34);
    expect(st.lumi).toBeLessThan(2.3e34);
    expect(st.mu).toBeGreaterThan(55);
    expect(st.mu).toBeLessThan(66);
    expect(st.sqrtS).toBe(13600);
    expect(st.bunchSpacingNs).toBe(25);
    expect(st.maxCrossingRateHz).toBeCloseTo(40e6, 0);
    expect(st.crossingRateHz).toBeCloseTo(RUN3_LIKE.nb * RUN3_LIKE.frev, 0);
    expect(machineStage({ mode: 'ee', beamEnergyGeV: 104.5, lumi: 1e32 }).mu).toBe(0);
  });
  test('bunch crossings: Poisson counts with mean μ, reproducible from the seed', () => {
    const a = bunchCrossings(20000, rng(3), 25);
    const b = bunchCrossings(20000, rng(3), 25);
    expect(a).toEqual(b);
    const mean = a.reduce((s, x) => s + x, 0) / a.length;
    expect(mean).toBeGreaterThan(24.8);
    expect(mean).toBeLessThan(25.2);
    const z = collisionVertices(rng(1), 5000, 45);
    const sd = Math.sqrt(z.reduce((s, x) => s + x * x, 0) / z.length);
    expect(sd).toBeGreaterThan(43);
    expect(sd).toBeLessThan(47);
    expect(luminousRegionSigmaZ(LHC_DESIGN)).toBeLessThan(LHC_DESIGN.sigmaZ / Math.SQRT2);
  });
  test('filling pattern: 2808 bunches fit in 3564 slots with an abort gap', () => {
    const p = fillingPattern(2808);
    expect(p.length).toBe(3564);
    expect(countBunches(p)).toBe(2808);
    expect(p.slice(3564 - 119).some(Boolean)).toBe(false);
    expect(countBunches(fillingPattern(100))).toBe(100);
  });
});

describe('a fill', () => {
  test('burn-off time for design beams is about 56 hours with two high-luminosity experiments', () => {
    const tau = burnOffTime(1.15e11 * 2808, 1e34, 2);
    expect(tau / 3600).toBeGreaterThan(50);
    expect(tau / 3600).toBeLessThan(62);
  });
  test('luminosity decay: pure exponential when burn-off is off, and 1/(1+t/τ)² when only burn-off acts', () => {
    expect(luminosityAt(10, 5, Infinity, 10)).toBeCloseTo(5 * Math.exp(-1) ** 2, 12);
    expect(luminosityAt(10, 5, 10, Infinity)).toBeCloseTo(5 / 4, 12);
    expect(luminosityAt(0, 5, 10, 7)).toBeCloseTo(5, 12);
  });
  test('integral: matches the closed form for burn-off only', () => {
    const tau = 1000;
    const T = 3000;
    const closed = (5 * tau * T) / (tau + T);
    expect(integratedLuminosity(T, 5, tau, Infinity)).toBeCloseTo(closed, 6);
  });
  test('optimal fill length grows with the turnaround time', () => {
    const tauB = burnOffTime(1.15e11 * 2808, 1e34, 2);
    const a = optimalFill(1e34, tauB, 20 * 3600, 2 * 3600);
    const b = optimalFill(1e34, tauB, 20 * 3600, 6 * 3600);
    expect(b.fillLength).toBeGreaterThan(a.fillLength);
    expect(cm2ToInvFb(a.integrated)).toBeGreaterThan(0.1);
    expect(a.averageLumi).toBeLessThan(1e34);
  });
});

describe('stored energy', () => {
  test('one LHC beam at 7 TeV stores about 362 MJ: about 87 kg of TNT, a 400 t train at 153 km/h, 590 kg of copper melted', () => {
    const E = storedEnergyMJ(1.15e11, 2808, 7000);
    expect(E).toBeCloseTo(362, 0);
    expect(tntKg(E)).toBeCloseTo(86.6, 0);
    expect(trainSpeedKmH(E, 400)).toBeCloseTo(153, 0);
    expect(trainEnergyMJ(400, 153)).toBeCloseTo(E, -1);
    expect(copperMeltedKg(E)).toBeGreaterThan(500);
    expect(copperMeltedKg(E)).toBeLessThan(650);
    expect(beamStoredEnergyMJ(1, 1) / 1.602e-16).toBeCloseTo(1, 3);
  });
  test('magnetic field energy density at 8.3 T', () => {
    expect(fieldEnergyDensity(8.33) / 1e6).toBeCloseTo(27.6, 0);
  });
});
