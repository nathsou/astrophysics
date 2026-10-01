/**
 * The Z lineshape and the number of light neutrino species (Chapter 23), from the course generator.
 *
 * `lineshapeTable.ts` holds σ(e⁺e⁻ → hadrons) with initial-state radiation, from `hep/gen`, on a grid of √s and of N_ν (see
 * `makeLineshapeTable.ts`). Here it is interpolated, turned into the expected number of selected events at a set of
 * scan energies, fluctuated into pseudo-data, and fitted with `fitBinned` from `hep/analysis`.
 *
 * Everything in this file is SIMULATED and LEP-LIKE: the energies and luminosities are chosen to resemble the LEP scan, the
 * cross-section is the generator's leading-order (plus the 1 + αs/π factor) result, and the numbers of events are drawn from Poisson
 * distributions with a seeded random generator. Nothing here is LEP data.
 */
import { Hist1D, fitBinned, type FitResult } from '$lib/hep/analysis';
import { poisson, normal, rng, type Rng } from '$lib/hep/random';
import { GAMMA_Z, M_Z, zPartialWidth, zWidths } from '$lib/hep/sm';
import { HBARC2_GEV2_NB } from '$lib/hep/units';
import { TABLE, TABLE_GRID } from './lineshapeTable';

const { e0, de, ne, n0, dn, nn } = TABLE_GRID;

/** Leading-order Γ(Z → νν̄) in GeV for one species (165.9 MeV): the amount by which each species widens the Z. */
export const GAMMA_NU = zPartialWidth(12);

/** The Z's total width (GeV) if there are N light neutrino species, all else as in the generator (Γ_Z(3) = the table's 2.4955 GeV). */
export const zWidthFor = (N: number): number => GAMMA_Z + (N - 3) * GAMMA_NU;

/** Catmull–Rom cubic through four equally spaced points, at fraction t ∈ [0, 1] between the middle two. */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/** The table's hadronic cross-section at (√s in GeV, N_ν) in nb, interpolated (cubic in both). Outside the grid the ends are held. */
export function sigmaHad(sqrtS: number, N: number): number {
  const x = Math.min(Math.max((sqrtS - e0) / de, 1), ne - 2.0001);
  const i = Math.floor(x), t = x - i;
  const y = Math.min(Math.max((N - n0) / dn, 1), nn - 2.0001);
  const j = Math.floor(y), u = y - j;
  const rowAt = (r: number) => {
    const row = TABLE[r]!;
    return cubic(row[i - 1 < 0 ? 0 : i - 1]!, row[i]!, row[i + 1]!, row[Math.min(ne - 1, i + 2)]!, t);
  };
  const vals = [j - 1 < 0 ? 0 : j - 1, j, j + 1, Math.min(nn - 1, j + 2)].map(rowAt);
  return cubic(vals[0]!, vals[1]!, vals[2]!, vals[3]!, u);
}

/** A LEP-like scan: seven centre-of-mass energies around the peak, with luminosity in pb⁻¹ at each (all four experiments together). */
export const SCAN: { E: number; L: number }[] = [
  { E: 88.5, L: 35 }, { E: 89.5, L: 50 }, { E: 90.2, L: 40 }, { E: 91.2, L: 360 }, { E: 92.0, L: 55 }, { E: 93.0, L: 60 }, { E: 93.8, L: 40 },
];
/** The fraction of hadronic Z decays that pass the (assumed) selection. */
export const SELECTION_EFFICIENCY = 0.98;

/** Expected selected events at each scan point for N light neutrino species, a shift of the Z mass `dm` (GeV) and a normalisation `k`. */
export function expectedCounts(N: number, dm = 0, k = 1, lumiScale = 1): number[] {
  return SCAN.map((s) => k * lumiScale * s.L * 1000 * SELECTION_EFFICIENCY * sigmaHad(s.E - dm, N));
}

export interface PseudoData {
  counts: number[];
  /** The true N_ν and the relative luminosity error that was applied to the expectation. */
  trueN: number;
  lumiError: number;
  seed: number;
}

/**
 * Pseudo-data from Nature: N_ν = `trueN` (3 by default), counts Poisson about the expectation. `lumiScale` multiplies all luminosities
 * (a smaller data set); `lumiSyst` is the relative error of the luminosity measurement: the true luminosity differs from the assumed one by a
 * factor 1 + lumiSyst·g, with g a standard normal number drawn from the seed, the same for all points.
 */
export function pseudoData(seed: number, opts: { trueN?: number; lumiScale?: number; lumiSyst?: number } = {}): PseudoData {
  const r = rng(seed);
  const trueN = opts.trueN ?? 3;
  const syst = (opts.lumiSyst ?? 0) * normal(r, 0, 1);
  const mu = expectedCounts(trueN, 0, 1 + syst, opts.lumiScale ?? 1);
  return { counts: mu.map((m) => poisson(r, m)), trueN, lumiError: syst, seed };
}

/** A histogram with one bin per scan point (bin edges halfway between neighbouring energies), so that `fitBinned` can fit the scan. */
export function scanHistogram(counts: number[]): Hist1D {
  const edges = [SCAN[0]!.E - 0.5];
  for (let i = 1; i < SCAN.length; i++) edges.push(0.5 * (SCAN[i - 1]!.E + SCAN[i]!.E));
  edges.push(SCAN[SCAN.length - 1]!.E + 0.5);
  const h = new Hist1D(edges);
  counts.forEach((c, i) => {
    h.counts[i] = c;
    h.sumw2[i] = c;
  });
  return h;
}

export interface LineshapeFit {
  N: number;
  dN: number;
  dm: number;
  ddm: number;
  k: number;
  chi2: number;
  ndf: number;
  nll: number;
  converged: boolean;
  fit: FitResult;
}

/**
 * Fit N_ν (and a shift of the Z mass, which the scan's energy calibration does not fix) to the counts with the binned Poisson likelihood of
 * `fitBinned`. With `freeNorm` the overall normalisation (luminosity times efficiency) is fitted too, and then only the shape of the
 * lineshape tells N_ν apart; without it the luminosity is taken as known and the peak height counts as well.
 */
export function fitLineshape(counts: number[], opts: { freeNorm?: boolean; lumiScale?: number } = {}): LineshapeFit {
  const hist = scanHistogram(counts);
  const model = (p: number[]) => expectedCounts(p[0]!, p[1]!, p[2]!, opts.lumiScale ?? 1);
  const fit = fitBinned(hist, model, [3.1, 0.05, 1], {
    names: ['N_nu', 'dm', 'norm'],
    fixed: [false, false, !opts.freeNorm],
    lower: [1.05, -1.5, 0.5],
    upper: [4.95, 1.5, 1.5],
  });
  return { N: fit.params[0]!, dN: fit.errors[0]!, dm: fit.params[1]!, ddm: fit.errors[1]!, k: fit.params[2]!, chi2: fit.chi2, ndf: fit.ndf, nll: fit.nll, converged: fit.converged, fit };
}

/**
 * The Poisson χ² (Baker–Cousins) of the counts against a fixed hypothesis N, with the mass shift refitted (and the normalisation fixed):
 * how badly N_ν = N describes the data.
 */
export function fitAtFixedN(counts: number[], N: number, opts: { freeNorm?: boolean; lumiScale?: number } = {}): { chi2: number; dm: number; k: number } {
  const hist = scanHistogram(counts);
  const model = (p: number[]) => expectedCounts(N, p[0]!, p[1]!, opts.lumiScale ?? 1);
  const fit = fitBinned(hist, model, [0, 1], { names: ['dm', 'norm'], fixed: [false, !opts.freeNorm], lower: [-1.5, 0.5], upper: [1.5, 1.5] });
  return { chi2: fit.chi2, dm: fit.params[0]!, k: fit.params[1]! };
}

// ── the classic formulas ──────────────────────────────────────────────────────────────────────────────────────

/** σ⁰_had = 12π Γ_ee Γ_had / (m_Z² Γ_Z²), the pole cross-section without initial-state radiation, in nb. */
export function poleCrossSectionNb(Gee: number, Ghad: number, GZ: number, mZ = M_Z): number {
  return ((12 * Math.PI * Gee * Ghad) / (mZ * mZ * GZ * GZ)) * HBARC2_GEV2_NB;
}

/** Number of light neutrino species from σ⁰_had (nb), R_ℓ = Γ_had/Γ_ℓℓ and m_Z: N_ν = (Γ_inv/Γ_ℓℓ)/(Γ_νν/Γ_ℓℓ)_SM, with the leading-order SM ratio. */
export function neutrinoNumber(sigma0Nb: number, Rl: number, mZ = M_Z): number {
  const s0 = sigma0Nb / HBARC2_GEV2_NB;
  const invOverLl = Math.sqrt((12 * Math.PI * Rl) / (mZ * mZ * s0)) - Rl - 3;
  return invOverLl / (GAMMA_NU / zPartialWidth(13));
}

/** Leading-order widths with the first QCD correction: total, hadronic, invisible and charged-lepton, in GeV. */
export function zWidthSummary(): { total: number; hadronic: number; invisible: number; perLepton: number; nu: number } {
  const w = zWidths({ qcd: true });
  return { total: w.total, hadronic: w.hadronic, invisible: w.invisible, perLepton: w.byFlavour.mu!, nu: GAMMA_NU };
}

/** Peak cross-section of the table at N_ν species (nb, with initial-state radiation): the height of the visible peak. */
export function visiblePeakNb(N: number): number {
  let best = 0;
  for (let E = 90.5; E <= 92; E += 0.05) best = Math.max(best, sigmaHad(E, N));
  return best;
}

export { rng, type Rng };
