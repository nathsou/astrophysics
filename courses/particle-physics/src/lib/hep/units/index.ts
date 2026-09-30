/**
 * Natural units (ħ = c = 1) and the constants the course uses.
 *
 * Energies, momenta and masses are in GeV throughout the library; lengths are in fm only when a
 * function says so; times in seconds only when a function says so. Convert with the factors below.
 * Values are CODATA 2018 / PDG 2024.
 */

/** ħc in GeV·fm. A length of 1 fm corresponds to an energy of ħc/1 fm = 0.1973 GeV. */
export const HBARC_GEV_FM = 0.1973269804;
/** ħc in MeV·fm (the form most people remember: 197.3). */
export const HBARC_MEV_FM = 197.3269804;
/** ħ in GeV·s. A width of 1 GeV corresponds to a lifetime ħ/Γ = 6.582e-25 s. */
export const HBAR_GEV_S = 6.582119569e-25;
/** Speed of light in m/s. */
export const C_M_S = 299792458;
/** Speed of light in mm/ns (handy for detector times). */
export const C_MM_NS = 299.792458;
/** (ħc)² in GeV²·mb, to convert cross-sections from GeV⁻² to millibarn. */
export const HBARC2_GEV2_MB = 0.3893793721;
/** (ħc)² in GeV²·pb. */
export const HBARC2_GEV2_PB = 0.3893793721e9;
/** (ħc)² in GeV²·nb. */
export const HBARC2_GEV2_NB = 0.3893793721e6;
/** Fine-structure constant at zero momentum transfer. */
export const ALPHA = 1 / 137.035999084;
/** Fine-structure constant at the Z mass (running value, about 1/127.95). */
export const ALPHA_MZ = 1 / 127.952;
/** Strong coupling at the Z mass. */
export const ALPHA_S_MZ = 0.1180;
/** Fermi constant in GeV⁻². */
export const G_F = 1.1663788e-5;
/** sin²θ_W (on-shell, from m_W and m_Z). */
export const SIN2_THETA_W = 0.2229;
/** Boltzmann constant in eV/K. */
export const K_B_EV_K = 8.617333262e-5;
/** Elementary charge in coulombs. */
export const E_COULOMB = 1.602176634e-19;
/** One GeV/c² in kilograms. */
export const GEV_KG = 1.78266192e-27;
/** Atomic mass unit in GeV/c². */
export const AMU_GEV = 0.93149410242;
/** Avogadro's number. */
export const N_A = 6.02214076e23;
/** Planck mass in GeV. */
export const M_PLANCK_GEV = 1.220890e19;

/** Metre ↔ GeV⁻¹: 1 m = 1e15 fm / ħc. */
export const M_PER_INV_GEV = HBARC_GEV_FM * 1e-15;

/** A length in fm to the equivalent energy in GeV (the energy needed to resolve it: E ≈ ħc/L). */
export function fmToGeV(lengthFm: number): number {
  return HBARC_GEV_FM / lengthFm;
}
/** An energy in GeV to the length in fm it resolves (λ = ħc/E). */
export function geVToFm(energyGeV: number): number {
  return HBARC_GEV_FM / energyGeV;
}
/** A mass or width in GeV to a lifetime in seconds (τ = ħ/Γ). */
export function widthToLifetime(widthGeV: number): number {
  return HBAR_GEV_S / widthGeV;
}
/** A lifetime in seconds to a width in GeV. */
export function lifetimeToWidth(seconds: number): number {
  return HBAR_GEV_S / seconds;
}
/** The decay length cτ·βγ in metres for a particle of mass m (GeV), momentum p (GeV) and lifetime τ (s). */
export function decayLength(massGeV: number, pGeV: number, lifetimeS: number): number {
  return (pGeV / massGeV) * C_M_S * lifetimeS;
}
/** Convert a cross-section in GeV⁻² to picobarn. */
export function invGeV2ToPb(x: number): number {
  return x * HBARC2_GEV2_PB;
}
/** Convert a cross-section in picobarn to GeV⁻². */
export function pbToInvGeV2(x: number): number {
  return x / HBARC2_GEV2_PB;
}
/** Mass in GeV to kilograms. */
export function geVToKg(massGeV: number): number {
  return massGeV * GEV_KG;
}
/** Temperature in kelvin to a typical energy k_B·T in GeV. */
export function kelvinToGeV(kelvin: number): number {
  return kelvin * K_B_EV_K * 1e-9;
}

/** SI prefixes for eV, for formatting. */
const PREFIXES: [number, string][] = [
  [1e12, 'TeV'],
  [1, 'GeV'],
  [1e-3, 'MeV'],
  [1e-6, 'keV'],
  [1e-9, 'eV'],
];
/** Format an energy in GeV with a sensible unit: 0.000511 → "511 keV", 125 → "125 GeV", 13000 → "13 TeV". */
export function formatEnergy(gev: number, digits = 3): string {
  const a = Math.abs(gev);
  if (a === 0) return '0 GeV';
  if (a >= 1e3) return `${trim(gev / 1e3, digits)} TeV`;
  for (const [f, u] of PREFIXES.slice(1)) if (a >= f) return `${trim(gev / f, digits)} ${u}`;
  return `${gev.toExponential(2)} GeV`;
}
/** Format a length in metres as "fm", "pm", "nm", "µm", "mm", "m" or "km". */
export function formatLength(m: number, digits = 3): string {
  const a = Math.abs(m);
  const table: [number, string][] = [
    [1e3, 'km'],
    [1, 'm'],
    [1e-3, 'mm'],
    [1e-6, 'µm'],
    [1e-9, 'nm'],
    [1e-12, 'pm'],
    [1e-15, 'fm'],
    [1e-18, 'am'],
  ];
  for (const [f, u] of table) if (a >= f) return `${trim(m / f, digits)} ${u}`;
  return `${m.toExponential(2)} m`;
}
/** Format a time in seconds with a unit from ys to years. */
export function formatTime(s: number, digits = 3): string {
  const a = Math.abs(s);
  const table: [number, string][] = [
    [3.15576e7, 'years'],
    [86400, 'days'],
    [3600, 'h'],
    [60, 'min'],
    [1, 's'],
    [1e-3, 'ms'],
    [1e-6, 'µs'],
    [1e-9, 'ns'],
    [1e-12, 'ps'],
    [1e-15, 'fs'],
    [1e-18, 'as'],
    [1e-21, 'zs'],
    [1e-24, 'ys'],
  ];
  for (const [f, u] of table) if (a >= f) return `${trim(s / f, digits)} ${u}`;
  return `${s.toExponential(2)} s`;
}
function trim(x: number, digits: number): string {
  return Number(x.toPrecision(digits)).toString();
}
export * from "./convert.ts";
