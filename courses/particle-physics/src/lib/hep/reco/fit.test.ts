import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { circleFit, fitTrack3D, kasaFit, ptFromRadius } from './fit.ts';
import { DEFAULT_GEOMETRY } from './geometry.ts';
import { simulateTrackHits } from './synthetic.ts';
import { radiusFromPt } from './helix.ts';

function arc(xc: number, yc: number, R: number, a0: number, a1: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return { x: xc + R * Math.cos(a), y: yc + R * Math.sin(a) };
  });
}

describe('circle fits', () => {
  test('exact points give the exact circle', () => {
    const r = circleFit(arc(100, -50, 300, 0.3, 2.5, 8));
    expect(r.xc).toBeCloseTo(100, 6);
    expect(r.yc).toBeCloseTo(-50, 6);
    expect(r.R).toBeCloseTo(300, 6);
    expect(r.chi2).toBeLessThan(1e-12);
    const k = kasaFit(arc(100, -50, 300, 0.3, 2.5, 8));
    expect(k.R).toBeCloseTo(300, 6);
  });
  test('three points are enough', () => {
    const r = circleFit([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]);
    expect(r.R).toBeCloseTo(1, 10);
    expect(() => circleFit([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
  });
  test('a straight line gives a huge radius, not NaN', () => {
    const r = circleFit(Array.from({ length: 6 }, (_, i) => ({ x: 100 * i, y: 50 * i })));
    expect(Number.isFinite(r.R)).toBe(true);
    expect(r.R).toBeGreaterThan(1e8);
    expect(r.chi2).toBeLessThan(1e-6);
  });
  test('Taubin is less biased than Kåsa on short noisy arcs', () => {
    const g = rng(11);
    let biasT = 0, biasK = 0;
    const N = 400;
    for (let k = 0; k < N; k++) {
      const pts = arc(0, 2000, 2000, -Math.PI / 2 - 0.25, -Math.PI / 2 + 0.25, 6).map((p) => ({ x: p.x + normal(g, 0, 6), y: p.y + normal(g, 0, 6) }));
      biasT += circleFit(pts).R - 2000;
      biasK += kasaFit(pts).R - 2000;
    }
    // Kåsa shrinks the circle; Taubin is (almost) unbiased
    expect(biasK / N).toBeLessThan(biasT / N);
    expect(Math.abs(biasT / N)).toBeLessThan(Math.abs(biasK / N));
  });
  test('weights: a point with a large sigma is followed less', () => {
    const pts = arc(0, 0, 100, 0, 1.5, 7).map((p) => ({ ...p, sigma: 0.01 }));
    const bad = { x: pts[3]!.x + 5, y: pts[3]!.y, sigma: 100 };
    const r1 = circleFit([...pts, bad]);
    const r2 = circleFit([...pts, { ...bad, sigma: 0.01 }]);
    expect(Math.abs(r1.R - 100)).toBeLessThan(Math.abs(r2.R - 100));
  });
  test('ptFromRadius: R = 1 m at 1 T is 0.2998 GeV', () => {
    expect(ptFromRadius(1000, 1)).toBeCloseTo(0.299792458, 9);
    expect(ptFromRadius(radiusFromPt(12.3, 3.8), 3.8)).toBeCloseTo(12.3, 9);
  });
});

describe('fitTrack3D on synthetic helices', () => {
  test('recovers pT, η, φ, charge, d0, z0 from noise-free hits, both charges, both field signs', () => {
    const r = rng(5);
    for (const q of [1, -1]) {
      for (const eta of [-2, 0.3, 1.7]) {
        const hits = simulateTrackHits(r, { pt: 4.2, eta, phi: 0.8, charge: q, vertex: [0, 0, 12], id: 0, collision: 0 }, DEFAULT_GEOMETRY, { ms: false, smear: false });
        const f = fitTrack3D(hits, 3.8);
        expect(f.charge).toBe(q);
        expect(f.pt).toBeCloseTo(4.2, 4);
        expect(f.eta).toBeCloseTo(eta, 5);
        expect(f.phi).toBeCloseTo(0.8, 5);
        expect(Math.abs(f.d0)).toBeLessThan(1e-4);
        expect(f.z0).toBeCloseTo(12, 4);
        expect(f.chi2).toBeLessThan(1e-6);
        expect(f.ndof).toBe(2 * hits.length - 5);
      }
    }
    // reversed field flips the sense of rotation: the same hits now belong to the opposite charge
    const hits = simulateTrackHits(r, { pt: 4.2, eta: 0.2, phi: 0.8, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 }, DEFAULT_GEOMETRY, { ms: false, smear: false });
    expect(fitTrack3D(hits, -3.8).charge).toBe(-1);
  });
  test('a displaced track has the right signed d0', () => {
    const r = rng(6);
    // production vertex 2 mm left of a particle going along +x: the perigee is at the vertex, y = +2 -> d0 = +2·cos... ≈ 2
    const hits = simulateTrackHits(r, { pt: 20, eta: 0, phi: 0, charge: 1, vertex: [0, 2, 0], id: 0, collision: 0 }, DEFAULT_GEOMETRY, { ms: false, smear: false });
    const f = fitTrack3D(hits, 3.8);
    expect(f.d0).toBeGreaterThan(1.9);
    expect(f.d0).toBeLessThan(2.1);
  });
  test('resolution with smearing and multiple scattering is sensible', () => {
    const r = rng(7);
    const rel: number[] = [];
    for (let k = 0; k < 300; k++) {
      const hits = simulateTrackHits(r, { pt: 20, eta: 0.4, phi: k, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
      rel.push(fitTrack3D(hits, 3.8).pt / 20 - 1);
    }
    const m = rel.reduce((a, b) => a + b, 0) / rel.length;
    const s = Math.sqrt(rel.reduce((a, b) => a + (b - m) ** 2, 0) / rel.length);
    expect(Math.abs(m)).toBeLessThan(0.01);
    expect(s).toBeLessThan(0.05);
    expect(s).toBeGreaterThan(0.001);
  });
});

describe('fitTrack3D with multiple scattering (generalised least squares)', () => {
  const pts = (hits: { layer: number; x: number; y: number; z: number }[]) =>
    hits.map((h) => ({ x: h.x, y: h.y, z: h.z, sxy: DEFAULT_GEOMETRY.layers[h.layer]!.sigmaRPhi, sz: DEFAULT_GEOMETRY.layers[h.layer]!.sigmaZ, x0: DEFAULT_GEOMETRY.layers[h.layer]!.xOverX0 }));
  test('χ²/ndof ≈ 1, parameter pulls ≈ N(0,1), and it beats the unweighted fit at low pT', () => {
    const g = rng(21);
    const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    for (const pt of [1, 4, 30]) {
      let chi = 0, ndof = 0;
      const pd0: number[] = [], pz0: number[] = [], ppt: number[] = [], ptz: number[] = [];
      let errPlain = 0, errGls = 0;
      for (let k = 0; k < 300; k++) {
        const eta = (g() - 0.5) * 2.4;
        const hits = simulateTrackHits(g, { pt, eta, phi: g() * 6 - 3, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
        if (hits.length < 10) continue;
        const f = fitTrack3D(pts(hits), 3.8, { scattering: true });
        const plain = fitTrack3D(pts(hits), 3.8);
        chi += f.chi2;
        ndof += f.ndof;
        pd0.push(f.d0 / Math.sqrt(f.covT[0]![0]!));
        pz0.push(f.z0 / f.sigmaZ0);
        const sc = Math.sqrt(f.covT[2]![2]!);
        ppt.push((f.c - 1 / (1000 * pt / (0.299792458 * 3.8))) / sc);
        ptz.push((f.tanLambda - Math.sinh(eta)) / f.sigmaTanLambda);
        errPlain += (1 / plain.pt - 1 / pt) ** 2;
        errGls += (1 / f.pt - 1 / pt) ** 2;
      }
      expect(chi / ndof).toBeGreaterThan(0.75);
      expect(chi / ndof).toBeLessThan(1.3);
      for (const a of [pd0, pz0, ppt, ptz]) {
        expect(rms(a)).toBeGreaterThan(0.75);
        expect(rms(a)).toBeLessThan(1.3);
      }
      expect(errGls).toBeLessThanOrEqual(errPlain * 1.02);
    }
  });
  test('agrees with the Kalman fit', async () => {
    const { kalmanTrackFit } = await import('./kalman.ts');
    const g = rng(22);
    const hits = simulateTrackHits(g, { pt: 2, eta: 0.3, phi: 0.4, charge: -1, vertex: [0, 0, 0], id: 0, collision: 0 });
    const f = fitTrack3D(pts(hits), 3.8, { scattering: true });
    const k = kalmanTrackFit(hits, DEFAULT_GEOMETRY);
    expect(f.pt / k.pt).toBeGreaterThan(0.97);
    expect(f.pt / k.pt).toBeLessThan(1.03);
    expect(Math.sqrt(f.covT[0]![0]!) / k.sigmaD0).toBeGreaterThan(0.85);
    expect(Math.sqrt(f.covT[0]![0]!) / k.sigmaD0).toBeLessThan(1.15);
    expect(f.sigmaZ0 / k.sigmaZ0).toBeGreaterThan(0.85);
    expect(f.sigmaZ0 / k.sigmaZ0).toBeLessThan(1.15);
  });
});

describe('the reco.circleFit hook', () => {
  test('a replacement circle fit is used by fitTrack3D and by the track finder', async () => {
    const { setOverride } = await import('../hooks.ts');
    const { findTracks } = await import('./tracking.ts');
    const hits = simulateTrackHits(rng(9), { pt: 6, eta: 0.2, phi: 0.4, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
    const points = hits.map((h) => ({ x: h.x, y: h.y, z: h.z }));
    const plain = fitTrack3D(points, 3.8);
    let calls = 0;
    // a deliberately wrong fit: the right circle with a radius 10 % too large
    setOverride('reco.circleFit', ((pts: { x: number; y: number }[]) => {
      calls++;
      const c = circleFit(pts);
      return { ...c, R: c.R * 1.1 };
    }) as never);
    try {
      const biased = fitTrack3D(points, 3.8);
      expect(calls).toBe(1);
      expect(biased.pt / plain.pt).toBeGreaterThan(1.05);
      calls = 0;
      findTracks(hits, DEFAULT_GEOMETRY);
      expect(calls).toBeGreaterThan(0);
    } finally {
      setOverride('reco.circleFit', undefined);
    }
    expect(fitTrack3D(points, 3.8).pt).toBeCloseTo(plain.pt, 10);
  });
});
