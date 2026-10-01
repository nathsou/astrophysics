import { describe, expect, test } from 'vitest';
import { eigenSym3, generateJetEvents, jetMultiplicities, clusterEvent, addSoft, splitHardest, principalAxes } from './jetsim.ts';
import { rng } from '../../hep/random/index.ts';
import { sum, mass } from '../../hep/kinematics/index.ts';

describe('eigenSym3', () => {
  test('diagonalises a known matrix', () => {
    const { values, vectors } = eigenSym3([
      [2, 1, 0],
      [1, 2, 0],
      [0, 0, 5],
    ]);
    expect(values[0]).toBeCloseTo(5, 10);
    expect(values[1]).toBeCloseTo(3, 10);
    expect(values[2]).toBeCloseTo(1, 10);
    expect(Math.abs(vectors[0]![2]!)).toBeCloseTo(1, 10);
  });
});

describe('jet events', () => {
  const ev91 = generateJetEvents(91.2, 120, 3);
  test('rotation keeps energy and invariant mass; the event plane is x-y', () => {
    for (const e of ev91.slice(0, 20)) {
      const tot = sum(e.particles.map((q) => q.p));
      expect(tot.E).toBeGreaterThan(80);
      expect(mass(tot)).toBeGreaterThan(70);
      const ax = principalAxes(e.particles.map((q) => q.p));
      expect(ax.vectors[0]![0]!).toBeCloseTo(1, 6);
      expect(ax.values[0]).toBeGreaterThanOrEqual(ax.values[1]);
      expect(ax.values[1]).toBeGreaterThanOrEqual(ax.values[2]);
    }
  });
  test('with the shower, most events have two jets and a real minority three or more; without it, never', () => {
    const m = jetMultiplicities(ev91, 0.7, 5);
    const f2 = m.filter((k) => k === 2).length / m.length;
    const f3 = m.filter((k) => k >= 3).length / m.length;
    expect(f2).toBeGreaterThan(0.6);
    expect(f3).toBeGreaterThan(0.08);
    const bare = generateJetEvents(91.2, 60, 3, { shower: false });
    const mb = jetMultiplicities(bare, 0.7, 5);
    expect(mb.filter((k) => k >= 3).length / mb.length).toBeLessThan(0.05);
  });
  test('anti-kT is infrared and collinear safe on these events', () => {
    const r = rng(9);
    for (const e of ev91.slice(0, 30)) {
      const a = clusterEvent(e, 0.7, 5);
      const b = clusterEvent(addSoft(e, r), 0.7, 5);
      const c = clusterEvent(splitHardest(e), 0.7, 5);
      expect(b.length).toBe(a.length);
      expect(c.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) {
        expect(Math.abs(b[i]!.pt - a[i]!.pt)).toBeLessThan(0.1);
        expect(Math.abs(c[i]!.pt - a[i]!.pt)).toBeLessThan(1e-9);
      }
    }
  });
});
