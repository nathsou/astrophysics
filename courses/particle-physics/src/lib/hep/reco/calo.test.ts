import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import { DEFAULT_GEOMETRY as G, geometryFromConfig } from './geometry.ts';
import { clusterCells, clusterP4, extrapolateToRadius } from './calo.ts';
import { truthEventFrom } from './synthetic.ts';
import type { CaloCell } from '../event/index.ts';
import { helixAtRadius } from './helix.ts';

const cell = (calo: 'ecal' | 'hcal', ieta: number, iphi: number, layer: number, energy: number): CaloCell => {
  const g = G[calo];
  const nPhi = Math.round((2 * Math.PI) / g.dPhi);
  return { calo, eta: (ieta + 0.5) * g.dEta, phi: -Math.PI + (((iphi % nPhi) + nPhi) % nPhi + 0.5) * g.dPhi, energy, layer, truth: [] };
};

describe('topological clustering on hand-made cells', () => {
  test('a seed with neighbours above the grow threshold forms one cluster with the summed energy', () => {
    const cells = [cell('ecal', 10, 20, 0, 5), cell('ecal', 11, 20, 0, 1), cell('ecal', 10, 21, 1, 0.5), cell('ecal', 9, 19, 0, 0.2), cell('ecal', 13, 20, 0, 0.3)];
    const cl = clusterCells(cells, G);
    expect(cl.length).toBe(1);
    expect(cl[0]!.energy).toBeCloseTo(5 + 1 + 0.5 + 0.2, 10); // the last cell is not connected
    expect(cl[0]!.cells.length).toBe(4);
    expect(cl[0]!.calo).toBe('ecal');
    // energy-weighted position
    const eta = (5 * 10.5 + 1 * 11.5 + 0.5 * 10.5 + 0.2 * 9.5) / 6.7 * G.ecal.dEta;
    expect(cl[0]!.eta).toBeCloseTo(eta, 10);
  });
  test('no seed, no cluster; a cell below the grow threshold does not join', () => {
    expect(clusterCells([cell('ecal', 5, 5, 0, 0.2), cell('ecal', 6, 5, 0, 0.2)], G).length).toBe(0);
    const c = clusterCells([cell('ecal', 5, 5, 0, 2), cell('ecal', 6, 5, 0, 0.05)], G);
    expect(c.length).toBe(1);
    expect(c[0]!.cells.length).toBe(1);
  });
  test('clusters wrap around φ = ±π and separate calorimeters stay separate', () => {
    const nPhi = Math.round((2 * Math.PI) / G.ecal.dPhi);
    const cells = [cell('ecal', 3, 0, 0, 4), cell('ecal', 3, nPhi - 1, 0, 1), cell('hcal', 3, 0, 0, 6)];
    const cl = clusterCells(cells, G);
    expect(cl.length).toBe(2);
    const e = cl.find((c) => c.calo === 'ecal')!;
    expect(e.cells.length).toBe(2);
    expect(Math.abs(e.phi)).toBeGreaterThan(3.1);
  });
  test('two well-separated maxima in one connected group are split', () => {
    const cells: CaloCell[] = [];
    for (let k = 0; k < 9; k++) cells.push(cell('ecal', 10 + k, 20, 0, k === 1 ? 10 : k === 7 ? 8 : 0.5));
    const cl = clusterCells(cells, G);
    expect(cl.length).toBe(2);
    expect(cl.reduce((a, c) => a + c.energy, 0)).toBeCloseTo(10 + 8 + 7 * 0.5, 10);
  });
  test('calibration constant scales the energy', () => {
    const geom = { ...G, ecal: { ...G.ecal, scale: 1.1 } };
    const cl = clusterCells([cell('ecal', 10, 20, 0, 5)], geom);
    expect(cl[0]!.energy).toBeCloseTo(5.5, 10);
  });
});

describe('clusters in the detector simulation', () => {
  const cfg = presets.onion!;
  const geom = geometryFromConfig(cfg);
  test('photons: one ECAL cluster with the right energy and direction; hadrons: energy shared ECAL + HCAL', () => {
    const g = rng(1);
    const eRes: number[] = [], hRes: number[] = [];
    for (let k = 0; k < 30; k++) {
      const eta = (g() - 0.5) * 2.4, phi = (g() * 2 - 1) * Math.PI;
      const gam = simulate(truthEventFrom([{ pdg: 22, pt: 20 / Math.cosh(eta), eta, phi }]), cfg, g.fork('g' + k));
      const cl = clusterCells(gam.cells, geom);
      const ec = cl.filter((c) => c.calo === 'ecal');
      const conv = gam.hits.some((h) => h.truth >= 0); // conversion in the tracker
      if (conv) continue;
      expect(ec.length).toBeGreaterThanOrEqual(1);
      eRes.push(ec[0]!.energy / 20 - 1);
      expect(Math.abs(ec[0]!.eta - eta)).toBeLessThan(0.03);
      const p = clusterP4(ec[0]!, geom);
      expect(Math.abs(Math.atan2(p.py, p.px) - phi) < 0.03 || Math.abs(Math.abs(Math.atan2(p.py, p.px) - phi) - 2 * Math.PI) < 0.03).toBe(true);
      const pim = simulate(truthEventFrom([{ pdg: 211, pt: 30 / Math.cosh(eta), eta, phi }]), cfg, g.fork('p' + k));
      const tot = clusterCells(pim.cells, geom).reduce((a, c) => a + c.energy, 0);
      hRes.push(tot / (Math.sqrt(30 ** 2 + 0.14 ** 2) - 0.14) - 1);
    }
    expect(eRes.length).toBeGreaterThan(10);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    // the detector's cells lose a few per cent of a photon's energy below their thresholds: calibrateCalorimeters corrects it
    expect(Math.abs(mean(eRes) + 0.045)).toBeLessThan(0.03);
    expect(Math.abs(mean(hRes))).toBeLessThan(0.15);
  });
  test('two photons 0.08 apart in φ make two ECAL clusters', () => {
    const g = rng(2);
    let two = 0;
    for (let k = 0; k < 20; k++) {
      const eta = (g() - 0.5) * 1.6, phi = (g() * 2 - 1) * 3;
      const det = simulate(truthEventFrom([{ pdg: 22, pt: 30, eta, phi }, { pdg: 22, pt: 25, eta, phi: phi + 0.08 }]), cfg, g.fork('t' + k));
      if (clusterCells(det.cells, geom).filter((c) => c.calo === 'ecal' && c.energy > 5).length === 2) two++;
    }
    expect(two).toBeGreaterThanOrEqual(15);
  });
  test('track extrapolation agrees with the helix: a muon-like track reaches the calorimeter where the cells are', () => {
    const g = rng(3);
    const det = simulate(truthEventFrom([{ pdg: 211, pt: 10, eta: 0.4, phi: 1.0 }]), cfg, g);
    const cl = clusterCells(det.cells, geom).filter((c) => c.calo === 'ecal' || c.calo === 'hcal');
    const at = extrapolateToRadius({ d0: 0, z0: 0, phi0: 1.0, tanLambda: Math.sinh(0.4), c: 0.299792458 * 3.8 / (1000 * 10) }, geom.ecal.rInner)!;
    expect(Math.abs(at.eta - 0.4)).toBeLessThan(0.02);
    expect(helixAtRadius({ d0: 0, z0: 0, phi0: 1, tanLambda: 0, c: 1e-3 }, 1e9)).toBeUndefined();
    expect(cl.length).toBeGreaterThan(0);
    const near = cl.find((c) => Math.hypot(c.eta - at.eta, Math.atan2(Math.sin(c.phi - at.phi), Math.cos(c.phi - at.phi))) < 0.1);
    expect(near).toBeDefined();
  });
});
