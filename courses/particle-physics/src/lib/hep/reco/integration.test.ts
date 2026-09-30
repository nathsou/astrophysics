import { describe, expect, test } from 'vitest';
import { rng, normal } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import { findTracks, type FinderStats } from './tracking.ts';
import { minBiasTruth, truthEventFrom, type SimpleParticle } from './synthetic.ts';
import type { TruthEvent } from '../event/index.ts';
import { geometryFromConfig } from './geometry.ts';

describe('track finding on the detector simulation', () => {
  test('pile-up scan (report)', () => {
    const cfg = presets.onion!;
    const g = rng(11);
    const rows: string[] = [];
    for (const pu of [0, 10, 25, 50]) {
      let elig = 0, found = 0, fakes = 0, total = 0, tMs = 0;
      const n = 6;
      for (let e = 0; e < n; e++) {
        const sig: SimpleParticle[] = Array.from({ length: 6 }, () => ({ pdg: g() < 0.5 ? 211 : -211, pt: 1 + 30 * g() * g(), eta: (2 * g() - 1) * 2.3, phi: (2 * g() - 1) * Math.PI }));
        const zv = normal(g, 0, 50);
        const truth = truthEventFrom(sig, [0, 0, zv]);
        const pile: TruthEvent[] = Array.from({ length: pu }, (_, k) => minBiasTruth(g, 25, [normal(g, 0, 0.015), normal(g, 0, 0.015), normal(g, 0, 50)], k + 1));
        const det = simulate(truth, cfg, g.fork('sim' + e), { pileup: pile });
        const stats: FinderStats = { nSeeds: 0, nCandidates: 0, nTracks: 0 };
        const t0 = performance.now();
        const tracks = findTracks(det.hits, cfg, {}, stats);
        tMs += performance.now() - t0;
        // truth matching by hits
        const matched = new Set<number>();
        for (const t of tracks) {
          const cnt = new Map<number, number>();
          for (const h of t.hits) cnt.set(det.hits[h]!.truth, (cnt.get(det.hits[h]!.truth) ?? 0) + 1);
          let best = -1, bn = 0;
          for (const [k, v] of cnt) if (v > bn) { bn = v; best = k; }
          if (best >= 0 && bn / t.hits.length >= 0.5) matched.add(best);
          else fakes++;
        }
        total += tracks.length;
        truth.particles.forEach((p, i) => {
          if (Math.abs(p.vertex[2] - zv) > 1e-9) return;
          const pt = Math.hypot(p.p.px, p.p.py);
          const eta = Math.asinh(p.p.pz / pt);
          if (pt > 1 && Math.abs(eta) < 2.3) { elig++; if (matched.has(i)) found++; }
        });
      }
      rows.push(`PU ${pu}: signal-track eff ${(found / elig).toFixed(3)} (${found}/${elig}) fake ${(fakes / total).toFixed(3)} tracks ${(total / n).toFixed(0)} ms/event ${(tMs / n).toFixed(1)}`);
    }
    console.log(rows.join('\n'));
    expect(geometryFromConfig(cfg).layers.length).toBe(8);
  });
});
