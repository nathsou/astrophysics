import { describe, expect, it } from 'vitest';
import { LAMBDA_MM, X0_MM, defaultGeometry, direction, etaPhiOf, faceDistance, geometryFromDetectorConfig, outerHalfLength, outerRadius, trackerRadius, type DetectorConfigShape } from './geometry.ts';
import type { DisplayGeometry } from './geometry.ts';

// A config shaped like the detector module's DetectorConfig (with extra fields the display ignores).
const cfg = {
  name: 'test',
  bField: 3.8,
  trackerLayers: [
    { r: 35, halfLength: 300, sigmaRPhi: 0.012, sigmaZ: 0.02, x0: 0.012, kind: 'pixel' as const },
    { r: 1100, halfLength: 3000, sigmaRPhi: 0.04, sigmaZ: 0.5, x0: 0.02, kind: 'strip' as const },
  ],
  ecal: { rIn: 1290, depthX0: 25, halfLength: 3000, etaMax: 2.5, cellEta: 0.0175, layers: 3 },
  hcal: { rIn: 1600, depthLambda: 10, cellEta: 0.087, layers: 4 },
  muon: { stations: [{ r: 4000, halfLength: 6000 }, { r: 7000, halfLength: 8800 }], minPToReach: 4 },
  etaMax: 2.5,
};

describe('geometryFromDetectorConfig', () => {
  it('accepts a DetectorConfig-shaped object (structural typing)', () => {
    const shape: DetectorConfigShape = cfg;
    const g: DisplayGeometry = geometryFromDetectorConfig(shape);
    expect(g.bField).toBe(3.8);
    expect(g.tracker).toHaveLength(2);
    expect(g.tracker[1]).toEqual({ r: 1100, halfLength: 3000 });
    expect(g.muon.map((m) => m.r)).toEqual([4000, 7000]);
  });
  it('derives the calorimeter thicknesses from the depths', () => {
    const g = geometryFromDetectorConfig(cfg);
    expect(g.ecal.rOut).toBeCloseTo(1290 + 25 * X0_MM, 9);
    expect(g.hcal.rOut).toBeCloseTo(1600 + 10 * LAMBDA_MM, 9);
    expect(g.hcal.rIn).toBeGreaterThan(g.ecal.rOut);
    expect(g.solenoid.r).toBeCloseTo(g.hcal.rOut, 9); // the coil defaults to the HCAL's outer radius
  });
  it('uses exact outer radii, coil radius and return field when given', () => {
    const g = geometryFromDetectorConfig({ ...cfg, solenoidRadius: 3300, muon: { ...cfg.muon, returnField: -1.9 } }, { ecalOuterRadius: 1512, hcalOuterRadius: 3000 });
    expect(g.ecal.rOut).toBe(1512);
    expect(g.hcal.rOut).toBe(3000);
    expect(g.solenoid.r).toBe(3300);
    expect(g.outerFieldFactor).toBeCloseTo(-0.5, 9);
    expect(geometryFromDetectorConfig(cfg).outerFieldFactor).toBe(0);
  });
  it('sums fine cells into towers of at least 0.087', () => {
    const g = geometryFromDetectorConfig(cfg);
    expect(g.ecal.cell).toBe(0.087);
    expect(geometryFromDetectorConfig({ ...cfg, hcal: { ...cfg.hcal, cellEta: 0.1 } }).hcal.cell).toBe(0.1);
  });
  it('the default geometry is consistent', () => {
    const g = defaultGeometry;
    expect(g.ecal.rOut).toBeGreaterThan(g.ecal.rIn);
    expect(g.hcal.rIn).toBeGreaterThan(g.ecal.rOut);
    expect(g.muon[0]!.r).toBeGreaterThan(g.hcal.rOut);
    expect(trackerRadius(g)).toBeLessThan(g.ecal.rIn);
    expect(outerRadius(g)).toBe(7000);
    expect(outerHalfLength(g)).toBe(8800);
  });
});

describe('direction helpers', () => {
  it('direction(η, φ) is a unit vector with the right angles', () => {
    for (const [eta, phi] of [[0, 0], [1.2, 0.7], [-2.5, -2]] as const) {
      const d = direction(eta, phi);
      expect(Math.hypot(...d)).toBeCloseTo(1, 12);
      const back = etaPhiOf(d[0], d[1], d[2]);
      expect(back.eta).toBeCloseTo(eta, 9);
      expect(back.phi).toBeCloseTo(phi, 9);
    }
  });
  it('faceDistance reaches the barrel at η = 0 and the end cap at large η', () => {
    expect(faceDistance(0, 1290, 3040)).toBeCloseTo(1290, 9);
    expect(faceDistance(3, 1290, 3040)).toBeCloseTo(3040 / Math.tanh(3), 9);
    // the crossover is at sinh η = halfLength / r
    const etaX = Math.asinh(3040 / 1290);
    expect(faceDistance(etaX, 1290, 3040)).toBeCloseTo(1290 * Math.cosh(etaX), 6);
  });
});
