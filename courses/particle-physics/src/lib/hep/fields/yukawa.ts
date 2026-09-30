/**
 * Exchange of a massive particle and Yukawa's potential.
 *
 * The static potential between two sources that exchange a scalar of mass m is the three-dimensional Fourier transform of
 * the propagator 1/(q² + m²):  ∫ d³q/(2π)³ e^{iq·r}/(q² + m²) = e^{−mr}/(4πr),  with r in units of ħ/(mc) = ħc/(mc²).
 * The range R = ħc/(mc²) follows: 1.41 fm for the charged pion, 386 fm for the electron's mass, 2.45e−3 fm for the W.
 *
 * Units here: lengths in fm, masses in MeV/c², ħc = 197.327 MeV fm.
 */
import { HBARC_MEV_FM, HBAR_GEV_S, M_ELECTRON_MEV } from './constants.ts';

/** The range of the force, R = ħc/(mc²), in fm, for a mediator of mass `massMeV`. */
export function rangeFm(massMeV: number): number {
  return HBARC_MEV_FM / massMeV;
}
/** Yukawa's inversion: the mass (MeV/c²) of a mediator that gives a force of range `rangeFm`. */
export function massFromRangeMeV(range: number): number {
  return HBARC_MEV_FM / range;
}
/** The same in units of the electron mass (0.51099895 MeV). */
export function massInElectronMasses(massMeV: number): number {
  return massMeV / M_ELECTRON_MEV;
}
/** How long a virtual quantum of this mass may live on the energy–time argument, Δt ≈ ħ/(mc²), in seconds. */
export function virtualLifetimeS(massMeV: number): number {
  return HBAR_GEV_S / (massMeV * 1e-3);
}
/** The Yukawa shape e^{−r/R}/r for a mediator of mass `massMeV` (r in fm). The massless case is 1/r. */
export function yukawaShape(rFm: number, massMeV: number): number {
  return Math.exp(-(rFm * massMeV) / HBARC_MEV_FM) / rFm;
}
/**
 * The Yukawa potential V(r) = −(g²/4π) e^{−r/R}/r in MeV, for the coupling constant α_g = g²/(4π) (dimensionless) and r in fm
 * (the factor ħc converts 1/fm to MeV).
 */
export function yukawaPotentialMeV(rFm: number, massMeV: number, alphaG: number): number {
  return -alphaG * HBARC_MEV_FM * yukawaShape(rFm, massMeV);
}
/** The force F = −dV/dr in MeV/fm (attractive: negative). */
export function yukawaForceMeVPerFm(rFm: number, massMeV: number, alphaG: number): number {
  const R = rangeFm(massMeV);
  return -alphaG * HBARC_MEV_FM * Math.exp(-rFm / R) * (1 / (rFm * rFm) + 1 / (R * rFm));
}
/** The propagator in momentum space, 1/(q² + m²), with q and m in the same unit. */
export function propagator(q: number, m: number): number {
  return 1 / (q * q + m * m);
}
/** The distance at which V has fallen to 1/e of the pure Coulomb-like 1/r: r = R (the range) gives e^{−1}. */
export function suppressionAt(rFm: number, massMeV: number): number {
  return Math.exp(-rFm / rangeFm(massMeV));
}
