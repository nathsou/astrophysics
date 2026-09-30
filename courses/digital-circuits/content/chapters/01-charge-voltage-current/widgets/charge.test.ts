import { describe, expect, test } from 'vitest';
import { LANDMARKS, chargeOf, electronsAt, formatCharge, formatDuration, formatElectrons, nearestLandmark } from './charge';

describe('charge', () => {
  test('a coulomb is 6.24×10¹⁸ electrons', () => {
    const c = LANDMARKS.find((l) => l.id === 'coulomb')!;
    expect(c.electrons / 1e18).toBeCloseTo(6.2415, 3);
    expect(chargeOf(c.electrons)).toBeCloseTo(1, 12);
  });
  test('landmarks ascend, and the largest fits on the axis (10²³)', () => {
    for (let i = 1; i < LANDMARKS.length; i++) expect(LANDMARKS[i]!.electrons).toBeGreaterThan(LANDMARKS[i - 1]!.electrons);
    expect(Math.log10(LANDMARKS.at(-1)!.electrons)).toBeLessThan(23);
  });
  test('the phone battery holds 10,800 C', () => {
    const p = LANDMARKS.find((l) => l.id === 'phone')!;
    expect(chargeOf(p.electrons)).toBeCloseTo(10800, 6);
    expect(p.electrons).toBeCloseTo(6.74e22, -20);
  });
  test('an AA cell holds 9,000 C, which at 1.5 V is 13.5 kJ', () => {
    const aa = LANDMARKS.find((l) => l.id === 'aa')!;
    expect(chargeOf(aa.electrons)).toBeCloseTo(9000, 6);
    expect(chargeOf(aa.electrons) * 1.5).toBeCloseTo(13500, 5);
  });
  test('the nearest landmark and the ratio', () => {
    expect(nearestLandmark(0).landmark.id).toBe('one');
    const n = nearestLandmark(Math.log10(LANDMARKS.find((l) => l.id === 'coulomb')!.electrons) + 0.3);
    expect(n.landmark.id).toBe('coulomb');
    expect(n.ratio).toBeCloseTo(2, 1);
    expect(electronsAt(3)).toBe(1000);
  });
});

describe('formatting', () => {
  test('durations', () => {
    expect(formatDuration(3e-9)).toBe('3 ns');
    expect(formatDuration(0.04)).toBe('40 ms');
    expect(formatDuration(9000)).toBe('2.5 h');
    expect(formatDuration(1e10)).toBe('320 years');
  });
  test('charges and counts', () => {
    expect(formatCharge(1.6e-19)).toBe('1.60×10⁻¹⁹ C');
    expect(formatCharge(0.02)).toBe('20 mC');
    expect(formatCharge(9000)).toBe('9000 C');
    expect(formatElectrons(1)).toBe('1');
    expect(formatElectrons(6.24e18)).toBe('6.24×10¹⁸');
  });
});
