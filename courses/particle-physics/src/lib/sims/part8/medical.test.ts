import { describe, expect, test } from 'vitest';
import { protonRange, protonStoppingPower, protonDose, protonDoseSmeared, photonDose, energyForRange, spreadOutPeak, simulateLor, backproject, sharpen, type Blob } from './medical.ts';
import { rng } from '$lib/hep/random';

describe('protons in water', () => {
  test('ranges agree with the NIST PSTAR CSDA values to a few per cent (7.7, 15.8, 26.0 cm at 100, 150, 200 MeV)', () => {
    expect(protonRange(100) / 7.718).toBeGreaterThan(0.97);
    expect(protonRange(100) / 7.718).toBeLessThan(1.03);
    expect(protonRange(150) / 15.77).toBeGreaterThan(0.97);
    expect(protonRange(150) / 15.77).toBeLessThan(1.03);
    expect(protonRange(200) / 25.96).toBeGreaterThan(0.97);
    expect(protonRange(200) / 25.96).toBeLessThan(1.03);
  });
  test('stopping power at 100 MeV is about 7.3 MeV cm²/g', () => {
    expect(protonStoppingPower(100)).toBeGreaterThan(7.0);
    expect(protonStoppingPower(100)).toBeLessThan(7.6);
  });
  test('energyForRange inverts protonRange', () => {
    expect(energyForRange(protonRange(180))).toBeCloseTo(180, 1);
  });
  test('the Bragg peak: dose rises towards the end of the range, is about 3–6 times the entrance dose, and vanishes beyond', () => {
    const T = 150, R = protonRange(T);
    expect(protonDose(T, 0)).toBeCloseTo(1, 4);
    expect(protonDose(T, R * 0.5)).toBeGreaterThan(1);
    expect(protonDose(T, R * 0.98)).toBeGreaterThan(3);
    expect(protonDose(T, R * 0.98)).toBeLessThan(8);
    expect(protonDose(T, R + 0.1)).toBe(0);
    const smeared = protonDoseSmeared(T, R * 0.99);
    expect(smeared).toBeGreaterThan(2.5);
    expect(smeared).toBeLessThan(6);
  });
  test('photons lose dose steadily with depth: at the depth of the proton peak they deliver less than at the entrance', () => {
    expect(photonDose(15)).toBeLessThan(photonDose(0));
  });
  test('a spread-out peak is flat to about 15 % across its target', () => {
    const s = spreadOutPeak(10, 14, 20);
    const doses = [10.3, 11, 12, 13, 13.7].map((z) => s.dose(z));
    const mean = doses.reduce((a, b) => a + b, 0) / doses.length;
    for (const d of doses) expect(Math.abs(d / mean - 1)).toBeLessThan(0.15);
    expect(s.dose(16)).toBeLessThan(0.1 * mean);
  });
});

describe('PET', () => {
  const blobs: Blob[] = [{ x: 0.3, y: 0.2, sigma: 0.06, weight: 1 }];
  test('every line of response passes through the decay point (to the detector blur)', () => {
    const r = rng(3);
    for (let i = 0; i < 50; i++) {
      const l = simulateLor(blobs, r, 0);
      const x1 = Math.cos(l.a1), y1 = Math.sin(l.a1), x2 = Math.cos(l.a2), y2 = Math.sin(l.a2);
      // distance of (x, y) from the line through the two hits
      const d = Math.abs((x2 - x1) * (y1 - l.y) - (x1 - l.x) * (y2 - y1)) / Math.hypot(x2 - x1, y2 - y1);
      expect(d).toBeLessThan(1e-9);
    }
  });
  test('back-projection peaks at the source', () => {
    const r = rng(4);
    const lors = Array.from({ length: 3000 }, () => simulateLor(blobs, r));
    const n = 48;
    const img = sharpen(backproject(lors, n), n, 4, 1);
    let best = 0;
    for (let k = 1; k < n * n; k++) if (img[k]! > img[best]!) best = k;
    const x = ((best % n) + 0.5) / n * 2 - 1, y = (Math.floor(best / n) + 0.5) / n * 2 - 1;
    expect(Math.hypot(x - 0.3, y - 0.2)).toBeLessThan(0.15);
  });
});
