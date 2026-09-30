import { describe, expect, test } from 'vitest';
import type { RecoEvent, TruthEvent, TruthParticle } from '../event/index.ts';
import { binomial, efficiency, fakeRate, hasHeavyFlavour, jetFlavour, labelTracks, matchByDeltaR, matchByHits, resolution } from './match.ts';
import type { RecoTrack } from './types.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import { rng, normal } from '../random/index.ts';

const track = (hits: number[], truth = -1): RecoTrack => ({ id: 0, charge: 1, pt: 5, eta: 0, phi: 0, d0: 0, z0: 0, chi2: 1, ndof: 1, hits, truth, tanLambda: 0, c: 0, d0Raw: 0, z0Raw: 0, sigmaD0: 0.01, sigmaZ0: 0.01, cov: [], nLayers: hits.length });
const reco = (tracks: RecoTrack[], objs: RecoEvent['objects'] = []): RecoEvent => ({ tracks, vertices: [], clusters: [], objects: objs, met: { x: 0, y: 0 }, sumEt: 0 });
const tp = (id: number, pdg: number, pt: number, eta: number): TruthParticle => ({ id, pdg, p: fromPtEtaPhiM(pt, eta, 0.5, 0.1), vertex: [0, 0, 0], status: 'final', mothers: [], daughters: [] });
const truthOf = (ps: TruthParticle[]): TruthEvent => ({ number: 0, weight: 1, process: 't', sqrtS: 13000, particles: ps, primaryVertices: [[0, 0, 0]] });

describe('truth matching', () => {
  test('matchByHits: majority, purity and noise', () => {
    const hits = [{ truth: 3 }, { truth: 3 }, { truth: 3 }, { truth: 7 }, { truth: -1 }];
    const m = matchByHits([0, 1, 2, 3, 4], hits);
    expect(m.truth).toBe(3);
    expect(m.purity).toBeCloseTo(0.6, 12);
    expect(m.nShared).toBe(3);
    expect(matchByHits([4], hits).truth).toBe(-1);
  });
  test('labelTracks: purity ≥ 0.5 matches, below is a fake', () => {
    const hits = [{ truth: 1, layer: 0, x: 0, y: 0, z: 0 }, { truth: 1, layer: 0, x: 0, y: 0, z: 0 }, { truth: 2, layer: 0, x: 0, y: 0, z: 0 }, { truth: 3, layer: 0, x: 0, y: 0, z: 0 }, { truth: 4, layer: 0, x: 0, y: 0, z: 0 }];
    const good = track([0, 1, 2]);
    const bad = track([1, 2, 3, 4]);
    const nFake = labelTracks([good, bad], hits);
    expect(good.truth).toBe(1);
    expect(good.purity).toBeCloseTo(2 / 3, 12);
    expect(bad.truth).toBe(-1);
    expect(nFake).toBe(1);
  });
  test('matchByDeltaR picks the nearest within the cone, wrapping φ', () => {
    const c = [{ eta: 0, phi: 3.1, id: 1 }, { eta: 0.05, phi: -3.1, id: 2 }, { eta: 1, phi: 0, id: 3 }];
    expect(matchByDeltaR(0, -3.12, c, 0.1)!.candidate.id).toBe(2);
    expect(matchByDeltaR(0, 0, c, 0.1)).toBeNull();
  });
  test('heavy-flavour recognition from PDG ids', () => {
    for (const id of [511, -511, 521, 531, 5122, 5, 5232]) expect(hasHeavyFlavour(id, 5)).toBe(true);
    for (const id of [421, 411, 4122, 4, 431]) expect(hasHeavyFlavour(id, 4)).toBe(true);
    for (const id of [211, 321, 2212, 3122, 443, 22]) expect(hasHeavyFlavour(id, 5)).toBe(false);
    expect(hasHeavyFlavour(511, 4)).toBe(false);
    const jet = { E: 50, px: 50, py: 0, pz: 0 };
    const t = truthOf([{ ...tp(0, 511, 30, 0), p: { E: 35, px: 30, py: 1, pz: 0 } }]);
    expect(jetFlavour(jet, t)).toBe('b');
    expect(jetFlavour({ E: 50, px: 0, py: 50, pz: 0 }, t)).toBe('light');
  });
});

describe('efficiency, fake rate, resolution', () => {
  test('binomial errors: standard error and Wilson interval behave at the edges', () => {
    const f = binomial(30, 100);
    expect(f.value).toBeCloseTo(0.3, 12);
    expect(f.error).toBeCloseTo(Math.sqrt(0.3 * 0.7 / 100), 12);
    expect(f.low).toBeLessThan(0.3);
    expect(f.high).toBeGreaterThan(0.3);
    const z = binomial(0, 20);
    expect(z.error).toBe(0);
    expect(z.high).toBeGreaterThan(0.02);
    expect(z.low).toBe(0);
    expect(Number.isNaN(binomial(0, 0).value)).toBe(true);
  });
  test('efficiency counts truth particles with a matching track or object, once', () => {
    const truths = [truthOf([tp(0, 211, 5, 0), tp(1, 211, 5, 0.5), tp(2, 22, 5, 0)]), truthOf([tp(0, 211, 5, 0), tp(1, 211, 0.3, 0)])];
    const recos = [reco([track([], 0), track([], 0)]), reco([track([], 1)])];
    const sel = (p: TruthParticle) => Math.abs(p.pdg) === 211 && Math.hypot(p.p.px, p.p.py) > 1;
    const e = efficiency(recos, truthos(truths), sel);
    // event 1: particles 0,1 selected, 0 matched (twice); event 2: particle 0 selected, unmatched (track matches id 1, too soft)
    expect(e.n).toBe(3);
    expect(e.k).toBe(1);
    expect(e.value).toBeCloseTo(1 / 3, 12);
    expect(() => efficiency([recos[0]!], truths, sel)).toThrow();
    // custom matching
    expect(efficiency(recos, truths, sel, { matched: () => true }).value).toBe(1);
  });
  test('fake rate: tracks with truth −1', () => {
    const r = [reco([track([], 1), track([], -1), track([], -1), track([], 2)])];
    const f = fakeRate(r);
    expect(f.value).toBeCloseTo(0.5, 12);
    expect(f.n).toBe(4);
    expect(fakeRate(r, (t) => t.truth >= 0).value).toBe(0);
  });
  test('resolution: mean, rms and σ68 of a Gaussian with outliers', () => {
    const g = rng(1);
    const v = Array.from({ length: 20000 }, () => normal(g, 0.02, 0.1));
    for (let i = 0; i < 400; i++) v.push(normal(g, 0, 2)); // tail
    const r = resolution(v);
    expect(r.mean).toBeCloseTo(0.02, 1);
    expect(r.sigma68).toBeGreaterThan(0.095);
    expect(r.sigma68).toBeLessThan(0.115);
    expect(r.rms).toBeGreaterThan(r.sigma68 * 1.5); // the tail inflates the rms, not σ68
    expect(r.median).toBeCloseTo(0.02, 1);
    expect(resolution([]).n).toBe(0);
  });
});
function truthos(t: TruthEvent[]): TruthEvent[] {
  return t;
}
