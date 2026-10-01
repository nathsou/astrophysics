import { describe, expect, test } from 'vitest';
import { WOLFENSTEIN, ckmMatrix, ckmSquared } from '$lib/hep/sm';
import { particle } from '$lib/hep/particles';
import {
  apexFromSides, ckmMagnitudes, pdgCkm, ctauMm, jarlskog, jarlskogFromTriangle, logSurvival, meanDecayLengthMm, survival, triangleFromApex, triangleFromMatrix,
} from './flavour';

describe('the CKM matrix', () => {
  test('magnitudes: |V_us| = 0.225, |V_cb| = 0.042, |V_ub| = 0.0037, |V_tb| ≈ 1 (the PDG fit, rounded)', () => {
    const m = ckmMagnitudes();
    expect(m[0]![1]).toBeCloseTo(0.2250, 3);
    expect(m[1]![2]).toBeCloseTo(0.0418, 3);
    expect(m[0]![2]).toBeCloseTo(0.00369, 4);
    expect(m[2]![2]).toBeGreaterThan(0.999);
    expect(m[0]![0]).toBeCloseTo(0.9744, 3);
  });
  test('every row and column squares to 1: unitarity', () => {
    const m = ckmMagnitudes();
    for (let i = 0; i < 3; i++) {
      expect(m[i]!.reduce((s, v) => s + v * v, 0)).toBeCloseTo(1, 9);
      expect(m.reduce((s, r) => s + r[i]! * r[i]!, 0)).toBeCloseTo(1, 9);
    }
    expect(ckmSquared(2, 1)).toBeCloseTo(m[0]![0]! ** 2, 12);
  });
  test('the Cabibbo angle is 13.0°', () => {
    expect((Math.asin(ckmMagnitudes()[0]![1]!) * 180) / Math.PI).toBeCloseTo(13.0, 1);
  });
  test('Jarlskog invariant: 3.1 × 10⁻⁵ in size, equal to twice the area of the triangle', () => {
    expect(jarlskog()).toBeCloseTo(3.08e-5, 7);
    expect(jarlskogFromTriangle()).toBeCloseTo(jarlskog(), 9);
    // the library's own matrix has the opposite sign of the phase: the PDG-convention function undoes it
    const V = ckmMatrix();
    expect(V[0]![2]!.im).toBeGreaterThan(0);
    expect(pdgCkm()[0]![2]!.im).toBeLessThan(0);
  });
  test('no CP violation when η̄ = 0: J = 0', () => {
    expect(Math.abs(jarlskog({ ...WOLFENSTEIN, etabar: 0 }))).toBeLessThan(1e-15);
  });
});

describe('the unitarity triangle', () => {
  test('the triangle from the matrix has the Wolfenstein apex (0.159, 0.348)', () => {
    const t = triangleFromMatrix();
    expect(t.rhobar).toBeCloseTo(0.159, 6);
    expect(t.etabar).toBeCloseTo(0.348, 6);
  });
  test('angles: β = 22.5°, γ = 65.4°, α = 92.1°, summing to 180°; sin 2β = 0.71', () => {
    const t = triangleFromApex(0.159, 0.348);
    expect(t.beta).toBeCloseTo(22.48, 1);
    expect(t.gamma).toBeCloseTo(65.44, 1);
    expect(t.alpha).toBeCloseTo(92.08, 1);
    expect(t.alpha + t.beta + t.gamma).toBeCloseTo(180, 10);
    expect(Math.sin((2 * t.beta * Math.PI) / 180)).toBeCloseTo(0.7066, 3);
  });
  test('the sides R_u = 0.383 and R_t = 0.910 give the apex back', () => {
    const t = triangleFromApex(0.159, 0.348);
    expect(t.Ru).toBeCloseTo(0.3826, 3);
    expect(t.Rt).toBeCloseTo(0.9102, 3);
    const a = apexFromSides(t.Ru, t.Rt)!;
    expect(a.rhobar).toBeCloseTo(0.159, 10);
    expect(a.etabar).toBeCloseTo(0.348, 10);
  });
  test('sides that cannot close a triangle give null', () => {
    expect(apexFromSides(0.1, 0.5)).toBeNull();
  });
});

describe('flight of heavy-flavour hadrons', () => {
  test('cτ of the B⁰ is 455 μm and of the K_S 2.7 cm', () => {
    expect(ctauMm(511) * 1000).toBeCloseTo(454.8, 0);
    expect(ctauMm(310)).toBeCloseTo(26.84, 1);
  });
  test('a B⁰ of 50 GeV flies 4.3 mm; a D⁺ 8.3 mm; a τ 2.4 mm', () => {
    expect(meanDecayLengthMm(511, 50)).toBeCloseTo(4.307, 2);
    expect(meanDecayLengthMm(411, 50)).toBeCloseTo(8.28, 1);
    expect(meanDecayLengthMm(15, 50)).toBeCloseTo(2.449, 2);
  });
  test('survival of a K_S over the 57 feet (17.4 m) of the Cronin–Fitch beam is below 10⁻⁵⁰ at 2 GeV/c; a K_L has most of its flight ahead', () => {
    const L = 57 * 0.3048 * 1000;
    expect(logSurvival(310, 2, L) / Math.LN10).toBeLessThan(-50);
    expect(survival(130, 2, L)).toBeGreaterThan(0.6);
  });
  test('the table lifetimes of the long-lived particles are what the lengths use', () => {
    expect(particle(511).lifetime).toBeCloseTo(1.517e-12, 15);
  });
});
