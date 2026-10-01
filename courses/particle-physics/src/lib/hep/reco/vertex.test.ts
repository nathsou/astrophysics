import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { DEFAULT_GEOMETRY as G } from './geometry.ts';
import { findTracks } from './tracking.ts';
import { fitVertex, findPrimaryVertices, findSecondaryVertices, impactParameter, trackAtVertex } from './vertex.ts';
import { simulateTrackHits, synthEvent, type SynthTrack } from './synthetic.ts';
import type { Hit } from '../event/index.ts';
import type { RecoTrack } from './types.ts';

const rms = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

function tracksFrom(g: ReturnType<typeof rng>, list: SynthTrack[]): RecoTrack[] {
  const hits: Hit[] = [];
  for (const t of list) hits.push(...simulateTrackHits(g, t, G));
  return findTracks(hits, G);
}
const mk = (pt: number, eta: number, phi: number, q: number, vertex: [number, number, number], id: number): SynthTrack => ({ pt, eta, phi, charge: q, vertex, id, collision: 0 });

describe('vertex fit and impact parameter', () => {
  test('fitted position pulls are N(0,1) and χ²/ndof ≈ 1', () => {
    const g = rng(1);
    const px: number[] = [], py: number[] = [], pz: number[] = [];
    let chi = 0, ndof = 0;
    for (let k = 0; k < 120; k++) {
      const v: [number, number, number] = [normal(g, 0, 0.015), normal(g, 0, 0.015), normal(g, 0, 30)];
      const list = Array.from({ length: 8 }, (_, i) => mk(1 + 10 * g() * g(), (g() - 0.5) * 4, (g() * 2 - 1) * Math.PI, g() < 0.5 ? 1 : -1, v, i));
      const tr = tracksFrom(g, list);
      if (tr.length < 4) continue;
      const f = fitVertex(tr, { chi2Cut: Infinity });
      px.push((f.x - v[0]) / Math.sqrt(f.cov[0]![0]!));
      py.push((f.y - v[1]) / Math.sqrt(f.cov[1]![1]!));
      pz.push((f.z - v[2]) / Math.sqrt(f.cov[2]![2]!));
      chi += f.chi2;
      ndof += f.ndof;
    }
    for (const a of [px, py, pz]) {
      expect(rms(a)).toBeGreaterThan(0.75);
      expect(rms(a)).toBeLessThan(1.3);
    }
    expect(chi / ndof).toBeGreaterThan(0.75);
    expect(chi / ndof).toBeLessThan(1.35);
  });
  test('outlier rejection: a track from another vertex is dropped', () => {
    const g = rng(2);
    const v: [number, number, number] = [0, 0, 10];
    const list = [...Array.from({ length: 7 }, (_, i) => mk(3 + 5 * g(), (g() - 0.5) * 3, i * 0.8 - 2.5, i % 2 ? 1 : -1, v, i)), mk(5, 0.2, 1.0, 1, [0, 0, 14], 99)];
    const tr = tracksFrom(g, list);
    const f = fitVertex(tr);
    expect(f.tracks.length).toBe(tr.length - 1);
    expect(Math.abs(f.z - 10)).toBeLessThan(0.1);
  });
  test('impact-parameter significance: prompt tracks ≈ N(0,1); a displaced track is far out; sign convention', () => {
    const g = rng(3);
    const sig: number[] = [];
    for (let k = 0; k < 150; k++) {
      const tr = tracksFrom(g, [mk(1 + 5 * g(), (g() - 0.5) * 3, (g() * 2 - 1) * Math.PI, 1, [0, 0, 0], 0)]);
      if (tr.length) sig.push(impactParameter(tr[0]!, { x: 0, y: 0, z: 0 }).significance);
    }
    expect(rms(sig)).toBeGreaterThan(0.75);
    expect(rms(sig)).toBeLessThan(1.3);
    // a track from a vertex 1 mm to the left of its direction of motion: d0 = +1 (perigee to the left of the origin)
    const t = tracksFrom(g, [mk(20, 0, 0, 1, [0, 1, 0], 0)])[0]!;
    const ip = impactParameter(t, { x: 0, y: 0, z: 0 });
    expect(ip.d0).toBeGreaterThan(0.9);
    expect(ip.d0).toBeLessThan(1.1);
    expect(ip.significance).toBeGreaterThan(10);
    // with a jet axis: the lifetime sign is positive if the track's closest approach is ahead of the vertex along the jet.
    // A track leaving (5, 0) at 0.2 rad to a jet along +x passes the origin at y ≈ −0.97 with its closest approach at x ≈ +0.2
    const t2 = tracksFrom(g, [mk(20, 0, 0.2, 1, [5, 0, 0], 0)])[0]!;
    const ahead = impactParameter(t2, { x: 0, y: 0, z: 0 }, { E: 50, px: 50, py: 0, pz: 0 });
    expect(ahead.d0).toBeGreaterThan(0.9);
    const behind = impactParameter(t2, { x: 0, y: 0, z: 0 }, { E: 50, px: -50, py: 0, pz: 0 });
    expect(behind.d0).toBeLessThan(-0.9);
    expect(trackAtVertex(t, 0, 1, 0).dxy).toBeCloseTo(0, 1);
  });
});

describe('primary vertices', () => {
  test('finds pile-up vertices at the right z and picks the hard-scatter by Σ pT²', () => {
    const g = rng(4);
    let nTrue = 0, nFound = 0, nHardOk = 0, nEv = 0;
    const pulls: number[] = [];
    for (let e = 0; e < 8; e++) {
      const zHard = normal(g, 0, 40);
      const sig = Array.from({ length: 12 }, () => ({ pt: 5 + 40 * g(), eta: (g() - 0.5) * 4, phi: (g() * 2 - 1) * Math.PI, charge: g() < 0.5 ? 1 : -1 }));
      const ev = synthEvent(g, sig, { pileup: 10, zv: zHard, noise: 1 });
      const tr = findTracks(ev.hits, G);
      const pvs = findPrimaryVertices(tr);
      nEv++;
      if (pvs.length && Math.abs(pvs[0]!.z - zHard) < 0.3) nHardOk++;
      // true vertices with ≥ 6 reconstructible tracks
      const truthZ = new Map<number, number>();
      const count = new Map<number, number>();
      for (const t of ev.tracks) if (t.pt > 1 && Math.abs(t.eta) < 2.2) count.set(t.collision, (count.get(t.collision) ?? 0) + 1);
      for (const [c, n] of count) if (n >= 6) { truthZ.set(c, c === 0 ? zHard : (ev.tracks.find((t) => t.collision === c)!.vertex[2])); }
      for (const [, z] of truthZ) {
        nTrue++;
        const m = pvs.find((v) => Math.abs(v.z - z) < 0.5);
        if (m) { nFound++; pulls.push((m.z - z) / Math.sqrt(m.cov[2]![2]!)); }
      }
    }
    expect(nFound / nTrue).toBeGreaterThan(0.85);
    expect(nHardOk / nEv).toBeGreaterThan(0.85);
    // robust width of the pulls (the errors are a little optimistic, and a few vertices are merged or split)
    const med = pulls.map(Math.abs).sort((a, b) => a - b)[Math.floor(pulls.length / 2)]! * 1.4826;
    expect(med).toBeLessThan(2);
  });
});

describe('secondary vertices', () => {
  test('a B-like decay 4 mm from the primary vertex is found, with position and mass sensible', () => {
    const g = rng(5);
    let found = 0, n = 0;
    const dxs: number[] = [];
    for (let k = 0; k < 40; k++) {
      const ang = (g() * 2 - 1) * Math.PI, eta0 = (g() - 0.5) * 2;
      const L = 4; // mm along the flight direction
      const sv: [number, number, number] = [L * Math.cos(ang) / Math.cosh(eta0), L * Math.sin(ang) / Math.cosh(eta0), L * Math.tanh(eta0)];
      const prompt = Array.from({ length: 4 }, (_, i) => mk(2 + 5 * g(), (g() - 0.5) * 3, (g() * 2 - 1) * Math.PI, i % 2 ? 1 : -1, [0, 0, 0], i));
      const dec = Array.from({ length: 4 }, (_, i) => mk(1.5 + 4 * g(), eta0 + normal(g, 0, 0.15), ang + normal(g, 0, 0.15), i % 2 ? 1 : -1, sv, 10 + i));
      const tr = tracksFrom(g, [...prompt, ...dec]);
      const pvs = findPrimaryVertices(tr);
      if (!pvs.length) continue;
      n++;
      const svs = findSecondaryVertices(tr, pvs[0]!);
      const m = svs.find((v) => Math.hypot(v.x - sv[0], v.y - sv[1], v.z - sv[2]) < 1.5);
      if (m) {
        found++;
        dxs.push(Math.hypot(m.x - sv[0], m.y - sv[1]));
        expect(m.kind).toBe('secondary');
        expect(m.mass!).toBeGreaterThan(0.3);
        expect(m.tracks.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(found / n).toBeGreaterThan(0.75);
    expect(dxs.sort((a, b) => a - b)[Math.floor(dxs.length / 2)]).toBeLessThan(0.3);
  });
  test('no secondary vertex from prompt tracks', () => {
    const g = rng(6);
    let spurious = 0;
    for (let k = 0; k < 30; k++) {
      const list = Array.from({ length: 10 }, (_, i) => mk(1.5 + 10 * g() * g(), (g() - 0.5) * 4, (g() * 2 - 1) * Math.PI, i % 2 ? 1 : -1, [0, 0, 0], i));
      const tr = tracksFrom(g, list);
      const pvs = findPrimaryVertices(tr);
      if (pvs.length && findSecondaryVertices(tr, pvs[0]!).length) spurious++;
    }
    expect(spurious).toBeLessThan(4);
  });
});
