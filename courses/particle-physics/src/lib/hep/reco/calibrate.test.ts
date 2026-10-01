import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import { applyCalibration, calibratedGeometry, calibrateCalorimeters } from './calibrate.ts';
import { clusterCells } from './calo.ts';
import { geometryFromConfig } from './geometry.ts';
import { truthEventFrom } from './synthetic.ts';

describe('calorimeter calibration', () => {
  const cfg = presets.onion!;
  test('the derived scales are close to one, deterministic, and cached per configuration', () => {
    const c1 = calibrateCalorimeters(cfg);
    const c2 = calibrateCalorimeters(cfg);
    expect(c1).toEqual(c2);
    expect(c1.ecal).toBeGreaterThan(1);
    expect(c1.ecal).toBeLessThan(1.1);
    expect(c1.hcal).toBeGreaterThan(0.8);
    expect(c1.hcal).toBeLessThan(1.6);
    expect(calibratedGeometry(cfg)).toBe(calibratedGeometry(cfg));
    expect(calibratedGeometry(cfg, { autoCalibrate: false })).toBe(geometryFromConfig(cfg));
  });
  test('after calibration photons are within 1.5 % on average, at energies the calibration did not use', () => {
    const geom = calibratedGeometry(cfg);
    const g = rng(77);
    const r: number[] = [];
    for (const E of [8, 15, 60, 120]) {
      for (let k = 0; k < 12; k++) {
        const eta = (g() - 0.5) * 1.6;
        const det = simulate(truthEventFrom([{ pdg: 22, pt: E / Math.cosh(eta), eta, phi: g() * 6 - 3 }]), cfg, g.fork('c' + E + k));
        if (det.hits.some((h) => h.truth >= 0)) continue;
        const ec = clusterCells(det.cells, geom).filter((c) => c.calo === 'ecal').reduce((a, c) => a + c.energy, 0);
        r.push(ec / E - 1);
      }
    }
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    expect(Math.abs(mean)).toBeLessThan(0.015);
  });
  test('applyCalibration multiplies the scales and leaves the original alone', () => {
    const base = geometryFromConfig(cfg);
    const cal = applyCalibration(base, { ecal: 1.1, hcal: 0.9, n: 1 });
    expect(cal.ecal.scale).toBeCloseTo(base.ecal.scale * 1.1, 12);
    expect(cal.hcal.scale).toBeCloseTo(base.hcal.scale * 0.9, 12);
    expect(base.ecal.scale).toBe(1);
  });
});
