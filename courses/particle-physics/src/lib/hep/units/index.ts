/**
 * Natural units (ħ = c = 1) and the constants the course uses: the constants live in constants.ts (so that convert.ts can
 * import them without a cycle); the conversion and formatting functions are here.
 */
import { HBARC_GEV_FM, HBAR_GEV_S, C_M_S, HBARC2_GEV2_PB, GEV_KG, K_B_EV_K } from './constants.ts';
export * from './constants.ts';

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
