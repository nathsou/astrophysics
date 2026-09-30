import { describe, expect, test } from 'vitest';
import { rng, normal } from '../random/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { fromPtEtaPhiM, deltaPhi, pt as ptOf } from '../kinematics/index.ts';
import { antiKt, cambridgeAachen, exclusiveJets, jetMass, kt, nSubjettiness, sequentialJets } from './jets.ts';

const massless = (pt: number, y: number, phi: number): P4 => fromPtEtaPhiM(pt, y, phi, 0); // η = y for massless

function randomEvent(g: ReturnType<typeof rng>, n: number): P4[] {
  // a few hard clusters plus a soft background
  const out: P4[] = [];
  const nj = 2 + Math.floor(g() * 3);
  for (let j = 0; j < nj; j++) {
    const y0 = (g() - 0.5) * 4, ph0 = (g() * 2 - 1) * Math.PI, pt0 = 30 + 100 * g();
    for (let k = 0; k < 5 + Math.floor(g() * 8); k++) out.push(massless(pt0 * g() * 0.5 + 1, y0 + normal(g, 0, 0.15), ph0 + normal(g, 0, 0.15)));
  }
  for (let i = 0; i < n; i++) out.push(massless(0.3 + 2 * g(), (g() - 0.5) * 6, (g() * 2 - 1) * Math.PI));
  return out;
}
const key = (j: P4) => [j.E, j.px, j.py, j.pz];
const sameJets = (a: P4[], b: P4[], tol = 1e-5) => a.length === b.length && a.every((j, i) => key(j).every((v, k) => Math.abs(v - key(b[i]!)[k]!) < tol * (1 + Math.abs(v))));

describe('anti-kT, kT and Cambridge/Aachen', () => {
  test('one hard particle with soft ones: anti-kT gives a circle of radius R', () => {
    const g = rng(1);
    for (const R of [0.4, 0.7, 1.0]) {
      const hard = massless(100, 0.3, 1.0);
      const soft: P4[] = [];
      for (let i = 0; i < 300; i++) {
        const a = g() * 2 * Math.PI, d = 2 * R * Math.sqrt(g());
        soft.push(massless(1e-5 * (1 + g()), 0.3 + d * Math.cos(a), 1.0 + d * Math.sin(a)));
      }
      const { jets, constituents } = antiKt([hard, ...soft], R, 50);
      expect(jets.length).toBe(1);
      // the constituents are exactly those soft particles within R of the hard one (rapidity-azimuth distance)
      const yh = 0.3, ph = 1.0;
      const expected = new Set([0, ...soft.map((s, i) => [i + 1, Math.hypot(0.5 * Math.log((s.E + s.pz) / (s.E - s.pz)) - yh, deltaPhi(Math.atan2(s.py, s.px), ph))] as const).filter(([, d]) => d < R).map(([i]) => i)]);
      expect(new Set(constituents[0])).toEqual(expected);
    }
  });
  test('two hard particles closer than R merge; farther than 2R stay separate', () => {
    const a = massless(100, 0, 0), b = massless(80, 0.3, 0.2);
    expect(antiKt([a, b], 0.4, 10).jets.length).toBe(1);
    const c = massless(80, 1.5, 0.2);
    expect(antiKt([a, c], 0.4, 10).jets.length).toBe(2);
    // anti-kT with overlapping cones: the harder one keeps its cone, the softer is cut (two jets between R and 2R)
    const d = massless(60, 0.6, 0.0);
    const r = antiKt([a, d], 0.4, 10);
    expect(r.jets.length).toBe(2);
  });
  test('momentum is conserved: the jets sum to the input', () => {
    const g = rng(2);
    const ev = randomEvent(g, 40);
    for (const alg of [antiKt, kt, cambridgeAachen]) {
      const { jets } = alg(ev, 0.6, 0);
      const sum = (l: P4[]) => l.reduce((s, p) => [s[0]! + p.E, s[1]! + p.px, s[2]! + p.py, s[3]! + p.pz], [0, 0, 0, 0]);
      const a = sum(jets), b = sum(ev);
      for (let k = 0; k < 4; k++) expect(a[k]).toBeCloseTo(b[k]!, 6);
    }
  });
  test('every particle is in exactly one jet (ptMin 0)', () => {
    const g = rng(3);
    const ev = randomEvent(g, 60);
    for (const alg of [antiKt, kt, cambridgeAachen]) {
      const { constituents } = alg(ev, 0.5, 0);
      const all = constituents.flat().sort((a, b) => a - b);
      expect(all).toEqual(ev.map((_, i) => i));
    }
  });
  test('IRC safety: a soft ghost particle does not change the hard jets (anti-kT, kT, C/A)', () => {
    const g = rng(4);
    for (const [name, p] of [['antikt', -1], ['kt', 1], ['ca', 0]] as const) {
      for (let t = 0; t < 12; t++) {
        const ev = randomEvent(g, 30);
        const base = sequentialJets(ev, 0.5, p, 15);
        const ghost = massless(1e-9, (g() - 0.5) * 5, (g() * 2 - 1) * Math.PI);
        const withG = sequentialJets([...ev, ghost], 0.5, p, 15);
        expect(sameJets(base.jets, withG.jets), name).toBe(true);
        // and the constituents (apart from the ghost) are the same
        expect(withG.constituents.map((c) => c.filter((i) => i < ev.length).sort((a, b) => a - b))).toEqual(base.constituents.map((c) => [...c].sort((a, b) => a - b)));
      }
    }
  });
  test('IRC safety: splitting a particle into two collinear ones does not change the jets', () => {
    const g = rng(5);
    for (const [name, p] of [['antikt', -1], ['kt', 1], ['ca', 0]] as const) {
      for (let t = 0; t < 12; t++) {
        const ev = randomEvent(g, 30);
        const base = sequentialJets(ev, 0.5, p, 15);
        const i = Math.floor(g() * ev.length);
        const f = 0.1 + 0.8 * g();
        const a = ev[i]!;
        const split = [...ev.slice(0, i), ...ev.slice(i + 1), { E: a.E * f, px: a.px * f, py: a.py * f, pz: a.pz * f }, { E: a.E * (1 - f), px: a.px * (1 - f), py: a.py * (1 - f), pz: a.pz * (1 - f) }];
        const out = sequentialJets(split, 0.5, p, 15);
        expect(sameJets(base.jets, out.jets), name).toBe(true);
      }
    }
  });
  test('kT clusters the softest pair first; C/A the closest pair first', () => {
    // three particles on a line in φ at y=0: hard (100) at 0, hard (90) at 0.5, soft (1) at 0.2
    const h1 = massless(100, 0, 0), h2 = massless(90, 0, 0.5), s = massless(1, 0, 0.2);
    // exclusive two-jet clustering: kT merges the soft one with its nearest neighbour (h1) and leaves h2
    const k = exclusiveJets([h1, h2, s], 2, 1);
    expect(k.constituents.map((c) => c.length).sort()).toEqual([1, 2]);
    const c = exclusiveJets([h1, h2, s], 2, 0);
    // C/A merges the closest pair: h1 and s (0.2) before h1 and h2 (0.5)
    expect(c.constituents.find((x) => x.length === 2)!.sort()).toEqual([0, 2]);
  });
  test('O(N²) speed: 500 particles in a few ms per event', () => {
    const g = rng(6);
    const ev = randomEvent(g, 500);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) antiKt(ev, 0.4, 10);
    expect((performance.now() - t0) / 5).toBeLessThan(200);
  });
});

describe('jet mass and N-subjettiness', () => {
  test('jet mass of two massless particles at angle: m² = 2 pT1 pT2 (cosh Δy − cos Δφ)', () => {
    const a = massless(50, 0, 0), b = massless(40, 0.2, 0.3);
    const { jets } = antiKt([a, b], 0.8, 0);
    const expected = Math.sqrt(2 * 50 * 40 * (Math.cosh(0.2) - Math.cos(0.3)));
    expect(jetMass(jets[0]!)).toBeCloseTo(expected, 6);
  });
  test('two-prong jets have smaller τ2/τ1 than one-prong jets', () => {
    const g = rng(7);
    const onePr: P4[] = Array.from({ length: 20 }, () => massless(5 * g() + 0.5, normal(g, 0, 0.08), normal(g, 0, 0.08)));
    const twoPr: P4[] = [...Array.from({ length: 10 }, () => massless(5 * g() + 0.5, normal(g, 0, 0.03) - 0.25, normal(g, 0, 0.03))), ...Array.from({ length: 10 }, () => massless(5 * g() + 0.5, normal(g, 0, 0.03) + 0.25, normal(g, 0, 0.03)))];
    const r1 = nSubjettiness(onePr, 2) / nSubjettiness(onePr, 1);
    const r2 = nSubjettiness(twoPr, 2) / nSubjettiness(twoPr, 1);
    expect(r2).toBeLessThan(r1);
    expect(r2).toBeLessThan(0.4);
  });
});
