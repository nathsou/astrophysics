/**
 * Running the pipeline: `runEvent` (one event through every stage) and `runBatch` (many, accumulated).
 *
 *   machine         the number of pile-up collisions of this crossing: Poisson with the configured mean
 *   generator       `hep/gen` `generate` for the event's sample (hard process, shower, hadronisation, decays, pile-up overlay)
 *   detector        `hep/detector` `simulate`
 *   reconstruction  `hep/reco` `reconstruct`, with the truth record so that objects and tracks carry their truth links
 *   trigger         `hep/trigger` `evaluateMenu`: Level 1 from the detector's towers and muon hits (through the hook `trigger.l1Decision`), then the HLT
 *   analysis        the observables of `observables.ts`, selection, histograms, truth matching
 *
 * The reader's code enters through `hep/hooks` only: the library functions above look their hooks up at every call, so whatever `setOverride`
 * has installed is what runs (`reco.antiKt`, `gen.unweight`, `trigger.l1Decision`, `kinematics.pairMass`, …).
 * Every event has its own random streams, derived from `(seed, index)` alone: a batch does not depend on how it was split.
 */
import { simulate, type DetectorConfig } from '../detector/index.ts';
import { resolveDetector } from './detector.ts';
import { generate, type Process } from '../gen/index.ts';
import type { FullEvent, TruthEvent } from '../event/index.ts';
import type { MachineStageResult } from '../machine/index.ts';
import { machineOf } from './machine.ts';
import { poisson } from '../random/index.ts';
import { reconstruct } from '../reco/index.ts';
import { evaluateMenu, l1InputFromDetector, menuFromSettings, EVENT_SIZE_MB, type EventDecision, type TriggerMenu } from '../trigger/index.ts';
import { eventRng, sampleIndexFor, stageStreams } from './rand.ts';
import { STAGE_NAMES, type PipelineConfig, type SampleSpec, type Selection, type StageName } from './config.ts';
import { OBSERVABLES, binEdges, detectorAcceptance, matchCounts, recoObservables, truthObservable, EFF_KINDS, type EffCounts, type EffKind } from './observables.ts';
import { processFor, sampleXsec } from './processes.ts';
import { emptySample, emptyTimes, fillHist, RESOLUTION_EDGES, type BatchResult, type KeptEvent, type SampleAcc } from './accum.ts';

// ── Resolving a configuration ─────────────────────────────────────────────────────────────────

export { machineOf, resolveDetector };

export interface Prepared {
  config: PipelineConfig;
  sqrtS: number;
  machine: MachineStageResult;
  /** The mean number of pile-up collisions simulated (the configured one, or the machine's μ). */
  mu: number;
  samples: SampleSpec[];
  processes: Process[];
  shares: number[];
  detector: DetectorConfig;
  /** |η| reached by the tracker and calorimeters and by the muon system (for the efficiency counts). */
  acceptance: { tracker: number; muon: number };
  menu: TriggerMenu;
  sel: Selection;
  observables: string[];
  edges: number[][];
}

/** Resolve everything a run needs from a configuration. Cheap (no integration grids are trained here). */
export function prepare(config: PipelineConfig): Prepared {
  const machine = machineOf(config);
  const samples = config.generator.samples;
  if (samples.length === 0) throw new Error('the generator has no samples');
  const detector = resolveDetector(config.detector);
  const observables = config.analysis.observables;
  for (const o of observables) if (!OBSERVABLES[o]) throw new Error(`unknown observable "${o}"; available: ${Object.keys(OBSERVABLES).join(', ')}`);
  return {
    config,
    sqrtS: config.machine.sqrtS,
    machine,
    mu: config.machine.mode === 'ee' ? 0 : (config.machine.pileupMean ?? machine.mu),
    samples,
    processes: samples.map(processFor),
    shares: samples.map((s) => Math.max(1, Math.round(s.share))),
    detector,
    acceptance: detectorAcceptance(detector),
    menu: menuFromSettings(config.name, config.trigger.menu),
    sel: config.analysis.selection,
    observables,
    edges: observables.map((o) => binEdges(OBSERVABLES[o]!, config.analysis.binning[o])),
  };
}

// ── One event ─────────────────────────────────────────────────────────────────────────────────

export interface TriggerDecision {
  l1Passed: string[];
  hltPassed: string[];
  /** Items that fired after prescales. */
  fired: string[];
  /** The event is kept: at least one item fired. */
  kept: boolean;
  /** Expected acceptance probability (over prescales) at Level 1 and after the HLT, overall and per menu item. */
  pL1: number;
  pHlt: number;
  itemL1: number[];
  itemHlt: number[];
}

export interface EventOutput {
  index: number;
  sampleIndex: number;
  sample: string;
  /** Pile-up collisions overlaid. */
  pileup: number;
  /** The complete event (undefined if a stage failed): truth, detector output, reconstruction, fired trigger items, weight. */
  event?: FullEvent;
  failed?: { stage: StageName; message: string };
  decision?: TriggerDecision;
  /** Observable values in the order of `config.analysis.observables` (null where the event has none). Empty if the analysis did not run. */
  values: (number | null)[];
  /** Whether the analysis used the event (trigger applied) and it has a value of the main observable. */
  triggered: boolean;
  selected: boolean;
  /** The main observable computed from the truth record, where defined. */
  truthMain: number | null;
  /** Truth-matching counts of this event (prompt truth objects, matches, reconstructed objects, fakes), by kind. */
  eff?: Record<EffKind, EffCounts>;
  /** Wall-clock milliseconds in each stage (not deterministic). */
  time: Record<StageName, number>;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const errMsg = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/**
 * Process one event. `xsec(k)` gives the weight of a sample-k event (its cross-section in pb, times the K-factors); the default is 1.
 */
export function processEvent(p: Prepared, index: number, seed: number, xsec: (k: number) => number = () => 1): EventOutput {
  const r = eventRng(seed, index);
  const rs = stageStreams(r);
  const k = sampleIndexFor(index, p.shares);
  const sample = p.samples[k]!;
  const out: EventOutput = { index, sampleIndex: k, sample: sample.name, pileup: 0, values: [], triggered: false, selected: false, truthMain: null, time: emptyTimes() };
  const c = p.config;
  let stage: StageName = 'machine';
  let t0 = now();
  const tick = (next: StageName) => {
    const t = now();
    out.time[stage] += t - t0;
    t0 = t;
    stage = next;
  };
  try {
    // machine
    out.pileup = p.mu > 0 ? poisson(rs.machine, p.mu) : 0;
    tick('generator');
    // generator
    const truth: TruthEvent = generate(p.processes[k]!, {
      sqrtS: p.sqrtS, pileup: out.pileup, isr: c.generator.isr, eventNumber: index,
      shower: c.generator.shower, hadronise: c.generator.hadronise, decay: c.generator.decay,
    }, rs.generator);
    tick('detector');
    const det = simulate(truth, p.detector, rs.detector);
    tick('reconstruction');
    const reco = reconstruct(det, p.detector, c.reco, truth);
    tick('trigger');
    let decision: EventDecision | undefined;
    if (p.menu.items.length > 0) decision = evaluateMenu([{ reco, l1: l1InputFromDetector(det, p.detector.bField) }], p.menu, { rng: rs.trigger })[0];
    const fired = decision?.fired ?? [];
    out.decision = {
      l1Passed: decision?.l1Passed ?? [], hltPassed: decision?.hltPassed ?? [], fired, kept: fired.length > 0,
      pL1: decision?.pL1 ?? 0, pHlt: decision?.pHlt ?? 0, itemL1: decision?.itemL1 ?? [], itemHlt: decision?.itemHlt ?? [],
    };
    tick('analysis');
    out.triggered = !c.trigger.apply || out.decision.kept;
    const names = p.observables;
    if (out.triggered) {
      out.values = recoObservables(reco, p.sel, names);
      out.selected = out.values[0] !== null && out.values[0] !== undefined;
    }
    if (OBSERVABLES[names[0]!]?.truth) out.truthMain = truthObservable(truth, p.sel, names[0]!, p.detector.etaMax - 0.1);
    out.event = { truth, detector: det, reco, trigger: fired, weight: xsec(k) };
    out.eff = matchCounts(truth, reco, p.sel, p.acceptance);
    tick('analysis');
  } catch (e) {
    out.failed = { stage, message: errMsg(e) };
    tick(stage);
  }
  return out;
}

/**
 * One event through the whole pipeline: the reader's code runs wherever a hook is installed. Returns the complete `FullEvent` (truth, detector, reco,
 * fired trigger items, weight = the sample's cross-section in pb times its K-factor), the trigger decision, and the observables.
 */
export function runEvent(config: PipelineConfig, index: number, seed = 1): EventOutput {
  const p = prepare(config);
  return processEvent(p, index, seed, (k) => sampleXsec(p.samples[k]!, p.sqrtS, p.config.generator.kFactor));
}

// ── Accumulating ──────────────────────────────────────────────────────────────────────────────

export function emptyBatch(p: Prepared): BatchResult {
  const mainEdges = p.edges[0]!;
  return {
    n: 0,
    observables: p.observables.slice(),
    edges: p.edges.map((e) => e.slice()),
    samples: p.samples.map((s) => emptySample(s.name, p.edges, p.menu.items.length, mainEdges)),
    time: emptyTimes(),
    errors: [],
    kept: [],
  };
}

/** Add one event's output to a batch. */
export function accumulate(p: Prepared, res: BatchResult, o: EventOutput): void {
  const s: SampleAcc = res.samples[o.sampleIndex]!;
  res.n++;
  s.n++;
  for (const st of STAGE_NAMES) res.time[st] += o.time[st];
  if (o.failed) {
    s.failed++;
    const hit = res.errors.find((e) => e.stage === o.failed!.stage && e.message === o.failed!.message);
    if (hit) hit.count++;
    else if (res.errors.length < 20) res.errors.push({ stage: o.failed.stage, message: o.failed.message, count: 1 });
    return;
  }
  const ev = o.event!;
  s.pileup += o.pileup;
  s.truthParticles += ev.truth!.particles.length;
  s.hits += ev.detector!.hits.length;
  s.cells += ev.detector!.cells.length;
  s.muonHits += ev.detector!.muonHits.length;
  s.tracks += ev.reco.tracks.length;
  s.vertices += ev.reco.vertices.length;
  for (const ob of ev.reco.objects) s.objects[ob.kind] = (s.objects[ob.kind] ?? 0) + 1;
  // trigger
  const d = o.decision;
  const T = s.trigger;
  T.n++;
  if (d) {
    T.pL1 += d.pL1; T.pHlt += d.pHlt; T.pL1Sq += d.pL1 * d.pL1; T.pHltSq += d.pHlt * d.pHlt;
    const items = p.menu.items;
    let count = 0, size = 0;
    const pass: boolean[] = items.map((it) => d.hltPassed.includes(it.name));
    for (let i = 0; i < items.length; i++) {
      T.itemL1[i]! += d.itemL1[i]!; T.itemHlt[i]! += d.itemHlt[i]!;
      T.itemL1Sq[i]! += d.itemL1[i]! ** 2; T.itemHltSq[i]! += d.itemHlt[i]! ** 2;
      if (pass[i]) { count++; size = Math.max(size, items[i]!.eventSizeMB ?? EVENT_SIZE_MB); }
      if (d.fired.includes(items[i]!.name)) T.itemFired[i]!++;
    }
    for (let i = 0; i < items.length; i++) {
      if (!pass[i]) continue;
      if (count === 1) T.unique[i]!++;
      for (let j = 0; j < items.length; j++) if (pass[j]) T.overlap[i]![j]!++;
    }
    T.bandwidth += d.pHlt * size;
    if (d.l1Passed.length) T.l1Pass++;
    if (d.hltPassed.length) T.hltPass++;
    if (d.fired.length) T.fired++;
  }
  // analysis
  if (o.triggered) s.triggered++;
  if (o.selected) {
    s.selected++;
    o.values.forEach((v, i) => {
      if (v !== null && v !== undefined) fillHist(s.hist[i]!, res.edges[i]!, v);
    });
    const w = p.config.analysis.window;
    const main = o.values[0]!;
    if (w && main >= w[0] && main <= w[1]) s.inWindow++;
    if (o.truthMain !== null && OBSERVABLES[p.observables[0]!]?.truth && o.truthMain !== 0 && p.observables[0] !== 'cosThetaMu') {
      fillHist(s.resolution, RESOLUTION_EDGES, (main - o.truthMain) / o.truthMain);
    }
  }
  if (o.truthMain !== null) fillHist(s.truthHist, res.edges[0]!, o.truthMain);
  const eff = o.eff;
  if (eff) for (const kd of EFF_KINDS) for (const f of ['nTruth', 'nMatched', 'nReco', 'nFake'] as const) s.eff[kd][f] += eff[kd][f];
  const m = (ev.reco as { match?: { nTruthTracks: number; nMatchedTracks: number; nFakeTracks: number } }).match;
  if (m) {
    s.trackEff.nTruth += m.nTruthTracks;
    s.trackEff.nMatched += m.nMatchedTracks;
    s.trackEff.nFake += m.nFakeTracks;
  }
}

export interface BatchOptions {
  /** Index of the first event (default 0): events `start … start + n − 1` are run. */
  start?: number;
  /** Keep up to this many triggered events (complete, for display), selected ones first in index order. Default 0. */
  keep?: number;
  /** Weights of the kept events (cross-section in pb per sample), if known. */
  xsec?: number[];
  /** Called with every event's output before it is accumulated (tests, tracing). */
  onEvent?: (o: EventOutput) => void;
  /** Checked between events; return true to stop early (the result holds what was done). */
  shouldStop?: () => boolean;
  /** An already prepared configuration. */
  prepared?: Prepared;
}

/**
 * Run events `start … start + n − 1` of the run with seed `seed` and accumulate counters, histograms, trigger sums and efficiencies.
 * Split a run into batches at will and add the results with `mergeBatch`: the histograms and counters come out identical.
 */
export function runBatch(config: PipelineConfig, n: number, seed = 1, opts: BatchOptions = {}): BatchResult {
  const p = opts.prepared ?? prepare(config);
  const res = emptyBatch(p);
  const start = opts.start ?? 0;
  const keep = opts.keep ?? 0;
  const selectedKept: KeptEvent[] = [];
  const otherKept: KeptEvent[] = [];
  for (let i = 0; i < n; i++) {
    if (opts.shouldStop?.()) break;
    const o = processEvent(p, start + i, seed, (k) => opts.xsec?.[k] ?? 1);
    opts.onEvent?.(o);
    accumulate(p, res, o);
    if (keep > 0 && o.event && o.decision && (o.decision.kept || !p.config.trigger.apply)) {
      const ke: KeptEvent = { index: o.index, sample: o.sample, selected: o.selected, event: o.event };
      if (o.selected) {
        if (selectedKept.length < keep) selectedKept.push(ke);
      } else if (otherKept.length < keep) otherKept.push(ke);
    }
  }
  res.kept = [...selectedKept, ...otherKept].slice(0, keep);
  return res;
}
