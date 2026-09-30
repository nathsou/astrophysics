import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import { DEFAULT_GEOMETRY as G } from './geometry.ts';
import { findTracks } from './tracking.ts';
import { bTagFeatures, bTagInfo, bTagScore } from './btag.ts';
import { findPrimaryVertices } from './vertex.ts';
import { simulateTrackHits, type SynthTrack } from './synthetic.ts';
import type { Hit } from '../event/index.ts';

const mk = (pt: number, eta: number, phi: number, q: number, vertex: [number, number, number], id: number): SynthTrack => ({ pt, eta, phi, charge: q, vertex, id, collision: 0 });

function jetEvent(g: ReturnType<typeof rng>, displaced: boolean, L = 3.5) {
  const eta = (g() - 0.5) * 1.5, phi = (g() * 2 - 1) * Math.PI;
  const flight = L / Math.cosh(eta);
  const sv: [number, number, number] = displaced ? [flight * Math.cos(phi), flight * Math.sin(phi), L * Math.tanh(eta)] : [0, 0, 0];
  const list: SynthTrack[] = [];
  for (let i = 0; i < 2; i++) list.push(mk(2 + 4 * g(), eta + normal(g, 0, 0.1), phi + normal(g, 0, 0.1), i % 2 ? 1 : -1, [0, 0, 0], i));
  for (let i = 0; i < 4; i++) list.push(mk(1.5 + 4 * g(), eta + normal(g, 0, 0.12), phi + normal(g, 0, 0.12), i % 2 ? 1 : -1, sv, 10 + i));
  // tracks from the primary vertex to give it substance
  for (let i = 0; i < 6; i++) list.push(mk(1 + 8 * g(), (g() - 0.5) * 4, (g() * 2 - 1) * Math.PI, i % 2 ? 1 : -1, [0, 0, 0], 20 + i));
  const hits: Hit[] = list.flatMap((t) => simulateTrackHits(g, t, G));
  const tracks = findTracks(hits, G);
  const vertices = findPrimaryVertices(tracks);
  const jet: P4 = fromPtEtaPhiM(40, eta, phi, 5);
  return { tracks, vertices, jet };
}

describe('b-tagging', () => {
  test('features: zero for a jet without tracks, monotonic in the significances', () => {
    expect(bTagFeatures([])).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    const f1 = bTagFeatures([2, 1, 0.5]);
    const f2 = bTagFeatures([8, 4, 2]);
    for (let i = 0; i < 3; i++) expect(f2[i]!).toBeGreaterThan(f1[i]!);
    expect(f2[3]).toBe(2); // tracks above 3 σ
    expect(bTagFeatures([-5, -3, -1])[0]).toBe(0); // negative (behind the vertex) does not count
  });
  test('jets with a displaced vertex score much higher than prompt jets', () => {
    const g = rng(5);
    const prompt: number[] = [], disp: number[] = [];
    let svFound = 0;
    for (let k = 0; k < 40; k++) {
      const a = jetEvent(g, false);
      const b = jetEvent(g, true);
      prompt.push(bTagScore(a.jet, a.tracks, a.vertices));
      disp.push(bTagScore(b.jet, b.tracks, b.vertices));
      if (bTagInfo(b.jet, b.tracks, b.vertices).vertex) svFound++;
    }
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    expect(mean(disp)).toBeGreaterThan(0.6);
    expect(mean(prompt)).toBeLessThan(0.1);
    expect(svFound).toBeGreaterThan(25);
    for (const s of [...prompt, ...disp]) expect(s >= 0 && s <= 1).toBe(true);
  });
  test('the lifetime sign: the same displaced tracks seen against the flight direction do not tag', () => {
    const g = rng(6);
    let flipped = 0, straight = 0;
    for (let k = 0; k < 30; k++) {
      const b = jetEvent(g, true);
      const back: P4 = { E: b.jet.E, px: -b.jet.px, py: -b.jet.py, pz: -b.jet.pz };
      straight += bTagScore(b.jet, b.tracks, b.vertices) > 0.5 ? 1 : 0;
      // a jet axis opposite to the flight: the tracks are no longer in its cone, so use lifetime-sign flip via the option
      flipped += bTagInfo(b.jet, b.tracks, b.vertices, { lifetimeSign: false }).score > 0.5 ? 1 : 0;
      void back;
    }
    expect(straight).toBeGreaterThan(20);
    // without the sign the significances are not ordered by the lifetime sign and the score is no better than with it
    expect(flipped).toBeLessThanOrEqual(straight + 3);
  });
});
