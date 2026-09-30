/**
 * Trigger menus: a list of items, each with an L1 seed threshold, an HLT selection and a prescale. Evaluating a menu on events
 * gives decisions per event; evaluating it on weighted samples gives rates (rate = σ · L · efficiency) with their errors, the
 * overlaps between items, the bandwidth and the efficiency for named physics samples.
 *
 * A **prescale** N keeps one accepted event in N (applied here at Level 1, before the HLT): it is how a trigger with a huge rate
 * but a cheap physics case (low thresholds, B physics) is fitted in the budget, by recording a fraction of it.
 */
import type { DetectorEvent, RecoEvent } from '../event/index.ts';
import type { Rng } from '../random/index.ts';
import { MENU_KINDS, menuKind, type MenuKind } from './hlt.ts';
import { EVENT_SIZE_MB, l1Decision, l1InputFromDetector, l1InputFromReco, l1Variables, type Level1Input, type L1Variables } from './level1.ts';

export interface TriggerItem {
  name: string;
  /** The L1 seed: an item name (`SingleMu`, `DoubleMu_Low`, …) and its threshold in GeV; null for an HLT-only item. */
  l1: { item: string; threshold: number } | null;
  /** The HLT selection over reconstructed objects. */
  hlt: (reco: RecoEvent) => boolean;
  /** Keep 1 in N of the events that pass L1 (≥ 1). */
  prescale: number;
  /** Keep 1 in N of the events that pass the HLT selection (default 1). */
  hltPrescale?: number;
  /** Event size in MB when this item fires (default 1). */
  eventSizeMB?: number;
}
export interface TriggerMenu {
  name: string;
  items: TriggerItem[];
}

/** An event as the trigger sees it: reconstructed objects and, optionally, the detector output or a ready-made L1 input. */
export interface TriggerEvent {
  reco: RecoEvent;
  detector?: DetectorEvent;
  l1?: Level1Input;
  /** Weight within its sample (default 1). */
  weight?: number;
  /** Whether the event would be usable in an analysis (the final state is in the detector's acceptance). */
  fiducial?: boolean;
}

/** A sample: events from one process with its cross-section (pb). The events' weights share the cross-section. */
export interface Sample {
  name: string;
  label?: string;
  sigmaPb: number;
  events: TriggerEvent[];
  /** 'signal' samples are physics the experiment wants; 'background' are the rest. */
  role?: 'signal' | 'background';
}

/** The L1 input of an event: the one supplied, else built from the detector output, else from the reconstructed objects. */
export function l1InputOf(ev: TriggerEvent): Level1Input {
  return ev.l1 ?? (ev.detector ? l1InputFromDetector(ev.detector) : l1InputFromReco(ev.reco));
}

export interface EventDecision {
  /** Items that passed Level 1 / passed Level 1 and the HLT selection (before prescales). */
  l1Passed: string[];
  hltPassed: string[];
  /** Items that fired after prescales (counter mode: deterministic; random mode: seeded). */
  fired: string[];
  /** Expected probability (over prescales) that the event is accepted by L1 and by the HLT. */
  pL1: number;
  pHlt: number;
  /** Per item (menu order): probability of acceptance at L1 and at the HLT after prescales. */
  itemL1: number[];
  itemHlt: number[];
}

export interface EvaluateOptions {
  /** With an Rng, prescales are applied randomly with probability 1/N; without, a counter keeps every N-th event of each item. */
  rng?: Rng;
}

/**
 * Run a menu over events. The L1 step calls the (possibly overridden) `trigger.l1Decision` hook with one threshold per distinct L1
 * item name; the HLT step calls each item's selection.
 */
export function evaluateMenu(events: readonly TriggerEvent[], menu: TriggerMenu, opts: EvaluateOptions = {}): EventDecision[] {
  const thresholds: Record<string, number> = {};
  for (const it of menu.items) if (it.l1) thresholds[it.l1.item] = Math.min(thresholds[it.l1.item] ?? Infinity, it.l1.threshold);
  const counters = menu.items.map(() => [0, 0]);
  return events.map((ev) => {
    const fired1 = Object.keys(thresholds).length ? l1Decision(l1InputOf(ev), thresholds) : [];
    const l1Passed: string[] = [];
    const hltPassed: string[] = [];
    const fired: string[] = [];
    const itemL1: number[] = [];
    const itemHlt: number[] = [];
    let q1 = 1;
    let q2 = 1;
    menu.items.forEach((it, i) => {
      const l1Ok = it.l1 === null || fired1.includes(it.l1.item);
      const p1 = 1 / Math.max(1, it.prescale);
      const p2 = 1 / Math.max(1, it.hltPrescale ?? 1);
      if (l1Ok) l1Passed.push(it.name);
      const hltOk = l1Ok && it.hlt(ev.reco);
      if (hltOk) hltPassed.push(it.name);
      itemL1.push(l1Ok ? p1 : 0);
      itemHlt.push(hltOk ? p1 * p2 : 0);
      q1 *= 1 - (l1Ok ? p1 : 0);
      q2 *= 1 - (hltOk ? p1 * p2 : 0);
      // the actual prescale decisions
      if (l1Ok) {
        let keep1: boolean;
        if (opts.rng) keep1 = opts.rng() < p1;
        else keep1 = ++counters[i]![0]! % Math.max(1, it.prescale) === 0;
        if (keep1 && hltOk) {
          const keep2 = opts.rng ? opts.rng() < p2 : ++counters[i]![1]! % Math.max(1, it.hltPrescale ?? 1) === 0;
          if (keep2) fired.push(it.name);
        }
      }
    });
    return { l1Passed, hltPassed, fired, pL1: 1 - q1, pHlt: 1 - q2, itemL1, itemHlt };
  });
}

// ── Rates ──────────────────────────────────────────────────────────────────────────────────────

const PB_CM2 = 1e-36;
/** A rate in Hz: σ [pb] × L [cm⁻² s⁻¹] × efficiency. */
export const rateHz = (sigmaPb: number, lumi_cm2s: number, efficiency: number): number => sigmaPb * PB_CM2 * lumi_cm2s * efficiency;

/** Weighted mean of p (per-event values in [0, 1]) with its standard error; equal weights give the binomial error √(ε(1 − ε)/N). */
export function weightedEfficiency(weights: ArrayLike<number>, values: ArrayLike<number>): { eff: number; err: number } {
  let sw = 0;
  let swp = 0;
  for (let i = 0; i < weights.length; i++) { sw += weights[i]!; swp += weights[i]! * values[i]!; }
  if (sw === 0) return { eff: 0, err: 0 };
  const eff = swp / sw;
  let v = 0;
  for (let i = 0; i < weights.length; i++) v += (weights[i]! * (values[i]! - eff)) ** 2;
  return { eff, err: Math.sqrt(v) / sw };
}
/** The effective number of events of a weighted sample, (Σw)²/Σw². */
export function effectiveEvents(weights: ArrayLike<number>): number {
  let s = 0, s2 = 0;
  for (let i = 0; i < weights.length; i++) { s += weights[i]!; s2 += weights[i]! ** 2; }
  return s2 > 0 ? (s * s) / s2 : 0;
}

export interface ItemRate {
  name: string;
  /** Expected rate after prescales at L1 and after the HLT (Hz). */
  l1Rate: number;
  hltRate: number;
  /** Rates before prescales (Hz). */
  l1RateRaw: number;
  hltRateRaw: number;
  /** HLT rate of events that no other item would keep (before prescales). */
  hltUniqueRaw: number;
  hltError: number;
  l1Error: number;
}
export interface SampleRate {
  name: string;
  sigmaPb: number;
  l1Rate: number;
  hltRate: number;
  /** Efficiency of the whole menu (L1 and HLT, after prescales) for this sample, and its error. */
  efficiency: number;
  error: number;
  fiducialEfficiency: number;
  fiducialError: number;
}
export interface RateReport {
  items: ItemRate[];
  samples: SampleRate[];
  /** Total accepted rate of the menu (OR of the items, overlaps counted once), Hz. */
  l1Total: number;
  hltTotal: number;
  l1TotalError: number;
  hltTotalError: number;
  /** Fraction of time the detector is able to take data at this L1 rate. */
  liveFraction: number;
  /** HLT output bandwidth in MB/s, and the storage per day in TB. */
  bandwidthMBs: number;
  /** Item overlap: `overlap[i][j]` is the HLT rate (Hz, before prescales) of events passing both items. */
  overlap: number[][];
}
export interface RateOptions {
  /** Instantaneous luminosity in cm⁻² s⁻¹ (2 × 10³⁴ by default). */
  lumi?: number;
  /** Dead time per Level-1 accept in seconds (default 1.0 × 10⁻⁷: about four bunch crossings, an approximate value). */
  deadTimeS?: number;
  /** Decisions already computed by `evaluateMenu` (same order as the samples' events, concatenated); computed here if omitted. */
  decisions?: EventDecision[][];
}

/** The live fraction of a non-paralysable dead time τ after each accept at rate R: 1/(1 + Rτ). */
export const liveFraction = (rate: number, deadTimeS: number): number => 1 / (1 + rate * deadTimeS);

/** Rates for a menu from weighted samples: per item, in total with overlaps, per sample, with the dead time and the bandwidth. */
export function estimateRates(samples: readonly Sample[], menu: TriggerMenu, opts: RateOptions = {}): RateReport {
  const lumi = opts.lumi ?? 2e34;
  const nItems = menu.items.length;
  const items: ItemRate[] = menu.items.map((it) => ({ name: it.name, l1Rate: 0, hltRate: 0, l1RateRaw: 0, hltRateRaw: 0, hltUniqueRaw: 0, hltError: 0, l1Error: 0 }));
  const overlap = Array.from({ length: nItems }, () => new Array<number>(nItems).fill(0));
  const sampleRates: SampleRate[] = [];
  let l1Total = 0, hltTotal = 0, l1Var = 0, hltVar = 0, bandwidth = 0;
  samples.forEach((s, si) => {
    const dec = opts.decisions?.[si] ?? evaluateMenu(s.events, menu);
    const n = s.events.length;
    const w = new Float64Array(n);
    let sw = 0;
    for (let i = 0; i < n; i++) { w[i] = s.events[i]!.weight ?? 1; sw += w[i]!; }
    const scale = sw > 0 ? rateHz(s.sigmaPb, lumi, 1) / sw : 0; // Hz per unit weight
    const pL1 = new Float64Array(n), pH = new Float64Array(n);
    for (let i = 0; i < n; i++) { pL1[i] = dec[i]!.pL1; pH[i] = dec[i]!.pHlt; }
    const e1 = weightedEfficiency(w, pL1);
    const eH = weightedEfficiency(w, pH);
    // fiducial
    const fw = new Float64Array(n), fp = new Float64Array(n);
    let anyFid = false;
    for (let i = 0; i < n; i++) { const f = s.events[i]!.fiducial; if (f !== undefined) anyFid = true; fw[i] = f === false ? 0 : w[i]!; fp[i] = pH[i]!; }
    const eF = anyFid ? weightedEfficiency(fw, fp) : eH;
    const R = rateHz(s.sigmaPb, lumi, 1);
    l1Total += R * e1.eff;
    hltTotal += R * eH.eff;
    l1Var += (R * e1.err) ** 2;
    hltVar += (R * eH.err) ** 2;
    sampleRates.push({ name: s.name, sigmaPb: s.sigmaPb, l1Rate: R * e1.eff, hltRate: R * eH.eff, efficiency: eH.eff, error: eH.err, fiducialEfficiency: eF.eff, fiducialError: eF.err });
    for (let i = 0; i < nItems; i++) {
      const a = new Float64Array(n), b = new Float64Array(n);
      for (let k = 0; k < n; k++) { a[k] = dec[k]!.itemL1[i]!; b[k] = dec[k]!.itemHlt[i]!; }
      const l1e = weightedEfficiency(w, a);
      const he = weightedEfficiency(w, b);
      const it = items[i]!;
      it.l1Rate += R * l1e.eff;
      it.hltRate += R * he.eff;
      it.l1Error = Math.hypot(it.l1Error, R * l1e.err);
      it.hltError = Math.hypot(it.hltError, R * he.err);
      const ps = Math.max(1, menu.items[i]!.prescale) * Math.max(1, menu.items[i]!.hltPrescale ?? 1);
      const ps1 = Math.max(1, menu.items[i]!.prescale);
      it.l1RateRaw += R * l1e.eff * ps1;
      it.hltRateRaw += R * he.eff * ps;
    }
    // overlaps and unique raw rates, from the raw pass flags
    for (let k = 0; k < n; k++) {
      const d = dec[k]!;
      const pass = menu.items.map((it) => d.hltPassed.includes(it.name));
      const wk = w[k]! * scale;
      const count = pass.reduce((c, x) => c + (x ? 1 : 0), 0);
      for (let i = 0; i < nItems; i++) {
        if (!pass[i]) continue;
        if (count === 1) items[i]!.hltUniqueRaw += wk;
        for (let j = 0; j < nItems; j++) if (pass[j]) overlap[i]![j]! += wk;
      }
      // bandwidth: the event is written with the largest size among the items that pass
      let size = 0;
      for (let i = 0; i < nItems; i++) if (pass[i]) size = Math.max(size, menu.items[i]!.eventSizeMB ?? EVENT_SIZE_MB);
      bandwidth += wk * d.pHlt * size;
    }
  });
  const live = liveFraction(l1Total, opts.deadTimeS ?? 1e-7);
  return {
    items,
    samples: sampleRates,
    l1Total,
    hltTotal,
    l1TotalError: Math.sqrt(l1Var),
    hltTotalError: Math.sqrt(hltVar),
    liveFraction: live,
    bandwidthMBs: bandwidth,
    overlap,
  };
}

/** Data volume for an output rate and an event size: MB/s, GB/s and TB per day of continuous running. */
export function bandwidth(rateHz_: number, eventSizeMB = EVENT_SIZE_MB): { MBs: number; GBs: number; TBperDay: number } {
  const MBs = rateHz_ * eventSizeMB;
  return { MBs, GBs: MBs / 1000, TBperDay: (MBs * 86400) / 1e6 };
}

export interface PhysicsEfficiency {
  name: string;
  label?: string;
  /** Fraction of generated events kept (L1 + HLT, after prescales), with its binomial error. */
  efficiency: number;
  error: number;
  /** The same for events in the detector's acceptance (what an analysis could use). */
  fiducialEfficiency: number;
  fiducialError: number;
  /** The same at the Level-1 stage alone. */
  l1Efficiency: number;
}
/** The efficiency of a menu for each sample: how much of each kind of physics survives. */
export function physicsLost(menu: TriggerMenu, samples: readonly Sample[], decisions?: EventDecision[][]): PhysicsEfficiency[] {
  return samples.map((s, si) => {
    const dec = decisions?.[si] ?? evaluateMenu(s.events, menu);
    const n = s.events.length;
    const w = new Float64Array(n), pH = new Float64Array(n), p1 = new Float64Array(n), fw = new Float64Array(n);
    let anyFid = false;
    for (let i = 0; i < n; i++) {
      w[i] = s.events[i]!.weight ?? 1;
      pH[i] = dec[i]!.pHlt;
      p1[i] = dec[i]!.pL1;
      const f = s.events[i]!.fiducial;
      if (f !== undefined) anyFid = true;
      fw[i] = f === false ? 0 : w[i]!;
    }
    const e = weightedEfficiency(w, pH);
    const f = anyFid ? weightedEfficiency(fw, pH) : e;
    return { name: s.name, label: s.label, efficiency: e.eff, error: e.err, fiducialEfficiency: f.eff, fiducialError: f.err, l1Efficiency: weightedEfficiency(w, p1).eff };
  });
}

// ── Menu items from the catalogue ───────────────────────────────────────────────────────────────────

export interface ItemSetting {
  key: string;
  /** L1 threshold and HLT threshold in GeV, prescale ≥ 1, and whether the item is switched on. */
  l1Threshold: number;
  hltThreshold: number;
  prescale: number;
  enabled?: boolean;
}
/** A menu item from the catalogue with the given thresholds. */
export function itemFromSetting(s: ItemSetting): TriggerItem {
  const k = menuKind(s.key);
  return {
    name: k.key,
    l1: { item: k.l1Item, threshold: s.l1Threshold },
    hlt: (reco) => {
      const v = k.hltVariable(reco);
      return v > 0 && v >= s.hltThreshold;
    },
    prescale: s.prescale,
  };
}
/** A menu from catalogue settings (disabled items left out). */
export function menuFromSettings(name: string, settings: readonly ItemSetting[]): TriggerMenu {
  return { name, items: settings.filter((s) => s.enabled !== false).map(itemFromSetting) };
}

/**
 * A fast evaluator for the catalogue menus, for interactive use: the L1 and HLT variables of every event are computed once, and
 * changing a threshold or a prescale is then a comparison per event. Gives the same numbers as `estimateRates` and `physicsLost`
 * on `menuFromSettings` (tested).
 */
export class CatalogueEvaluator {
  readonly kinds: MenuKind[] = MENU_KINDS;
  private prepared: { sample: Sample; w: Float64Array; fid: Uint8Array; hasFid: boolean; l1: Float64Array; hlt: Float64Array; sumW: number }[];
  readonly samples: readonly Sample[];
  constructor(samples: readonly Sample[]) {
    this.samples = samples;
    const K = MENU_KINDS.length;
    this.prepared = samples.map((s) => {
      const n = s.events.length;
      const w = new Float64Array(n), fid = new Uint8Array(n), l1 = new Float64Array(n * K), hlt = new Float64Array(n * K);
      let hasFid = false, sumW = 0;
      s.events.forEach((ev, i) => {
        w[i] = ev.weight ?? 1;
        sumW += w[i]!;
        if (ev.fiducial !== undefined) hasFid = true;
        fid[i] = ev.fiducial === false ? 0 : 1;
        const v: L1Variables = l1Variables(l1InputOf(ev));
        MENU_KINDS.forEach((k, j) => {
          l1[i * K + j] = k.l1Variable(v);
          hlt[i * K + j] = k.hltVariable(ev.reco);
        });
      });
      return { sample: s, w, fid, hasFid, l1, hlt, sumW };
    });
  }
  /** Rates and efficiencies for settings (one per catalogue kind used; disabled ones are ignored). */
  evaluate(settings: readonly ItemSetting[], lumi = 2e34, deadTimeS = 1e-7): RateReport {
    const K = MENU_KINDS.length;
    const active = settings.filter((s) => s.enabled !== false).map((s) => ({ s, j: MENU_KINDS.findIndex((k) => k.key === s.key), p1: 1 / Math.max(1, s.prescale) }));
    const items: ItemRate[] = active.map((a) => ({ name: a.s.key, l1Rate: 0, hltRate: 0, l1RateRaw: 0, hltRateRaw: 0, hltUniqueRaw: 0, hltError: 0, l1Error: 0 }));
    const nA = active.length;
    const overlap = Array.from({ length: nA }, () => new Array<number>(nA).fill(0));
    const samples: SampleRate[] = [];
    let l1Total = 0, hltTotal = 0, l1Var = 0, hltVar = 0, bandwidth = 0;
    for (const p of this.prepared) {
      const n = p.w.length;
      const R = rateHz(p.sample.sigmaPb, lumi, 1);
      const scale = p.sumW > 0 ? R / p.sumW : 0;
      // running sums for the weighted efficiencies: Σ w p and Σ w² (p − ε)² need two passes; store p
      const pL1 = new Float64Array(n), pH = new Float64Array(n);
      const perItem1 = active.map(() => new Float64Array(n)), perItemH = active.map(() => new Float64Array(n));
      for (let i = 0; i < n; i++) {
        let q1 = 1, q2 = 1, count = 0;
        const pass: boolean[] = new Array(nA);
        for (let a = 0; a < nA; a++) {
          const { s, j, p1 } = active[a]!;
          const l1ok = p.l1[i * K + j]! > 0 && p.l1[i * K + j]! >= s.l1Threshold;
          const hv = p.hlt[i * K + j]!;
          const hok = l1ok && hv > 0 && hv >= s.hltThreshold;
          pass[a] = hok;
          if (hok) count++;
          perItem1[a]![i] = l1ok ? p1 : 0;
          perItemH[a]![i] = hok ? p1 : 0;
          q1 *= 1 - (l1ok ? p1 : 0);
          q2 *= 1 - (hok ? p1 : 0);
        }
        pL1[i] = 1 - q1;
        pH[i] = 1 - q2;
        const wk = p.w[i]! * scale;
        for (let a = 0; a < nA; a++) {
          if (!pass[a]) continue;
          if (count === 1) items[a]!.hltUniqueRaw += wk;
          for (let b = 0; b < nA; b++) if (pass[b]) overlap[a]![b]! += wk;
        }
        if (count > 0) bandwidth += wk * pH[i]! * EVENT_SIZE_MB;
      }
      const e1 = weightedEfficiency(p.w, pL1);
      const eH = weightedEfficiency(p.w, pH);
      const fw = p.hasFid ? Float64Array.from(p.w, (w, i) => (p.fid[i] ? w : 0)) : p.w;
      const eF = p.hasFid ? weightedEfficiency(fw, pH) : eH;
      l1Total += R * e1.eff; hltTotal += R * eH.eff;
      l1Var += (R * e1.err) ** 2; hltVar += (R * eH.err) ** 2;
      samples.push({ name: p.sample.name, sigmaPb: p.sample.sigmaPb, l1Rate: R * e1.eff, hltRate: R * eH.eff, efficiency: eH.eff, error: eH.err, fiducialEfficiency: eF.eff, fiducialError: eF.err });
      active.forEach((a, idx) => {
        const x1 = weightedEfficiency(p.w, perItem1[idx]!);
        const xh = weightedEfficiency(p.w, perItemH[idx]!);
        const it = items[idx]!;
        it.l1Rate += R * x1.eff;
        it.hltRate += R * xh.eff;
        it.l1RateRaw += R * x1.eff / a.p1;
        it.hltRateRaw += R * xh.eff / a.p1;
        it.l1Error = Math.hypot(it.l1Error, R * x1.err);
        it.hltError = Math.hypot(it.hltError, R * xh.err);
      });
    }
    return { items, samples, l1Total, hltTotal, l1TotalError: Math.sqrt(l1Var), hltTotalError: Math.sqrt(hltVar), liveFraction: liveFraction(l1Total, deadTimeS), bandwidthMBs: bandwidth, overlap };
  }
}
