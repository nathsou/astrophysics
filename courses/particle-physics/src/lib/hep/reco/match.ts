/**
 * Truth matching and performance measures: which truth particle does a reconstructed track (by shared hits) or object
 * (by ΔR) come from, and from that the efficiency, the fake rate and the resolution, with binomial errors.
 *
 * Conventions. A track is matched to the truth particle that produced most of its hits if they make up at least
 * `matchPurity` (default 0.5) of its hits; otherwise it is a *fake* (`truth = −1`). Hits made by pile-up particles carry
 * indices ≥ `truth.particles.length` (see `truthOffsets` in the detector module): such tracks match a pile-up particle,
 * are real tracks, and count as matched but never as a hard-scatter particle. The *efficiency* for a class of truth
 * particles is the fraction with a reconstructed track or object pointing back to them; the *fake rate* is the fraction
 * of reconstructed tracks or objects with no truth link.
 */
import type { Hit, RecoEvent, RecoObject, TruthEvent, TruthParticle } from '../event/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { deltaPhi } from '../kinematics/index.ts';
import type { MatchInfo, RecoTrack } from './types.ts';

export interface HitMatch {
  /** The truth index that supplied most of the hits (−1 if none). */
  truth: number;
  /** Its share of the track's hits. */
  purity: number;
  /** How many hits it supplied. */
  nShared: number;
}

/** The truth particle behind a set of hits (indices into `hits`): the majority, its share (purity) and count. Noise hits (truth −1) count in the denominator. */
export function matchByHits(hitIdx: readonly number[], hits: readonly Pick<Hit, 'truth'>[]): HitMatch {
  const count = new Map<number, number>();
  for (const i of hitIdx) {
    const t = hits[i]!.truth;
    if (t >= 0) count.set(t, (count.get(t) ?? 0) + 1);
  }
  let best = -1, n = 0;
  for (const [t, c] of count) if (c > n) {
    n = c;
    best = t;
  }
  return { truth: best, purity: hitIdx.length ? n / hitIdx.length : 0, nShared: n };
}

/** Label tracks with their truth particle and purity (`Track.truth`, `Track.purity`); returns the number of fakes. */
export function labelTracks(tracks: RecoTrack[], hits: readonly Hit[], minPurity = 0.5): number {
  let fakes = 0;
  for (const t of tracks) {
    const m = matchByHits(t.hits, hits);
    t.purity = m.purity;
    t.truth = m.purity >= minPurity ? m.truth : -1;
    if (t.truth < 0) fakes++;
  }
  return fakes;
}

/** The candidate nearest to (eta, phi) within `maxDR`, or null. */
export function matchByDeltaR<T extends { eta: number; phi: number }>(eta: number, phi: number, candidates: readonly T[], maxDR = 0.1): { candidate: T; dR: number } | null {
  let best: T | null = null;
  let bd = maxDR;
  for (const c of candidates) {
    const d = Math.hypot(c.eta - eta, deltaPhi(c.phi, phi));
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best ? { candidate: best, dR: bd } : null;
}

const pdgDigits = (pdg: number) => {
  const a = Math.abs(pdg);
  return { q1: Math.floor(a / 1000) % 10, q2: Math.floor(a / 100) % 10, q3: Math.floor(a / 10) % 10 };
};
/** Whether a PDG id is a hadron (or quark) containing the quark of flavour `f` (4 = charm, 5 = bottom). */
export function hasHeavyFlavour(pdg: number, f: 4 | 5): boolean {
  const a = Math.abs(pdg);
  if (a === f) return true;
  if (a < 100 || a > 9999) return false;
  const d = pdgDigits(pdg);
  return d.q1 === f || d.q2 === f || d.q3 === f;
}

export type JetFlavour = 'b' | 'c' | 'light';

/** The flavour of a jet by ghost matching: b if a b hadron (or b quark) of pT > `minPt` lies within ΔR < 0.4, else c, else light. */
export function jetFlavour(jet: P4, truth: TruthEvent, dRmax = 0.4, minPt = 5): JetFlavour {
  const je = Math.asinh(jet.pz / Math.hypot(jet.px, jet.py)), jp = Math.atan2(jet.py, jet.px);
  let c = false;
  for (const p of truth.particles) {
    const pt = Math.hypot(p.p.px, p.p.py);
    if (pt < minPt) continue;
    const near = () => Math.hypot(Math.asinh(p.p.pz / pt) - je, deltaPhi(Math.atan2(p.p.py, p.p.px), jp)) < dRmax;
    if (hasHeavyFlavour(p.pdg, 5) && near()) return 'b';
    if (hasHeavyFlavour(p.pdg, 4) && near()) c = true;
  }
  return c ? 'c' : 'light';
}

/** Index of the truth parton (quark or gluon, any status) nearest to the jet within ΔR < dRmax with pT > minPt, or −1. */
export function matchJetToParton(jet: P4, truth: TruthEvent, dRmax = 0.4, minPt = 5): number {
  const je = Math.asinh(jet.pz / Math.hypot(jet.px, jet.py)), jp = Math.atan2(jet.py, jet.px);
  let best = -1, bd = dRmax;
  for (const p of truth.particles) {
    const a = Math.abs(p.pdg);
    if (!((a >= 1 && a <= 6) || a === 21)) continue;
    const pt = Math.hypot(p.p.px, p.p.py);
    if (pt < minPt) continue;
    const d = Math.hypot(Math.asinh(p.p.pz / pt) - je, deltaPhi(Math.atan2(p.p.py, p.p.px), jp));
    if (d < bd) {
      bd = d;
      best = p.id;
    }
  }
  return best;
}

/** Charged stable particles of the hard scatter that a tracker could reconstruct: pT above `ptMin`, |η| below `etaMax`. */
export function isReconstructibleCharged(p: TruthParticle, chargeOf: (pdg: number) => number, ptMin = 0.5, etaMax = 2.4): boolean {
  if (p.status !== 'final' || chargeOf(p.pdg) === 0) return false;
  const pt = Math.hypot(p.p.px, p.p.py);
  return pt > ptMin && Math.abs(Math.asinh(p.p.pz / pt)) < etaMax;
}

// ── statistics ───────────────────────────────────────────────────────────────────────────────

export interface Fraction {
  /** The estimate k/n (NaN if n = 0). */
  value: number;
  k: number;
  n: number;
  /** Binomial standard error √(p(1−p)/n). */
  error: number;
  /** Wilson 68 % interval (behaves at p = 0 and p = 1, where the standard error is zero). */
  low: number;
  high: number;
}

/** A fraction k/n with its binomial uncertainty. */
export function binomial(k: number, n: number): Fraction {
  if (n <= 0) return { value: NaN, k, n, error: NaN, low: NaN, high: NaN };
  const p = k / n;
  const z = 1; // one standard deviation, 68 %
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { value: p, k, n, error: Math.sqrt((p * (1 - p)) / n), low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export interface EfficiencyOptions {
  /** Which reconstructed things can match a truth particle: tracks, objects of a kind, or either (default 'any'). */
  reco?: 'track' | 'any' | RecoObject['kind'];
  /** Replace the test "some track or object of this event has `truth === id`". */
  matched?: (reco: RecoEvent, id: number) => boolean;
}

/**
 * Efficiency: among the truth particles of `truthEvents` that pass `selection`, the fraction that some reconstructed
 * track or object of the corresponding `recoEvents` entry points back to (`truth === particle.id`). Returns the fraction
 * with its binomial errors. The two arrays are event by event parallel.
 */
export function efficiency(recoEvents: readonly RecoEvent[], truthEvents: readonly TruthEvent[], selection: (p: TruthParticle, truth: TruthEvent) => boolean, opts: EfficiencyOptions = {}): Fraction {
  if (recoEvents.length !== truthEvents.length) throw new Error('efficiency: recoEvents and truthEvents must be parallel');
  let n = 0, k = 0;
  const kind = opts.reco ?? 'any';
  for (let e = 0; e < truthEvents.length; e++) {
    const truth = truthEvents[e]!;
    const reco = recoEvents[e]!;
    const ids = new Set<number>();
    if (!opts.matched) {
      if (kind === 'any' || kind === 'track') for (const t of reco.tracks) if (t.truth >= 0) ids.add(t.truth);
      if (kind !== 'track') for (const o of reco.objects) if (o.truth >= 0 && (kind === 'any' || o.kind === kind)) ids.add(o.truth);
    }
    for (const p of truth.particles) {
      if (!selection(p, truth)) continue;
      n++;
      if (opts.matched ? opts.matched(reco, p.id) : ids.has(p.id)) k++;
    }
  }
  return binomial(k, n);
}

/**
 * Fake rate: among the reconstructed tracks (and objects of the given kind, if `kind` is given) that pass `selection`, the
 * fraction with no truth link (`truth < 0`). With no `kind`, tracks are counted.
 */
export function fakeRate(recoEvents: readonly RecoEvent[], selection: (t: { pt: number; eta: number; phi: number; truth: number }, reco: RecoEvent) => boolean = () => true, kind?: RecoObject['kind']): Fraction {
  let n = 0, k = 0;
  for (const reco of recoEvents) {
    const items: { pt: number; eta: number; phi: number; truth: number }[] =
      kind === undefined
        ? reco.tracks
        : reco.objects
            .filter((o) => o.kind === kind)
            .map((o) => ({ pt: Math.hypot(o.p.px, o.p.py), eta: Math.asinh(o.p.pz / Math.hypot(o.p.px, o.p.py)), phi: Math.atan2(o.p.py, o.p.px), truth: o.truth }));
    for (const t of items) {
      if (!selection(t, reco)) continue;
      n++;
      if (t.truth < 0) k++;
    }
  }
  return binomial(k, n);
}

export interface Resolution {
  n: number;
  mean: number;
  /** Standard error of the mean. */
  meanError: number;
  /** Root mean square about the mean. */
  rms: number;
  /** Half the width of the central 68 % interval: robust against tails. */
  sigma68: number;
  /** Approximate standard error of σ68 (for a Gaussian: σ/√(2n) · 1.1). */
  sigmaError: number;
  median: number;
}

/** The mean, rms, median and robust width σ68 of a list of residuals (e.g. reconstructed/true − 1). */
export function resolution(values: ArrayLike<number>): Resolution {
  const v = Array.from(values).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return { n: 0, mean: NaN, meanError: NaN, rms: NaN, sigma68: NaN, sigmaError: NaN, median: NaN };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const rms = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = (f: number) => {
    const x = f * (n - 1);
    const i = Math.floor(x);
    return i + 1 < n ? v[i]! + (x - i) * (v[i + 1]! - v[i]!) : v[n - 1]!;
  };
  const sigma68 = (q(0.8413) - q(0.1587)) / 2;
  return { n, mean, meanError: rms / Math.sqrt(n), rms, sigma68, sigmaError: (sigma68 * 1.1) / Math.sqrt(2 * n), median: q(0.5) };
}

/** Summary counts for a labelled event (see `RecoEventFull.match`). */
export function matchSummary(tracks: readonly RecoTrack[], truth: TruthEvent, hits: readonly Hit[], chargeOf: (pdg: number) => number, opts: { ptMin?: number; etaMax?: number; minHits?: number } = {}): MatchInfo {
  const minHits = opts.minHits ?? 4;
  const count = new Map<number, number>();
  for (const h of hits) if (h.truth >= 0) count.set(h.truth, (count.get(h.truth) ?? 0) + 1);
  const matched = new Set<number>();
  let fakes = 0;
  for (const t of tracks) {
    if (t.truth >= 0) matched.add(t.truth);
    else fakes++;
  }
  let n = 0, k = 0;
  for (const p of truth.particles) {
    if (!isReconstructibleCharged(p, chargeOf, opts.ptMin ?? 0.5, opts.etaMax ?? 2.4)) continue;
    if ((count.get(p.id) ?? 0) < minHits) continue;
    n++;
    if (matched.has(p.id)) k++;
  }
  return { nTruthTracks: n, nMatchedTracks: k, nFakeTracks: fakes };
}
