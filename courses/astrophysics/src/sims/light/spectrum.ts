// Shared spectral helpers for chapter 4 (Light & Blackbodies) sims.
// Builds on src/lib/physics/blackbody.ts (Planck function + CIE colour matching) without
// modifying that shared file.

import { planckLambda } from '../../lib/physics/blackbody';
import { h, c, kB, sigmaSB } from '../../lib/physics/constants';

/** Planck spectral radiance B_ν(T) in W sr⁻¹ m⁻² Hz⁻¹. */
export function planckNu(nu: number, T: number): number {
  const x = (h * nu) / (kB * T);
  if (x > 700) return 0;
  return (2 * h * nu ** 3) / (c * c) / Math.expm1(x);
}

/** Rayleigh–Jeans approximation to B_λ (low-frequency / classical limit, no ℏ). */
export function rayleighJeansLambda(lambda: number, T: number): number {
  return (2 * c * kB * T) / lambda ** 4;
}

/** Wien approximation to B_λ (high-frequency limit, drops the "−1" in the Bose–Einstein factor). */
export function wienApproxLambda(lambda: number, T: number): number {
  const x = (h * c) / (lambda * kB * T);
  return ((2 * h * c * c) / lambda ** 5) * Math.exp(-x);
}

/** Emitted flux (radiant exitance) from a surface at temperature T: F = σT⁴, in W/m². */
export const totalFlux = (T: number) => sigmaSB * T ** 4;

/**
 * Fraction of a blackbody's emitted power that falls in the visible band (380–780 nm),
 * by numerically integrating B_λ in log(λ) (trapezoid rule) from 1 nm to 1 m.
 */
export function visibleFraction(T: number): number {
  const lo = Math.log(1e-9), hi = Math.log(1);
  const N = 2000;
  const dlnl = (hi - lo) / N;
  let total = 0, visible = 0;
  let prevL = Math.exp(lo), prevB = planckLambda(prevL, T) * prevL; // integrand in d(lnλ): λ·B_λ
  for (let i = 1; i <= N; i++) {
    const l = Math.exp(lo + i * dlnl);
    const B = planckLambda(l, T) * l;
    const seg = 0.5 * (prevB + B) * dlnl;
    total += seg;
    if (l >= 380e-9 && l <= 780e-9) visible += seg;
    prevL = l; prevB = B;
  }
  return total > 0 ? visible / total : 0;
}

/**
 * Natural log of B_λ(T), computed so it stays finite even when B_λ itself underflows to zero
 * (e.g. 440 nm at 3 K): for x = hc/λk_BT ≳ 50, ln(eˣ−1) ≈ x, so we use that branch instead of
 * ln(expm1(x)), which would otherwise hand back ln(Infinity) or ln(0).
 */
function lnPlanckLambda(lambda: number, T: number): number {
  const x = (h * c) / (lambda * kB * T);
  const lnCoeff = Math.log(2 * h * c * c) - 5 * Math.log(lambda);
  const lnDenom = x > 50 ? x : Math.log(Math.expm1(x));
  return lnCoeff - lnDenom;
}

/**
 * Simplified two-band "colour index": −2.5·log₁₀(B_λ(440 nm)/B_λ(550 nm)), zero-pointed so the
 * Sun's index matches its real B−V ≈ 0.63. This is a Planck-ratio proxy, not the actual UBV
 * filter photometry (which integrates over broad, non-Planckian filter+detector response curves).
 * Stays finite (very large and red) even for objects with negligible visible emission.
 */
export function colorIndexBV(T: number): number {
  const LN10 = Math.LN10;
  const raw = (-2.5 / LN10) * (lnPlanckLambda(440e-9, T) - lnPlanckLambda(550e-9, T));
  const rawSun = (-2.5 / LN10) * (lnPlanckLambda(440e-9, 5772) - lnPlanckLambda(550e-9, 5772));
  return raw - rawSun + 0.63;
}

export interface Preset {
  label: string;
  T: number;
}

export const PRESETS: Preset[] = [
  { label: 'CMB', T: 2.725 },
  { label: 'Human body', T: 310 },
  { label: 'Earth', T: 255 },
  { label: 'Sun', T: 5772 },
  { label: 'Sirius A', T: 9940 },
  { label: 'O star', T: 40000 },
  { label: 'Accretion disk', T: 1e6 },
];
