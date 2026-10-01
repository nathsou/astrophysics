import { describe, expect, test } from 'vitest';
import { customise, presets, simulate } from '../detector/index.ts';
import { rng } from '../random/index.ts';
import { DEFAULT_GEOMETRY, geometryFromConfig } from './geometry.ts';
import { findTracks } from './tracking.ts';
import { truthEventFrom } from './synthetic.ts';

describe('geometry from a detector configuration', () => {
  test('presets: layers sorted by radius, pixel count, calorimeters, muon system', () => {
    for (const [name, cfg] of Object.entries(presets)) {
      const g = geometryFromConfig(cfg);
      expect(g.layers.length, name).toBe(cfg.trackerLayers.length);
      for (let i = 1; i < g.layers.length; i++) expect(g.layers[i]!.r).toBeGreaterThan(g.layers[i - 1]!.r);
      expect(g.bField).toBe(cfg.bField);
      expect(g.ecal.rInner).toBe(cfg.ecal.rIn);
      expect(g.hcal.rInner).toBe(cfg.hcal.rIn);
      expect(g.nPixelLayers).toBe(cfg.trackerLayers.filter((l) => l.kind === 'pixel').length);
      expect(g.muon.stations.length).toBe(cfg.muon.stations.length);
      expect(g.coilRadius).toBeGreaterThan(g.hcal.rInner);
      // the expected muon momentum after the calorimeters is lower, and zero for a muon that stops
      expect(g.muon.momentumAfterCalo(20, 1)).toBeLessThan(20);
      expect(g.muon.momentumAfterCalo(20, 1)).toBeGreaterThan(10);
      expect(g.muon.momentumAfterCalo(g.muon.minP * 0.3, 1)).toBe(0);
    }
  });
  test('the result is cached per configuration object', () => {
    const cfg = presets.onion!;
    expect(geometryFromConfig(cfg)).toBe(geometryFromConfig(cfg));
    expect(geometryFromConfig(DEFAULT_GEOMETRY)).toBe(DEFAULT_GEOMETRY);
  });
  test('layers in a different order in the configuration: hits are mapped to the sorted layers, tracks are still found', () => {
    const cfg = customise(presets.onion!, {});
    cfg.trackerLayers = [...cfg.trackerLayers].reverse();
    const g = geometryFromConfig(cfg);
    expect(g.layerMap).toBeDefined();
    const gen = rng(3);
    const det = simulate(truthEventFrom([{ pdg: 211, pt: 10, eta: 0.3, phi: 0.6 }]), cfg, gen);
    const tr = findTracks(det.hits, cfg);
    expect(tr.length).toBe(1);
    expect(tr[0]!.pt).toBeGreaterThan(9);
    expect(tr[0]!.pt).toBeLessThan(11);
  });
});
