import { describe, expect, test } from 'vitest';
import { simulateCrossing, DEFAULT_QUALITY, configFor } from './pileup.ts';
import { findTracks, findPrimaryVertices } from '../../hep/reco/index.ts';

/** The statement in the caption of Figure 8.4: at 60 pile-up collisions roughly one vertex in ten is lost. */
describe('primary vertices in a crowded crossing', () => {
  test('at 60 pile-up collisions 85–95 % of the collisions get a vertex within 1 mm, and the hard-scatter vertex is always found', () => {
    const cfg = configFor(DEFAULT_QUALITY);
    let truth = 0, matchedTotal = 0, hardOk = 0;
    const seeds = [1, 2, 3, 4, 5, 6];
    for (const s of seeds) {
      const x = simulateCrossing(60, 5000 + s, DEFAULT_QUALITY);
      const vs = findPrimaryVertices(findTracks(x.det.hits, cfg), undefined, { x: 0, y: 0, sigma: Math.max(cfg.beamSpot.sigmaXY, 0.005) });
      const matched = new Set<number>();
      for (const v of vs) {
        let best = -1, bd = Infinity;
        x.vertices.forEach((z, i) => { const d = Math.abs(z - v.z); if (d < bd) { bd = d; best = i; } });
        if (bd < 1) matched.add(best);
      }
      truth += x.vertices.length;
      matchedTotal += matched.size;
      const hard = vs.find((v) => v.kind === 'primary');
      if (hard && Math.abs(hard.z - x.vertices[0]!) < 0.5) hardOk++;
    }
    expect(matchedTotal / truth).toBeGreaterThan(0.85);
    expect(matchedTotal / truth).toBeLessThan(0.95);
    expect(hardOk).toBe(seeds.length);
  }, 120000);
});
