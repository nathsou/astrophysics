/**
 * From the accumulated counts of a run to what a page shows: histograms scaled to a luminosity, pseudo-data, a fit, the expected significance,
 * trigger rates (the same numbers `hep/trigger` `estimateRates` gives), truth-vs-reconstruction efficiencies and the stage counters.
 *
 * Scaling. Generated events of sample k all carry the same weight, w_k = σ_k K L / N_k (cross-section in pb, K-factor, integrated luminosity in pb⁻¹, events
 * generated). A cross-section at leading order is what `hep/gen` gives; without a K-factor the normalisation is LO and the summary says so (`isLO`).
 * Without a luminosity (`analysis.lumiFb = null`) w_k = 1 and the histograms count simulated events.
 */
import { Hist1D } from '../analysis/hist.ts';
import { fitBinned, guessStart, type FitResult } from '../analysis/fit.ts';
import { namedModel } from '../analysis/models.ts';
import { poissonQuantile } from '../analysis/counting.ts';
import { normalQuantile } from '../analysis/special.ts';
import { significance } from '../analysis/significance.ts';
import { liveFraction, rateHz, type ItemRate, type RateReport, type SampleRate } from '../trigger/index.ts';
import { rng } from '../random/index.ts';
import { STAGE_NAMES, type PipelineConfig, type StageName } from './config.ts';
import { OBSERVABLES, EFF_KINDS, type EffKind } from './observables.ts';
import { RESOLUTION_EDGES, toHist1D, type BatchResult, type HistAcc, type SampleAcc } from './accum.ts';
import { mix32 } from './rand.ts';
import { machineOf } from './machine.ts';

// ── Scaling ───────────────────────────────────────────────────────────────────────────────────

export interface SampleInfo {
  name: string;
  label: string;
  role: 'signal' | 'background';
  /** Events generated so far. */
  n: number;
  /** Cross-section in pb (LO times K-factors). */
  sigmaPb: number;
  /** Weight of one simulated event: σ L / N with L in pb⁻¹; 1 when no luminosity is set. */
  weight: number;
  /** Expected events in the selection and in the signal window at the luminosity (or simulated events if unscaled). */
  expectedSelected: number;
  expectedInWindow: number;
  /** Fraction of generated events that were selected, with its binomial error. */
  selectionEfficiency: number;
  selectionEfficiencyError: number;
}

export interface Series {
  label: string;
  role?: 'signal' | 'background' | 'total' | 'data' | 'truth' | 'fit';
  counts: number[];
  errors: number[];
}

export interface ObservableSummary {
  name: string;
  label: string;
  unit: string;
  edges: number[];
  /** Expected total (all samples, scaled), with MC statistical errors. */
  total: Series;
  /** Each sample's scaled contribution (backgrounds first, then signals). */
  bySample: Series[];
  /**
   * What to draw as a stack, bottom first. Normally `bySample`. With pseudo-data the background samples, which carry large weights (one simulated event
   * stands for thousands of expected ones), are replaced by one background series that is a *smooth fit* of their sum, as analyses use an analytic background
   * shape: the Poisson pseudo-data then fluctuate around a smooth curve instead of around the simulation's own lumps. `smoothed` says which.
   */
  stack: Series[];
  smoothed: boolean;
  /** Poisson-fluctuated pseudo-data from the expectation (main observable only, if configured). */
  pseudo?: Series;
  /** The main observable at truth level (before detector and trigger), scaled like the total. */
  truth?: Series;
  mean: number;
  std: number;
}

export interface FitSummary {
  model: string;
  range: [number, number];
  /** Parameter name → value and error. */
  params: Record<string, { value: number; error: number }>;
  chi2: number;
  ndf: number;
  pValue: number;
  converged: boolean;
  /** The fit converged, every error is finite and the peak position and width are constrained: false early in a run, when there are too few events to constrain the model. */
  reliable: boolean;
  /** Fitted expected counts per bin of the histogram, total and per component (`sig`, `bkg`). */
  expected: number[];
  components: Record<string, number[]>;
  /** The histogram that was fitted. */
  of: 'pseudo-data' | 'expectation';
  signalYield?: { value: number; error: number };
  /** Naive significance of the fitted signal yield over its uncertainty. */
  yieldSignificance?: number;
}

export interface StageSummary {
  stage: StageName;
  /** Events through the stage per second of the stage's own time, on one core (not the wall-clock rate of a parallel run). */
  eventsPerSecond: number;
  /** Mean milliseconds per event. */
  msPerEvent: number;
  /** Named counters (totals over the run) and per-event means. */
  counters: { label: string; value: number }[];
  perEvent: { label: string; value: number }[];
}

export interface EffSummary {
  kind: EffKind;
  nTruth: number;
  efficiency: number;
  efficiencyError: number;
  nReco: number;
  fakeRate: number;
  fakeRateError: number;
}

export interface Summary {
  n: number;
  config: PipelineConfig;
  lumiFb: number | null;
  /** The scale is a leading-order cross-section (no K-factor applied). */
  isLO: boolean;
  kFactor: number;
  samples: SampleInfo[];
  observables: ObservableSummary[];
  fit?: FitSummary;
  /** Signal window: expected signal and background counts, and the Asimov significance (through the hook `analysis.significance`). */
  window?: { lo: number; hi: number; signal: number; background: number; significance: number | null };
  stages: StageSummary[];
  trigger: RateReport & { menu: string[]; lumi: number; deadTimeS: number };
  efficiencies: EffSummary[];
  tracking: { efficiency: number; fakePerEvent: number; nTruth: number };
  /** Resolution of the main observable: mean and rms of (reco − truth)/truth, and the number of events. */
  resolution?: { mean: number; rms: number; n: number; hist: Series; edges: number[] };
  machine: { lumi: number; mu: number; simulatedMu: number; crossingRateHz: number; sqrtS: number };
  errors: BatchResult['errors'];
}

const binom = (k: number, n: number): { v: number; e: number } => ({ v: n > 0 ? k / n : 0, e: n > 0 ? Math.sqrt(Math.max(0, (k / n) * (1 - k / n)) / n) : 0 });

/** The weight of one simulated event of each sample. */
export function sampleWeights(result: BatchResult, config: PipelineConfig, xsec: readonly number[]): number[] {
  const L = config.analysis.lumiFb;
  return result.samples.map((s, k) => (L === null || L === undefined || s.n === 0 ? 1 : (xsec[k]! * config.generator.kFactor * (config.generator.samples[k]!.kFactor ?? 1) * L * 1000) / s.n));
}

/** Uniform numbers fixed per bin, so a pseudo-data histogram changes smoothly as the expectation fills in rather than re-rolling. */
export function pseudoUniforms(seed: number, n: number): number[] {
  const r = rng(mix32(seed, 0xda7a));
  return Array.from({ length: n }, () => r());
}

/** A Poisson quantile that stays fast for large means (normal approximation above 500). */
function poissonAt(u: number, mu: number): number {
  if (!(mu > 0)) return 0;
  if (mu > 500) return Math.max(0, Math.round(mu + Math.sqrt(mu) * normalQuantile(u)));
  return poissonQuantile(u, mu);
}

function seriesFrom(acc: HistAcc[], weights: number[], edges: number[], label: string, role?: Series['role']): Series {
  const n = edges.length - 1;
  const counts = new Array<number>(n).fill(0), v = new Array<number>(n).fill(0);
  acc.forEach((h, k) => {
    for (let i = 0; i < n; i++) {
      counts[i]! += h.counts[i]! * weights[k]!;
      v[i]! += h.counts[i]! * weights[k]! ** 2;
    }
  });
  return { label, role, counts, errors: v.map(Math.sqrt) };
}

export interface SummaryOptions {
  /** Seed of the pseudo-data's fixed uniform numbers (default 1). */
  seed?: number;
  /** Run the fit (default true). */
  fit?: boolean;
}

/**
 * Everything a page shows about a (partial) result. `xsec[k]` is the LO cross-section in pb of sample k (see `sampleXsec` and the worker's `xsec`
 * message); the K-factors of the configuration are applied here.
 */
export function summarise(result: BatchResult, config: PipelineConfig, xsec: readonly number[], opts: SummaryOptions = {}): Summary {
  const a = config.analysis;
  const weights = sampleWeights(result, config, xsec);
  const specs = config.generator.samples;
  const kAll = config.generator.kFactor;
  const samples: SampleInfo[] = result.samples.map((s, k) => {
    const sel = binom(s.selected, s.n);
    return {
      name: s.name, label: specs[k]!.label, role: specs[k]!.role, n: s.n,
      sigmaPb: xsec[k]! * kAll * (specs[k]!.kFactor ?? 1), weight: weights[k]!,
      expectedSelected: s.selected * weights[k]!, expectedInWindow: s.inWindow * weights[k]!,
      selectionEfficiency: sel.v, selectionEfficiencyError: sel.e,
    };
  });
  const order = [...specs.keys()].sort((i, j) => (specs[i]!.role === specs[j]!.role ? i - j : specs[i]!.role === 'background' ? -1 : 1));

  // ── histograms ──
  const observables: ObservableSummary[] = result.observables.map((name, oi) => {
    const def = OBSERVABLES[name]!;
    const edges = result.edges[oi]!;
    const total = seriesFrom(result.samples.map((s) => s.hist[oi]!), weights, edges, 'simulation', 'total');
    const bySample = order.map((k) => seriesFrom([result.samples[k]!.hist[oi]!], [weights[k]!], edges, specs[k]!.label, specs[k]!.role));
    let sum = 0, sumx = 0, sumx2 = 0;
    result.samples.forEach((s, k) => {
      const h = s.hist[oi]!;
      sum += h.sum * weights[k]!;
      sumx += h.sumx * weights[k]!;
      sumx2 += h.sumx2 * weights[k]!;
    });
    const mean = sum > 0 ? sumx / sum : NaN;
    const std = sum > 0 ? Math.sqrt(Math.max(0, sumx2 / sum - mean * mean)) : NaN;
    let o: ObservableSummary = { name, label: def.label, unit: def.unit, edges, total, bySample, stack: bySample, smoothed: false, mean, std };
    if (oi === 0 && a.pseudoData && a.fit) o = smoothBackgrounds(o, specs.map((sp) => sp.role), order, a.fit.model, a.fit.range);
    if (oi === 0) {
      if (def.truth) o.truth = seriesFrom(result.samples.map((s) => s.truthHist), weights, edges, 'truth level', 'truth');
      if (a.pseudoData) {
        const u = pseudoUniforms(opts.seed ?? 1, edges.length - 1);
        const counts = o.total.counts.map((mu, i) => poissonAt(u[i]!, mu));
        o.pseudo = { label: 'pseudo-data', role: 'data', counts, errors: counts.map(Math.sqrt) };
      }
    }
    return o;
  });

  // ── fit ──
  let fit: FitSummary | undefined;
  const main = observables[0];
  if (a.fit && main && (opts.fit ?? true)) {
    try {
      fit = fitMain(main, a.fit.model, a.fit.range, !!main.pseudo);
    } catch {
      fit = undefined;
    }
  }

  // ── signal window ──
  let window: Summary['window'];
  if (a.window && main) {
    // from the histogram, so that moving the window needs no new run: the bins whose centres lie inside it
    let s = 0, b = 0;
    result.samples.forEach((acc, k) => {
      const h = acc.hist[0]!;
      let c = 0;
      for (let i = 0; i < h.counts.length; i++) {
        const ctr = 0.5 * (main.edges[i]! + main.edges[i + 1]!);
        if (ctr >= a.window![0] && ctr <= a.window![1]) c += h.counts[i]!;
      }
      if (specs[k]!.role === 'signal') s += c * weights[k]!;
      else b += c * weights[k]!;
    });
    window = { lo: a.window[0], hi: a.window[1], signal: s, background: b, significance: s > 0 && b > 0 ? significance(s, b) : null };
  }

  // ── stage counters ──
  const stages = stageSummaries(result, config);

  // ── trigger ──
  const machine = machineOf(config);
  const lumi = machine.lumi;
  const deadTimeS = config.trigger.deadTimeNs * 1e-9;
  const trig = rateReportFrom(result, config, xsec, lumi, deadTimeS);

  // ── efficiencies ──
  const efficiencies: EffSummary[] = [];
  for (const kind of EFF_KINDS) {
    let nT = 0, nM = 0, nR = 0, nF = 0;
    for (const s of result.samples) {
      nT += s.eff[kind].nTruth; nM += s.eff[kind].nMatched; nR += s.eff[kind].nReco; nF += s.eff[kind].nFake;
    }
    if (nT === 0 && nR === 0) continue;
    const e = binom(nM, nT), f = binom(nF, nR);
    efficiencies.push({ kind, nTruth: nT, efficiency: e.v, efficiencyError: e.e, nReco: nR, fakeRate: f.v, fakeRateError: f.e });
  }
  let tT = 0, tM = 0, tF = 0, nEv = 0;
  for (const s of result.samples) { tT += s.trackEff.nTruth; tM += s.trackEff.nMatched; tF += s.trackEff.nFake; nEv += s.n - s.failed; }
  const tracking = { efficiency: tT > 0 ? tM / tT : 0, fakePerEvent: nEv > 0 ? tF / nEv : 0, nTruth: tT };

  // ── resolution ──
  let resolution: Summary['resolution'];
  const resAcc = result.samples.reduce((acc, s) => {
    acc.counts.forEach((_, i) => (acc.counts[i]! += s.resolution.counts[i]!));
    acc.sum += s.resolution.sum; acc.sumx += s.resolution.sumx; acc.sumx2 += s.resolution.sumx2;
    return acc;
  }, { counts: new Array<number>(RESOLUTION_EDGES.length - 1).fill(0), underflow: 0, overflow: 0, sum: 0, sumx: 0, sumx2: 0 } as HistAcc);
  if (resAcc.sum >= 5) {
    const mean = resAcc.sumx / resAcc.sum;
    resolution = { mean, rms: Math.sqrt(Math.max(0, resAcc.sumx2 / resAcc.sum - mean * mean)), n: resAcc.sum, edges: RESOLUTION_EDGES, hist: { label: 'reco − truth', counts: resAcc.counts, errors: resAcc.counts.map(Math.sqrt) } };
  }

  const isLO = kAll === 1 && specs.every((s) => (s.kFactor ?? 1) === 1);
  return {
    n: result.n, config, lumiFb: a.lumiFb ?? null, isLO, kFactor: kAll, samples, observables, fit, window, stages,
    trigger: { ...trig, menu: config.trigger.menu.filter((m) => m.enabled !== false).map((m) => m.key), lumi, deadTimeS },
    efficiencies, tracking, resolution,
    machine: { lumi, mu: machine.mu, simulatedMu: config.machine.mode === 'ee' ? 0 : (config.machine.pileupMean ?? machine.mu), crossingRateHz: machine.crossingRateHz, sqrtS: config.machine.sqrtS },
    errors: result.errors,
  };
}

/** The mean weight of a weighted histogram, Σ w² / Σ w (1 for unit weights): dividing by it puts the contents in units of simulated events. */
function unitWeight(counts: readonly number[], variance: readonly number[]): number {
  const sw = counts.reduce((a, b) => a + b, 0), sw2 = variance.reduce((a, b) => a + b, 0);
  return sw > 0 && sw2 > 0 ? sw2 / sw : 1;
}

/** Replace the background samples of `o` by one smooth background (an analytic fit to their sum) and rebuild the stack and the total from it and the signal samples. */
function smoothBackgrounds(o: ObservableSummary, roles: ('signal' | 'background')[], order: number[], model: string, range: [number, number] | null): ObservableSummary {
  const bkg = order.map((k, i) => ({ k, s: o.bySample[i]! })).filter((x) => roles[x.k] === 'background');
  const sig = order.map((k, i) => ({ k, s: o.bySample[i]! })).filter((x) => roles[x.k] === 'signal');
  if (bkg.length === 0) return o;
  const n = o.edges.length - 1;
  const counts = new Array<number>(n).fill(0), v = new Array<number>(n).fill(0);
  for (const { s } of bkg) for (let i = 0; i < n; i++) { counts[i]! += s.counts[i]!; v[i]! += s.errors[i]! ** 2; }
  const shape = model.includes('+') ? model.split('+')[1]!.trim() : model;
  let smooth: number[] | null = null;
  try {
    // fit in units of "one simulated event" (mean weight 1): the minimiser is badly conditioned with yields of 10⁵ and a slope of 10⁻²
    const k = unitWeight(counts, v);
    const h = new Hist1D(o.edges);
    for (let i = 0; i < n; i++) { h.counts[i] = counts[i]! / k; h.sumw2[i] = v[i]! / (k * k); }
    // too few simulated background events to fit a shape: use the simulation as it is
    const effN = h.counts.reduce((a, b) => a + b, 0) ** 2 / Math.max(1e-300, h.sumw2.reduce((a, b) => a + b, 0));
    if (effN >= 30) {
      const bm = namedModel(shape);
      const r = fitBinned(h, bm, guessStart(h, bm), range ? { range } : {});
      if (r.converged && r.ndf > 0) {
        const lo = range ? range[0] : h.lower, hi = range ? range[1] : h.upper;
        const e = bm.binned(r.params, Array.from(h.edges), [lo, hi]);
        smooth = counts.map((c, i) => (h.binCenter(i) >= lo && h.binCenter(i) <= hi ? e[i]! * k : c));
      }
    }
  } catch {
    smooth = null;
  }
  if (!smooth) return o;
  const background: Series = { label: bkg.length === 1 ? bkg[0]!.s.label : 'background', role: 'background', counts: smooth, errors: v.map(Math.sqrt) };
  const stack = [background, ...sig.map((x) => x.s)];
  const tot = new Array<number>(n).fill(0), tv = new Array<number>(n).fill(0);
  for (const s of stack) for (let i = 0; i < n; i++) { tot[i]! += s.counts[i]!; tv[i]! += s.errors[i]! ** 2; }
  return { ...o, stack, smoothed: true, total: { ...o.total, counts: tot, errors: tv.map(Math.sqrt) } };
}

/** Fit the main observable's pseudo-data (or its expectation) with a named model. */
export function fitMain(main: ObservableSummary, modelName: string, range: [number, number] | null, usePseudo: boolean): FitSummary {
  const series = usePseudo && main.pseudo ? main.pseudo : main.total;
  const h = new Hist1D(main.edges);
  // an expectation made of weighted events is fitted in units of one simulated event (see `smoothBackgrounds`); pseudo-data are counts already
  const k = usePseudo && main.pseudo ? 1 : unitWeight(series.counts, series.errors.map((e) => e * e));
  for (let i = 0; i < series.counts.length; i++) {
    h.counts[i] = series.counts[i]! / k;
    h.sumw2[i] = usePseudo && main.pseudo ? series.counts[i]! : series.errors[i]! ** 2 / (k * k);
  }
  const model = namedModel(modelName);
  const p0 = guessStart(h, model);
  const r: FitResult = fitBinned(h, model, p0, range ? { range } : {});
  const lo = range ? range[0] : h.lower, hi = range ? range[1] : h.upper;
  // expected counts per bin of the full histogram, per component
  const comps: Record<string, number[]> = {};
  const cb = model.componentBinned(r.params, Array.from(h.edges), [lo, hi]);
  model.components.forEach((c, i) => (comps[c.label] = cb[i]!.map((x) => x * k)));
  const params: FitSummary['params'] = {};
  // yields are in simulated events when k ≠ 1: report them in the units of the histogram
  r.names.forEach((nm, i) => (params[nm] = { value: nm.endsWith('.yield') ? r.params[i]! * k : r.params[i]!, error: nm.endsWith('.yield') ? r.errors[i]! * k : r.errors[i]! }));
  const y = params['sig.yield'];
  return {
    model: modelName, range: [lo, hi], params, chi2: r.chi2, ndf: r.ndf, pValue: r.pValue, converged: r.converged,
    reliable: r.converged && r.errors.every((e) => Number.isFinite(e)) && r.ndf > 0 && Object.entries(params).every(([k, p]) => (k.endsWith('mean') ? p.error < 0.05 * Math.abs(p.value) : k.endsWith('sigma') || k.endsWith('width') ? p.error < Math.abs(p.value) : true)),
    expected: model.binned(r.params, Array.from(h.edges), [lo, hi]).map((x) => x * k), components: comps,
    of: usePseudo && main.pseudo ? 'pseudo-data' : 'expectation',
    signalYield: y,
    yieldSignificance: y && y.error > 0 ? y.value / y.error : undefined,
  };
}

// ── Stages ────────────────────────────────────────────────────────────────────────────────────

function stageSummaries(res: BatchResult, config: PipelineConfig): StageSummary[] {
  const n = res.n;
  const ok = res.samples.reduce((s, x) => s + x.n - x.failed, 0);
  const sum = (f: (s: SampleAcc) => number) => res.samples.reduce((t, s) => t + f(s), 0);
  const per = (x: number) => (ok > 0 ? x / ok : 0);
  const objs: Record<string, number> = {};
  for (const s of res.samples) for (const [k, v] of Object.entries(s.objects)) objs[k] = (objs[k] ?? 0) + v;
  const T = res.samples.reduce((t, s) => ({ l1: t.l1 + s.trigger.l1Pass, hlt: t.hlt + s.trigger.hltPass, fired: t.fired + s.trigger.fired, n: t.n + s.trigger.n }), { l1: 0, hlt: 0, fired: 0, n: 0 });
  const defs: Record<StageName, Pick<StageSummary, 'counters' | 'perEvent'>> = {
    machine: {
      counters: [{ label: 'bunch crossings', value: n }, { label: 'pile-up collisions', value: sum((s) => s.pileup) }],
      perEvent: [{ label: 'pile-up collisions per crossing', value: per(sum((s) => s.pileup)) }],
    },
    generator: {
      counters: [{ label: 'events generated', value: n }, { label: 'lost to errors', value: sum((s) => s.failed) }],
      perEvent: [{ label: 'truth particles per event', value: per(sum((s) => s.truthParticles)) }],
    },
    detector: {
      counters: [{ label: 'events simulated', value: ok }],
      perEvent: [{ label: 'tracker hits', value: per(sum((s) => s.hits)) }, { label: 'calorimeter cells', value: per(sum((s) => s.cells)) }, { label: 'muon hits', value: per(sum((s) => s.muonHits)) }],
    },
    reconstruction: {
      counters: [{ label: 'events reconstructed', value: ok }],
      perEvent: [{ label: 'tracks', value: per(sum((s) => s.tracks)) }, { label: 'vertices', value: per(sum((s) => s.vertices)) }, ...Object.entries(objs).map(([k, v]) => ({ label: `${k}s`, value: per(v) }))],
    },
    trigger: {
      counters: [{ label: 'passed Level 1', value: T.l1 }, { label: 'passed the HLT', value: T.hlt }, { label: 'kept', value: T.fired }],
      perEvent: [{ label: 'kept fraction', value: T.n > 0 ? T.fired / T.n : 0 }],
    },
    analysis: {
      counters: [{ label: config.trigger.apply ? 'events after the trigger' : 'events analysed', value: sum((s) => s.triggered) }, { label: 'selected', value: sum((s) => s.selected) }, { label: 'in the signal window', value: sum((s) => s.inWindow) }],
      perEvent: [],
    },
  };
  return STAGE_NAMES.map((stage) => {
    const ms = res.time[stage];
    return { stage, eventsPerSecond: ms > 0 ? (n / ms) * 1000 : 0, msPerEvent: n > 0 ? ms / n : 0, ...defs[stage] };
  });
}

// ── Trigger rates from the accumulated sums ───────────────────────────────────────────────────

const effOf = (sumP: number, sumP2: number, n: number): { eff: number; err: number } => {
  if (n === 0) return { eff: 0, err: 0 };
  const eff = sumP / n;
  return { eff, err: Math.sqrt(Math.max(0, sumP2 - n * eff * eff)) / n };
};

/**
 * The rates of a run's menu, from the accumulated sums. Same numbers as `estimateRates` on the same events (the tests compare them): rate = σ L ε per
 * item and in total with overlaps counted once, errors, the dead time and the bandwidth. The samples are the ones of this run, not the whole detector's
 * traffic: the rate of a Z → μμ run is the rate of Z → μμ events, not of everything the trigger sees.
 */
export function rateReportFrom(result: BatchResult, config: PipelineConfig, xsec: readonly number[], lumi: number, deadTimeS: number): RateReport {
  const items = config.trigger.menu.filter((m) => m.enabled !== false);
  const nI = items.length;
  const itemRates: ItemRate[] = items.map((it) => ({ name: it.key, l1Rate: 0, hltRate: 0, l1RateRaw: 0, hltRateRaw: 0, hltUniqueRaw: 0, hltError: 0, l1Error: 0 }));
  const overlap = Array.from({ length: nI }, () => new Array<number>(nI).fill(0));
  const sampleRates: SampleRate[] = [];
  let l1Total = 0, hltTotal = 0, l1Var = 0, hltVar = 0, bandwidth = 0;
  result.samples.forEach((s, k) => {
    const T = s.trigger;
    const sigma = xsec[k]! * config.generator.kFactor * (config.generator.samples[k]!.kFactor ?? 1);
    const R = rateHz(sigma, lumi, 1);
    const e1 = effOf(T.pL1, T.pL1Sq, T.n), eH = effOf(T.pHlt, T.pHltSq, T.n);
    l1Total += R * e1.eff; hltTotal += R * eH.eff; l1Var += (R * e1.err) ** 2; hltVar += (R * eH.err) ** 2;
    sampleRates.push({ name: s.name, sigmaPb: sigma, l1Rate: R * e1.eff, hltRate: R * eH.eff, efficiency: eH.eff, error: eH.err, fiducialEfficiency: eH.eff, fiducialError: eH.err });
    const perEvent = T.n > 0 ? R / T.n : 0;
    for (let i = 0; i < nI; i++) {
      const l1e = effOf(T.itemL1[i]!, T.itemL1Sq[i]!, T.n), he = effOf(T.itemHlt[i]!, T.itemHltSq[i]!, T.n);
      const it = itemRates[i]!;
      it.l1Rate += R * l1e.eff; it.hltRate += R * he.eff;
      it.l1Error = Math.hypot(it.l1Error, R * l1e.err); it.hltError = Math.hypot(it.hltError, R * he.err);
      const ps1 = Math.max(1, items[i]!.prescale), ps = ps1;
      it.l1RateRaw += R * l1e.eff * ps1; it.hltRateRaw += R * he.eff * ps;
      it.hltUniqueRaw += T.unique[i]! * perEvent;
      for (let j = 0; j < nI; j++) overlap[i]![j]! += T.overlap[i]![j]! * perEvent;
    }
    bandwidth += T.bandwidth * perEvent;
  });
  return { items: itemRates, samples: sampleRates, l1Total, hltTotal, l1TotalError: Math.sqrt(l1Var), hltTotalError: Math.sqrt(hltVar), liveFraction: liveFraction(l1Total, deadTimeS), bandwidthMBs: bandwidth, overlap };
}

/** A `Hist1D` of one series, with errors, for use with `hep/analysis` (fits, integrals). */
export function seriesToHist(edges: readonly number[], s: Series): Hist1D {
  const h = new Hist1D(edges);
  for (let i = 0; i < s.counts.length; i++) {
    h.counts[i] = s.counts[i]!;
    h.sumw2[i] = s.errors[i]! ** 2;
  }
  return h;
}

export { toHist1D };
