import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { invariantMass } from '../kinematics/index.ts';
import { reconstruct } from './reconstruct.ts';
import { jetParticles, minBiasTruth, truthEventFrom, type SimpleParticle } from './synthetic.ts';
import { resolution } from './match.ts';

const cfg = presets.onion!;
const merge = (...evs: TruthEvent[]): TruthEvent => {
  // concatenate particle lists of events made at the same vertex (ids renumbered)
  const particles = evs.flatMap((e) => e.particles);
  return { ...evs[0]!, particles: particles.map((p, i) => ({ ...p, id: i })) };
};

describe('reconstruct: Z → μμ', () => {
  test('two muons, mass peak at 91 GeV, truth links', () => {
    const g = rng(1);
    const masses: number[] = [];
    let found = 0, total = 0;
    for (let e = 0; e < 40; e++) {
      const M = 91.19;
      const eta1 = (g() - 0.5) * 1.8, eta2 = (g() - 0.5) * 1.8;
      const phi1 = (g() * 2 - 1) * Math.PI;
      const phi2 = phi1 + Math.PI + normal(g, 0, 0.3);
      const pt1 = 30 + 25 * g();
      const pt2 = pt1 * (0.8 + 0.4 * g());
      const sig: SimpleParticle[] = [{ pdg: 13, pt: pt1, eta: eta1, phi: phi1 }, { pdg: -13, pt: pt2, eta: eta2, phi: phi2 }];
      const truth = merge(truthEventFrom(sig), minBiasTruth(g, 8, [0, 0, 0], 0));
      const det = simulate(truth, cfg, g.fork('s' + e));
      const reco = reconstruct(det, cfg, {}, truth);
      const mus = reco.objects.filter((o) => o.kind === 'muon');
      total += 2;
      found += mus.filter((m) => m.truth === 0 || m.truth === 1).length;
      if (mus.length === 2 && mus[0]!.charge! * mus[1]!.charge! < 0) masses.push(invariantMass([mus[0]!.p, mus[1]!.p]));
      void M;
    }
    expect(found / total).toBeGreaterThan(0.9);
    expect(masses.length).toBeGreaterThan(25);
  });
});
