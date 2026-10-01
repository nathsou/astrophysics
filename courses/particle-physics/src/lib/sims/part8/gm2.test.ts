import { describe, expect, test } from 'vitest';
import { VALUES, pull } from './gm2.ts';

const v = (id: string) => VALUES.find((x) => x.id === id)!;

describe('g − 2 values', () => {
  test('the Fermilab 2025 uncertainty is the quadrature sum of the quoted parts (11.4 stat, 9.1 syst, 2.1 ext)', () => {
    expect(Math.hypot(11.4, 9.1, 2.1)).toBeCloseTo(v('fnal25').error, 0);
  });
  test('the 2025 world average is 116 592 0715(145) × 10⁻¹²', () => {
    expect(v('avg25').value * 10).toBeCloseTo(116592071.5 * 10, 6);
    expect(v('avg25').error * 10).toBeCloseTo(145, 6);
  });
  test('against the 2020 white paper the final result differs by more than five standard deviations; against the 2025 one by less than one', () => {
    expect(pull(v('avg25'), v('wp20')).z).toBeGreaterThan(5);
    expect(pull(v('avg25'), v('wp20')).z).toBeLessThan(6.5);
    expect(Math.abs(pull(v('avg25'), v('wp25')).z)).toBeLessThan(1);
  });
  test('all the measurements agree with each other within two standard deviations', () => {
    for (const a of VALUES.filter((x) => x.kind === 'experiment'))
      for (const b of VALUES.filter((x) => x.kind === 'experiment')) expect(Math.abs(pull(a, b).z)).toBeLessThan(2);
  });
});
