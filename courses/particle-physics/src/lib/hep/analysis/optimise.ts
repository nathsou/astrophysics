/**
 * Helpers for the analysis chapters: optimising a selection for the best expected significance, and blinding.
 *
 * A *selection* is a set of one-sided cuts on columns. Each cut changes how many signal events s and background events b survive, and the figure of
 * merit is the expected significance Z(s, b) (by default the Asimov formula of `significance`). Tightening a cut removes background faster than signal
 * at first, then signal faster than background: there is a best threshold. `selectionOptimiser` finds it by coordinate descent, cut by cut, from
 * several starting points, since the best value of one cut depends on the others.
 */
import type { EventTable } from '../event/index.ts';
import { rng as makeRng } from '../random/index.ts';
import { Hist1D } from './hist.ts';
import { significanceReference, significanceWithUncertainty } from './significance.ts';

/** Events of one kind. Every event stands for `weight` expected events (cross-section × luminosity / number generated). */
export interface OptSample {
  columns: Record<string, ArrayLike<number>>;
  n: number;
  weight: number;
  /** Optional per-event multiplier on `weight`. */
  weights?: ArrayLike<number>;
}

/** An `OptSample` from an event table. */
export function sampleFromTable(table: EventTable, weight: number, weights?: ArrayLike<number>): OptSample {
  return { columns: table.columns, n: table.n, weight, weights };
}

export interface CutValue {
  column: string;
  /** `min`: keep events with value ≥ threshold; `max`: keep events with value ≤ threshold. */
  kind: 'min' | 'max';
  value: number;
}

export interface CutSpec {
  column: string;
  /** `min`, `max`, or `window` (both, optimised as two cuts). */
  kind: 'min' | 'max' | 'window';
}

export interface Selection {
  cuts: CutValue[];
  /** Expected signal and background after the cuts. */
  s: number;
  b: number;
  /** Raw (unweighted) numbers of simulated events passing. */
  nSig: number;
  nBkg: number;
  /** Signal and background efficiencies. */
  effS: number;
  effB: number;
  /** The figure of merit. */
  z: number;
}

export interface OptimiserOptions {
  /** Relative uncertainty on the background (0.1 = 10 %): uses `significanceWithUncertainty`. Default 0. */
  bkgRelUnc?: number;
  /** Require at least this many simulated background events to pass, so that the optimiser does not chase an empty, noisy corner. Default 5. */
  minBkgEvents?: number;
  /** Candidate thresholds per cut (quantiles of the signal). Default 80. */
  nCandidates?: number;
  /** Extra random starting points beyond "no cuts". Default 3. */
  nStarts?: number;
  /** Cuts to start from (overrides "no cuts" as the first start). */
  start?: CutValue[];
  seed?: number;
}

function weightSum(sample: OptSample, pass: (i: number) => boolean): { w: number; n: number } {
  let w = 0, n = 0;
  for (let i = 0; i < sample.n; i++) {
    if (!pass(i)) continue;
    n++;
    w += sample.weights ? sample.weights[i]! : 1;
  }
  return { w: w * sample.weight, n };
}

function passer(sample: OptSample, cuts: CutValue[]): (i: number) => boolean {
  const cols = cuts.map((c) => {
    const col = sample.columns[c.column];
    if (!col) throw new Error(`no column ${c.column}`);
    return { col, min: c.kind === 'min', v: c.value };
  });
  return (i) => {
    for (const c of cols) {
      const x = c.col[i]!;
      if (c.min ? !(x >= c.v) : !(x <= c.v)) return false;
    }
    return true;
  };
}

/** Evaluate a selection: expected s and b, efficiencies and the significance. */
export function evaluateSelection(sig: OptSample, bkg: OptSample, cuts: CutValue[], opts: Pick<OptimiserOptions, 'bkgRelUnc'> = {}): Selection {
  const s = weightSum(sig, passer(sig, cuts));
  const b = weightSum(bkg, passer(bkg, cuts));
  const s0 = weightSum(sig, () => true).w, b0 = weightSum(bkg, () => true).w;
  const unc = opts.bkgRelUnc ?? 0;
  const z = b.w > 0 ? (unc > 0 ? significanceWithUncertainty(s.w, b.w, unc * b.w) : significanceReference(s.w, b.w)) : s.w > 0 ? Infinity : 0;
  return { cuts, s: s.w, b: b.w, nSig: s.n, nBkg: b.n, effS: s0 > 0 ? s.w / s0 : 0, effB: b0 > 0 ? b.w / b0 : 0, z };
}

/** Expand `window` specs to a `min` and a `max`. */
function expand(specs: CutSpec[]): { column: string; kind: 'min' | 'max' }[] {
  return specs.flatMap((s) => (s.kind === 'window' ? [{ column: s.column, kind: 'min' as const }, { column: s.column, kind: 'max' as const }] : [{ column: s.column, kind: s.kind }]));
}

/** Weighted quantile of a sample column (for candidate thresholds). */
function quantiles(sample: OptSample, column: string, k: number): number[] {
  const col = sample.columns[column];
  if (!col) throw new Error(`no column ${column}`);
  const v = Float64Array.from({ length: sample.n }, (_, i) => col[i]!).filter((x) => Number.isFinite(x)).sort();
  if (v.length === 0) return [];
  const out: number[] = [];
  for (let j = 0; j <= k; j++) out.push(v[Math.min(v.length - 1, Math.floor((0.002 + 0.996 * j / k) * v.length))]!);
  return Array.from(new Set(out));
}

export interface ScanPoint {
  value: number;
  s: number;
  b: number;
  z: number;
}

/** Events passing all cuts but one, sorted by the value of that cut's column, with prefix sums of the weights (for fast scans of a single threshold). */
interface SortedColumn {
  vals: Float64Array;
  /** cum[i] = summed weight of the first i events (times the sample weight). */
  cum: Float64Array;
}
function sortedColumn(sample: OptSample, cuts: CutValue[], skip: number): SortedColumn {
  const others = cuts.filter((_, i) => i !== skip);
  const pass = passer(sample, others);
  const col = sample.columns[cuts[skip]!.column];
  if (!col) throw new Error(`no column ${cuts[skip]!.column}`);
  const idx: number[] = [];
  for (let i = 0; i < sample.n; i++) if (Number.isFinite(col[i]!) && pass(i)) idx.push(i);
  idx.sort((a, b) => col[a]! - col[b]!);
  const vals = new Float64Array(idx.length);
  const cum = new Float64Array(idx.length + 1);
  idx.forEach((i, k) => {
    vals[k] = col[i]!;
    cum[k + 1] = cum[k]! + (sample.weights ? sample.weights[i]! : 1) * sample.weight;
  });
  return { vals, cum };
}
/** Number of entries strictly below v (first index with value ≥ v). */
function lowerBound(a: Float64Array, v: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m]! < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}
/** Number of entries at or below v (first index with value > v). */
function upperBound(a: Float64Array, v: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m]! <= v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * Scan one cut (by index in `cuts`) over `thresholds` with the others fixed, in O((n + k) log n) rather than O(n k): the curve the reader sees in Chapter 29.
 * Points with fewer than `minBkgEvents` simulated background events passing get z = −Infinity.
 */
export function scanCut(sig: OptSample, bkg: OptSample, cuts: CutValue[], index: number, thresholds: number[], opts: OptimiserOptions = {}): ScanPoint[] {
  const cs = sortedColumn(sig, cuts, index);
  const cb = sortedColumn(bkg, cuts, index);
  const minBkg = opts.minBkgEvents ?? 5;
  const unc = opts.bkgRelUnc ?? 0;
  const isMin = cuts[index]!.kind === 'min';
  return thresholds.map((value) => {
    const is = isMin ? lowerBound(cs.vals, value) : upperBound(cs.vals, value);
    const ib = isMin ? lowerBound(cb.vals, value) : upperBound(cb.vals, value);
    const sW = isMin ? cs.cum[cs.vals.length]! - cs.cum[is]! : cs.cum[is]!;
    const bW = isMin ? cb.cum[cb.vals.length]! - cb.cum[ib]! : cb.cum[ib]!;
    const nB = isMin ? cb.vals.length - ib : ib;
    const nS = isMin ? cs.vals.length - is : is;
    const z = bW > 0 ? (unc > 0 ? significanceWithUncertainty(sW, bW, unc * bW) : significanceReference(sW, bW)) : sW > 0 ? Infinity : 0;
    return { value, s: sW, b: bW, z: nB >= minBkg && nS > 0 ? z : -Infinity };
  });
}

/**
 * Find the cut values that maximise the expected significance. Coordinate descent: each cut in turn is moved to its best threshold with the others held,
 * repeated until nothing improves, from "no cuts" and from `nStarts` random starting points; the best result wins.
 * Thresholds are tried at `nCandidates` quantiles of the signal distribution of the cut variable.
 */
export function selectionOptimiser(sig: OptSample, bkg: OptSample, specs: CutSpec[], opts: OptimiserOptions = {}): Selection {
  const flat = expand(specs);
  const minBkg = opts.minBkgEvents ?? 5;
  const cand = flat.map((c) => quantiles(sig, c.column, opts.nCandidates ?? 80));
  const loosest = (): CutValue[] =>
    flat.map((c, k) => ({ column: c.column, kind: c.kind, value: c.kind === 'min' ? (cand[k]![0] ?? -Infinity) - 1e-9 : (cand[k]![cand[k]!.length - 1] ?? Infinity) + 1e-9 }));
  const r = makeRng(opts.seed ?? 1);
  const starts: CutValue[][] = [opts.start ? opts.start.map((c) => ({ ...c })) : loosest()];
  for (let s = 0; s < (opts.nStarts ?? 3); s++) {
    starts.push(flat.map((c, k) => ({ column: c.column, kind: c.kind, value: cand[k]![Math.floor(r() * cand[k]!.length)] ?? 0 })));
  }
  const score = (cuts: CutValue[]): { z: number; sel: Selection } => {
    const sel = evaluateSelection(sig, bkg, cuts, opts);
    return { z: sel.nBkg >= minBkg && sel.nSig > 0 ? sel.z : -Infinity, sel };
  };
  let best: Selection | null = null;
  let bestZ = -Infinity;
  for (const start of starts) {
    let cuts = start;
    let cur = score(cuts);
    // A random start can violate the minimum-background condition: fall back on "no cuts".
    if (!Number.isFinite(cur.z)) {
      cuts = loosest();
      cur = score(cuts);
    }
    for (let sweep = 0; sweep < 8; sweep++) {
      let improved = false;
      for (let k = 0; k < cuts.length; k++) {
        const scan = scanCut(sig, bkg, cuts, k, cand[k]!, opts);
        let bi = -1, bz = cur.z;
        scan.forEach((pt, i) => {
          if (pt.z > bz + 1e-12) {
            bz = pt.z;
            bi = i;
          }
        });
        if (bi >= 0) {
          cuts = cuts.map((c, i) => (i === k ? { ...c, value: scan[bi]!.value } : c));
          cur = score(cuts);
          improved = true;
        }
      }
      if (!improved) break;
    }
    if (cur.z > bestZ) {
      bestZ = cur.z;
      best = cur.sel;
    }
  }
  return best ?? evaluateSelection(sig, bkg, loosest(), opts);
}

/**
 * The "par" significance of a cuts exercise: what a good reader gets. It is the optimum found by `selectionOptimiser` times `fraction` (default 0.9), so that a
 * sensible selection beats it without needing the exact optimum.
 */
export function parSignificance(sig: OptSample, bkg: OptSample, specs: CutSpec[], fraction = 0.9, opts: OptimiserOptions = {}): number {
  return fraction * selectionOptimiser(sig, bkg, specs, opts).z;
}

// ── blinding ─────────────────────────────────────────────────────────────────────────────────────

/** Thrown when blinded data are requested. */
export class BlindingError extends Error {
  constructor(what: string) {
    super(`The signal region is blinded: ${what}. Finish and freeze the analysis on simulation and sidebands first, then call unblind(reason).`);
    this.name = 'BlindingError';
  }
}

/**
 * Data with a blinded signal region. The analyst develops the selection and the background model on simulation and on the sidebands, freezes
 * them, and only then looks inside the window. The point is to stop the analysis from being tuned, even unconsciously, until a bump appears.
 * While blinded, nothing that depends on the events inside the region is returned: not the events, not their number, not a histogram bin.
 *
 *     const d = new BlindedSample(masses, [120, 130]);
 *     d.sidebands();               // fine
 *     d.signalRegion();            // throws BlindingError
 *     d.unblind('analysis frozen, approved at review 12');
 *     d.signalRegion();            // now returns the events
 */
export class BlindedSample {
  private readonly values: Float64Array;
  private open = false;
  /** What was done and why, in order. */
  readonly log: string[] = [];
  constructor(values: ArrayLike<number>, readonly region: [number, number], opts: { unblinded?: boolean } = {}) {
    this.values = Float64Array.from(values);
    if (opts.unblinded) this.unblind('constructed unblinded');
    else this.log.push(`blinded region [${region[0]}, ${region[1]}]`);
  }
  get blinded(): boolean {
    return !this.open;
  }
  private inRegion(x: number): boolean {
    return x >= this.region[0] && x <= this.region[1];
  }
  /** The events outside the region. Always available. */
  sidebands(): number[] {
    return Array.from(this.values).filter((x) => !this.inRegion(x));
  }
  /** The events inside the region. Throws while blinded. */
  signalRegion(): number[] {
    if (!this.open) throw new BlindingError('signalRegion()');
    return Array.from(this.values).filter((x) => this.inRegion(x));
  }
  /** All events. Throws while blinded. */
  all(): number[] {
    if (!this.open) throw new BlindingError('all()');
    return Array.from(this.values);
  }
  /** The number of events. Throws while blinded (the total would reveal the count inside the region). */
  count(): number {
    if (!this.open) throw new BlindingError('count()');
    return this.values.length;
  }
  /** A histogram of the data; while blinded the bins overlapping the region stay empty and the count is of sideband events only. */
  histogram(edges: ArrayLike<number>): Hist1D {
    const h = new Hist1D(edges);
    for (const x of this.values) {
      if (!this.open && this.inRegion(x)) continue;
      h.fill(x);
    }
    if (!this.open) {
      // Bins that straddle the region are also hidden, so that no bin reveals an edge count.
      for (let i = 0; i < h.nbins; i++) if (h.edges[i + 1]! > this.region[0] && h.edges[i]! < this.region[1]) { h.counts[i] = 0; h.sumw2[i] = 0; }
    }
    return h;
  }
  /** Open the box. Irreversible, and recorded. */
  unblind(reason: string): void {
    if (!reason.trim()) throw new Error('unblind(reason): say why the analysis is ready to be unblinded');
    this.open = true;
    this.log.push(`UNBLINDED: ${reason}`);
  }
}

/** Keep only the rows outside the blinded region of a column, or all rows if `unblinded`. */
export function blindTable(table: EventTable, column: string, region: [number, number], opts: { unblinded?: boolean } = {}): EventTable {
  if (opts.unblinded) return table;
  const col = table.col(column);
  return table.select((i) => !(col[i]! >= region[0] && col[i]! <= region[1]));
}
