import { describe, expect, test } from 'vitest';
import { M_Z } from '$lib/hep/sm';
import { startValues, inverseCouplings, crossing, closestApproach } from './running.ts';

describe('running couplings', () => {
  test('values at the Z: 1/α₁ ≈ 59.0, 1/α₂ ≈ 29.6, 1/α₃ ≈ 8.5', () => {
    const [a1, a2, a3] = startValues();
    expect(a1).toBeCloseTo(59.0, 0);
    expect(a2).toBeCloseTo(29.6, 0);
    expect(a3).toBeCloseTo(8.47, 1);
  });
  test('at the Z mass the running has not started', () => {
    const a = inverseCouplings(M_Z);
    expect(a[0]).toBeCloseTo(startValues()[0], 6);
  });
  test('Standard Model: α₃ gets weaker with energy (1/α₃ grows), α₁ gets stronger (1/α₁ falls)', () => {
    const a = inverseCouplings(1e4);
    expect(a[2]).toBeGreaterThan(startValues()[2]);
    expect(a[0]).toBeLessThan(startValues()[0]);
  });
  test('Standard Model: α₁ meets α₂ near 10¹³ GeV and α₂ meets α₃ near 10¹⁷ GeV: not at one point', () => {
    const c12 = crossing(0, 1);
    const c23 = crossing(1, 2);
    expect(Math.log10(c12.mu)).toBeGreaterThan(12.5);
    expect(Math.log10(c12.mu)).toBeLessThan(13.5);
    expect(Math.log10(c23.mu)).toBeGreaterThan(16.5);
    expect(Math.log10(c23.mu)).toBeLessThan(17.5);
    expect(closestApproach().spread).toBeGreaterThan(3);
  });
  test('with superpartners at 1 TeV the three nearly meet near 10¹⁶ GeV', () => {
    const c = closestApproach(1000);
    expect(Math.log10(c.mu)).toBeGreaterThan(15.7);
    expect(Math.log10(c.mu)).toBeLessThan(16.6);
    expect(c.spread).toBeLessThan(1.2);
  });
});
