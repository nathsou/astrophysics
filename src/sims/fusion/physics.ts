// Shared physics for the fusion chapter's sims: Gamow-peak reaction-rate theory.
// All energies are in eV internally unless a function name says otherwise (keV/MeV helpers convert).

export const ALPHA = 1 / 137.035999;
export const AMU_EV = 931.494e6; // 1 u c^2 in eV
export const KB_EV = 8.617333262e-5; // Boltzmann constant, eV/K
export const KEV_FM = 1.439964e3; // e^2/(4 pi eps0) in keV*fm (1.439964 MeV*fm)

export interface Reaction {
  id: string;
  label: string;
  Z1: number;
  Z2: number;
  A1: number;
  A2: number;
}

// Reduced mass in amu.
export function reducedMassAmu(A1: number, A2: number): number {
  return (A1 * A2) / (A1 + A2);
}

export const REACTIONS: Reaction[] = [
  { id: 'pp', label: 'p + p', Z1: 1, Z2: 1, A1: 1.008, A2: 1.008 },
  { id: 'pC', label: 'p + ¹²C', Z1: 1, Z2: 6, A1: 1.008, A2: 12 },
  { id: 'pN', label: 'p + ¹⁴N', Z1: 1, Z2: 7, A1: 1.008, A2: 14 },
  { id: 'HeHe', label: '⁴He + ⁴He', Z1: 2, Z2: 2, A1: 4.0026, A2: 4.0026 },
  { id: 'CC', label: '¹²C + ¹²C', Z1: 6, Z2: 6, A1: 12, A2: 12 },
];

/** Gamow energy E_G = 2 mu c^2 (pi alpha Z1 Z2)^2, in eV. */
export function gamowEnergyEV(r: Reaction): number {
  const muAmu = reducedMassAmu(r.A1, r.A2);
  const muC2 = muAmu * AMU_EV;
  return 2 * muC2 * (Math.PI * ALPHA * r.Z1 * r.Z2) ** 2;
}

export function kTeV(T_MK: number): number {
  return KB_EV * T_MK * 1e6;
}

/** Location of the Gamow peak, in eV. */
export function gamowPeakE0(EG_eV: number, kT_eV: number): number {
  return Math.cbrt((EG_eV * kT_eV * kT_eV) / 4);
}

/** 1/e full width of the (Gaussian-approximated) Gamow peak, in eV. */
export function gamowWidth(E0_eV: number, kT_eV: number): number {
  return (4 / Math.sqrt(3)) * Math.sqrt(E0_eV * kT_eV);
}

export function lnIntegrand(E_eV: number, kT_eV: number, EG_eV: number): number {
  return -E_eV / kT_eV - Math.sqrt(EG_eV / E_eV);
}

export interface RateResult {
  E0: number; // eV
  width: number; // eV
  /** ln of the reaction rate up to an (arbitrary, S-factor-independent) additive constant. */
  logRate: number;
}

/**
 * Numerically integrate <sigma v> ~ mu^-1/2 (kT)^-3/2 * int S(E) exp(-E/kT - sqrt(EG/E)) dE,
 * with S(E) = 1 (constant S-factor — see the chapter's Hood for why this is a fine demo choice).
 * Returns everything in log form so cross-reaction comparisons never overflow.
 */
export function gamowRate(kT_eV: number, EG_eV: number, muAmu: number): RateResult {
  const E0 = gamowPeakE0(EG_eV, kT_eV);
  const width = gamowWidth(E0, kT_eV);
  const lo = Math.max(1e-6 * E0, E0 - 8 * width);
  const hi = E0 + 10 * width;
  const N = 800;
  const dE = (hi - lo) / N;
  // Saddle point (peak) value, computed analytically so the log-sum-exp trick never underflows.
  const gPeak = lnIntegrand(E0, kT_eV, EG_eV);
  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const E = lo + i * dE;
    const g = lnIntegrand(E, kT_eV, EG_eV) - gPeak; // <= 0
    const w = i === 0 || i === N ? 0.5 : 1; // trapezoid
    sum += w * Math.exp(g);
  }
  const logIntegral = gPeak + Math.log(sum * dE);
  const logPrefactor = -0.5 * Math.log(muAmu) - 1.5 * Math.log(kT_eV);
  return { E0, width, logRate: logPrefactor + logIntegral };
}

/** Effective temperature exponent nu = d ln(rate) / d ln(T), by central finite difference. */
export function rateExponent(T_MK: number, EG_eV: number, muAmu: number): number {
  const h = 1.001;
  const rp = gamowRate(kTeV(T_MK * h), EG_eV, muAmu).logRate;
  const rm = gamowRate(kTeV(T_MK / h), EG_eV, muAmu).logRate;
  return (rp - rm) / (2 * Math.log(h));
}
