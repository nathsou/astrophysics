import { describe, expect, test } from 'vitest';
import { caloResolution, presets } from '../../hep/detector/index.ts';
import { glucksternMeasurement, glucksternScattering } from './trackMc.ts';

/** The tracker and calorimeter resolution curves of Chapter 7's figure 7.3, for the course detector. */
const cfg = presets.onion!;
const L = cfg.trackerLayers.at(-1)!.r / 1000;
const n = cfg.trackerLayers.length;
const sigma = Math.sqrt(cfg.trackerLayers.reduce((a, l) => a + l.sigmaRPhi ** 2, 0) / n) * 1e-3;
const x0 = cfg.trackerLayers.reduce((a, l) => a + l.x0, 0);
const setup = { B: cfg.bField, L, n, sigma, x0 };
const tracker = (E: number) => Math.hypot(glucksternMeasurement(E, setup), glucksternScattering(E, setup, 1));

describe('Chapter 7: tracker against calorimeter for the course detector', () => {
  test('the ECAL gives 1.0 % at 10 GeV and 0.41 % at 100 GeV; the tracker 0.49 % and 1.7 %', () => {
    expect(caloResolution('em', 10, cfg, 9)).toBeGreaterThan(0.0095);
    expect(caloResolution('em', 10, cfg, 9)).toBeLessThan(0.0107);
    expect(caloResolution('em', 100, cfg, 9)).toBeGreaterThan(0.0039);
    expect(caloResolution('em', 100, cfg, 9)).toBeLessThan(0.0043);
    expect(tracker(10)).toBeGreaterThan(0.0046);
    expect(tracker(10)).toBeLessThan(0.0052);
    expect(tracker(100)).toBeGreaterThan(0.0165);
    expect(tracker(100)).toBeLessThan(0.0180);
  });
  test('the tracker and the ECAL cross at about 26 GeV, and the tracker and the HCAL at about 400 GeV', () => {
    let eEm = 0, eHad = 0;
    for (let E = 1; E < 2000; E *= 1.01) {
      if (!eEm && tracker(E) > caloResolution('em', E, cfg, 9)) eEm = E;
      if (!eHad && tracker(E) > caloResolution('had', E, cfg, 9)) eHad = E;
    }
    expect(eEm).toBeGreaterThan(23);
    expect(eEm).toBeLessThan(30);
    expect(eHad).toBeGreaterThan(330);
    expect(eHad).toBeLessThan(500);
  });
  test('Chapter 8: particle flow gives 3.2 GeV for the jet of the exercise, calorimeters alone 8.7 GeV', () => {
    const pf = Math.hypot(0.01 * 65, 0.027 * Math.sqrt(25), Math.sqrt(10));
    const cal = Math.hypot(Math.sqrt(65), 0.027 * Math.sqrt(25), Math.sqrt(10));
    expect(pf).toBeCloseTo(3.23, 2);
    expect(cal).toBeCloseTo(8.66, 2);
  });
  test('Chapter 7: the fraction of an isotropic distribution outside |η| < 2.5 is 1.34 %, and η = 2.5 is 9.4° from the beam', () => {
    expect(1 - Math.tanh(2.5)).toBeCloseTo(0.0134, 4);
    expect((2 * Math.atan(Math.exp(-2.5)) * 180) / Math.PI).toBeCloseTo(9.4, 1);
    expect((2 * Math.atan(Math.exp(-5)) * 180) / Math.PI).toBeCloseTo(0.77, 2);
  });
});
