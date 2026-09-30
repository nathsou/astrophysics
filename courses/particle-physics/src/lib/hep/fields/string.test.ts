import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { HBARC_GEV_FM } from './constants.ts';
import { cornellForce, cornellPotential, coulombForce, defaultFrag, defaultStringParams, fragment, mesonId, rapidityPlateau, StringModel, thresholdLength } from './string.ts';

describe('string model', () => {
  test('energy is conserved to rounding through pulling, breaking and yo-yo motion', () => {
    for (const seed of [1, 2, 3, 4]) {
      const sm = new StringModel(defaultStringParams(), rng(seed));
      sm.setSeparation(8);
      let worst = 0;
      for (let i = 0; i < 1500; i++) {
        sm.advance(0.02);
        const b = sm.budget();
        worst = Math.max(worst, Math.abs(b.residual) / Math.max(1, b.input));
      }
      expect(worst).toBeLessThan(1e-6);
      expect(sm.breaks.length).toBeGreaterThan(0);
    }
  });
  test('a string shorter than the gap 2m/κ never breaks', () => {
    const p = defaultStringParams();
    const sm = new StringModel(p, rng(1), 0.3);
    const L = thresholdLength(p.mass.u, p.kappa) * 0.95;
    sm.setSeparation(L);
    for (let i = 0; i < 400; i++) sm.advance(0.05);
    expect(sm.breaks.length).toBe(0);
    expect(sm.separation()).toBeCloseTo(L, 6);
  });
  test('breaking a string makes two colour-singlet pieces and conserves momentum and energy exactly', () => {
    const p = defaultStringParams();
    const sm = new StringModel(p, rng(2), 3);
    const before = sm.budget();
    const ev = sm.breakPiece(sm.pieces[0]!, 'u');
    const after = sm.budget();
    expect(sm.pieces.length).toBe(2);
    expect(after.residual).toBeCloseTo(before.residual, 12);
    expect(after.created).toBeCloseTo(2 * p.mass.u, 12);
    expect(before.string - after.string).toBeCloseTo(p.kappa * ev.gap, 12);
    expect(sm.freeMomentum()).toBe(0);
  });
  test('the pieces become mesons with masses above 2m', () => {
    const p = defaultStringParams();
    const sm = new StringModel(p, rng(5), 0.3);
    sm.setSeparation(6);
    for (let i = 0; i < 600; i++) sm.advance(0.02);
    const masses = sm.pieces.map((pc) => sm.pieceMass(pc)).filter((x): x is number => x !== null);
    expect(masses.length).toBeGreaterThan(0);
    for (const M of masses) expect(M).toBeGreaterThan(2 * p.mass.u * 0.999);
  });
  test('same seed, same history', () => {
    const run = (s: number) => {
      const sm = new StringModel(defaultStringParams(), rng(s));
      sm.setSeparation(6);
      for (let i = 0; i < 400; i++) sm.advance(0.02);
      return sm.breaks.map((b) => b.z.toFixed(6) + b.flavour).join();
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});

describe('Cornell potential and forces', () => {
  test('Coulomb at short distance, linear at long; the force tends to κ', () => {
    expect(cornellPotential(0.05)).toBeLessThan(0);
    expect(cornellPotential(3) - cornellPotential(2)).toBeCloseTo(0.9, 1);
    expect(-cornellForce(20)).toBeCloseTo(0.9, 2);
    expect(-cornellForce(0.05)).toBeGreaterThan(5 * 0.9);
    // derivative check
    const h = 1e-6;
    expect(-(cornellPotential(1 + h) - cornellPotential(1 - h)) / (2 * h)).toBeCloseTo(cornellForce(1), 5);
  });
  test('the electron–positron force falls as 1/r² while the quark force does not', () => {
    const r = [0.5, 1, 2, 4, 8];
    expect(coulombForce(8) / coulombForce(0.5)).toBeCloseTo((0.5 / 8) ** 2, 10);
    expect(cornellForce(8) / cornellForce(4)).toBeGreaterThan(0.95);
    expect(coulombForce(1)).toBeCloseTo(-HBARC_GEV_FM / 137.035999, 9);
    expect(r.length).toBe(5);
  });
  test('1 GeV/fm is 0.1973 GeV²', () => {
    expect(0.9 * HBARC_GEV_FM).toBeCloseTo(0.1776, 3);
  });
});

describe('jet fragmentation', () => {
  test('mesons from a quark–antiquark pair conserve energy, momentum and charge exactly', () => {
    for (const sqrtS of [5, 10, 30, 91.2, 200]) {
      const r = rng(Math.round(sqrtS));
      for (let i = 0; i < 40; i++) {
        const ev = fragment(r.fork(i), defaultFrag(sqrtS));
        const E = ev.hadrons.reduce((s, h) => s + h.p.E, 0);
        const px = ev.hadrons.reduce((s, h) => s + h.p.px, 0);
        const py = ev.hadrons.reduce((s, h) => s + h.p.py, 0);
        const pz = ev.hadrons.reduce((s, h) => s + h.p.pz, 0);
        const Q = ev.hadrons.reduce((s, h) => s + h.charge3, 0);
        expect(E).toBeCloseTo(sqrtS, 7);
        expect(Math.abs(px)).toBeLessThan(1e-9);
        expect(Math.abs(py)).toBeLessThan(1e-9);
        expect(Math.abs(pz)).toBeLessThan(1e-7);
        expect(Q).toBe(0);
        for (const h of ev.hadrons) expect(h.p.E * h.p.E - h.p.px ** 2 - h.p.py ** 2 - h.p.pz ** 2).toBeCloseTo(h.mass ** 2, 6);
      }
    }
  });
  test('the rapidity distribution has a plateau, and the multiplicity grows with √s', () => {
    const big = rapidityPlateau(rng(3), defaultFrag(200), 600, 6, 12);
    // central bins |y| < 2 are flat within statistics
    const central = big.dNdy.filter((_, i) => Math.abs((big.edges[i]! + big.edges[i + 1]!) / 2) < 2);
    const mean = central.reduce((s, v) => s + v, 0) / central.length;
    for (const v of central) expect(Math.abs(v / mean - 1)).toBeLessThan(0.15);
    expect(mean).toBeGreaterThan(1);
    expect(mean).toBeLessThan(4);
    const small = rapidityPlateau(rng(3), defaultFrag(20), 300, 6, 12);
    expect(big.meanMultiplicity).toBeGreaterThan(1.4 * small.meanMultiplicity);
  });
  test('meson assignment follows the quark content', () => {
    expect(mesonId('u', 'd')).toBe(211);
    expect(mesonId('d', 'u')).toBe(-211);
    expect(mesonId('u', 's')).toBe(321);
    expect(mesonId('u', 'u')).toBe(111);
  });
});
