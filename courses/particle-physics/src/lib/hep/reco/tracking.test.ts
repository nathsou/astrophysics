import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { DEFAULT_GEOMETRY } from './geometry.ts';
import { findTracks, type FinderStats } from './tracking.ts';
import { synthEvent, type SynthTrack } from './synthetic.ts';

function matchStats(tracks: ReturnType<typeof findTracks>, hits: { truth: number }[], truthTracks: SynthTrack[], ptMin: number) {
  // a track is matched to the particle supplying most of its hits; purity ≥ 0.5
  const matched = new Set<number>();
  let fakes = 0;
  for (const t of tracks) {
    const cnt = new Map<number, number>();
    for (const h of t.hits) cnt.set(hits[h]!.truth, (cnt.get(hits[h]!.truth) ?? 0) + 1);
    let best = -1, bn = 0;
    for (const [k, v] of cnt) if (v > bn) { bn = v; best = k; }
    if (best >= 0 && bn / t.hits.length >= 0.5) matched.add(best);
    else fakes++;
  }
  const eligible = truthTracks.filter((t) => t.pt > ptMin && Math.abs(t.eta) < 2.3 && Math.hypot(t.vertex[0], t.vertex[1]) < 1 && Math.abs(t.vertex[2]) < 200);
  const found = eligible.filter((t) => matched.has(t.id)).length;
  return { eff: found / Math.max(1, eligible.length), nEligible: eligible.length, fakes, fakeRate: fakes / Math.max(1, tracks.length) };
}

function signalTracks(g: ReturnType<typeof rng>, n: number): Omit<SynthTrack, 'id' | 'collision' | 'vertex'>[] {
  return Array.from({ length: n }, () => ({ pt: 1 + 40 * g() * g(), eta: (g() * 2 - 1) * 2.3, phi: (g() * 2 - 1) * Math.PI, charge: g() < 0.5 ? 1 : -1 }));
}

describe('track finding on synthetic events', () => {
  test('a single clean track is found with the right parameters', () => {
    const g = rng(1);
    const ev = synthEvent(g, [{ pt: 10, eta: 0.7, phi: -1.2, charge: -1 }]);
    const tr = findTracks(ev.hits, DEFAULT_GEOMETRY);
    expect(tr.length).toBe(1);
    expect(tr[0]!.charge).toBe(-1);
    expect(tr[0]!.pt).toBeGreaterThan(9);
    expect(tr[0]!.pt).toBeLessThan(11);
    expect(tr[0]!.hits.length).toBe(10);
    expect(tr[0]!.chi2 / tr[0]!.ndof).toBeLessThan(3);
  });
  test('efficiency ≥ 95 % (pT > 1 GeV) and fake rate < 5 % with no pile-up (30 tracks per event)', () => {
    const g = rng(2);
    let eligible = 0, found = 0, fakes = 0, total = 0;
    for (let e = 0; e < 20; e++) {
      const ev = synthEvent(g, signalTracks(g, 30), { efficiency: 0.98, noise: 3 });
      const tr = findTracks(ev.hits, DEFAULT_GEOMETRY);
      const s = matchStats(tr, ev.hits, ev.tracks, 1);
      eligible += s.nEligible;
      found += s.eff * s.nEligible;
      fakes += s.fakes;
      total += tr.length;
    }
    expect(found / eligible).toBeGreaterThan(0.95);
    expect(fakes / total).toBeLessThan(0.05);
  });
  test('the Hough-seeded finder works on clean events', () => {
    const g = rng(3);
    let eligible = 0, found = 0;
    for (let e = 0; e < 5; e++) {
      const ev = synthEvent(g, signalTracks(g, 10));
      const tr = findTracks(ev.hits, DEFAULT_GEOMETRY, { seeding: 'hough' });
      const s = matchStats(tr, ev.hits, ev.tracks, 1);
      eligible += s.nEligible;
      found += s.eff * s.nEligible;
    }
    expect(found / eligible).toBeGreaterThan(0.8);
  });
  test('pile-up: efficiency and fake rate degrade gracefully (report)', () => {
    const g = rng(4);
    const rows: string[] = [];
    for (const pu of [0, 20, 50]) {
      let eligible = 0, found = 0, fakes = 0, total = 0, t0 = 0;
      const stats: FinderStats = { nSeeds: 0, nCandidates: 0, nTracks: 0 };
      const n = 6;
      for (let e = 0; e < n; e++) {
        const ev = synthEvent(g, signalTracks(g, 4), { pileup: pu, efficiency: 0.98, noise: 3 });
        const t1 = performance.now();
        const tr = findTracks(ev.hits, DEFAULT_GEOMETRY, {}, stats);
        t0 += performance.now() - t1;
        const s = matchStats(tr, ev.hits, ev.tracks.filter((t) => t.collision === 0 || t.pt > 1), 1);
        eligible += s.nEligible;
        found += s.eff * s.nEligible;
        fakes += s.fakes;
        total += tr.length;
      }
      rows.push(`PU ${pu}: eff ${(found / eligible).toFixed(3)} fake ${(fakes / total).toFixed(3)} tracks/event ${(total / n).toFixed(0)} ms/event ${(t0 / n).toFixed(1)} seeds ${stats.nSeeds}`);
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBe(3);
  });
});
