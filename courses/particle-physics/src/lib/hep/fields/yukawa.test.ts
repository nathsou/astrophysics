import { describe, expect, test } from 'vitest';
import { massFromRangeMeV, massInElectronMasses, propagator, rangeFm, suppressionAt, virtualLifetimeS, yukawaForceMeVPerFm, yukawaPotentialMeV, yukawaShape } from './yukawa.ts';
import { particle } from '../particles/index.ts';

describe('Yukawa potential', () => {
  test('the pion gives a range of 1.4 fm and the inversion recovers the mass', () => {
    expect(rangeFm(140)).toBeCloseTo(1.4095, 3);
    expect(rangeFm(particle(211).mass * 1000)).toBeCloseTo(1.414, 2);
    expect(massFromRangeMeV(1.4)).toBeCloseTo(140.95, 1);
    expect(massFromRangeMeV(rangeFm(777))).toBeCloseTo(777, 9);
    expect(massInElectronMasses(139.57)).toBeCloseTo(273.1, 1);
    expect(rangeFm(particle(24).mass * 1000)).toBeCloseTo(2.455e-3, 5);
  });
  test('e^{−mr}/r solves (−∇² + m²)V = 0 away from the source and is 1/r for m = 0', () => {
    const m = 140;
    const R = rangeFm(m);
    for (const r of [0.3, 1, 2.5]) {
      const h = 1e-3;
      // (1/r²) d/dr (r² dV/dr) by central differences
      const V = (x: number) => yukawaShape(x, m);
      const dV = (x: number) => (V(x + h) - V(x - h)) / (2 * h);
      const lap = ((r + h) ** 2 * dV(r + h) - (r - h) ** 2 * dV(r - h)) / (2 * h * r * r);
      expect(lap / V(r)).toBeCloseTo(1 / (R * R), 3);
    }
    expect(yukawaShape(2, 0)).toBe(0.5);
  });
  test('force is minus the derivative of the potential; it is 1/r² at short distance', () => {
    const r = 0.8, m = 140, a = 0.08, h = 1e-5;
    const num = -(yukawaPotentialMeV(r + h, m, a) - yukawaPotentialMeV(r - h, m, a)) / (2 * h);
    expect(yukawaForceMeVPerFm(r, m, a) / num).toBeCloseTo(1, 6);
    const short = 1e-3;
    expect(yukawaForceMeVPerFm(short, m, a) * short * short / (-a * 197.3269804)).toBeCloseTo(1, 2);
  });
  test('the exchange time and the suppression at one range', () => {
    expect(virtualLifetimeS(140) / 4.70e-24).toBeCloseTo(1, 2);
    expect(suppressionAt(1.4095, 140)).toBeCloseTo(Math.exp(-1), 3);
    expect(propagator(0, 2)).toBe(0.25);
  });
});
