import { describe, expect, test } from 'vitest';
import { rng } from '../../hep/random/index.ts';
import { HBAR_GEV_S } from '../../hep/units/index.ts';
import { PRESETS, decayedBy, formatWidth, lifetimeEstimate, lifetimeOf, sampleDecays, widthOf } from './decay.ts';

describe('the decay clock model', () => {
  test('presets take their lifetimes and widths from the particle table, with Γτ = ħ', () => {
    for (const p of PRESETS) {
      expect(p.widthGeV * p.tauS / HBAR_GEV_S, p.id).toBeCloseTo(1, 10);
      const sum = p.modes.reduce((a, m) => a + m.br, 0);
      expect(sum, p.id).toBeGreaterThan(0.99);
      expect(sum, p.id).toBeLessThan(1.001);
    }
    const z = PRESETS.find((p) => p.id === 'z')!;
    expect(z.tauS).toBeCloseTo(2.6376e-25, 28);
    expect(z.modes.map((m) => m.label)).toContain('μ⁺μ⁻');
    const jpsi = PRESETS.find((p) => p.id === 'jpsi')!;
    expect(jpsi.tauS).toBeCloseTo(7.108e-21, 24);
    const mu = PRESETS.find((p) => p.id === 'mu')!;
    expect(mu.tauS).toBeCloseTo(2.197e-6, 9);
    expect(mu.widthGeV).toBeCloseTo(2.996e-19, 22);
  });

  test('decay times are exponential: mean τ, survival e^(−t/τ), and memoryless', () => {
    const tau = 3.7;
    const { t } = sampleDecays(rng(5), 200000, tau, [1]);
    const mean = t.reduce((a, b) => a + b, 0) / t.length;
    expect(mean / tau).toBeCloseTo(1, 1);
    for (const k of [0.5, 1, 2, 4]) {
      const surv = 1 - decayedBy(t, k * tau) / t.length;
      expect(surv).toBeCloseTo(Math.exp(-k), 2);
    }
    // memoryless: among those surviving to τ, the fraction surviving a further τ is again e⁻¹
    const s1 = t.length - decayedBy(t, tau);
    const s2 = t.length - decayedBy(t, 2 * tau);
    expect(s2 / s1).toBeCloseTo(Math.exp(-1), 2);
    // sorted
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]!);
  });

  test('modes are drawn in proportion to the branching ratios', () => {
    const z = PRESETS.find((p) => p.id === 'z')!;
    const w = z.modes.map((m) => m.br);
    const { mode } = sampleDecays(rng(6), 100000, 1, w);
    const c = new Array<number>(w.length).fill(0);
    for (const m of mode) c[m]!++;
    const tot = w.reduce((a, b) => a + b, 0);
    w.forEach((b, i) => expect(Math.abs(c[i]! / 100000 - b / tot)).toBeLessThan(0.006));
  });

  test('the lifetime estimate is unbiased, with error τ/√k, including when only part of the decay curve has been seen', () => {
    const tau = 2;
    const pulls: number[] = [];
    for (let s = 1; s <= 300; s++) {
      const { t } = sampleDecays(rng(s), 200, tau, [1]);
      const e = lifetimeEstimate(t, 1.0 * tau); // watched for only one lifetime
      pulls.push((e.tau - tau) / e.err);
    }
    const mean = pulls.reduce((a, b) => a + b, 0) / pulls.length;
    const sd = Math.sqrt(pulls.reduce((a, b) => a + (b - mean) ** 2, 0) / pulls.length);
    expect(Math.abs(mean)).toBeLessThan(0.25);
    expect(sd).toBeGreaterThan(0.8);
    expect(sd).toBeLessThan(1.2);
    expect(Number.isNaN(lifetimeEstimate(new Float64Array([5, 6]), 1).tau)).toBe(true);
  });

  test('width and lifetime conversions and formatting', () => {
    expect(widthOf(2.6376e-25)).toBeCloseTo(2.4955, 3);
    expect(lifetimeOf(9.26e-5)).toBeCloseTo(7.108e-21, 24);
    expect(formatWidth(2.4955)).toBe('2.5 GeV');
    expect(formatWidth(9.26e-5)).toBe('92.6 keV');
    expect(formatWidth(0.1474)).toBe('147 MeV');
    expect(formatWidth(2.996e-19)).toBe('300 peV');
    expect(formatWidth(1e-23)).toBe('1.00 × 10⁻¹⁴ eV');
  });
});
