import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import { calibratedGeometry } from './calibrate.ts';
import { clusterCells } from './calo.ts';
import { findTracks } from './tracking.ts';
import { findConversions, metFromEvent, missingPt, particleFlow, predictStationHits, trackIsolation } from './objects.ts';
import { jetParticles, minBiasTruth, simulateTrackHits, truthEventFrom } from './synthetic.ts';
import type { TruthEvent } from '../event/index.ts';

const cfg = presets.onion!;
const geom = calibratedGeometry(cfg);
const merge = (...evs: TruthEvent[]): TruthEvent => ({ ...evs[0]!, particles: evs.flatMap((e) => e.particles).map((p, i) => ({ ...p, id: i })) });

describe('missing transverse momentum', () => {
  test('missingPt is minus the vector sum; metFromEvent from cells and muons', () => {
    const a = fromPtEtaPhiM(30, 0.2, 0.5, 0), b = fromPtEtaPhiM(20, -1, 2.5, 0);
    const m = missingPt([a, b]);
    expect(m.x).toBeCloseTo(-(a.px + b.px), 12);
    expect(m.y).toBeCloseTo(-(a.py + b.py), 12);
    // one cell of 10 GeV at η = 0.5, φ = 1: ET = 10/cosh(0.5); a muon of 25 GeV adds to the sum
    const cells = [{ calo: 'ecal' as const, eta: 0.5, phi: 1, energy: 10 }];
    const { met, sumEt } = metFromEvent(cells, geom, []);
    const et = (10 * geom.ecal.scale) / Math.cosh(0.5);
    expect(Math.hypot(met.x, met.y)).toBeCloseTo(et, 10);
    expect(Math.atan2(met.y, met.x)).toBeCloseTo(1 - Math.PI, 10);
    expect(sumEt).toBeCloseTo(et, 10);
    const mu = fromPtEtaPhiM(25, 0, 1 + Math.PI, 0.1057);
    const both = metFromEvent(cells, geom, [mu]);
    expect(both.sumEt).toBeCloseTo(et + 25, 6);
    expect(Math.hypot(both.met.x, both.met.y)).toBeCloseTo(Math.abs(25 - et), 6);
  });
});

describe('particle flow and isolation', () => {
  test('every track is used once; charged particles take the tracker momentum; neutrals come from clusters', () => {
    const g = rng(1);
    const parts = jetParticles(g, 'light', 60, 0.2, 1.0);
    const truth = merge(truthEventFrom(parts), minBiasTruth(g, 8, [0, 0, 0], 0));
    const det = simulate(truth, cfg, g);
    const tracks = findTracks(det.hits, geom);
    const clusters = clusterCells(det.cells, geom);
    const pf = particleFlow(tracks, clusters, geom);
    const charged = pf.filter((c) => c.track >= 0);
    expect(new Set(charged.map((c) => c.track)).size).toBe(charged.length);
    expect(charged.length).toBe(tracks.length);
    for (const c of charged) expect(Math.hypot(c.p.px, c.p.py)).toBeCloseTo(tracks[c.track]!.pt, 6);
    for (const c of pf.filter((c) => c.track < 0)) expect(c.charge).toBe(0);
    // the sum of particle-flow pT is close to the visible truth pT (vector sum over the jet's particles), much closer than tracks alone
    const sx = pf.reduce((a, c) => a + c.p.px, 0), sy = pf.reduce((a, c) => a + c.p.py, 0);
    const tx = truth.particles.reduce((a, p) => a + p.p.px, 0), ty = truth.particles.reduce((a, p) => a + p.p.py, 0);
    expect(Math.hypot(sx - tx, sy - ty)).toBeLessThan(0.3 * Math.hypot(tx, ty));
  });
  test('charged-hadron subtraction drops tracks from other vertices', () => {
    const g = rng(2);
    const truth = merge(truthEventFrom([{ pdg: 211, pt: 20, eta: 0.1, phi: 0.3 }], [0, 0, 0]));
    const pile = [truthEventFrom([{ pdg: 211, pt: 20, eta: 0.1, phi: 2.0 }], [0, 0, 25], 1)];
    const det = simulate(truth, cfg, g, { pileup: pile });
    const tracks = findTracks(det.hits, geom);
    const clusters = clusterCells(det.cells, geom);
    expect(particleFlow(tracks, clusters, geom, { pvZ: 0, chs: false }).filter((c) => c.kind === 'chHad').length).toBe(2);
    const chs = particleFlow(tracks, clusters, geom, { pvZ: 0, chs: true }).filter((c) => c.kind === 'chHad');
    expect(chs.length).toBe(1);
    expect(Math.abs(Math.atan2(chs[0]!.p.py, chs[0]!.p.px) - 0.3)).toBeLessThan(0.05);
  });
  test('track isolation: a cone sum of the other tracks divided by the object pT', () => {
    const g = rng(3);
    const parts = [{ pdg: 211, pt: 20, eta: 0, phi: 0 }, { pdg: 211, pt: 3, eta: 0.1, phi: 0.1 }, { pdg: -211, pt: 2, eta: -0.1, phi: -0.15 }, { pdg: 211, pt: 5, eta: 0, phi: 1.5 }];
    const det = simulate(truthEventFrom(parts), cfg, g);
    const tracks = findTracks(det.hits, geom);
    const lead = tracks.findIndex((t) => t.pt > 15);
    const iso = trackIsolation({ eta: tracks[lead]!.eta, phi: tracks[lead]!.phi, pt: tracks[lead]!.pt }, tracks, { exclude: new Set([lead]) });
    expect(iso).toBeCloseTo((3 + 2) / tracks[lead]!.pt, 1);
    expect(trackIsolation({ eta: tracks[lead]!.eta, phi: tracks[lead]!.phi, pt: tracks[lead]!.pt }, tracks, { exclude: new Set([lead]), cone: 0.05 })).toBe(0);
  });
});

describe('muon system prediction and conversions', () => {
  test('a 30 GeV muon is predicted in every station within the muon hits, the return field bends it back', () => {
    const g = rng(4);
    const det = simulate(truthEventFrom([{ pdg: 13, pt: 30, eta: 0.3, phi: 1.2 }]), cfg, g);
    const tr = findTracks(det.hits, geom);
    expect(det.muonHits.length).toBeGreaterThanOrEqual(2);
    const pred = predictStationHits(tr[0]!, geom);
    expect(pred.length).toBe(det.muonHits.length);
    for (const s of pred) {
      const h = det.muonHits.find((m) => m.station === s.station)!;
      const r = Math.hypot(h.x, h.y);
      const dT = Math.abs(Math.atan2(Math.sin(Math.atan2(h.y, h.x) - Math.atan2(s.y, s.x)), Math.cos(Math.atan2(h.y, h.x) - Math.atan2(s.y, s.x)))) * r;
      expect(dT).toBeLessThan(s.wT);
      expect(Math.abs(h.z - s.z)).toBeLessThan(s.wZ);
    }
    // a muon too soft to get through the calorimeters is not predicted
    const soft = { ...tr[0]!, pt: 2 };
    expect(predictStationHits(soft, geom).length).toBe(0);
  });
  test('photon conversions: an e⁺e⁻ pair created at r = 20 mm is found; two unrelated tracks are not', () => {
    const g = rng(5);
    let found = 0, n = 0, spurious = 0;
    for (let k = 0; k < 30; k++) {
      const phi = (g() * 2 - 1) * Math.PI, eta = (g() - 0.5) * 2;
      const r0 = 20 + 10 * g();
      const v: [number, number, number] = [r0 * Math.cos(phi) / Math.cosh(eta), r0 * Math.sin(phi) / Math.cosh(eta), r0 * Math.tanh(eta)];
      const pair = [
        { pt: 8 + 10 * g(), eta: eta + 0.0003, phi: phi + 0.0002, charge: 1, vertex: v, id: 0, collision: 0 },
        { pt: 4 + 6 * g(), eta: eta - 0.0002, phi: phi - 0.0003, charge: -1, vertex: v, id: 1, collision: 0 },
      ];
      const hits = pair.flatMap((t) => simulateTrackHits(g, t, geom));
      const tr = findTracks(hits, geom, { d0Max: 10 });
      if (tr.length !== 2) continue;
      n++;
      if (findConversions(tr, 5).length === 1) found++;
      // the same two tracks, rotated apart: not a conversion
      const apart = [pair[0]!, { ...pair[1]!, phi: phi + 0.5, vertex: [0, 0, 0] as [number, number, number] }];
      const tr2 = findTracks(apart.flatMap((t) => simulateTrackHits(g, t, geom)), geom);
      if (findConversions(tr2, 5).length > 0) spurious++;
    }
    expect(n).toBeGreaterThan(15);
    expect(found / n).toBeGreaterThan(0.8);
    expect(spurious).toBe(0);
  });
});
