/**
 * Thermal freeze-out of a relic particle (Chapter 32): the Boltzmann equation for the comoving abundance Y = n/s of a heavy particle X that annihilates with a
 * thermally averaged cross-section ⟨σv⟩,
 *
 *     dY/dx = −(λ/x²) (Y² − Y_eq²),   x = m/T,   λ = (2π²/45) (g*s / (1.66 √g*)) m M_Planck ⟨σv⟩,
 *     Y_eq = (45/(2π²)) (g/g*s) (x/2π)^{3/2} e^{−x}   (non-relativistic).
 *
 * The relic density today is Ω h² = m Y∞ s₀ / (ρ_c/h²) = 2.742 × 10⁸ (m/GeV) Y∞ (s₀ = 2891 cm⁻³, ρ_c/h² = 1.054 × 10⁻⁵ GeV/cm³).
 * A TOY of the standard calculation (Kolb and Turner, *The Early Universe*): s-wave annihilation with a constant ⟨σv⟩, constant g* = g*s, no co-annihilation,
 * no Sommerfeld enhancement, instant kinetic decoupling. The equation is integrated with an implicit (stable) Euler step on a logarithmic grid in x.
 */
import { M_PLANCK_GEV, HBARC2_GEV2_MB, C_M_S } from '$lib/hep/units';

/** 1 GeV⁻² expressed in cm³/s as a cross-section times c: (ħc)² [cm² GeV²] × c [cm/s]. */
export const CM3S_PER_GEV2 = HBARC2_GEV2_MB * 1e-27 * C_M_S * 100;
export const OMEGA_H2_COEFF = 2.742e8;

export interface FreezeOutOptions {
  /** Mass in GeV. */
  mass: number;
  /** ⟨σv⟩ in cm³/s. */
  sigmaV: number;
  /** Relativistic degrees of freedom g* (= g*s), default 90. */
  gStar?: number;
  /** Internal degrees of freedom of X, default 2. */
  g?: number;
  xStart?: number;
  xEnd?: number;
}

export interface FreezeOutResult {
  x: number[];
  Y: number[];
  Yeq: number[];
  /** Y at the end. */
  Yinf: number;
  /** Ω h² today. */
  omegaH2: number;
  /** The x at which Y first exceeds 1.5 Y_eq (a working definition of freeze-out). */
  xFreeze: number;
}

export function yEq(x: number, g: number, gStar: number): number {
  return 0.1448 * (g / gStar) * Math.pow(x, 1.5) * Math.exp(-x);
}

export function solveFreezeOut(o: FreezeOutOptions): FreezeOutResult {
  const gStar = o.gStar ?? 90;
  const g = o.g ?? 2;
  const x0 = o.xStart ?? 1.5, x1 = o.xEnd ?? 1000;
  const sv = o.sigmaV / CM3S_PER_GEV2; // GeV⁻²
  const lambda = ((2 * Math.PI ** 2) / 45) * (gStar / (1.66 * Math.sqrt(gStar))) * o.mass * M_PLANCK_GEV * sv;
  const steps = 4000;
  const f = Math.pow(x1 / x0, 1 / steps);
  let x = x0;
  let Y = yEq(x0, g, gStar);
  const xs = [x], Ys = [Y], Es = [Y];
  let xFreeze = NaN;
  for (let i = 0; i < steps; i++) {
    const xn = x * f;
    const h = xn - x;
    const xm = 0.5 * (x + xn);
    const a = (h * lambda) / (xm * xm);
    const eq = yEq(xn, g, gStar);
    // implicit step: Y1 − Y0 = −a (Y1² − eq²)  →  a Y1² + Y1 − (Y0 + a eq²) = 0
    const Y1 = (-1 + Math.sqrt(1 + 4 * a * (Y + a * eq * eq))) / (2 * a);
    Y = Y1;
    x = xn;
    if (Number.isNaN(xFreeze) && Y > 1.5 * eq) xFreeze = x;
    xs.push(x);
    Ys.push(Y);
    Es.push(eq);
  }
  return { x: xs, Y: Ys, Yeq: Es, Yinf: Y, omegaH2: OMEGA_H2_COEFF * o.mass * Y, xFreeze };
}

/** The cross-section (cm³/s) that gives a target Ω h² for a given mass, by bisection on a log scale (Ω falls as ⟨σv⟩ grows). */
export function sigmaVForOmega(target: number, mass: number, opts: Omit<FreezeOutOptions, 'mass' | 'sigmaV'> = {}): number {
  let lo = 1e-32, hi = 1e-20;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    const om = solveFreezeOut({ mass, sigmaV: mid, ...opts }).omegaH2;
    if (om > target) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}
