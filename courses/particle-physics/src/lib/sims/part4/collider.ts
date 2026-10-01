/**
 * The numerics of Chapter 16's virtual e⁺e⁻ collider: which process, its cross-section, a measurement at one energy
 * (counts, angular distribution, forward–backward asymmetry) and a scan of R = σ(hadrons)/σ(μ⁺μ⁻) over √s.
 *
 * Everything comes from `hep/gen` (the process, its cross-section and its events) and `hep/sm` (R at leading order).
 * All random numbers are seeded. "Data" here are simulated by the course's own generator, not measured.
 */
import { eeToFermions, bhabha, getProcess, type Process } from '../../hep/gen/index.ts';
import { rng, poisson, type Rng } from '../../hep/random/index.ts';
import { rRatio, alphaS } from '../../hep/sm/index.ts';

export type FinalState = 'mumu' | 'hadrons' | 'bhabha';

export const FINAL_LABEL: Record<FinalState, string> = {
  mumu: 'e⁺e⁻ → μ⁺μ⁻',
  hadrons: 'e⁺e⁻ → qq̄ (hadrons)',
  bhabha: 'e⁺e⁻ → e⁺e⁻ (Bhabha)',
};

const cache = new Map<string, Process>();
/** The generator process for a final state, with photon exchange alone (`z = false`) or γ and Z together. */
export function processFor(final: FinalState, z: boolean): Process {
  const key = `${final}:${z}`;
  let p = cache.get(key);
  if (!p) {
    if (final === 'bhabha') p = bhabha({ cosMax: 0.9 });
    else p = eeToFermions({ final: final === 'mumu' ? 'mu' : 'hadrons', qedOnly: !z });
    cache.set(key, p);
  }
  return p;
}

/** The cross-section in pb. */
export function sigmaPb(final: FinalState, z: boolean, sqrtS: number): number {
  return processFor(final, z).sigma(sqrtS);
}

/** The point cross-section 4πα²/3s in pb, for the reader to compare with. */
export function sigmaPointPb(sqrtS: number): number {
  return eeToFermions({ final: 'mu', qedOnly: true }).sigma(sqrtS);
}

export interface Measurement {
  final: FinalState;
  sqrtS: number;
  lumiPb: number;
  /** Events the generator was asked for: Poisson(σ L). */
  nObserved: number;
  /** How many of them were generated and histogrammed (capped for speed). */
  nShown: number;
  sigmaMeasPb: number;
  sigmaErrPb: number;
  sigmaTheoryPb: number;
  /** cos θ of the outgoing μ⁻ (or quark, or e⁻) with respect to the e⁻ beam, for the events shown. */
  cosTheta: Float64Array;
  afb: number;
  afbErr: number;
}

/** Simulate a run of the collider: a Poisson number of events for the integrated luminosity, then their angles. */
export function measure(final: FinalState, z: boolean, sqrtS: number, lumiPb: number, seed: number, cap = 20000): Measurement {
  const r = rng(seed);
  const proc = processFor(final, z);
  const sigmaTheoryPb = proc.sigma(sqrtS);
  const nObserved = poisson(r, sigmaTheoryPb * lumiPb);
  const nShown = Math.min(nObserved, cap);
  const cos = new Float64Array(nShown);
  let fw = 0;
  const wanted = final === 'mumu' ? 13 : final === 'bhabha' ? 11 : 0;
  for (let i = 0; i < nShown; i++) {
    const { event } = proc.generate(r, { sqrtS });
    let p;
    if (final === 'hadrons') p = event.particles.find((q) => q.status === 'final' && q.pdg >= 1 && q.pdg <= 6);
    else p = event.particles.find((q) => q.status === 'final' && q.pdg === wanted);
    const c = p ? p.p.pz / Math.hypot(p.p.px, p.p.py, p.p.pz) : 0;
    cos[i] = c;
    if (c > 0) fw++;
  }
  const afb = nShown ? (2 * fw - nShown) / nShown : 0;
  const afbErr = nShown ? Math.sqrt((1 - afb * afb) / nShown) : 0;
  return {
    final,
    sqrtS,
    lumiPb,
    nObserved,
    nShown,
    sigmaMeasPb: nObserved / lumiPb,
    sigmaErrPb: Math.sqrt(Math.max(nObserved, 1)) / lumiPb,
    sigmaTheoryPb,
    cosTheta: cos,
    afb,
    afbErr,
  };
}

/** Bin cos θ into `n` bins on [−1, 1]. */
export function histogramCos(cos: Float64Array, n: number): { edges: number[]; counts: number[] } {
  const edges = Array.from({ length: n + 1 }, (_, i) => -1 + (2 * i) / n);
  const counts = new Array<number>(n).fill(0);
  for (const c of cos) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(((c + 1) / 2) * n)));
    counts[i]!++;
  }
  return { edges, counts };
}

/** The normalised shape (probability density in cos θ) of a process at √s, by numerical differentiation of nothing: closed forms. */
export function cosShape(final: FinalState, z: boolean, sqrtS: number, afb: number): (c: number) => number {
  if (final === 'mumu' || final === 'hadrons') {
    // (3/8)[(1 + c²) + (8/3) A_FB c] integrates to one on [−1, 1]
    return (c) => (3 / 8) * (1 + c * c + (8 / 3) * (z ? afb : 0) * c);
  }
  // Bhabha: the normalisation comes from the cross-section itself
  const s = sqrtS * sqrtS;
  const f = (c: number) => bhabhaShape(s, c);
  let norm = 0;
  const n = 400;
  for (let i = 0; i < n; i++) norm += f(-0.9 + (1.8 * (i + 0.5)) / n) * (1.8 / n);
  return (c) => (Math.abs(c) <= 0.9 ? f(c) / norm : 0);
}
function bhabhaShape(s: number, c: number): number {
  const t = (-s * (1 - c)) / 2, u = (-s * (1 + c)) / 2;
  return u * u * (1 / s + 1 / t) ** 2 + (t / s) ** 2 + (s / t) ** 2;
}

// ── the R scan ────────────────────────────────────────────────────────────────────────────────────────────────
export interface RPoint {
  sqrtS: number;
  nMu: number;
  nHad: number;
  r: number;
  err: number;
  /** the exact generator ratio σ(hadrons)/σ(μ⁺μ⁻) */
  theory: number;
}

/** Log-spaced energies. */
export function energyGrid(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => lo * Math.pow(hi / lo, i / (n - 1)));
}

/**
 * Pseudo-data for R: at each √s the luminosity is chosen to give `muPairs` expected μ⁺μ⁻ events, and the hadronic and
 * muonic counts are drawn from Poisson distributions around σ L. The generator has N_c = 3 built in.
 */
export function scanR(energies: number[], muPairs: number, seed: number, qcd: boolean): RPoint[] {
  const r: Rng = rng(seed);
  const mu = eeToFermions({ final: 'mu', qedOnly: true });
  const had = eeToFermions({ final: 'hadrons', qedOnly: true, qcd });
  return energies.map((e) => {
    const sMu = mu.sigma(e);
    const sHad = had.sigma(e);
    const lumi = muPairs / sMu;
    const nMu = Math.max(1, poisson(r, sMu * lumi));
    const nHad = poisson(r, sHad * lumi);
    const R = nHad / nMu;
    const err = R > 0 ? R * Math.sqrt(1 / Math.max(nHad, 1) + 1 / nMu) : 1 / nMu;
    return { sqrtS: e, nMu, nHad, r: R, err, theory: sHad / sMu };
  });
}

/** The leading-order curve for a hypothetical number of colours: R(N_c) = (N_c/3) R(3). */
export function rModel(sqrtS: number, nColours: number, qcd: boolean): number {
  return (nColours / 3) * rRatio(sqrtS, { qcd });
}

/** χ² and number of degrees of freedom of the pseudo-data against R(N_c). */
export function chi2OfColours(points: RPoint[], nColours: number, qcd: boolean): { chi2: number; ndf: number } {
  let chi2 = 0;
  for (const p of points) chi2 += ((p.r - rModel(p.sqrtS, nColours, qcd)) / p.err) ** 2;
  return { chi2, ndf: points.length };
}

export { rRatio, alphaS, getProcess };
