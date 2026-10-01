import { describe, expect, test } from 'vitest';
import {
  STANDARD_ROCK, SEA_LEVEL_VERTICAL_INTENSITY, differentialFlux, integralFlux, lowEnergyIntensity, minimumEnergy, range, energyAfter,
  transmittedIntensity, massThickness, expectedCount, lengthInBox, exitDistance, slantThickness,
} from './index.ts';

describe('energy loss in rock', () => {
  test('range and minimum energy are inverse functions', () => {
    for (const E of [10, 100, 1000, 1e4]) expect(minimumEnergy(range(E))).toBeCloseTo(E, 6);
  });
  test('orders of magnitude: a 1 TeV muon crosses a couple of kilometres of rock, a 50 GeV muon about a hundred metres', () => {
    expect(range(1000) / 2.65 / 1e5).toBeGreaterThan(0.8); // km
    expect(range(1000) / 2.65 / 1e5).toBeLessThan(1.3);
    expect(range(50) / 2.4 / 100).toBeGreaterThan(80);
    expect(range(50) / 2.4 / 100).toBeLessThan(130);
  });
  test('energyAfter: zero for a muon that stops, and consistent with the range', () => {
    const E = 100;
    const R = range(E);
    expect(energyAfter(E, 0.999 * R)).toBeGreaterThan(0);
    expect(energyAfter(E, 1.001 * R)).toBe(0);
    expect(energyAfter(E, R / 2)).toBeGreaterThan(0);
    expect(energyAfter(E, R / 2)).toBeLessThan(E);
  });
  test('ionisation dominates below the critical energy a/b = 500 GeV', () => {
    expect(STANDARD_ROCK.a / STANDARD_ROCK.b).toBeCloseTo(500, 6);
  });
});

describe('the flux', () => {
  test('the spectrum falls steeply and is integrable', () => {
    expect(differentialFlux(100, 0)).toBeGreaterThan(differentialFlux(200, 0) * 4);
    expect(integralFlux(100, 0)).toBeGreaterThan(integralFlux(1000, 0));
    expect(integralFlux(100, 0)).toBeGreaterThan(0);
    // the integral above E agrees with a brute-force sum on a fine log grid
    let s = 0;
    const n = 20000, lo = Math.log(50), hi = Math.log(1e6);
    for (let i = 0; i < n; i++) {
      const E = Math.exp(lo + ((i + 0.5) * (hi - lo)) / n);
      s += differentialFlux(E, 0.4) * E * ((hi - lo) / n);
    }
    expect(integralFlux(50, 0.4) / s).toBeCloseTo(1, 3);
  });
  test('above 10 GeV the vertical intensity is within a factor of a few of the PDG total above 1 GeV divided by ten', () => {
    const I10 = integralFlux(10, 0);
    expect(I10).toBeGreaterThan(SEA_LEVEL_VERTICAL_INTENSITY / 10);
    expect(I10).toBeLessThan(SEA_LEVEL_VERTICAL_INTENSITY);
  });
  test('the low-energy angular distribution is cos²θ', () => {
    expect(lowEnergyIntensity(0)).toBeCloseTo(0.007, 12);
    expect(lowEnergyIntensity(Math.PI / 3) / lowEnergyIntensity(0)).toBeCloseTo(0.25, 12);
    expect(lowEnergyIntensity(Math.PI / 2 + 0.1)).toBe(0);
  });
  test('more rock, fewer muons', () => {
    let prev = Infinity;
    for (const L of [10, 30, 100, 300, 1000]) {
      const I = transmittedIntensity(massThickness(L, 2.65), 0);
      expect(I).toBeLessThan(prev);
      prev = I;
    }
  });
  test('a hundred metres of rock passes well under 2 % of the muons that reach the surface', () => {
    const I = transmittedIntensity(massThickness(100, 2.4), 0);
    expect(I / SEA_LEVEL_VERTICAL_INTENSITY).toBeLessThan(0.02);
    expect(I / SEA_LEVEL_VERTICAL_INTENSITY).toBeGreaterThan(0.002);
  });
});

describe('geometry', () => {
  const p = { base: 230, height: 139 };
  test('a box on the axis is crossed along its full length', () => {
    expect(lengthInBox(0, 0, 0, 1, { x: 0, z: 10, w: 4, h: 6 })).toBeCloseTo(6, 12);
    expect(lengthInBox(0, 0, 0, 1, { x: 20, z: 10, w: 4, h: 6 })).toBe(0);
    expect(lengthInBox(0, 0, 1, 0, { x: 10, z: 0, w: 4, h: 6 })).toBeCloseTo(4, 12);
  });
  test('vertical path through the pyramid from the base centre is the height', () => {
    expect(exitDistance(0, 0, 0, 1, p)).toBeCloseTo(139, 9);
    expect(exitDistance(0, 5, 0, 1, p)).toBeCloseTo(134, 9);
  });
  test('a horizontal-ish ray leaves through a face at the expected distance', () => {
    const t = exitDistance(0, 0, Math.sin(1), Math.cos(1), p);
    const x = t * Math.sin(1), z = t * Math.cos(1);
    expect(Math.abs(x) / 115 + z / 139).toBeCloseTo(1, 9);
  });
  test('a chamber removes its length of rock; a ray that misses it sees all of it', () => {
    const box = { x: 0, z: 60, w: 10, h: 8 };
    const full = slantThickness(p, { x: 0, z: 5 }, 0, 2.4);
    const hole = slantThickness(p, { x: 0, z: 5 }, 0, 2.4, box);
    expect(full - hole).toBeCloseTo(massThickness(8, 2.4), 6);
    expect(slantThickness(p, { x: 0, z: 5 }, 0.8, 2.4, box)).toBeCloseTo(slantThickness(p, { x: 0, z: 5 }, 0.8, 2.4), 9);
  });
});

describe('counts', () => {
  test('a chamber raises the count in the directions that cross it', () => {
    const p = { base: 230, height: 139 };
    const box = { x: 0, z: 60, w: 10, h: 12 };
    const dOm = (Math.PI / 90) ** 2;
    const at = (chamber: typeof box | null) => expectedCount(slantThickness(p, { x: 0, z: 5 }, 0, 2.4, chamber), 0, 1, dOm, 86400 * 30);
    expect(at(box)).toBeGreaterThan(at(null) * 1.03);
    expect(at(box)).toBeLessThan(at(null) * 1.6);
  });
});
