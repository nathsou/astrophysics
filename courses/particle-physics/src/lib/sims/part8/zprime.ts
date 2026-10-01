/**
 * The engine of the search sandbox (Chapter 32): a hypothetical heavy Z′ decaying to two muons, looked for in the dimuon mass spectrum on top of the
 * Drell–Yan background, with the limit set by `hep/analysis`. Everything here is SIMULATED and a TOY:
 *
 *  - The hard processes come from `hep/gen`: `pp->Zprime->mumu` (the sequential Z′, signal only) and Drell–Yan Z/γ* → μμ (the background), at leading order with
 *    the course's own parton distributions, at √s = 13.6 TeV. No shower, no hadronisation, no pile-up.
 *  - The "detector" is a selection and a smearing, not the course's detector simulation: both muons need |η| < 2.4 and pT > 30 GeV, each is found with 95 %
 *    efficiency, and the mass is smeared by a Gaussian of relative width 2 % ⊕ 2 % × (m/TeV) (about 3 % at 1 TeV, 8 % at 3 TeV, 12 % at 5 TeV).
 *  - The background is the leading-order Drell–Yan spectrum, without the other backgrounds of a real search (tt̄, dibosons, misidentified or mismeasured muons) and without K-factors.
 *  - Couplings: the Z′ couples to every fermion like the Z does, times a factor g (so g = 1 is the "sequential" Z′). The width follows from the couplings; the
 *    signal rate scales as g² (narrow-width approximation, interference neglected, `signalOnly`).
 * The fixed seeds make every number reproducible; the tests recompute them.
 */
import { drellYan, zPrime, zPrimeWidth } from '$lib/hep/gen';
import { rng as makeRng } from '$lib/hep/random';
import { eta, pt } from '$lib/hep/kinematics';
import { upperLimit, clsModel, asimovData, type CountingModel } from '$lib/hep/analysis';
import type { TruthEvent } from '$lib/hep/event';

export const SQRT_S = 13600;
/** The selection (toy). */
export const SELECTION = { etaMax: 2.4, ptMin: 30, muonEfficiency: 0.95 } as const;
/** Relative mass resolution of the toy detector at mass m (GeV). */
export const massResolution = (m: number): number => Math.hypot(0.02, 0.02 * (m / 1000));

/** Analysis bins: 40 logarithmic bins from 500 GeV to 7 TeV. */
export const N_BINS = 40;
export const M_LO = 500;
export const M_HI = 7000;
export const EDGES: number[] = Array.from({ length: N_BINS + 1 }, (_, i) => M_LO * Math.pow(M_HI / M_LO, i / N_BINS));

/** The invariant mass of the two final-state muons of a truth event, if both pass the toy selection; else null. */
export function acceptedMass(ev: TruthEvent): number | null {
  const mu = ev.particles.filter((p) => Math.abs(p.pdg) === 13 && p.status === 'final');
  if (mu.length !== 2) return null;
  for (const m of mu) if (Math.abs(eta(m.p)) >= SELECTION.etaMax || pt(m.p) <= SELECTION.ptMin) return null;
  const E = mu[0]!.p.E + mu[1]!.p.E, px = mu[0]!.p.px + mu[1]!.p.px, py = mu[0]!.p.py + mu[1]!.p.py, pz = mu[0]!.p.pz + mu[1]!.p.pz;
  const m2 = E * E - px * px - py * py - pz * pz;
  return m2 > 0 ? Math.sqrt(m2) : null;
}

// ── background ──────────────────────────────────────────────────────────────────────────────────

interface Slice {
  lo: number;
  hi: number;
  /** σ in pb of the slice, times acceptance and efficiency. */
  sigmaAcc: number;
}
export interface Background {
  slices: Slice[];
  /** The expected number of accepted Drell–Yan events in each analysis bin for an integrated luminosity in pb⁻¹. */
  counts(lumiPb: number): number[];
  /** Total σ × acceptance × efficiency (pb) above a mass. */
  sigmaAbove(m: number): number;
}

const SLICES = 30;
const M_SLICE_LO = 300;
let bkgPromise: Promise<Background> | null = null;

/** Build the Drell–Yan background table (about 2 s once; cached). `progress` is called with the fraction done; the loop yields to the browser between slices. */
export function getBackground(progress?: (f: number) => void): Promise<Background> {
  if (!bkgPromise) bkgPromise = build(progress);
  return bkgPromise;
}
/** The same, synchronously (for tests and scripts). */
export function buildBackgroundSync(): Background {
  const r = makeRng(5);
  const slices: Slice[] = [];
  for (let i = 0; i < SLICES; i++) slices.push(oneSlice(i, r));
  return finish(slices);
}
function edgeOf(i: number): number {
  return M_SLICE_LO * Math.pow(M_HI / M_SLICE_LO, i / SLICES);
}
function oneSlice(i: number, r: ReturnType<typeof makeRng>): Slice {
  const lo = edgeOf(i), hi = edgeOf(i + 1);
  const p = drellYan({ mMin: lo, mMax: hi });
  const sigma = p.sigma(SQRT_S);
  const N = 300;
  let acc = 0;
  for (let k = 0; k < N; k++) if (acceptedMass(p.generate(r, { sqrtS: SQRT_S }).event) !== null) acc++;
  return { lo, hi, sigmaAcc: (sigma * (acc / N)) * SELECTION.muonEfficiency ** 2 };
}
async function build(progress?: (f: number) => void): Promise<Background> {
  const r = makeRng(5);
  const slices: Slice[] = [];
  for (let i = 0; i < SLICES; i++) {
    slices.push(oneSlice(i, r));
    progress?.((i + 1) / SLICES);
    await new Promise<void>((res) => setTimeout(res, 0));
  }
  return finish(slices);
}
function finish(slices: Slice[]): Background {
  // dσ/dm in each slice, interpolated linearly in (ln m, ln dσ/dm) between slice centres.
  const cx = slices.map((s) => Math.log(Math.sqrt(s.lo * s.hi)));
  const cy = slices.map((s) => Math.log(s.sigmaAcc / (s.hi - s.lo)));
  const dsdm = (m: number): number => {
    const x = Math.log(m);
    let k = 0;
    while (k < cx.length - 2 && cx[k + 1]! < x) k++;
    const t = (x - cx[k]!) / (cx[k + 1]! - cx[k]!);
    return Math.exp(cy[k]! + t * (cy[k + 1]! - cy[k]!));
  };
  const binSigma = EDGES.slice(0, N_BINS).map((lo, j) => {
    const hi = EDGES[j + 1]!;
    // Simpson over the bin in m
    const mid = 0.5 * (lo + hi);
    return ((hi - lo) / 6) * (dsdm(lo) + 4 * dsdm(mid) + dsdm(hi));
  });
  return {
    slices,
    counts: (lumiPb) => binSigma.map((s) => s * lumiPb),
    sigmaAbove: (m) => {
      let s = 0;
      for (const sl of slices) if (sl.lo >= m) s += sl.sigmaAcc;
      return s;
    },
  };
}

// ── signal ──────────────────────────────────────────────────────────────────────────────────────

export interface SignalTemplate {
  mass: number;
  /** σ × BR(μμ) in pb for g = 1 (the sequential Z′), from the analytic integral. */
  sigmaPb: number;
  /** Full width in GeV for g = 1. */
  width: number;
  /** Fraction of generated events that pass the selection (including efficiency). */
  acceptance: number;
  /** For each analysis bin, the fraction of all generated events landing in it after selection and smearing. */
  fractions: number[];
}

const templates = new Map<number, SignalTemplate>();
const N_SIGNAL = 1500;

/** The signal template at a mass (GeV): generated once per mass with a fixed seed and cached. */
export function signalTemplate(mass: number): SignalTemplate {
  const hit = templates.get(mass);
  if (hit) return hit;
  const p = zPrime({ mass }, { signalOnly: true });
  const sigmaPb = p.sigma(SQRT_S);
  const r = makeRng(1000 + Math.round(mass));
  const fractions = new Array<number>(N_BINS).fill(0);
  let acc = 0;
  const gauss = () => {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  for (let k = 0; k < N_SIGNAL; k++) {
    const m = acceptedMass(p.generate(r, { sqrtS: SQRT_S }).event);
    if (m === null) continue;
    const ms = m * (1 + massResolution(m) * gauss());
    if (ms < M_LO || ms >= M_HI) continue;
    let j = Math.floor((Math.log(ms / M_LO) / Math.log(M_HI / M_LO)) * N_BINS);
    j = Math.min(N_BINS - 1, Math.max(0, j));
    fractions[j]! += SELECTION.muonEfficiency ** 2 / N_SIGNAL;
    acc += SELECTION.muonEfficiency ** 2 / N_SIGNAL;
  }
  const t: SignalTemplate = { mass, sigmaPb, width: zPrimeWidth({ mass }), acceptance: acc, fractions };
  templates.set(mass, t);
  return t;
}

// ── statistics ──────────────────────────────────────────────────────────────────────────────────

/** The counting model for a signal template (μ = 1 means g = 1) and a background, at an integrated luminosity in fb⁻¹ and a background uncertainty. */
export function makeModel(t: SignalTemplate, bkg: Background, lumiFb: number, relUnc: number): CountingModel {
  const lumiPb = lumiFb * 1000;
  return {
    signal: t.fractions.map((f) => f * t.sigmaPb * lumiPb),
    background: bkg.counts(lumiPb),
    ...(relUnc > 0 ? { nuisance: { name: 'bkg', relUnc } } : {}),
  };
}

/** Pseudo-data: Poisson counts of background plus (optionally) a signal of strength μ = g², with a seed. */
export function pseudoData(model: CountingModel, mu: number, seed: number): number[] {
  const r = makeRng(seed);
  const pois = (mean: number): number => {
    if (mean > 500) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss01(r)));
    const L = Math.exp(-mean);
    let k = 0, p = 1;
    do {
      k++;
      p *= r();
    } while (p > L);
    return k - 1;
  };
  return model.background.map((b, i) => pois(b + mu * model.signal[i]!));
}
function gauss01(r: ReturnType<typeof makeRng>): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export interface LimitPoint {
  mass: number;
  /** Limits on the coupling factor g: the square roots of the limits on the signal strength μ = g². */
  observed: number;
  expected: number;
  m1: number;
  p1: number;
  /** The limit on σ × BR in fb, for the same three cases. */
  observedFb: number;
  expectedFb: number;
}

/** The 95 % CL limits at one mass, from the observed pseudo-data and from the background-only expectation (Asimov). */
export function limitAt(mass: number, bkg: Background, lumiFb: number, relUnc: number, data: number[]): LimitPoint {
  const t = signalTemplate(mass);
  const model = makeModel(t, bkg, lumiFb, relUnc);
  const exp = upperLimit(model, asimovData(model, 0), { method: 'asymptotic' });
  const obs = upperLimit(model, data, { method: 'asymptotic' });
  const fb = t.sigmaPb * 1000;
  return {
    mass,
    observed: Math.sqrt(obs.observed),
    expected: Math.sqrt(exp.expected.median),
    m1: Math.sqrt(exp.expected.m1),
    p1: Math.sqrt(exp.expected.p1),
    observedFb: obs.observed * fb,
    expectedFb: exp.expected.median * fb,
  };
}

/** CLs of the hypothesis "a Z′ of mass M and coupling g exists", given the data. */
export function clsOf(mass: number, g: number, bkg: Background, lumiFb: number, relUnc: number, data: number[]): number {
  const model = makeModel(signalTemplate(mass), bkg, lumiFb, relUnc);
  return clsModel(model, data, g * g, { method: 'asymptotic' }).cls;
}
