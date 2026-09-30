import { describe, expect, test } from 'vitest';
import {
  bucketAreaEVs, bucketGeometry, hamiltonian, inBucket, isPhaseStable, lhcRf, longitudinalHistory, mapCoefficients, movingBucketHeightRatio,
  phaseJumpAtTransition, separatrix, slipFactor, stablePhase, stationaryBucketArea, stationaryHalfHeight, synchrotronTune, synchrotronTuneExact,
  trackLongitudinal, transitionEnergy, transitionGamma, deltaOf, energyOffsetOf, type RfParams,
} from './longitudinal.ts';
import { tuneFromTurns } from './optics.ts';
import { LHC } from './fields.ts';

/** A stationary proton bucket above transition with LHC-injection-like numbers. */
const stationary = (): RfParams => lhcRf(450);

describe('phase stability', () => {
  test('η cos φ_s < 0 is required; the stable phase flips across transition', () => {
    const above: RfParams = { ...stationary(), phiS: Math.PI - 0.3 };
    const below: RfParams = { ...stationary(), eta: -1e-3, phiS: 0.3 };
    expect(isPhaseStable(above)).toBe(true);
    expect(isPhaseStable(below)).toBe(true);
    expect(isPhaseStable({ ...above, phiS: 0.3 })).toBe(false);
    expect(stablePhase(1e-3, 0.5)).toBeCloseTo(Math.PI - Math.asin(0.5), 12);
    expect(stablePhase(-1e-3, 0.5)).toBeCloseTo(Math.asin(0.5), 12);
    expect(phaseJumpAtTransition(0.3)).toBeCloseTo(Math.PI - 0.6, 12);
  });
  test('transition: γ_t = 1/√α_c is about 55.7 for the LHC, far below the injection γ = 480, so the LHC never crosses it', () => {
    expect(transitionGamma(LHC.momentumCompaction)).toBeCloseTo(55.69, 1);
    expect(transitionEnergy(LHC.momentumCompaction)).toBeCloseTo(52.3, 0);
    expect(slipFactor(450 / 0.938272, LHC.momentumCompaction)).toBeGreaterThan(0);
  });
  test('LHC synchrotron tune at 7 TeV and 16 MV: Q_s ≈ 2.0e-3, f_s ≈ 23 Hz', () => {
    const q = synchrotronTune(lhcRf(7000));
    expect(q).toBeGreaterThan(1.9e-3);
    expect(q).toBeLessThan(2.2e-3);
    expect(q * 11245.5).toBeGreaterThan(21);
    expect(q * 11245.5).toBeLessThan(25);
    expect(synchrotronTuneExact(lhcRf(7000))).toBeCloseTo(q, 6);
  });
});

describe('the bucket', () => {
  test('stationary bucket: half-height √(2eV/(π h |η| β² E)) = 2 Q_s/(h|η|), area 8 × half-height', () => {
    const p = stationary();
    const g = bucketGeometry(p);
    const hmax = stationaryHalfHeight(p);
    expect(g.halfHeight).toBeCloseTo(hmax, 9);
    expect(g.area).toBeCloseTo(stationaryBucketArea(p), 5);
    expect(g.left).toBeCloseTo(-Math.PI, 9);
    expect(g.right).toBeCloseTo(Math.PI, 6);
    // 2 Q_s/(h |η|)
    expect(hmax).toBeCloseTo((2 * synchrotronTune(p)) / (p.harmonic * Math.abs(p.eta)), 9);
  });
  test('moving bucket: height shrinks as √Y(φ_s) and the area shrinks with it', () => {
    const p0 = stationary();
    for (const phiFromZero of [0.2, 0.6, 1.0, 1.3]) {
      const p: RfParams = { ...p0, phiS: Math.PI - phiFromZero };
      const g = bucketGeometry(p);
      expect(g.halfHeight / stationaryHalfHeight(p0)).toBeCloseTo(movingBucketHeightRatio(phiFromZero), 6);
      expect(g.area).toBeLessThan(stationaryBucketArea(p0));
    }
    const small = bucketGeometry({ ...p0, phiS: Math.PI - 1.55 });
    expect(small.area).toBeLessThan(0.02 * stationaryBucketArea(p0));
    // below transition gives the mirror image
    const below = bucketGeometry({ ...p0, eta: -p0.eta, phiS: 0.6 });
    expect(below.area).toBeCloseTo(bucketGeometry({ ...p0, phiS: Math.PI - 0.6 }).area, 6);
  });
  test('small-amplitude area: ellipse π Δφ δ with H = Q_s × area; the exact area at energy H tends to H/Q_s', () => {
    const p = stationary();
    const dphi = 0.05;
    const H0 = hamiltonian(p, 0, 0);
    const H = hamiltonian(p, dphi, 0) - H0;
    const Qs = synchrotronTune(p);
    const { a } = mapCoefficients(p);
    const deltaMax = Math.sqrt((2 * H) / Math.abs(a));
    const area = Math.PI * dphi * deltaMax;
    expect(area).toBeCloseTo(H / Qs, 1 + 4);
    expect(Math.abs(area / (H / Qs) - 1)).toBeLessThan(1e-3);
  });
  test('the separatrix curve touches δ = 0 at the unstable point and reaches the half-height at the centre', () => {
    const p = stationary();
    const s = separatrix(p, 100);
    expect(Math.max(...s.delta)).toBeCloseTo(stationaryHalfHeight(p), 6);
    expect(s.delta[0]).toBeCloseTo(0, 6);
    expect(s.delta[100]).toBeCloseTo(0, 4);
  });
  test('area in eV·s: LHC injection bucket at 450 GeV, 8 MV is about 1.4 eV·s', () => {
    const p = lhcRf(450);
    const A = bucketAreaEVs(bucketGeometry(p).area, p, 400.789e6);
    expect(A).toBeGreaterThan(1.3);
    expect(A).toBeLessThan(1.6);
  });
});

describe('tracking', () => {
  test('synchrotron tune measured from tracking agrees with Q_s', () => {
    const p = stationary();
    const start = { dphi: 0.05, dE: 0 };
    const h = longitudinalHistory(start, p, 1024);
    const Qs = synchrotronTuneExact(p);
    expect(tuneFromTurns(h.dphi)).toBeCloseTo(Qs, 3);
    expect(synchrotronTune(p)).toBeCloseTo(Qs, 4);
  });
  test('the pendulum oscillation amplitude is conserved (symplectic map)', () => {
    const p = stationary();
    const h = longitudinalHistory({ dphi: 0.5, dE: 0 }, p, 4000);
    const max = Math.max(...h.dphi);
    const min = Math.min(...h.dphi);
    expect(max).toBeGreaterThan(0.49);
    expect(max).toBeLessThan(0.52);
    expect(min).toBeLessThan(-0.45);
  });
  test('particles just inside the separatrix stay; just outside they are lost', () => {
    const p = stationary();
    const hmax = stationaryHalfHeight(p);
    const inside = { dphi: 0, dE: energyOffsetOf(p, 0.97 * hmax) };
    const outside = { dphi: 0, dE: energyOffsetOf(p, 1.05 * hmax) };
    const out = trackLongitudinal([inside, outside], p, 3000);
    expect(out[0]!.lost).toBeFalsy();
    expect(Math.abs(out[0]!.dphi)).toBeLessThan(Math.PI);
    expect(out[1]!.lost).toBe(true);
    expect(inBucket(inside, p)).toBe(true);
    expect(inBucket(outside, p)).toBe(false);
    expect(deltaOf(p, inside.dE)).toBeCloseTo(0.97 * hmax, 12);
  });
  test('a moving bucket accelerates the synchronous particle: in-bucket particles oscillate around φ_s, outside ones slip', () => {
    const p: RfParams = { ...stationary(), phiS: Math.PI - 0.5 };
    const g = bucketGeometry(p);
    const inside = { dphi: 0.6 * g.right, dE: 0 };
    const res = trackLongitudinal([inside], p, 4000);
    expect(res[0]!.lost).toBeFalsy();
    const far = { dphi: g.right + 0.3, dE: 0 };
    expect(trackLongitudinal([far], p, 50)[0]!.lost).toBe(true);
  });
});
