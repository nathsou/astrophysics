import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { setOverride } from '../hooks.ts';
import { kalmanPredict, kalmanTrackFit, kalmanUpdate } from './kalman.ts';
import { fitTrack3D } from './fit.ts';
import { DEFAULT_GEOMETRY } from './geometry.ts';
import { simulateTrackHits } from './synthetic.ts';

describe('generic Kalman filter', () => {
  test('one-dimensional update is the textbook weighted mean', () => {
    const r = kalmanUpdate({ x: [10], P: [[4]] }, { z: [12], R: [[1]] }, [[1]]);
    expect(r.x[0]).toBeCloseTo(10 + (4 / 5) * 2, 12);
    expect(r.P[0]![0]).toBeCloseTo(4 / 5, 12);
    expect(r.chi2).toBeCloseTo(4 / 5, 12); // y²/S = 4/5
  });
  test('two-dimensional constant-velocity filter converges and χ² per measurement is about 1', () => {
    // state (position, velocity); measure position
    const g = rng(3);
    const F = [[1, 1], [0, 1]];
    const Q = [[0, 0], [0, 0]];
    let s = { x: [0, 0], P: [[100, 0], [0, 100]] };
    let truth = [0, 0.7];
    let chi = 0;
    let n = 0;
    for (let k = 0; k < 400; k++) {
      truth = [truth[0]! + truth[1]!, truth[1]!];
      const zm = truth[0]! + (g() + g() + g() + g() - 2) * Math.sqrt(3);
      s = kalmanPredict(s, F, Q);
      const u = kalmanUpdate(s, { z: [zm], R: [[1]] }, [[1, 0]]);
      s = { x: u.x, P: u.P };
      if (k > 5) { chi += u.chi2; n++; }
    }
    expect(s.x[1]).toBeCloseTo(0.7, 1);
    expect(chi / n).toBeGreaterThan(0.6);
    expect(chi / n).toBeLessThan(1.5);
    // covariance stays symmetric
    expect(Math.abs(s.P[0]![1]! - s.P[1]![0]!)).toBeLessThan(1e-12);
  });
  test('the hook replaces the update used by the track fit', () => {
    const hits = simulateTrackHits(rng(1), { pt: 5, eta: 0.1, phi: 0.2, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
    let calls = 0;
    setOverride('reco.kalmanUpdate', ((...a: Parameters<typeof kalmanUpdate>) => { calls++; return kalmanUpdate(...a); }) as never);
    try {
      kalmanTrackFit(hits, DEFAULT_GEOMETRY);
    } finally {
      setOverride('reco.kalmanUpdate', undefined);
    }
    expect(calls).toBe(hits.length);
  });
});

describe('Kalman track fit', () => {
  test('noise-free hits: exact parameters, χ² ≈ 0', () => {
    const hits = simulateTrackHits(rng(2), { pt: 8, eta: -1.1, phi: 2.0, charge: -1, vertex: [0, 0, -7], id: 0, collision: 0 }, DEFAULT_GEOMETRY, { ms: false, smear: false });
    const f = kalmanTrackFit(hits, DEFAULT_GEOMETRY);
    expect(f.charge).toBe(-1);
    expect(f.pt).toBeCloseTo(8, 3);
    expect(f.eta).toBeCloseTo(-1.1, 4);
    expect(f.phi).toBeCloseTo(2.0, 4);
    expect(f.z0).toBeCloseTo(-7, 2);
    expect(Math.abs(f.d0)).toBeLessThan(1e-2);
    expect(f.chi2).toBeLessThan(1e-3);
    expect(f.ndof).toBe(2 * hits.length - 5);
  });
  test('with scattering and smearing: χ²/ndof ≈ 1, pulls ≈ N(0,1), parameter pulls ≈ N(0,1)', () => {
    const g = rng(99);
    let chi = 0, ndof = 0;
    const pullsR: number[] = [], pullsZ: number[] = [];
    const pD0: number[] = [], pZ0: number[] = [], pPt: number[] = [];
    for (const pt of [1.5, 5, 30]) {
      for (let k = 0; k < 150; k++) {
        const eta = (g() - 0.5) * 3;
        const hits = simulateTrackHits(g, { pt, eta, phi: g() * 6 - 3, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
        if (hits.length < 8) continue;
        const f = kalmanTrackFit(hits, DEFAULT_GEOMETRY);
        chi += f.chi2;
        ndof += f.ndof;
        for (const p of f.pulls) { pullsR.push(p.rphi); pullsZ.push(p.z); }
        pD0.push(f.d0 / f.sigmaD0);
        pZ0.push(f.z0 / f.sigmaZ0);
        pPt.push((1 / f.pt - 1 / pt) / (f.sigmaPtRel / f.pt));
      }
    }
    const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    expect(chi / ndof).toBeGreaterThan(0.8);
    expect(chi / ndof).toBeLessThan(1.25);
    for (const a of [pD0, pZ0, pPt]) {
      expect(rms(a)).toBeGreaterThan(0.8);
      expect(rms(a)).toBeLessThan(1.25);
    }
    // filtered residual pulls are narrower than N(0,1) only if the model is over-pessimistic; they should not be much wider
    expect(rms(pullsR)).toBeLessThan(1.3);
    expect(rms(pullsZ)).toBeLessThan(1.3);
  });
  test('the Kalman fit is not worse than the plain least-squares fit at low pT (scattering is in the weights)', () => {
    const g = rng(5);
    let kSum = 0, lSum = 0, n = 0;
    for (let k = 0; k < 200; k++) {
      const hits = simulateTrackHits(g, { pt: 1, eta: 0.2, phi: g() * 6 - 3, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
      if (hits.length < 10) continue;
      const kf = kalmanTrackFit(hits, DEFAULT_GEOMETRY);
      const ls = fitTrack3D(hits.map((h) => ({ x: h.x, y: h.y, z: h.z, sxy: 0.03, sz: 0.3 })), 3.8);
      kSum += Math.abs(kf.d0);
      lSum += Math.abs(ls.d0);
      n++;
    }
    expect(kSum / n).toBeLessThan(lSum / n);
  });
});
