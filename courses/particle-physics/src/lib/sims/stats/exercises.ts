/**
 * The logic behind the two analysis exercises (`CutsExercise.svelte`, `FitExercise.svelte`), as plain TypeScript so that it can be tested and so that
 * a chapter author can compute a `par` or an `answer` from the same code the reader's page runs.
 *
 * ── cuts ──
 *   config:     the sample description (see `samples.ts`): { seed, signal: { events, yield, vars }, background: { … }, bkgRelUnc?, minBkgEvents? }
 *               (`sample` is accepted as a synonym for `config`)
 *   variables:  what the reader may cut on: [{ name, label?, unit?, kind: 'window' | 'min' | 'max', lo, hi, step? }]; lo and hi bound the slider
 *   par:        the expected significance to reach (a number), or "auto" / absent to use 0.9 × the optimum found by `selectionOptimiser`
 *
 * ── fit ──
 *   model:      the default fit model, "gauss+exp" (see `namedModel` in hep/analysis)
 *   data:       { seed, range: [lo, hi], bins, model?, truth: { 'sig.yield': 300, 'sig.mean': 125, … } (for the model that generates the data; default `model`) }
 *               or { range, counts: [...] } with explicit counts
 *   config:     { backgrounds?: ['flat', 'exp', 'cheb2'], signals?: ['gauss', 'cb'], parameter?: 'sig.yield', rangeEditable?: boolean,
 *                 methods?: ['nll', 'chi2'], minPValue?: number, start?: { 'sig.mean': 124 } }
 *   tolerance:  relative (a number, default 0.05), or { abs: 10 }
 *   answer:     the expected value of `config.parameter` (a number), or { 'sig.yield': 312, … } to check several parameters
 */
import {
  Hist1D,
  evaluateSelection,
  fitBinned,
  fitChi2,
  guessStart,
  namedModel,
  poissonSample,
  selectionOptimiser,
  type CutSpec,
  type CutValue,
  type FitResult,
  type Model,
  type OptSample,
  type Selection,
} from '$lib/hep/analysis';
import { rng as makeRng } from '$lib/hep/random';
import { generateSamples, type SampleConfig } from './samples';

// ── cuts ─────────────────────────────────────────────────────────────────────────────────────────

export interface CutVariable {
  name: string;
  label?: string;
  unit?: string;
  kind: 'window' | 'min' | 'max';
  lo: number;
  hi: number;
  step?: number;
}

export interface CutsSpecData {
  config?: SampleConfig & { minBkgEvents?: number };
  sample?: SampleConfig & { minBkgEvents?: number };
  variables?: CutVariable[];
  par?: number | 'auto';
}

/** The state of the controls: for each variable, [a, b] (window: both; min: a; max: b). */
export type CutState = Record<string, [number, number]>;

export function defaultCutState(vars: CutVariable[]): CutState {
  return Object.fromEntries(vars.map((v) => [v.name, [v.lo, v.hi] as [number, number]]));
}

/** The optimiser's cut list for the controls; a cut at its slider limit is left out (it removes nothing). */
export function cutsFromState(vars: CutVariable[], state: CutState): CutValue[] {
  const out: CutValue[] = [];
  for (const v of vars) {
    const [a, b] = state[v.name] ?? [v.lo, v.hi];
    if (v.kind !== 'max' && a > v.lo) out.push({ column: v.name, kind: 'min', value: a });
    if (v.kind !== 'min' && b < v.hi) out.push({ column: v.name, kind: 'max', value: b });
  }
  return out;
}

export interface CutsProblem {
  sig: OptSample;
  bkg: OptSample;
  variables: CutVariable[];
  minBkgEvents: number;
  bkgRelUnc: number;
  /** The par given by the spec, or undefined when it is to be computed. */
  par: number | undefined;
}

export function buildCutsProblem(spec: CutsSpecData): CutsProblem {
  const cfg = spec.sample ?? spec.config;
  if (!cfg) throw new Error('cuts exercise: give `config` (the sample description)');
  const { sig, bkg } = generateSamples(cfg);
  const variables = spec.variables ?? Object.keys(cfg.signal.vars).map((name) => ({ name, kind: 'window' as const, lo: 0, hi: 1 }));
  return { sig, bkg, variables, minBkgEvents: cfg.minBkgEvents ?? 5, bkgRelUnc: cfg.bkgRelUnc ?? 0, par: typeof spec.par === 'number' ? spec.par : undefined };
}

export function evaluateCuts(p: CutsProblem, state: CutState): Selection {
  return evaluateSelection(p.sig, p.bkg, cutsFromState(p.variables, state), { bkgRelUnc: p.bkgRelUnc });
}

/** The sequential cutflow: after no cuts, then after the first variable, the first two, and so on. */
export function cutflowRows(p: CutsProblem, state: CutState): { name: string; s: number; b: number; z: number; nBkg: number }[] {
  const rows: { name: string; s: number; b: number; z: number; nBkg: number }[] = [];
  const first = evaluateSelection(p.sig, p.bkg, [], { bkgRelUnc: p.bkgRelUnc });
  rows.push({ name: 'no cuts', s: first.s, b: first.b, z: first.z, nBkg: first.nBkg });
  const applied: CutVariable[] = [];
  for (const v of p.variables) {
    applied.push(v);
    const sel = evaluateSelection(p.sig, p.bkg, cutsFromState(applied, state), { bkgRelUnc: p.bkgRelUnc });
    rows.push({ name: v.label ?? v.name, s: sel.s, b: sel.b, z: sel.z, nBkg: sel.nBkg });
  }
  return rows;
}

/** The best selection the optimiser finds for the problem's variables. */
export function optimumFor(p: CutsProblem): Selection {
  const specs: CutSpec[] = p.variables.map((v) => ({ column: v.name, kind: v.kind }));
  return selectionOptimiser(p.sig, p.bkg, specs, { bkgRelUnc: p.bkgRelUnc, minBkgEvents: p.minBkgEvents, nCandidates: 60, nStarts: 2 });
}

/** The par to beat: the spec's, else 90 % of the optimum. */
export function parFor(p: CutsProblem): number {
  return p.par ?? 0.9 * optimumFor(p).z;
}

export function checkCuts(p: CutsProblem, state: CutState, par: number): { ok: boolean; z: number; message: string } {
  const sel = evaluateCuts(p, state);
  if (sel.nBkg < p.minBkgEvents) return { ok: false, z: sel.z, message: `Only ${sel.nBkg} simulated background events survive: too few to trust the estimate of b. Loosen a cut.` };
  if (!(sel.nSig > 0)) return { ok: false, z: 0, message: 'No signal survives.' };
  if (sel.z >= par) return { ok: true, z: sel.z, message: `Expected significance ${sel.z.toFixed(2)}σ, at or above the par of ${par.toFixed(2)}σ.` };
  return { ok: false, z: sel.z, message: `Expected significance ${sel.z.toFixed(2)}σ; the par is ${par.toFixed(2)}σ.` };
}

// ── fits ─────────────────────────────────────────────────────────────────────────────────────────

export interface FitSpecData {
  model?: string;
  data: {
    seed?: number;
    range: [number, number];
    bins?: number;
    model?: string;
    truth?: Record<string, number>;
    counts?: number[];
    xLabel?: string;
    unit?: string;
  };
  config?: {
    backgrounds?: string[];
    signals?: string[];
    parameter?: string;
    rangeEditable?: boolean;
    methods?: ('nll' | 'chi2')[];
    minPValue?: number;
    start?: Record<string, number>;
  };
  tolerance?: number | { abs?: number; rel?: number };
  answer: number | Record<string, number>;
}

export interface FitProblem {
  hist: Hist1D;
  range: [number, number];
  defaultModel: string;
  signals: string[];
  backgrounds: string[];
  parameter: string;
  methods: ('nll' | 'chi2')[];
  rangeEditable: boolean;
  minPValue: number | undefined;
  start: Record<string, number>;
  xLabel: string;
  unit: string;
  /** The true parameters, when the data were generated from a model (for the solution display only). */
  truth?: Record<string, number>;
}

export function buildFitProblem(spec: FitSpecData): FitProblem {
  const d = spec.data;
  const defaultModel = spec.model ?? 'gauss+exp';
  const [lo, hi] = d.range;
  let hist: Hist1D;
  if (d.counts) {
    hist = new Hist1D(d.counts.length, lo, hi);
    d.counts.forEach((c, i) => {
      hist.counts[i] = c;
      hist.sumw2[i] = c;
      hist.entries += c;
    });
  } else {
    const nb = d.bins ?? 60;
    hist = new Hist1D(nb, lo, hi);
    const truthModel: Model = namedModel(d.model ?? defaultModel);
    const t = d.truth;
    if (!t) throw new Error('fit exercise: give data.truth (or data.counts)');
    const p = truthModel.paramNames.map((nm) => {
      const v = t[nm];
      if (v === undefined) throw new Error(`fit exercise: data.truth lacks ${nm}`);
      return v;
    });
    const r = makeRng(d.seed ?? 1);
    truthModel.binned(p, Array.from(hist.edges)).forEach((nu, i) => {
      const n = poissonSample(r, nu);
      hist.counts[i] = n;
      hist.sumw2[i] = n;
      hist.entries += n;
    });
  }
  const [defSig, defBkg] = defaultModel.includes('+') ? defaultModel.split('+') : ['gauss', defaultModel];
  const c = spec.config ?? {};
  return {
    hist,
    range: [lo, hi],
    defaultModel,
    signals: c.signals ?? [defSig!],
    backgrounds: c.backgrounds ?? [defBkg!],
    parameter: c.parameter ?? (typeof spec.answer === 'object' ? Object.keys(spec.answer)[0]! : 'sig.yield'),
    methods: c.methods ?? ['nll'],
    rangeEditable: !!c.rangeEditable,
    minPValue: c.minPValue,
    start: c.start ?? {},
    xLabel: d.xLabel ?? 'x',
    unit: d.unit ?? '',
    truth: d.truth,
  };
}

export interface FitChoice {
  signal: string;
  background: string;
  range: [number, number];
  method: 'nll' | 'chi2';
}

/** Fit the chosen model to the data, from a starting point found by `guessStart` (overridden by `config.start`). */
export function runExerciseFit(p: FitProblem, choice: FitChoice): { fit: FitResult; model: Model } {
  const model = namedModel(`${choice.signal}+${choice.background}`);
  const p0 = guessStart(p.hist, model);
  model.paramNames.forEach((nm, i) => {
    if (p.start[nm] !== undefined) p0[i] = p.start[nm]!;
  });
  const opts = { range: choice.range };
  const fit = choice.method === 'nll' ? fitBinned(p.hist, model, p0, opts) : fitChi2(p.hist, model, p0, opts);
  return { fit, model };
}

export function checkFit(spec: FitSpecData, p: FitProblem, fit: FitResult): { ok: boolean; message: string } {
  if (!fit.converged) return { ok: false, message: 'The fit did not converge. Try another model or a different range.' };
  const answers: Record<string, number> = typeof spec.answer === 'number' ? { [p.parameter]: spec.answer } : spec.answer;
  const tol = typeof spec.tolerance === 'object' ? spec.tolerance : { rel: spec.tolerance ?? 0.05 };
  const misses: string[] = [];
  for (const [name, target] of Object.entries(answers)) {
    const i = fit.names.indexOf(name);
    if (i < 0) return { ok: false, message: `The model you chose has no parameter ${name}.` };
    const v = fit.params[i]!;
    const limit = tol.abs !== undefined ? tol.abs : Math.abs(target) * (tol.rel ?? 0.05);
    if (!(Math.abs(v - target) <= limit)) misses.push(`${name} = ${Number(v.toPrecision(4))} is outside the accepted range`);
  }
  if (misses.length) return { ok: false, message: misses.join('; ') + '.' };
  if (p.minPValue !== undefined && Number.isFinite(fit.pValue) && fit.pValue < p.minPValue) {
    return { ok: false, message: `The parameter is right, but the model does not describe the data (p = ${fit.pValue.toPrecision(2)} < ${p.minPValue}).` };
  }
  return { ok: true, message: 'The fitted value is within the accepted range.' };
}
