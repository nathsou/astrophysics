import { test } from 'vitest';
import { rng } from '../random/index.ts';
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { shower } from '../shower/index.ts';
import { hadronise } from '../hadronise/index.ts';
import { decayAll } from '../decay/index.ts';
function qqbar(E: number, flav = 2): TruthEvent {
  const p = (pdg: number, s: number, col: [number, number]): TruthParticle => ({ id: 0, pdg, p: { E: E / 2, px: 0, py: 0, pz: s * E / 2 }, vertex: [0, 0, 0], status: 'final', mothers: [], daughters: [], colour: col });
  const a = p(flav, 1, [1, 0]), b = p(-flav, -1, [0, 1]); a.id = 0; b.id = 1;
  return { number: 0, weight: 1, process: 'test', sqrtS: E, particles: [a, b], primaryVertices: [[0, 0, 0]] };
}
test('x', () => {
  const r = rng(3);
  const N = 1500;
  let best = [1e9, 1e9, 1e9];
  for (let round = 0; round < 6; round++) {
    const t = [0, 0, 0];
    for (let k = 0; k < N; k++) {
      const ev = qqbar(200);
      let a = performance.now(); shower(ev, r); let b = performance.now(); t[0]! += b - a;
      hadronise(ev, r); a = performance.now(); t[1]! += a - b;
      decayAll(ev, r); b = performance.now(); t[2]! += b - a;
    }
    for (let i = 0; i < 3; i++) best[i] = Math.min(best[i]!, t[i]! / N);
  }
  process.stdout.write(`best per event ms: shower ${best[0]!.toFixed(3)} hadronise ${best[1]!.toFixed(3)} decay ${best[2]!.toFixed(3)} total ${(best[0]!+best[1]!+best[2]!).toFixed(3)} => ${(1000 / (best[0]!+best[1]!+best[2]!)).toFixed(0)} ev/s\n`);
});
