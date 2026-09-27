// Shared physics for the "Spectra & Atoms" chapter sims: Bohr levels, Boltzmann/Saha
// population fractions, a curated absorption-line list, and a pseudo-Voigt line profile.
//
// This is a *teaching* model, not a spectral-synthesis code — see the <Hood> in spectra.mdx
// for the honest list of what it leaves out (proper partition functions, NLTE, line opacity
// radiative transfer, molecular equilibrium for the band heads). It is tuned to get the right
// *qualitative* and roughly right *quantitative* behaviour: Balmer lines peaking near 9,500 K,
// Ca II H&K strong in G/K stars, TiO bands only below ~4,000 K, and so on.

import { h, c, kB, me } from '../../lib/physics/constants';

export const eV = 1.602176634e-19; // J
export const kB_eV = 8.617333262e-5; // eV/K
export const RY_EV = 13.605693; // Rydberg energy, eV

/** Bohr hydrogen level energy (eV), n = 1, 2, 3, … */
export const bohrLevelEV = (n: number, Z = 1) => -RY_EV * Z * Z / (n * n);

/** Photon wavelength (nm) for a transition n_hi -> n_lo of a hydrogenic ion of charge Z. */
export function bohrWavelengthNM(nLo: number, nHi: number, Z = 1): number {
  const dE = (bohrLevelEV(nHi, Z) - bohrLevelEV(nLo, Z)) * eV; // J, negative->positive since nHi>nLo means less bound (higher E)
  const E = Math.abs(dE);
  return (h * c) / E * 1e9;
}

export type SeriesName = 'Lyman' | 'Balmer' | 'Paschen' | 'Brackett';
export const SERIES: { name: SeriesName; nLo: number; color: 'series-1' | 'series-2' | 'series-3' | 'series-4' }[] = [
  { name: 'Lyman', nLo: 1, color: 'series-4' },
  { name: 'Balmer', nLo: 2, color: 'series-1' },
  { name: 'Paschen', nLo: 3, color: 'series-2' },
  { name: 'Brackett', nLo: 4, color: 'series-3' },
];

// ---------------------------------------------------------------------------
// Boltzmann excitation & Saha ionisation
// ---------------------------------------------------------------------------

/** Boltzmann level ratio N_b/N_a = (g_b/g_a) exp(-ΔE/kT), ΔE in eV, T in K. */
export function boltzmannRatio(gA: number, gB: number, dE_eV: number, T: number): number {
  return (gB / gA) * Math.exp(-dE_eV / (kB_eV * T));
}

/**
 * Saha ratio N_{r+1} n_e / N_r = (2 U_{r+1}/U_r) (2π m_e k T / h²)^{3/2} exp(-χ_r / kT).
 * We stand in ground-state statistical weights for the partition functions U — an honest
 * simplification (see <Hood>): it under-counts excited-state contributions, which matters most
 * for cool, low-ionisation-potential metals at low density.
 */
export function sahaPhi(T: number): number {
  const x = (2 * Math.PI * me * kB * T) / (h * h);
  return Math.pow(x, 1.5); // m^-3
}
export function sahaRatio(chi_eV: number, gLow: number, gHigh: number, T: number, ne_m3: number): number {
  const phi = sahaPhi(T) * Math.exp(-chi_eV / (kB_eV * T));
  return (2 * gHigh) / (gLow * Math.max(ne_m3, 1)) * phi;
}

/**
 * Fraction of an element's atoms in each of len(g) ionisation stages, given successive
 * ionisation energies `chi` (length g.length - 1) and ground-state weights `g`.
 */
export function stageFractions(chi_eV: number[], g: number[], T: number, ne_m3: number): number[] {
  const r: number[] = [1]; // relative population, stage 0 = 1
  for (let i = 0; i < chi_eV.length; i++) {
    r.push(r[i] * sahaRatio(chi_eV[i], g[i], g[i + 1], T, ne_m3));
  }
  const sum = r.reduce((a, b) => a + b, 0);
  return r.map((x) => x / sum);
}

/**
 * Solve electron density self-consistently for a H+He gas at total number density nTot (m^-3),
 * plus a small floor from easily-ionised metals (Na, Ca, Fe…) that dominates n_e when H and He
 * are still neutral. Simple fixed-point iteration; converges in a handful of steps because n_e
 * enters the Saha equation only through a mild division.
 */
export function solveElectronDensity(T: number, nTot: number, heFrac = 0.1): number {
  const nH = nTot * (1 - heFrac);
  const nHe = nTot * heFrac;
  const metalFloor = 3e-5 * nTot; // ~solar metal abundance, all singly ionised, as a floor
  let ne = 0.5 * nTot;
  for (let it = 0; it < 24; it++) {
    const fH = stageFractions([13.598], [2, 1], T, ne); // H I -> H II
    const fHe = stageFractions([24.587, 54.418], [1, 2, 1], T, ne); // He I -> II -> III
    const neNew = nH * fH[1] + nHe * (fHe[1] + 2 * fHe[2]) + metalFloor;
    ne = 0.5 * ne + 0.5 * Math.max(neNew, 1e6);
  }
  return ne;
}

// ---------------------------------------------------------------------------
// Curated line list
// ---------------------------------------------------------------------------

export interface Species {
  key: string;
  label: string; // e.g. "Ca II"
  chi_eV: number[]; // successive ionisation energies
  g: number[]; // ground-state statistical weights, one per stage
  abundance: number; // number fraction relative to H
  massAMU: number;
}

export const SPECIES: Record<string, Species> = {
  H: { key: 'H', label: 'H', chi_eV: [13.598], g: [2, 1], abundance: 1, massAMU: 1.008 },
  He: { key: 'He', label: 'He', chi_eV: [24.587, 54.418], g: [1, 2, 1], abundance: 0.1, massAMU: 4.003 },
  Ca: { key: 'Ca', label: 'Ca', chi_eV: [6.113, 11.872], g: [1, 2, 1], abundance: 2.2e-6, massAMU: 40.08 },
  Na: { key: 'Na', label: 'Na', chi_eV: [5.139], g: [2, 1], abundance: 2.1e-6, massAMU: 22.99 },
  Mg: { key: 'Mg', label: 'Mg', chi_eV: [7.646], g: [1, 2], abundance: 3.5e-5, massAMU: 24.31 },
  Fe: { key: 'Fe', label: 'Fe', chi_eV: [7.902], g: [9, 10], abundance: 3.2e-5, massAMU: 55.85 },
};

export type LineCategory = 'H' | 'He' | 'metal' | 'molecule';

export interface LineDef {
  id: string;
  label: string; // "Hα", "Ca II K", …
  species: keyof typeof SPECIES | 'TiO' | 'CH';
  category: LineCategory;
  nm: number; // rest air/vacuum wavelength, nm
  stage: number; // 0 = neutral, 1 = singly ionised, …
  dE_eV: number; // excitation of the lower level above the ground state of that stage
  gLower: number;
  maxDepth: number; // hand-tuned ceiling on line depth (curated, see <Hood>)
  gamma: number; // saturation softness exponent (molecular bands only)
  k?: number; // opacity scale: optical depth τ = k × abundance × stage fraction × Boltzmann fraction
}

// Balmer series lower level is n=2: dE = 13.6*(1 - 1/4) = 10.2 eV, g(n=2) = 2n^2 = 8.
const H_N2_DE = RY_EV * (1 - 1 / 4); // 10.2 eV above the ground state
const H_N2_G = 8;

export const LINES: LineDef[] = [
  { id: 'Ha', label: 'Hα', species: 'H', category: 'H', nm: 656.28, stage: 0, dE_eV: H_N2_DE, gLower: H_N2_G, maxDepth: 0.75, gamma: 0.55, k: 6e+07 },
  { id: 'Hb', label: 'Hβ', species: 'H', category: 'H', nm: 486.13, stage: 0, dE_eV: H_N2_DE, gLower: H_N2_G, maxDepth: 0.7, gamma: 0.55, k: 3e+07 },
  { id: 'Hg', label: 'Hγ', species: 'H', category: 'H', nm: 434.05, stage: 0, dE_eV: H_N2_DE, gLower: H_N2_G, maxDepth: 0.6, gamma: 0.55, k: 1.5e+07 },
  { id: 'Hd', label: 'Hδ', species: 'H', category: 'H', nm: 410.17, stage: 0, dE_eV: H_N2_DE, gLower: H_N2_G, maxDepth: 0.5, gamma: 0.55, k: 1e+07 },
  { id: 'HeI', label: 'He I', species: 'He', category: 'He', nm: 587.6, stage: 0, dE_eV: 20.6, gLower: 3, maxDepth: 0.4, gamma: 0.6, k: 3e+09 },
  { id: 'HeII', label: 'He II', species: 'He', category: 'He', nm: 468.6, stage: 1, dE_eV: 48.4, gLower: 32, maxDepth: 0.3, gamma: 0.6, k: 4e+08 },
  { id: 'CaK', label: 'Ca II K', species: 'Ca', category: 'metal', nm: 393.37, stage: 1, dE_eV: 0, gLower: 2, maxDepth: 0.9, gamma: 0.4, k: 2e+07 },
  { id: 'CaH', label: 'Ca II H', species: 'Ca', category: 'metal', nm: 396.85, stage: 1, dE_eV: 0, gLower: 2, maxDepth: 0.85, gamma: 0.4, k: 2e+07 },
  { id: 'NaD2', label: 'Na D₂', species: 'Na', category: 'metal', nm: 589.0, stage: 0, dE_eV: 0, gLower: 2, maxDepth: 0.55, gamma: 0.45, k: 1.5e+11 },
  { id: 'NaD1', label: 'Na D₁', species: 'Na', category: 'metal', nm: 589.6, stage: 0, dE_eV: 0, gLower: 2, maxDepth: 0.5, gamma: 0.45, k: 1.5e+11 },
  { id: 'Mgb', label: 'Mg b', species: 'Mg', category: 'metal', nm: 517.3, stage: 0, dE_eV: 2.71, gLower: 5, maxDepth: 0.45, gamma: 0.5, k: 1.5e+10 },
  { id: 'FeI', label: 'Fe I (blend)', species: 'Fe', category: 'metal', nm: 527.0, stage: 0, dE_eV: 0.05, gLower: 9, maxDepth: 0.35, gamma: 0.4, k: 5e+08 },
  { id: 'TiO1', label: 'TiO band', species: 'TiO', category: 'molecule', nm: 495, stage: 0, dE_eV: 0, gLower: 1, maxDepth: 0.85, gamma: 1 },
  { id: 'TiO2', label: 'TiO band', species: 'TiO', category: 'molecule', nm: 620, stage: 0, dE_eV: 0, gLower: 1, maxDepth: 0.8, gamma: 1 },
  { id: 'TiO3', label: 'TiO band', species: 'TiO', category: 'molecule', nm: 715, stage: 0, dE_eV: 0, gLower: 1, maxDepth: 0.75, gamma: 1 },
  { id: 'GBand', label: 'G-band (CH)', species: 'CH', category: 'molecule', nm: 430.5, stage: 0, dE_eV: 0, gLower: 1, maxDepth: 0.5, gamma: 1 },
];

/** Population of the line's lower level per H atom: abundance × Saha stage fraction × Boltzmann fraction. */
export function lineStrength(line: LineDef, T: number, ne_m3: number): number {
  if (line.species === 'TiO') return molecularBandStrength(T, 4200, 300); // TiO survives only below ~4500 K (K5–M)
  if (line.species === 'CH') return molecularBandStrength(T, 6300, 700) * molecularCoolCutoff(T);
  const sp = SPECIES[line.species];
  const fracStage = stageFractions(sp.chi_eV, sp.g, T, ne_m3)[line.stage];
  const gGroundOfStage = line.stage === 0 ? sp.g[0] : sp.g[line.stage];
  // Two-level Boltzmann fraction of the lower level within its stage (bounded, see <Hood>).
  const boltz = line.dE_eV === 0 ? 1 : boltzmannRatio(gGroundOfStage, line.gLower, line.dE_eV, T) /
    (1 + boltzmannRatio(gGroundOfStage, line.gLower, line.dE_eV, T));
  return sp.abundance * fracStage * boltz;
}

/** Line-centre optical depth: the lower-level population times a curated opacity scale `k`. */
export function lineTau(line: LineDef, T: number, ne_m3: number): number {
  return (line.k ?? 0) * lineStrength(line, T, ne_m3);
}

// TiO/CH molecular bands: empirical logistic cutoffs (no molecular-equilibrium solve here).
function molecularBandStrength(T: number, T0: number, width: number): number {
  return 1 / (1 + Math.exp((T - T0) / width));
}
function molecularCoolCutoff(T: number): number {
  // G-band fades again in the very coolest stars where CH itself gets swamped by TiO/dust — mild.
  return 1 / (1 + Math.exp((3200 - T) / 250));
}

/**
 * Depth (0..1, fraction of continuum removed at line centre). Atomic lines use a crude curve of
 * growth, depth = maxDepth · τ/(1+τ): linear in the population while weak, saturating once the
 * line centre is opaque. Molecular bands use an empirical logistic strength with a soft power.
 */
export function lineDepth(line: LineDef, T: number, ne_m3: number): number {
  if (line.category === 'molecule') return line.maxDepth * Math.pow(Math.min(1, Math.max(0, lineStrength(line, T, ne_m3))), line.gamma);
  const tau = lineTau(line, T, ne_m3);
  return line.maxDepth * (tau / (1 + tau));
}

// ---------------------------------------------------------------------------
// Line profile: pseudo-Voigt (Thompson–Cox–Hastings approximation)
// ---------------------------------------------------------------------------

const mu = 1.66053906660e-27; // kg, atomic mass unit

/** Gaussian FWHM (nm) from thermal Doppler broadening, Δλ/λ = sqrt(2kT/(mc^2)). */
export function dopplerFWHM_nm(nm: number, T: number, massAMU: number): number {
  const ratio = Math.sqrt((2 * kB * T) / (massAMU * mu * c * c));
  return nm * ratio * Math.sqrt(Math.LN2) * 2; // convert 1/e width factor to FWHM
}

/** Lorentzian FWHM (nm): a small natural width plus a pressure/collisional term ∝ n_e. */
export function lorentzFWHM_nm(nm: number, ne_m3: number): number {
  const natural = 3e-5 * (nm / 500);
  const pressure = 4e-4 * (nm / 500) * Math.pow(ne_m3 / 1e21, 0.7);
  return natural + pressure;
}

/** Pseudo-Voigt FWHM combination (Olivero & Longbothum 1977). */
export function voigtFWHM(fG: number, fL: number): number {
  return Math.pow(fG ** 5 + 2.69269 * fG ** 4 * fL + 2.42843 * fG ** 3 * fL ** 2 +
    4.47163 * fG ** 2 * fL ** 3 + 0.07842 * fG * fL ** 4 + fL ** 5, 0.2);
}

/** Normalised (peak = 1) pseudo-Voigt profile value at offset `dx` from line centre. */
export function pseudoVoigt(dx: number, fG: number, fL: number): number {
  const f = voigtFWHM(fG, fL);
  const ratio = fL / f;
  const eta = 1.36603 * ratio - 0.47719 * ratio ** 2 + 0.11116 * ratio ** 3;
  const sigmaG = f / (2 * Math.sqrt(2 * Math.LN2));
  const gauss = Math.exp(-(dx * dx) / (2 * sigmaG * sigmaG));
  const gammaL = f / 2;
  const lorentz = (gammaL * gammaL) / (dx * dx + gammaL * gammaL);
  return eta * lorentz + (1 - eta) * gauss;
}

// ---------------------------------------------------------------------------
// Spectral classification
// ---------------------------------------------------------------------------

export interface SpectralClass { letter: string; color: string; Tmax: number }
export const SPECTRAL_SEQUENCE: SpectralClass[] = [
  { letter: 'O', color: '#9bb0ff', Tmax: 400000 },
  { letter: 'B', color: '#aabfff', Tmax: 30000 },
  { letter: 'A', color: '#cad7ff', Tmax: 10000 },
  { letter: 'F', color: '#f8f7ff', Tmax: 7500 },
  { letter: 'G', color: '#fff4ea', Tmax: 6000 },
  { letter: 'K', color: '#ffd2a1', Tmax: 5200 },
  { letter: 'M', color: '#ffb56c', Tmax: 3700 },
  { letter: 'L/T/Y', color: '#ff8c5a', Tmax: 2400 },
];
/** Index of the class whose range [Tmax of the next class, own Tmax) contains T. */
function classIndex(T: number): number {
  const i = SPECTRAL_SEQUENCE.findIndex((s) => T >= s.Tmax); // first class entirely cooler than T
  if (i === 0) return 0; // hotter than every bound: O
  return i < 0 ? SPECTRAL_SEQUENCE.length - 1 : i - 1;
}
export function spectralType(T: number): string {
  return SPECTRAL_SEQUENCE[classIndex(T)].letter;
}
/** Rough numeric sub-type 0-9 within a class (0 = hottest), for labels like "G2". */
export function spectralSubtype(T: number): { letter: string; sub: number } {
  const i = classIndex(T);
  const hi = SPECTRAL_SEQUENCE[i].Tmax;
  const lo = i + 1 < SPECTRAL_SEQUENCE.length ? SPECTRAL_SEQUENCE[i + 1].Tmax : hi * 0.5;
  const sub = Math.round(9 * (1 - (T - lo) / (hi - lo)));
  return { letter: SPECTRAL_SEQUENCE[i].letter, sub: Math.min(9, Math.max(0, sub)) };
}

export interface StarPreset { name: string; T: number; label: string }
export const STAR_PRESETS: StarPreset[] = [
  { name: 'Vega', T: 9600, label: 'A0 V' },
  { name: 'Sun', T: 5772, label: 'G2 V' },
  { name: 'Betelgeuse', T: 3600, label: 'M1 Ia' },
  { name: 'Rigel', T: 12100, label: 'B8 Ia' },
  { name: 'Proxima Cen.', T: 2992, label: 'M5.5 V' },
];
