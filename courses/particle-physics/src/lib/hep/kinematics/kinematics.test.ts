import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { add, beta, boost, deltaPhi, eta, fromMass, fromPtEtaPhiM, invariantMass, mass, phaseSpace, pt, rapidity, sum, toRestFrame, twoBodyDecay, twoBodyMomentum } from './index.ts';

describe('four-vectors', () => {
  test('mass of a single particle', () => {
    expect(mass(fromMass(0.105658, 1, 2, 3))).toBeCloseTo(0.105658, 10);
  });
  test('fromPtEtaPhiM round-trips', () => {
    const p = fromPtEtaPhiM(45, -1.2, 2.5, 0.1057);
    expect(pt(p)).toBeCloseTo(45, 9);
    expect(eta(p)).toBeCloseTo(-1.2, 9);
    expect(mass(p)).toBeCloseTo(0.1057, 6);
  });
  test('Z → μμ back-to-back in its rest frame has mass 91.19', () => {
    const k = twoBodyMomentum(91.19, 0.1057, 0.1057);
    const a = fromMass(0.1057, k, 0, 0);
    const b = fromMass(0.1057, -k, 0, 0);
    expect(invariantMass([a, b])).toBeCloseTo(91.19, 8);
  });
  test('(E − p)(E + p) keeps two or three digits at 6.8 TeV, where E² − p² keeps none', () => {
    const m = 0.000511;
    const p = 6800;
    const v = { E: Math.sqrt(p * p + m * m), px: p, py: 0, pz: 0 };
    // E itself is rounded to 53 bits, so the mass of a 6.8 TeV electron is only known to about 0.3 %.
    expect(mass(v)).toBeGreaterThan(0.99 * m);
    expect(mass(v)).toBeLessThan(1.01 * m);
    const naive = v.E * v.E - p * p - 0;
    expect(Math.abs(naive - m * m)).toBeGreaterThan(0); // the naive form is not exact either; the library uses the stable form
  });
  test('deltaPhi wraps', () => {
    expect(deltaPhi(3.0, -3.0)).toBeCloseTo(6 - 2 * Math.PI, 12);
  });
});

describe('boosts', () => {
  test('invariants are unchanged by a boost', () => {
    const r = rng(7);
    for (let i = 0; i < 100; i++) {
      const a = fromMass(0.14, r() - 0.5, r() - 0.5, r() * 10);
      const b = fromMass(0.14, r() - 0.5, r() - 0.5, -r() * 10);
      const bx = (r() - 0.5) * 1.2, by = (r() - 0.5) * 1.2, bz = (r() - 0.5) * 0.5;
      const m0 = invariantMass([a, b]);
      const m1 = invariantMass([boost(a, bx, by, bz), boost(b, bx, by, bz)]);
      expect(m1).toBeCloseTo(m0, 8);
    }
  });
  test('a particle is at rest in its own rest frame', () => {
    const p = fromMass(1.5, 3, -2, 5);
    const q = toRestFrame(p, p);
    expect(Math.hypot(q.px, q.py, q.pz)).toBeLessThan(1e-12);
    expect(q.E).toBeCloseTo(1.5, 10);
  });
  test('rapidities add under a longitudinal boost', () => {
    const p = fromMass(1, 0.3, 0, 2);
    const y0 = rapidity(p);
    const b = Math.tanh(0.4);
    expect(rapidity(boost(p, 0, 0, b))).toBeCloseTo(y0 + 0.4, 10);
    expect(beta(p)).toBeLessThan(1);
  });
});

describe('phase space', () => {
  test('two-body decay conserves four-momentum', () => {
    const r = rng(3);
    const parent = fromMass(91.19, 10, -20, 30);
    const [a, b] = twoBodyDecay(r, parent, 0.1057, 0.1057);
    const s = add(a, b);
    for (const k of ['E', 'px', 'py', 'pz'] as const) expect(s[k]).toBeCloseTo(parent[k], 9);
  });
  test('RAMBO conserves four-momentum and masses', () => {
    const r = rng(11);
    const total = fromMass(10, 1, 2, 3);
    const masses = [0.14, 0.14, 0.5, 0.0];
    for (let i = 0; i < 50; i++) {
      const { p, weight } = phaseSpace(r, total, masses);
      const s = sum(p);
      for (const k of ['E', 'px', 'py', 'pz'] as const) expect(s[k]).toBeCloseTo(total[k], 8);
      p.forEach((q, j) => expect(mass(q)).toBeCloseTo(masses[j]!, 6));
      expect(weight).toBeGreaterThan(0);
    }
  });
});
