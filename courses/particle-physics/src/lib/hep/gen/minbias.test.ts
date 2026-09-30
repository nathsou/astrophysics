import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { particle } from '../particles/index.ts';
import { dNchDeta, meanCharged, minimumBias, minimumBiasEvent, negativeBinomial, sigmaInelMb } from './minbias.ts';

const isCharged = (pdg: number) => particle(pdg).charge3 !== 0;
const etaOf = (p: { px: number; py: number; pz: number }) => Math.asinh(p.pz / Math.hypot(p.px, p.py));

describe('minimum-bias toy', () => {
  test('dNch/dη(0) = 6.0 at 7 TeV and about 6.9 at 13 TeV (a parametrisation, see the header); σ_inel of order 70–80 mb', () => {
    expect(dNchDeta(7000)).toBe(6);
    expect(dNchDeta(13000)).toBeGreaterThan(6.7);
    expect(dNchDeta(13000)).toBeLessThan(7.1);
    expect(sigmaInelMb(13000)).toBeGreaterThan(75);
    expect(sigmaInelMb(13000)).toBeLessThan(82);
    expect(sigmaInelMb(7000)).toBeGreaterThan(sigmaInelMb(900));
    expect(minimumBias().sigma(13000)).toBeCloseTo(sigmaInelMb(13000) * 1e9, 3);
  });
  test('charged multiplicity in |η| < 2.5 is ≈ 5 × dNch/dη, the η distribution is flat in the plateau, pT averages 0.55 GeV', () => {
    const r = rng(1);
    const n = 1500;
    let nch = 0, inner = 0, outer = 0, pt = 0, nc = 0;
    for (let i = 0; i < n; i++) {
      const ev = minimumBiasEvent(r, 13000);
      for (const p of ev.particles) {
        if (!isCharged(p.pdg)) continue;
        const e = etaOf(p.p);
        const a = Math.abs(e);
        if (a < 2.5) nch++;
        if (a < 1) inner++;
        else if (a < 2) outer++;
        pt += Math.hypot(p.p.px, p.p.py);
        nc++;
      }
    }
    expect(nch / n).toBeGreaterThan(0.9 * 5 * dNchDeta(13000));
    expect(nch / n).toBeLessThan(1.1 * 5 * dNchDeta(13000));
    expect(inner / 2 / (outer / 2)).toBeGreaterThan(0.93); // per unit η
    expect(inner / 2 / (outer / 2)).toBeLessThan(1.07);
    expect(pt / nc).toBeGreaterThan(0.5);
    expect(pt / nc).toBeLessThan(0.6);
  });
  test('the event has zero net charge and baryon number; π⁰ are half as many as charged pions; species fractions 84 : 11 : 5', () => {
    const r = rng(2);
    let pi = 0, k = 0, pr = 0, pi0 = 0;
    for (let i = 0; i < 400; i++) {
      const ev = minimumBiasEvent(r, 13000);
      let q3 = 0, b3 = 0;
      for (const p of ev.particles) {
        const t = particle(p.pdg);
        q3 += t.charge3;
        b3 += t.baryon3;
        expect(p.status).toBe('final');
        expect(p.mothers).toEqual([]);
        const a = Math.abs(p.pdg);
        if (a === 211) pi++;
        else if (a === 321) k++;
        else if (a === 2212) pr++;
        else if (a === 111) pi0++;
      }
      expect(q3).toBe(0);
      expect(b3).toBe(0);
    }
    const ch = pi + k + pr;
    expect(pi / ch).toBeGreaterThan(0.82);
    expect(pi / ch).toBeLessThan(0.86);
    expect(k / ch).toBeGreaterThan(0.09);
    expect(k / ch).toBeLessThan(0.13);
    expect(pi0 / pi).toBeGreaterThan(0.46);
    expect(pi0 / pi).toBeLessThan(0.54);
  });
  test('the multiplicity is negative-binomial: variance = μ + μ²/k', () => {
    const r = rng(3);
    const mu = 30, k = 2;
    let s = 0, s2 = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const x = negativeBinomial(r, mu, k);
      s += x;
      s2 += x * x;
    }
    const mean = s / n, v = s2 / n - mean * mean;
    expect(Math.abs(mean / mu - 1)).toBeLessThan(0.02);
    expect(Math.abs(v / (mu + (mu * mu) / k) - 1)).toBeLessThan(0.08);
  });
  test('etaMax restricts the window and the mean follows the plateau integral', () => {
    const r = rng(4);
    const ev = minimumBiasEvent(r, 13000, { etaMax: 2.5 });
    for (const p of ev.particles) expect(Math.abs(etaOf(p.p))).toBeLessThan(2.5 + 1e-9);
    expect(meanCharged(13000, 2.5)).toBeCloseTo(5 * dNchDeta(13000), -1);
    expect(meanCharged(13000, 5.5)).toBeGreaterThan(meanCharged(13000, 2.5));
  });
  test('as a Process: unit-weight events, weighted mode returns σ_inel in pb, deterministic', () => {
    const p = minimumBias();
    const a = p.generate(rng(5), { sqrtS: 13000 });
    const b = p.generate(rng(5), { sqrtS: 13000 });
    expect(a.weight).toBe(1);
    expect(a.event.particles.map((q) => q.p.E)).toEqual(b.event.particles.map((q) => q.p.E));
    expect(p.generate(rng(5), { sqrtS: 13000, weighted: true }).weight).toBeCloseTo(sigmaInelMb(13000) * 1e9, 0);
  });
});
