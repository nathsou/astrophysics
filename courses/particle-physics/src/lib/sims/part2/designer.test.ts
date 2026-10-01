import { describe, expect, test } from 'vitest';
import { BUDGET, DEFAULT_DESIGN, buildConfig, cost, measure, gunEventFor, type DesignParams } from './designer.ts';
import { glucksternMeasurement } from './trackMc.ts';
import { hcalOuterRadius, ecalOuterRadius } from '../../hep/detector/index.ts';

const D = DEFAULT_DESIGN;

describe('the designer’s detector', () => {
  test('layers, calorimeters and muon stations are nested', () => {
    for (const p of [D, { ...D, trackerRadius: 500, stripLayers: 2 }, { ...D, trackerRadius: 1500, stripLayers: 10, ecalDepth: 35, hcalDepth: 12 }]) {
      const c = buildConfig(p);
      const radii = c.trackerLayers.map((l) => l.r);
      expect(radii).toEqual([...radii].sort((a, b) => a - b));
      expect(new Set(radii).size).toBe(radii.length);
      expect(c.ecal.rIn).toBeGreaterThan(radii.at(-1)!);
      expect(c.hcal.rIn).toBeGreaterThan(ecalOuterRadius(c));
      expect(c.muon.stations[0]!.r).toBeGreaterThan(hcalOuterRadius(c));
      expect(c.trackerLayers.length).toBe(3 + p.stripLayers);
    }
  });
  test('the default design is close to the onion preset’s numbers: 3.8 T, an ECAL of 25 X0, an HCAL of 10 λ', () => {
    const c = buildConfig(D);
    expect(c.bField).toBe(3.8);
    expect(c.ecal.depthX0).toBe(25);
    expect(c.hcal.depthLambda).toBe(10);
  });
});

describe('the toy cost model', () => {
  test('the default design fits the budget with a little to spare', () => {
    const c = cost(D);
    expect(c.total).toBeGreaterThan(70);
    expect(c.total).toBeLessThan(BUDGET);
    expect(c.total).toBeCloseTo(c.tracker + c.magnet + c.ecal + c.hcal + c.muon, 10);
  });
  test('every knob costs more when it is turned up', () => {
    const base = cost(D).total;
    const up: Partial<DesignParams>[] = [{ B: 5 }, { trackerRadius: 1500 }, { stripLayers: 8 }, { ecalDepth: 30 }, { hcalDepth: 12 }];
    for (const u of up) expect(cost({ ...D, ...u }).total).toBeGreaterThan(base);
    expect(cost({ ...D, ecalType: 'sampling' }).total).toBeLessThan(base);
  });
  test('the magnet’s stored energy is of the order of a gigajoule at 3.8 T (the real CMS solenoid stores about 2.6 GJ)', () => {
    const e = cost(D).storedEnergyGJ;
    expect(e).toBeGreaterThan(0.5);
    expect(e).toBeLessThan(5);
  });
});

describe('what the designer measures', () => {
  test('σ(pT)/pT falls as 1/B, follows the lever arm, and is of the size of Gluckstern’s estimate', () => {
    const a = measure({ ...D, B: 2 }, 120, 1);
    const b = measure({ ...D, B: 4 }, 120, 1);
    expect(a.ptRes100 / b.ptRes100).toBeGreaterThan(1.6);
    expect(a.ptRes100 / b.ptRes100).toBeLessThan(2.5);
    const s = { B: 3.8, L: 1.1, n: 7, sigma: 30e-6, x0: 0 };
    const g = glucksternMeasurement(100, s);
    const m = measure(D, 160, 2);
    expect(m.ptRes100 / g).toBeGreaterThan(0.4);
    expect(m.ptRes100 / g).toBeLessThan(2);
    const small = measure({ ...D, trackerRadius: 600 }, 120, 3);
    expect(small.ptRes100 / m.ptRes100).toBeGreaterThan(2);
  });
  test('a crystal ECAL beats a sampling one; a thin ECAL leaks; a thin HCAL leaks', () => {
    const crystal = measure(D, 100, 4);
    const sampling = measure({ ...D, ecalType: 'sampling' }, 100, 4);
    expect(sampling.eRes50).toBeGreaterThan(1.8 * crystal.eRes50);
    const thinE = measure({ ...D, ecalDepth: 12 }, 100, 5);
    expect(thinE.eResponse).toBeLessThan(0.85 * crystal.eResponse);
    const thinH = measure({ ...D, hcalDepth: 5 }, 100, 6);
    expect(thinH.leakage100).toBeGreaterThan(crystal.leakage100 + 0.04);
    expect(thinH.muonMinP).toBeLessThan(crystal.muonMinP);
    expect(crystal.muonEff100).toBeGreaterThan(0.95);
  });
  test('the pion resolution is about 1/√E ⊕ 5 % for 50 GeV: 12–20 %', () => {
    const m = measure(D, 160, 7);
    expect(m.hadRes50).toBeGreaterThan(0.1);
    expect(m.hadRes50).toBeLessThan(0.22);
  });
  test('a gun event has truth, hits, cells and a reconstruction', () => {
    const ev = gunEventFor(buildConfig(D), 13, 40, 0.3, 1, 1);
    expect(ev.detector!.hits.length).toBeGreaterThan(5);
    expect(ev.reco.tracks.length).toBe(1);
    expect(ev.reco.tracks[0]!.pt).toBeGreaterThan(36);
  });
});
