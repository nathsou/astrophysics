import { describe, expect, test } from 'vitest';
import { allParticles, antiId, byName, hasParticle, particle, quantumNumbers } from './index.ts';

describe('particle table', () => {
  test('antiparticles flip quantum numbers', () => {
    const pim = particle(-211);
    expect(pim.charge3).toBe(-3);
    expect(pim.symbol).toBe('π⁻');
    const pbar = particle(-2212);
    expect(pbar.baryon3).toBe(-3);
    expect(pbar.quarks).toBe('~u~u~d');
    expect(particle(-11).charge3).toBe(3);
    expect(particle(-11).lepton[0]).toBe(-1);
    expect(particle(2224).name).toBe('Delta++');
    expect(particle(-2224).name).toBe('Delta--');
  });
  test('self-conjugate particles have no antiparticle entry', () => {
    expect(antiId(22)).toBe(22);
    expect(antiId(111)).toBe(111);
    expect(hasParticle(-22)).toBe(false);
    expect(() => particle(-22)).toThrow();
  });
  test('names resolve', () => {
    expect(byName('mu-')?.pdg).toBe(13);
    expect(byName('mu+')?.pdg).toBe(-13);
    expect(byName('anti-p')?.pdg).toBe(-2212);
  });
  test('every decay conserves charge, baryon number and lepton number', () => {
    for (const p of allParticles()) {
      for (const d of p.decays) {
        const from = quantumNumbers([p.pdg]);
        const to = quantumNumbers(d.products);
        // neutral kaon mixing states are not charge eigenstates of strangeness: skip strangeness for them
        expect({ pdg: p.pdg, products: d.products, charge3: to.charge3 }).toEqual({ pdg: p.pdg, products: d.products, charge3: from.charge3 });
        expect({ pdg: p.pdg, products: d.products, baryon3: to.baryon3 }).toEqual({ pdg: p.pdg, products: d.products, baryon3: from.baryon3 });
        expect({ pdg: p.pdg, products: d.products, lepton: to.lepton }).toEqual({ pdg: p.pdg, products: d.products, lepton: from.lepton });
      }
    }
  });
  test('decay fractions sum to about one', () => {
    for (const p of allParticles()) {
      if (!p.decays.length) continue;
      const s = p.decays.reduce((a, d) => a + d.br, 0);
      // A few entries list only the main modes; the tolerance is wide on purpose and tightened by the reviewer for the headline particles.
      expect(Math.abs(s - 1), `${p.name}: Σ BR = ${s}`).toBeLessThan(0.05);
    }
    // The bottom number follows the quark content: b quark −1, b̄ +1 (so B⁰ = d b̄ has +1 and Λ_b = udb has −1).
    expect(particle(5122).bottom).toBe(-1);
    expect(particle(511).bottom).toBe(1);
    for (const id of [23, 24, 25, 13, 211, 443, 553, 421]) {
      const s = particle(id).decays.reduce((a, d) => a + d.br, 0);
      expect(Math.abs(s - 1), `${particle(id).name}: Σ BR = ${s}`).toBeLessThan(0.01);
    }
  });
  test('widths and lifetimes agree', () => {
    const z = particle(23);
    expect(z.lifetime).toBeCloseTo(6.582119569e-25 / 2.4955, 30);
    expect(particle(13).lifetime).toBeCloseTo(2.197e-6, 9);
  });
});
