/**
 * The Higgs analyses of Chapter 29, as plain TypeScript (no DOM): decoders for the simulated samples made by scripts/data/higgs-sim.ts, the real CMS
 * four-lepton data made by scripts/data/h4l.py, the selections, the cut flows, the pseudo-data sets and the fits.
 *
 * ONE ANALYSIS, TWO SOURCES. `analyse4l` takes four leptons as `{ pdg, charge, p4 }` and does not know whether they were simulated by the course or
 * recorded by CMS. The same function runs on both.
 *
 * Simulated: the γγ and 4ℓ samples (hep/gen → hep/detector → hep/reco → hep/trigger). Real: the CMS four-lepton candidates (record 545 of the CERN Open Data
 * portal, as mirrored). There is no real diphoton sample in the course (see `loadRealDiphoton`).
 */
import {
  Hist1D,
  bernstein,
  erf,
  exponential,
  extendedModel,
  fitBinned,
  fitLikelihood,
  gaussian,
  normalCdf,
  poissonSample,
  pToZ,
  poissonTail,
  type FitResult,
  type Model,
  type Shape,
} from '../../hep/analysis/index.ts';
import { rng as makeRng } from '../../hep/random/index.ts';
import type { P4 } from '../../hep/kinematics/index.ts';
import { fromPtEtaPhiM, pairMass } from '../../hep/kinematics/index.ts';

// ── the simulated diphoton sample ───────────────────────────────────────────────────────────────────

export interface Photon { pt: number; eta: number; phi: number; isoTrack: number; isoCalo: number }
export interface PhotonPair { signal: boolean; trigger: boolean; a: Photon; b: Photon }
export interface DiphotonManifest {
  samples: {
    signal: { sigmaLO_pb: number; kFactorToApply: number; generated: number; twoPhotons: number; triggered: number; mH_GeV: number };
    background: { sigmaFiltered_pb: number; generated: number; twoPhotons: number; triggered: number; poolLuminosity_fb: number };
  };
  [k: string]: unknown;
}
export interface DiphotonSample {
  signal: PhotonPair[];
  background: PhotonPair[];
  manifest: DiphotonManifest;
}

const STRIDE_GG = 11;
export function parseDiphoton(buffer: ArrayBuffer, manifest: DiphotonManifest): DiphotonSample {
  const v = new Int16Array(buffer);
  const n = v.length / STRIDE_GG;
  const signal: PhotonPair[] = [];
  const background: PhotonPair[] = [];
  const ph = (o: number): Photon => ({ pt: v[o]! / 40, eta: v[o + 1]! / 4000, phi: v[o + 2]! / 4000, isoTrack: v[o + 3]! / 2000, isoCalo: v[o + 4]! / 2000 });
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE_GG;
    const flags = v[o]!;
    const pair: PhotonPair = { signal: (flags & 1) === 1, trigger: (flags & 2) === 2, a: ph(o + 1), b: ph(o + 6) };
    (pair.signal ? signal : background).push(pair);
  }
  return { signal, background, manifest };
}

export async function loadDiphoton(base = ''): Promise<DiphotonSample> {
  const [bin, man] = await Promise.all([fetch(`${base}/data/higgs-gamgam-sim.bin`), fetch(`${base}/data/higgs-gamgam-sim.manifest.json`)]);
  if (!bin.ok || !man.ok) throw new Error(`could not load the simulated diphoton sample (${bin.status}, ${man.status})`);
  return parseDiphoton(await bin.arrayBuffer(), (await man.json()) as DiphotonManifest);
}

/** The invariant mass of two massless particles from their pT, η and φ: m² = 2 pT1 pT2 (cosh Δη − cos Δφ). */
export function massOf(a: { pt: number; eta: number; phi: number }, b: { pt: number; eta: number; phi: number }): number {
  const m2 = 2 * a.pt * b.pt * (Math.cosh(a.eta - b.eta) - Math.cos(a.phi - b.phi));
  return Math.sqrt(Math.max(0, m2));
}

export interface DiphotonCuts {
  /** Require the trigger flag. */
  trigger: boolean;
  etaMax: number;
  /** pT of the leading photon above this fraction of mγγ, and of the second above the other (the experiments use fractions of the mass, so that the selection does not sculpt the spectrum). */
  ptFrac1: number;
  ptFrac2: number;
  isoTrackMax: number;
  isoCaloMax: number;
  mLo: number;
  mHi: number;
}
export const DEFAULT_GG_CUTS: DiphotonCuts = { trigger: true, etaMax: 2.4, ptFrac1: 1 / 3, ptFrac2: 1 / 4, isoTrackMax: 0.15, isoCaloMax: 0.5, mLo: 105, mHi: 160 };

export const GG_STAGES = ['Produced in the window (generator)', 'Two reconstructed photons', 'Trigger', '|η| < 2.4 for both', 'pT > m/3 and m/4', 'Isolated', '105 < mγγ < 160 GeV'] as const;

/** How many of the stages 1 to 6 of `GG_STAGES` the event passes in order (1 = it has two reconstructed photons and nothing more; 6 = it is selected). */
export function diphotonStage(e: PhotonPair, c: DiphotonCuts): number {
  if (c.trigger && !e.trigger) return 1;
  if (Math.abs(e.a.eta) > c.etaMax || Math.abs(e.b.eta) > c.etaMax) return 2;
  const m = massOf(e.a, e.b);
  const [hi, lo] = e.a.pt >= e.b.pt ? [e.a, e.b] : [e.b, e.a];
  if (hi.pt < c.ptFrac1 * m || lo.pt < c.ptFrac2 * m) return 3;
  if (e.a.isoTrack > c.isoTrackMax || e.b.isoTrack > c.isoTrackMax || e.a.isoCalo > c.isoCaloMax || e.b.isoCalo > c.isoCaloMax) return 4;
  if (m < c.mLo || m > c.mHi) return 5;
  return 6;
}
/** The stage index at which the cut flow counts the selected events. */
export const GG_SELECTED = 6;

/** Expected numbers of signal and continuum events at each stage, for the whole pool (the luminosity of `manifest`), with the signal scaled by μ (μ = 1: the Standard Model with the K factor). */
export function diphotonCutflow(s: DiphotonSample, c: DiphotonCuts, mu = 1): { name: string; signal: number; background: number }[] {
  const sg = s.manifest.samples.signal;
  const bg = s.manifest.samples.background;
  const lumiPb = bg.poolLuminosity_fb * 1000;
  const sigProduced = sg.sigmaLO_pb * sg.kFactorToApply * lumiPb * mu;
  const wS = sigProduced / sg.generated;
  const nS = new Array<number>(7).fill(0);
  const nB = new Array<number>(7).fill(0);
  for (const e of s.signal) { const st = diphotonStage(e, c); for (let k = 1; k <= st; k++) nS[k]!++; }
  for (const e of s.background) { const st = diphotonStage(e, c); for (let k = 1; k <= st; k++) nB[k]!++; }
  return GG_STAGES.map((name, i) => (i === 0 ? { name, signal: sigProduced, background: bg.generated } : { name, signal: nS[i]! * wS, background: nB[i]! }));
}

export interface DatasetOptions { mu: number; fraction: number; seed: number }
export interface DrawnEvent { m: number; signal: boolean; event: PhotonPair }
/**
 * A simulated data set: the continuum events of the pool, each kept with probability `fraction` (fraction = 1 is the whole pool, the 9.9 fb⁻¹ of the manifest;
 * a smaller fraction understates the fluctuations a little, by the factor 1 − fraction in the variance), plus a Poisson number of signal events drawn
 * without replacement from the signal pool (mean: the cross-section times K times the luminosity times μ).
 */
export function drawDataset(s: DiphotonSample, opts: DatasetOptions): DrawnEvent[] {
  const r = makeRng(opts.seed);
  const out: DrawnEvent[] = [];
  const sg = s.manifest.samples.signal;
  const bg = s.manifest.samples.background;
  for (const e of s.background) if (opts.fraction >= 1 || r() < opts.fraction) out.push({ m: massOf(e.a, e.b), signal: false, event: e });
  const expectedStored = sg.sigmaLO_pb * sg.kFactorToApply * bg.poolLuminosity_fb * 1000 * opts.fraction * opts.mu * (s.signal.length / sg.generated);
  const k = Math.min(s.signal.length, poissonSample(r, expectedStored));
  const idx = s.signal.map((_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(r() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    const e = s.signal[idx[i]!]!;
    out.push({ m: massOf(e.a, e.b), signal: true, event: e });
  }
  return out;
}

// ── the diphoton fit ────────────────────────────────────────────────────────────────────────────────

/** The line shape of the simulated signal: a narrow Gaussian core and a wider Gaussian, with the generated mass of the simulation (`mH`). */
export interface SignalShape { w1: number; m1: number; s1: number; m2: number; s2: number; mH: number; entries: number; peak: number }

/** The signal shape of the fit: the two Gaussians of the simulation, moved together by one free parameter, `shift` (GeV). */
export function shiftedDoubleGaussian(t: Pick<SignalShape, 'w1' | 'm1' | 's1' | 'm2' | 's2'>): Shape {
  const norm = 1 / Math.sqrt(2 * Math.PI);
  return {
    name: 'doubleGaussian',
    paramNames: ['shift'],
    lower: [-8],
    upper: [8],
    bind(p) {
      const d = p[0]!;
      const parts = [{ w: t.w1, m: t.m1 + d, s: t.s1 }, { w: 1 - t.w1, m: t.m2 + d, s: t.s2 }];
      return {
        f: (x) => parts.reduce((acc, g) => acc + (g.w * norm / g.s) * Math.exp(-0.5 * ((x - g.m) / g.s) ** 2), 0),
        integral: (a, b) => parts.reduce((acc, g) => acc + 0.5 * g.w * (erf((b - g.m) / (g.s * Math.SQRT2)) - erf((a - g.m) / (g.s * Math.SQRT2))), 0),
      };
    },
  };
}

/** The signal line shape from the simulation alone: two Gaussians fitted to the selected signal events (the peak is not a single Gaussian in this detector model). */
export function signalShapeFromSimulation(s: DiphotonSample, c: DiphotonCuts, range: [number, number] = [105, 145]): SignalShape {
  const h = new Hist1D(160, range[0], range[1]);
  for (const e of s.signal) if (diphotonStage(e, { ...c, mLo: range[0], mHi: range[1] }) === GG_SELECTED) h.fill(massOf(e.a, e.b));
  const model = extendedModel([{ label: 'a', shape: gaussian() }, { label: 'b', shape: gaussian() }]);
  const N = h.integral();
  const fit = fitBinned(h, model, [0.85 * N, 126.8, 0.8, 0.15 * N, 125.5, 1.8], { range });
  const [y1, m1, s1, y2, m2, s2] = fit.params as [number, number, number, number, number, number];
  return { w1: y1 / (y1 + y2), m1, s1, m2, s2, mH: s.manifest.samples.signal.mH_GeV, entries: h.entries, peak: m1 };
}

export interface MassFit {
  hist: Hist1D;
  model: Model;
  fit: FitResult;
  names: string[];
  signalYield: { value: number; error: number };
  /** The shift of the peak from its simulated position, and the mass it implies: the generated mass plus the shift. */
  shift: { value: number; error: number };
  mass: { value: number; error: number };
  /** Local significance of the excess from the profile likelihood ratio: √q0, with q0 = 2(−ln L(no signal) + ln L(best fit)). 0 if the best fit has no (positive) signal. */
  z0: number;
  p0: number;
  /** The fitted background, and the best-fit signal, in counts per bin. */
  background: number[];
  signalCurve: number[];
  bkgYield: { value: number; error: number };
  nll: number;
  nll0: number;
  chi2: number;
  ndf: number;
  pValueFit: number;
}

/**
 * Fit a peak on a smooth background to a histogram of the diphoton mass by the binned Poisson likelihood (`fitBinned` of hep/analysis). The shape of
 * the peak comes from the simulation, as in the experiments; the signal yield (which may come out negative), the shift of the peak from its simulated position (between −8 and +8 GeV)
 * and the background parameters are free. The significance is the profile-likelihood ratio against the same model with no signal. The choice of background
 * function matters: this simulated continuum has a shoulder near 105 GeV that a single exponential does not follow.
 */
export function fitDiphoton(masses: ArrayLike<number>, shape: SignalShape, range: [number, number] = [105, 160], bins = 55, background: Background = 'bern3'): MassFit {
  const hist = new Hist1D(bins, range[0], range[1]);
  for (let i = 0; i < masses.length; i++) hist.fill(masses[i]!);
  const bkgShape = background === 'exp' ? exponential() : bernstein(background === 'bern3' ? 3 : 4);
  const model = extendedModel([{ label: 'sig', shape: shiftedDoubleGaussian(shape) }, { label: 'bkg', shape: bkgShape }]);
  const names = model.paramNames;
  const total = hist.integral();
  const start: Record<string, number> = { 'sig.yield': 0, 'sig.shift': 0, 'bkg.yield': total, 'bkg.slope': -0.03 };
  const p0 = names.map((n) => start[n] ?? 1);
  const lower = names.map((n) => (n === 'sig.shift' ? -8 : -Infinity));
  const upper = names.map((n) => (n === 'sig.shift' ? 8 : Infinity));
  // 1. the background-only hypothesis: the signal yield is 0 (and its mass is irrelevant)
  const null0 = fitBinned(hist, model, p0, { range, fixed: names.map((n) => n.startsWith('sig.')), lower, upper });
  // 2. the best fit, started from the background-only fit at several masses (a narrow peak makes the likelihood bumpy in the mass)
  let best: FitResult | null = null;
  for (const d0 of [-4, -2, 0, 2, 4]) {
    const q = null0.params.map((v, i) => (names[i] === 'sig.yield' ? 0.002 * total : names[i] === 'sig.shift' ? d0 : v));
    const f = fitBinned(hist, model, q, { range, lower, upper });
    if (!best || f.nll < best.nll) best = f;
  }
  best = best!;
  const q0 = Math.max(0, 2 * (null0.nll - best.nll));
  const z0 = best.get('sig.yield').value > 0 ? Math.sqrt(q0) : 0;
  const edges = Array.from(hist.edges);
  const parts = model.componentBinned(best.params, edges, range);
  return {
    hist, model, fit: best, names,
    signalYield: best.get('sig.yield'), shift: best.get('sig.shift'), mass: { value: shape.mH + best.get('sig.shift').value, error: best.get('sig.shift').error }, z0, p0: z0 > 0 ? 1 - normalCdf(z0) : 0.5,
    background: parts[1]!, signalCurve: parts[0]!, bkgYield: best.get('bkg.yield'),
    nll: best.nll, nll0: null0.nll, chi2: best.chi2, ndf: best.ndf, pValueFit: best.pValue,
  };
}

// ── four leptons: one analysis, two sources ─────────────────────────────────────────────────────────

export interface Lepton { pdg: number; charge: number; p: P4 }
export interface Event4l {
  source: 'simulation' | 'cms-open-data';
  year?: number;
  channel?: string;
  run?: number;
  eventNumber?: number;
  leptons: Lepton[];
  trigger?: boolean;
  /** Only for the simulation: isolation of each lepton. */
  iso?: number[];
}
const M_Z = 91.1876;
const MASS_OF = (pdg: number) => (Math.abs(pdg) === 13 ? 0.1056583755 : 0.000510998950);

export interface Cuts4l { pt1: number; pt2: number; ptMuon: number; ptElectron: number; mZ1Min: number; mZ2Min: number; mHi: number }
export const DEFAULT_4L_CUTS: Cuts4l = { pt1: 20, pt2: 10, ptMuon: 5, ptElectron: 7, mZ1Min: 40, mZ2Min: 12, mHi: 120 };

export interface Result4l { pass: boolean; reason?: string; m4l?: number; mZ1?: number; mZ2?: number; flavour?: '4mu' | '4e' | '2e2mu' }
const ptOf = (p: P4) => Math.hypot(p.px, p.py);
const etaOf = (p: P4) => Math.asinh(p.pz / Math.hypot(p.px, p.py));

/**
 * The four-lepton selection. Four leptons (electrons or muons) with total charge 0 that form two opposite-sign pairs of the same flavour; Z1 is the pair
 * with the mass closest to the Z mass and Z2 the other; thresholds on the pT of the leptons ordered by pT (20 and 10 GeV for the two hardest, a lower one for
 * the others) and on the masses of Z1 and Z2. It uses only what both data sources have: four-vectors, charges and flavours.
 */
export function analyse4l(ev: Event4l, c: Cuts4l = DEFAULT_4L_CUTS): Result4l {
  const L = ev.leptons;
  if (L.length < 4) return { pass: false, reason: 'fewer than four leptons' };
  const four = [...L].sort((a, b) => ptOf(b.p) - ptOf(a.p)).slice(0, 4);
  if (four.reduce((s, l) => s + l.charge, 0) !== 0) return { pass: false, reason: 'total charge not zero' };
  const nMu = four.filter((l) => Math.abs(l.pdg) === 13).length;
  if (nMu % 2 !== 0) return { pass: false, reason: 'no two same-flavour pairs' };
  const pts = four.map((l) => ptOf(l.p));
  if (pts[0]! < c.pt1 || pts[1]! < c.pt2) return { pass: false, reason: 'lepton pT' };
  for (const l of four) {
    const pt = ptOf(l.p);
    if (Math.abs(l.pdg) === 13 ? pt < c.ptMuon : pt < c.ptElectron) return { pass: false, reason: 'lepton pT' };
  }
  // all ways to split into two opposite-sign same-flavour pairs
  let best: { z1: [number, number]; z2: [number, number]; m1: number; m2: number } | null = null;
  const splits: [[number, number], [number, number]][] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  for (const [p, q] of splits) {
    const ok = (pr: [number, number]) => four[pr[0]]!.charge * four[pr[1]]!.charge < 0 && Math.abs(four[pr[0]]!.pdg) === Math.abs(four[pr[1]]!.pdg);
    if (!ok(p) || !ok(q)) continue;
    const mp = pairMass(four[p[0]]!.p, four[p[1]]!.p), mq = pairMass(four[q[0]]!.p, four[q[1]]!.p);
    const [z1, z2, m1, m2] = Math.abs(mp - M_Z) <= Math.abs(mq - M_Z) ? [p, q, mp, mq] : [q, p, mq, mp];
    // with two possible pairings (4e, 4μ) take the one whose Z1 is closest to the Z mass
    if (!best || Math.abs(m1 - M_Z) < Math.abs(best.m1 - M_Z)) best = { z1, z2, m1, m2 };
  }
  if (!best) return { pass: false, reason: 'no two same-flavour pairs' };
  if (best.m1 < c.mZ1Min || best.m1 > c.mHi) return { pass: false, reason: 'Z1 mass', mZ1: best.m1, mZ2: best.m2 };
  if (best.m2 < c.mZ2Min || best.m2 > c.mHi) return { pass: false, reason: 'Z2 mass', mZ1: best.m1, mZ2: best.m2 };
  const tot = four.reduce((s, l) => ({ E: s.E + l.p.E, px: s.px + l.p.px, py: s.py + l.p.py, pz: s.pz + l.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
  const m4l = Math.sqrt(Math.max(0, (tot.E - Math.hypot(tot.px, tot.py, tot.pz)) * (tot.E + Math.hypot(tot.px, tot.py, tot.pz))));
  return { pass: true, m4l, mZ1: best.m1, mZ2: best.m2, flavour: nMu === 4 ? '4mu' : nMu === 0 ? '4e' : '2e2mu' };
}

// ── real data and the simulated four-lepton sample ──────────────────────────────────────────────────

export interface CmsOpenData {
  events: Event4l[];
  /** The notebook's simulated histograms (events per 3 GeV bin from 70 to 181 GeV), weighted to its luminosities. */
  mc: { range: [number, number]; bins: number; zz: number[]; dy: number[]; ttbar: number[]; hzz: number[]; note: string };
  /** The invariant mass M as published in the files, for checking. */
  published: number[];
}
export function parseCmsOpenData(json: {
  events: { year: number; channel: string; run: number; event: number; leptons: number[][]; M: number }[];
  mc: CmsOpenData['mc'];
}): CmsOpenData {
  const events: Event4l[] = json.events.map((e) => ({
    source: 'cms-open-data' as const,
    year: e.year,
    channel: e.channel,
    run: e.run,
    eventNumber: e.event,
    leptons: e.leptons.map((l) => ({ pdg: l[0]!, charge: l[5]!, p: { E: l[1]!, px: l[2]!, py: l[3]!, pz: l[4]! } })),
  }));
  return { events, mc: json.mc, published: json.events.map((e) => e.M) };
}
export async function loadCmsOpenData(base = ''): Promise<CmsOpenData> {
  const res = await fetch(`${base}/data/h4l-cms-opendata.json`);
  if (!res.ok) throw new Error(`could not load the CMS four-lepton data (${res.status})`);
  return parseCmsOpenData(await res.json());
}

const STRIDE_4L = 21;
export function parse4lSim(buffer: ArrayBuffer): Event4l[] {
  const v = new Int16Array(buffer);
  const n = v.length / STRIDE_4L;
  const out: Event4l[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE_4L;
    const leptons: Lepton[] = [];
    const iso: number[] = [];
    for (let k = 0; k < 4; k++) {
      const q = o + 1 + 5 * k;
      const code = v[q]!;
      const pt = v[q + 1]! / 40, eta = v[q + 2]! / 4000, phi = v[q + 3]! / 4000;
      leptons.push({ pdg: code, charge: code > 0 ? -1 : 1, p: fromPtEtaPhiM(pt, eta, phi, MASS_OF(code)) });
      iso.push(v[q + 4]! / 2000);
    }
    out.push({ source: 'simulation', leptons, trigger: (v[o]! & 2) === 2, iso });
  }
  return out;
}
export async function load4lSim(base = ''): Promise<{ events: Event4l[]; manifest: Record<string, any> }> {
  const [bin, man] = await Promise.all([fetch(`${base}/data/higgs-4l-sim.bin`), fetch(`${base}/data/higgs-4l-sim.manifest.json`)]);
  if (!bin.ok || !man.ok) throw new Error(`could not load the simulated four-lepton sample (${bin.status}, ${man.status})`);
  return { events: parse4lSim(await bin.arrayBuffer()), manifest: await man.json() };
}

/**
 * The swap mechanism for real diphoton data. If a file `static/data/gamgam-opendata.json` exists, with the format in scripts/data/README-higgs.md
 * (an array of `{ pt1, eta1, phi1, pt2, eta2, phi2 }`, GeV, for the two hardest photons of events that passed the experiment's own selection),
 * it is returned and the figure offers it as a data source. The course ships no such file (see the chapter): this returns null.
 */
export async function loadRealDiphoton(base = ''): Promise<{ m: number[]; meta: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${base}/data/gamgam-opendata.json`);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const j = (await res.json()) as { meta?: Record<string, unknown>; events: { pt1: number; eta1: number; phi1: number; pt2: number; eta2: number; phi2: number }[] };
    return { m: j.events.map((e) => massOf({ pt: e.pt1, eta: e.eta1, phi: e.phi1 }, { pt: e.pt2, eta: e.eta2, phi: e.phi2 })), meta: j.meta ?? {} };
  } catch {
    return null;
  }
}

// ── the four-lepton counting and template fit ───────────────────────────────────────────────────────

/** Histogram the selected events' four-lepton mass in the notebook's 37 bins of 3 GeV from 70 to 181 GeV. */
export function histogram4l(events: readonly Event4l[], cuts: Cuts4l = DEFAULT_4L_CUTS): { h: Hist1D; passed: number; results: Result4l[] } {
  const h = new Hist1D(37, 70, 181);
  const results = events.map((e) => analyse4l(e, cuts));
  let passed = 0;
  results.forEach((r) => { if (r.pass && r.m4l !== undefined) { h.fill(r.m4l); passed++; } });
  return { h, passed, results };
}

export interface TemplateFit { mu: { value: number; error: number }; z0: number; nll: number; nll0: number; p: number }
/**
 * The signal strength μ from a fit of the observed 4ℓ spectrum to μ × (signal template) + (background template), with the templates fixed, by the Poisson likelihood.
 * It goes through `fitLikelihood` of hep/analysis, which is the hook of Chapter 28's exercise: if the reader's function is installed, it is the reader's fit.
 */
export function templateFit(observed: ArrayLike<number>, signal: ArrayLike<number>, background: ArrayLike<number>, window?: [number, number], edges?: ArrayLike<number>): TemplateFit {
  const idx: number[] = [];
  for (let i = 0; i < observed.length; i++) {
    const c = edges ? 0.5 * (edges[i]! + edges[i + 1]!) : i;
    if (!window || (c >= window[0] && c <= window[1])) idx.push(i);
  }
  const data = idx.map((i) => observed[i]!);
  const s = idx.map((i) => signal[i]!);
  const b = idx.map((i) => background[i]!);
  const model = (p: number[]) => s.map((si, k) => p[0]! * si + b[k]!);
  const fit = fitLikelihood(data, model, [1]);
  const nll0 = data.reduce((acc, n, k) => acc + (b[k]! > 0 ? b[k]! - n * Math.log(b[k]!) + lnFact(n) : 0), 0);
  const q0 = Math.max(0, 2 * (nll0 - fit.nll));
  const z0 = fit.params[0]! > 0 ? Math.sqrt(q0) : 0;
  return { mu: { value: fit.params[0]!, error: fit.errors[0]! }, z0, nll: fit.nll, nll0, p: z0 > 0 ? 1 - normalCdf(z0) : 0.5 };
}
function lnFact(n: number): number {
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log(k);
  return s;
}

/** The counting experiment of Chapter 28 in a mass window: the observed count, the expected background and signal from the templates, the Poisson p-value. */
export function countingWindow(observed: ArrayLike<number>, signal: ArrayLike<number>, background: ArrayLike<number>, bins: [number, number]): { n: number; b: number; s: number; p: number; z: number } {
  let n = 0, b = 0, s = 0;
  for (let i = bins[0]; i < bins[1]; i++) { n += observed[i]!; b += background[i]!; s += signal[i]!; }
  const p = poissonTail(n, b);
  return { n, b, s, p, z: n > b ? pToZ(p) : 0 };
}

