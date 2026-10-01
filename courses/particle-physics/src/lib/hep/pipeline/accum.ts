/**
 * What a batch of events leaves behind: counters, histograms, trigger sums, truth-matching counts and stage timings, all as plain numbers
 * (JSON-serialisable, cheap to post between a worker and the page) and all **mergeable by addition**, so a run split across any number of
 * workers adds up to the same result.
 *
 * Every event of a sample has the same weight within its sample (the generator is unweighted), so histograms hold unit counts. The scaling to an
 * integrated luminosity (σ K L / N_generated of the sample) is applied when a result is *read* (`summary.ts`), because in a streaming run
 * N_generated is not known until the run stops.
 */
import { Hist1D } from '../analysis/hist.ts';
import type { FullEvent } from '../event/index.ts';
import { STAGE_NAMES, type StageName } from './config.ts';
import { emptyEff, EFF_KINDS, type EffCounts, type EffKind } from './observables.ts';

// ── Histogram accumulator ─────────────────────────────────────────────────────────────────────

export interface HistAcc {
  /** Bin contents (unit weights, so also the sum of squared weights). */
  counts: number[];
  underflow: number;
  overflow: number;
  /** Sums over in-range fills: n, Σx, Σx². */
  sum: number;
  sumx: number;
  sumx2: number;
}
export const emptyHist = (nbins: number): HistAcc => ({ counts: new Array<number>(nbins).fill(0), underflow: 0, overflow: 0, sum: 0, sumx: 0, sumx2: 0 });

/** Index of the bin of x among `edges` (−1 under, n over). */
export function findBin(edges: readonly number[], x: number): number {
  const n = edges.length - 1;
  if (!(x >= edges[0]!)) return x < edges[0]! ? -1 : n; // NaN counts as overflow
  if (!(x < edges[n]!)) return n;
  let a = 0, b = n;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (edges[m]! <= x) a = m;
    else b = m;
  }
  return a;
}
export function fillHist(h: HistAcc, edges: readonly number[], x: number): void {
  const i = findBin(edges, x);
  if (i < 0) h.underflow++;
  else if (i >= h.counts.length) h.overflow++;
  else {
    h.counts[i]!++;
    h.sum++;
    h.sumx += x;
    h.sumx2 += x * x;
  }
}
export function addHist(a: HistAcc, b: HistAcc): void {
  for (let i = 0; i < a.counts.length; i++) a.counts[i]! += b.counts[i]!;
  a.underflow += b.underflow;
  a.overflow += b.overflow;
  a.sum += b.sum;
  a.sumx += b.sumx;
  a.sumx2 += b.sumx2;
}
/** A `Hist1D` with the contents of an accumulator multiplied by `k` (errors: √(k² n) = k√n, the statistical error of the simulation). */
export function toHist1D(acc: HistAcc, edges: readonly number[], k = 1): Hist1D {
  const h = new Hist1D(edges);
  for (let i = 0; i < acc.counts.length; i++) {
    h.counts[i] = acc.counts[i]! * k;
    h.sumw2[i] = acc.counts[i]! * k * k;
  }
  h.underflow = acc.underflow * k;
  h.overflow = acc.overflow * k;
  h.underflowW2 = acc.underflow * k * k;
  h.overflowW2 = acc.overflow * k * k;
  h.entries = acc.sum + acc.underflow + acc.overflow;
  const hh = h as unknown as { sw: number; swx: number; swx2: number };
  hh.sw = acc.sum * k;
  hh.swx = acc.sumx * k;
  hh.swx2 = acc.sumx2 * k;
  return h;
}

// ── Trigger sums ──────────────────────────────────────────────────────────────────────────────

/**
 * What `estimateRates` needs from each event of a sample, summed: the expected acceptance probabilities (after prescales) at Level 1 and
 * at the HLT, overall and per item, with their squares (for the statistical errors), the overlaps between items and the bandwidth.
 */
export interface TriggerAcc {
  /** Events evaluated. */
  n: number;
  pL1: number;
  pHlt: number;
  pL1Sq: number;
  pHltSq: number;
  itemL1: number[];
  itemHlt: number[];
  itemL1Sq: number[];
  itemHltSq: number[];
  /** Events passing item i and item j at the HLT before prescales. */
  overlap: number[][];
  /** Events passing only item i. */
  unique: number[];
  /** Σ over events of pHlt × the event size (MB) of the biggest passing item. */
  bandwidth: number;
  /** Integer counts: events passing Level 1 (any item, before prescales), passing L1 and HLT, and kept (fired after prescales). */
  l1Pass: number;
  hltPass: number;
  fired: number;
  itemFired: number[];
}
export const emptyTrigger = (nItems: number): TriggerAcc => ({
  n: 0, pL1: 0, pHlt: 0, pL1Sq: 0, pHltSq: 0,
  itemL1: new Array<number>(nItems).fill(0), itemHlt: new Array<number>(nItems).fill(0),
  itemL1Sq: new Array<number>(nItems).fill(0), itemHltSq: new Array<number>(nItems).fill(0),
  overlap: Array.from({ length: nItems }, () => new Array<number>(nItems).fill(0)),
  unique: new Array<number>(nItems).fill(0),
  bandwidth: 0, l1Pass: 0, hltPass: 0, fired: 0, itemFired: new Array<number>(nItems).fill(0),
});
function addArr(a: number[], b: number[]): void {
  for (let i = 0; i < a.length; i++) a[i]! += b[i]!;
}
export function addTrigger(a: TriggerAcc, b: TriggerAcc): void {
  a.n += b.n; a.pL1 += b.pL1; a.pHlt += b.pHlt; a.pL1Sq += b.pL1Sq; a.pHltSq += b.pHltSq;
  addArr(a.itemL1, b.itemL1); addArr(a.itemHlt, b.itemHlt); addArr(a.itemL1Sq, b.itemL1Sq); addArr(a.itemHltSq, b.itemHltSq);
  for (let i = 0; i < a.overlap.length; i++) addArr(a.overlap[i]!, b.overlap[i]!);
  addArr(a.unique, b.unique);
  a.bandwidth += b.bandwidth; a.l1Pass += b.l1Pass; a.hltPass += b.hltPass; a.fired += b.fired;
  addArr(a.itemFired, b.itemFired);
}

// ── One sample ────────────────────────────────────────────────────────────────────────────────

export interface SampleAcc {
  name: string;
  /** Events generated and processed. */
  n: number;
  /** Events lost to an error in some stage. */
  failed: number;
  /** Multiplicities summed over events, for the stage counters. */
  pileup: number;
  truthParticles: number;
  hits: number;
  cells: number;
  muonHits: number;
  tracks: number;
  vertices: number;
  objects: Record<string, number>;
  trigger: TriggerAcc;
  /** Events the analysis used (triggered, if the trigger is applied) and those with a value of the main observable. */
  triggered: number;
  selected: number;
  /** Selected events with the main observable inside the signal window. */
  inWindow: number;
  /** One histogram per observable of the configuration, in the same order. */
  hist: HistAcc[];
  /** The main observable at truth level (events in the truth acceptance, before the detector and the trigger). */
  truthHist: HistAcc;
  /** (reco − truth)/truth of the main observable, for events that have both. */
  resolution: HistAcc;
  eff: Record<EffKind, EffCounts>;
  /** Track finding, from the truth record: reconstructible charged particles, matched, and tracks with no truth match. */
  trackEff: { nTruth: number; nMatched: number; nFake: number };
}

export const RESOLUTION_EDGES: number[] = Array.from({ length: 41 }, (_, i) => -0.1 + (0.2 * i) / 40);

export function emptySample(name: string, edges: readonly (readonly number[])[], nItems: number, mainEdges: readonly number[]): SampleAcc {
  return {
    name, n: 0, failed: 0, pileup: 0, truthParticles: 0, hits: 0, cells: 0, muonHits: 0, tracks: 0, vertices: 0, objects: {},
    trigger: emptyTrigger(nItems), triggered: 0, selected: 0, inWindow: 0,
    hist: edges.map((e) => emptyHist(e.length - 1)),
    truthHist: emptyHist(mainEdges.length - 1),
    resolution: emptyHist(RESOLUTION_EDGES.length - 1),
    eff: { muon: emptyEff(), electron: emptyEff(), photon: emptyEff() },
    trackEff: { nTruth: 0, nMatched: 0, nFake: 0 },
  };
}

export function addSample(a: SampleAcc, b: SampleAcc): void {
  a.n += b.n; a.failed += b.failed; a.pileup += b.pileup; a.truthParticles += b.truthParticles; a.hits += b.hits; a.cells += b.cells;
  a.muonHits += b.muonHits; a.tracks += b.tracks; a.vertices += b.vertices;
  for (const [k, v] of Object.entries(b.objects)) a.objects[k] = (a.objects[k] ?? 0) + v;
  addTrigger(a.trigger, b.trigger);
  a.triggered += b.triggered; a.selected += b.selected; a.inWindow += b.inWindow;
  a.hist.forEach((h, i) => addHist(h, b.hist[i]!));
  addHist(a.truthHist, b.truthHist);
  addHist(a.resolution, b.resolution);
  for (const k of EFF_KINDS) for (const f of ['nTruth', 'nMatched', 'nReco', 'nFake'] as const) a.eff[k][f] += b.eff[k][f];
  a.trackEff.nTruth += b.trackEff.nTruth; a.trackEff.nMatched += b.trackEff.nMatched; a.trackEff.nFake += b.trackEff.nFake;
}

// ── A batch ───────────────────────────────────────────────────────────────────────────────────

export interface StageError {
  stage: StageName;
  message: string;
  count: number;
}

export interface KeptEvent {
  /** Index of the event in the run and its sample's name. */
  index: number;
  sample: string;
  /** Whether it also passed the analysis selection (has a value of the main observable). */
  selected: boolean;
  event: FullEvent;
}

export interface BatchResult {
  /** Events processed. */
  n: number;
  /** Bin edges of each observable, in the order of `analysis.observables`; the first is the main observable. */
  observables: string[];
  edges: number[][];
  samples: SampleAcc[];
  /** Milliseconds spent in each stage (wall-clock, summed over events: not deterministic) and the events timed. */
  time: Record<StageName, number>;
  errors: StageError[];
  /** Events kept for display (only when asked for). */
  kept: KeptEvent[];
}

export const emptyTimes = (): Record<StageName, number> => Object.fromEntries(STAGE_NAMES.map((s) => [s, 0])) as Record<StageName, number>;

export function mergeBatch(a: BatchResult, b: BatchResult): BatchResult {
  if (a.samples.length !== b.samples.length) throw new Error('mergeBatch: results come from different configurations');
  a.n += b.n;
  a.samples.forEach((s, i) => addSample(s, b.samples[i]!));
  for (const k of STAGE_NAMES) a.time[k] += b.time[k];
  for (const e of b.errors) {
    const hit = a.errors.find((x) => x.stage === e.stage && x.message === e.message);
    if (hit) hit.count += e.count;
    else if (a.errors.length < 20) a.errors.push({ ...e });
  }
  a.kept.push(...b.kept);
  return a;
}

/** A deep copy (the accumulators are plain data). */
export function cloneBatch(a: BatchResult): BatchResult {
  return structuredClone(a);
}
