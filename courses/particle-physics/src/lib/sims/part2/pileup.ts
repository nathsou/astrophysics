/**
 * Tracking under pile-up, for the flagship figure of Chapter 8: one bunch crossing is a hard "signal" event with six charged
 * pions plus `pu` minimum-bias collisions, simulated with `hep/detector` (the course detector, *Onion*), then the tracks are
 * found with `hep/reco`'s finder and compared with the truth: efficiency for the signal pions, and the fraction of found tracks
 * that no single particle explains (fakes).
 */
import { customise, presets, simulate, type DetectorConfig } from '../../hep/detector/index.ts';
import type { DetectorEvent, TruthEvent } from '../../hep/event/index.ts';
import { normal, rng as makeRng } from '../../hep/random/index.ts';
import { binomial, findTracks, labelTracks, synthetic, type Fraction, type FinderStats, type RecoTrack, type RecoConfig } from '../../hep/reco/index.ts';

export interface FinderSettings {
  /** Seeds from triplets of hits in the inner layers, or from peaks of the Hough transform. */
  seeding: 'triplets' | 'hough';
  /** Smallest number of hits on a track (0: the finder chooses). */
  minHits: number;
  /** Half-width of the search road in units of the expected uncertainty. */
  roadSigmas: number;
  /** Largest χ² per degree of freedom of a kept track. */
  maxChi2: number;
}

export interface Quality {
  /** Noise hits per layer per event. */
  noise: number;
  /** Fraction of dead channels. */
  dead: number;
}

/** The reference reconstruction: pixel-triplet seeds, roads of 4σ, χ²/ndof below 4, the finder's own minimum number of hits. */
export const REFERENCE: FinderSettings = { seeding: 'triplets', minHits: 0, roadSigmas: 4, maxChi2: 4 };
export const DEFAULT_QUALITY: Quality = { noise: 1, dead: 0.01 };

export const PILEUP_POINTS = [0, 10, 25, 50, 100, 140, 200];

export function configFor(q: Quality): DetectorConfig {
  return customise(presets.onion!, { noiseHitsPerLayer: q.noise, deadFraction: q.dead });
}

export function recoConfig(s: FinderSettings): Partial<RecoConfig> {
  return { seeding: s.seeding, minHits: s.minHits, roadSigmas: s.roadSigmas, maxChi2PerDof: s.maxChi2 };
}

export interface EventResult {
  pu: number;
  nHits: number;
  nTracks: number;
  nFakes: number;
  nSignal: number;
  nFound: number;
  nSeeds: number;
  ms: number;
  /** For drawing: hit positions with their origin, and the tracks found. */
  hits: { x: number; y: number; kind: 'signal' | 'pileup' | 'noise' }[];
  tracks: { hits: number[]; fake: boolean; signal: boolean }[];
  /** Hit indices of the signal particles that were not found. */
  missed: number[][];
}

export interface Crossing {
  pu: number;
  cfg: DetectorConfig;
  signal: TruthEvent;
  det: DetectorEvent;
  /** The z position (mm) of every collision of the crossing: the hard scatter first, then the pile-up. */
  vertices: number[];
}

/** Simulate one bunch crossing with `pu` pile-up collisions. Deterministic for a given `seed`. */
export function simulateCrossing(pu: number, seed: number, quality: Quality = DEFAULT_QUALITY): Crossing {
  const cfg = configFor(quality);
  const r = makeRng(seed);
  const pileZ: number[] = [];
  const pile: TruthEvent[] = Array.from({ length: pu }, (_, k) => {
    const vx = normal(r, 0, 0.015), vy = normal(r, 0, 0.015), vz = normal(r, 0, 50);
    pileZ.push(vz);
    return synthetic.minBiasTruth(r, 25, [vx, vy, vz], k + 1);
  });
  const zv = normal(r, 0, 50);
  const signal = synthetic.truthEventFrom(
    Array.from({ length: 6 }, () => ({ pdg: r() < 0.5 ? 211 : -211, pt: 1 + 30 * r() * r(), eta: (2 * r() - 1) * 2.3, phi: (2 * r() - 1) * Math.PI })),
    [0, 0, zv],
  );
  const det = simulate(signal, cfg, r.fork('sim'), { pileup: pile });
  return { pu, cfg, signal, det, vertices: [zv, ...pileZ] };
}

/** Find tracks in a crossing with the given settings and compare them with the truth. */
export function reconstructCrossing(x: Crossing, settings: FinderSettings, keepPicture = false): EventResult {
  const { cfg, signal, det, pu } = x;
  const stats: FinderStats = { nSeeds: 0, nCandidates: 0, nTracks: 0 };
  const t0 = performance.now();
  const tracks = findTracks(det.hits, cfg, recoConfig(settings), stats);
  const ms = performance.now() - t0;
  labelTracks(tracks, det.hits, 0.5);
  const found = new Set(tracks.filter((t) => t.truth >= 0).map((t) => t.truth));
  const nSig = signal.particles.length;
  let nSignal = 0, nFound = 0;
  const missed: number[][] = [];
  signal.particles.forEach((p, i) => {
    const pt = Math.hypot(p.p.px, p.p.py);
    if (pt > 1 && Math.abs(Math.asinh(p.p.pz / pt)) < 2.3) {
      nSignal++;
      if (found.has(i)) nFound++;
      else if (keepPicture) missed.push(det.hits.flatMap((h, k) => (h.truth === i ? [k] : [])));
    }
  });
  const res: EventResult = {
    pu,
    nHits: det.hits.length,
    nTracks: tracks.length,
    nFakes: tracks.filter((t) => t.truth < 0).length,
    nSignal,
    nFound,
    nSeeds: stats.nSeeds,
    ms,
    hits: [],
    tracks: [],
    missed,
  };
  if (keepPicture) {
    res.hits = det.hits.map((h) => ({ x: h.x, y: h.y, kind: h.truth < 0 ? 'noise' : h.truth < nSig ? 'signal' : 'pileup' }));
    res.tracks = tracks.map((t: RecoTrack) => ({ hits: t.hits, fake: t.truth < 0, signal: t.truth >= 0 && t.truth < nSig }));
  }
  return res;
}

/** One bunch crossing with `pu` pile-up collisions, reconstructed with `settings`. */
export function runEvent(pu: number, seed: number, settings: FinderSettings, quality: Quality = DEFAULT_QUALITY, keepPicture = false): EventResult {
  return reconstructCrossing(simulateCrossing(pu, seed, quality), settings, keepPicture);
}

/** The seed used for event `i` at pile-up `pu` in a scan with base seed `seed0`. */
export const eventSeed = (seed0: number, pu: number, i: number): number => seed0 * 1000 + pu * 10 + i;

export interface PointResult {
  pu: number;
  efficiency: Fraction;
  fakeRate: Fraction;
  tracksPerEvent: number;
  seedsPerEvent: number;
  msPerEvent: number;
  events: number;
}

/** Combine the events of one pile-up value. */
export function aggregate(pu: number, events: EventResult[]): PointResult {
  const n = events.length;
  const sum = (f: (e: EventResult) => number) => events.reduce((a, e) => a + f(e), 0);
  return {
    pu,
    efficiency: binomial(sum((e) => e.nFound), sum((e) => e.nSignal)),
    fakeRate: binomial(sum((e) => e.nFakes), sum((e) => e.nTracks)),
    tracksPerEvent: sum((e) => e.nTracks) / Math.max(1, n),
    seedsPerEvent: sum((e) => e.nSeeds) / Math.max(1, n),
    msPerEvent: sum((e) => e.ms) / Math.max(1, n),
    events: n,
  };
}

/** Run `nEvents` events at one pile-up value. */
export function runPoint(pu: number, nEvents: number, settings: FinderSettings, quality: Quality = DEFAULT_QUALITY, seed0 = 1): PointResult {
  const events: EventResult[] = [];
  for (let i = 0; i < nEvents; i++) events.push(runEvent(pu, eventSeed(seed0, pu, i), settings, quality));
  return aggregate(pu, events);
}
