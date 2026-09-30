import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { houghTransform } from './hough.ts';
import { setOverride } from '../hooks.ts';
import { findTracks } from './tracking.ts';
import { DEFAULT_GEOMETRY } from './geometry.ts';
import { simulateTrackHits } from './synthetic.ts';

const radii = [30, 60, 100, 150, 250, 370, 500, 650, 800, 1000];
/** Hits of a track through the origin with direction φ0 and curvature κ (the parametrisation of hough.ts). */
function trackHits(phi0: number, kappa: number, sigma = 0) {
  const g = rng(Math.round(Math.abs(phi0 * 1000 + kappa * 1e6)));
  return radii.map((r) => {
    const phi = phi0 + Math.asin((kappa * r) / 2) + (sigma ? normal(g, 0, sigma) / r : 0);
    return { x: r * Math.cos(phi), y: r * Math.sin(phi) };
  });
}

describe('Hough transform', () => {
  test('a single track makes a peak with one vote per layer at its (φ0, κ)', () => {
    const res = houghTransform(trackHits(0.7, -0.0015));
    expect(res.accumulator.length).toBe(res.nAngle * res.nCurv);
    const top = res.peaks[0]!;
    expect(top.votes).toBe(10);
    expect(Math.abs(top.phi0 - 0.7)).toBeLessThan(0.03);
    expect(Math.abs(top.curvature - -0.0015)).toBeLessThan(2e-4);
  });
  test('the sign convention: κ > 0 turns towards increasing φ', () => {
    const left = trackHits(0, 0.001);
    expect(left[left.length - 1]!.y).toBeGreaterThan(0);
    const res = houghTransform(left);
    expect(res.peaks[0]!.curvature).toBeGreaterThan(0);
  });
  test('several tracks give several peaks, including across the φ = ±π seam', () => {
    const tracks = [[3.1, 0.002], [-3.1, -0.001], [0.0, 0.0005], [1.5, -0.003]] as const;
    const hits = tracks.flatMap(([p, k]) => trackHits(p, k, 0.02));
    const res = houghTransform(hits, { nAngle: 256, nCurv: 64, minVotes: 6 });
    for (const [p, k] of tracks) {
      const hit = res.peaks.find((pk) => Math.abs(Math.atan2(Math.sin(pk.phi0 - p), Math.cos(pk.phi0 - p))) < 0.05 && Math.abs(pk.curvature - k) < 6e-4);
      expect(hit, `peak for ${p}, ${k}`).toBeDefined();
    }
  });
  test('the hook replaces the transform in the Hough-seeded track finder', () => {
    let calls = 0;
    setOverride('reco.houghTransform', ((...a: Parameters<typeof houghTransform>) => { calls++; return houghTransform(...a); }) as never);
    try {
      const hits = simulateTrackHits(rng(1), { pt: 10, eta: 0.1, phi: 0.5, charge: 1, vertex: [0, 0, 0], id: 0, collision: 0 });
      const tr = findTracks(hits, DEFAULT_GEOMETRY, { seeding: 'hough' });
      expect(calls).toBe(1);
      expect(tr.length).toBe(1);
    } finally {
      setOverride('reco.houghTransform', undefined);
    }
  });
});
