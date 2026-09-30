/**
 * The tree-level cross-section for f f̄ → γ*, Z, Z′ → f′ f̄′ with massless initial fermions and a final fermion of mass m:
 * exact in the couplings, with the interference between all exchanged bosons and the forward–backward asymmetry.
 *
 * Amplitudes by initial helicity i ∈ {L, R}: the final fermion's vector and axial couplings give
 *
 *     V_i = Q_i Q_f + Σ_B κ_B g_i^B (g_L^f + g_R^f)/2 χ_B(s)
 *     A_i =           Σ_B κ_B g_i^B (g_L^f − g_R^f)/2 χ_B(s)
 *
 * where g_{L,R} are the chiral couplings in units of e/(sinθW cosθW), κ_B = (coupling of B / e)² and
 * χ_B = s/(s − M_B² + i M_B Γ_B(s)) is the propagator relative to the photon's. The angular distribution, with β = √(1 − 4m²/s)
 * and θ the angle between the incoming fermion and the outgoing fermion, is
 *
 *     dσ/dcosθ = C π α² β/(4s) Σ_i [ |V_i|² (2 − β² sin²θ) + |A_i|² β² (1 + cos²θ) ± 4 β cosθ Re(V_i A_i*) ]
 *
 * with + for i = L and − for i = R, and C the colour factor (N_c of the final state, or 1/N_c for quark annihilation).
 * For pure photon exchange this is the QED result πα²β/(2s) [1 + cos²θ + (1 − β²) sin²θ]; for massless fermions and only a Z
 * it gives the textbook (g_L², g_R²) combinations. Units: GeV⁻².
 */
import { G_F, ALPHA_0, M_Z, GAMMA_Z, chi, type Complex } from '../sm/index.ts';

export interface Chiral {
  L: number;
  R: number;
}
export interface Exchange {
  mass: number;
  width: number;
  /** Couplings to the initial fermion (g_L, g_R), in units of e/(sinθW cosθW) for the Z. */
  gi: Chiral;
  /** Couplings to the final fermion. */
  gf: Chiral;
  /** (coupling/e)² of this boson: 1/(sin²θW cos²θW) for the Z, expressed in the G_F scheme by `zKappa`. */
  kappa: number;
  /** Use Γ(s) = Γ s/M² (default true). */
  running?: boolean;
}

/** κ for the Z in the G_F scheme: e²/(sin²θW cos²θW) = 4√2 G_F mZ², divided by e² = 4πα. */
export function zKappa(alpha: number): number {
  return (Math.SQRT2 * G_F * M_Z * M_Z) / (Math.PI * alpha);
}

export interface EwCoefficients {
  /** Σ_i |V_i|², Σ_i |A_i|², Σ_i ± Re(V_i A_i*). */
  P: number;
  Q: number;
  R: number;
  /** C π α² β/(4 s). */
  k: number;
  beta: number;
}

/** The propagators χ_B(s) of a list of exchanges (compute once per s and pass to `ewCoefficients` for many fermions). */
export function ewPropagators(s: number, exchanges: readonly Exchange[]): Complex[] {
  return exchanges.map((ex) => chi(s, ex.mass, ex.width, ex.running ?? true));
}

/** Coefficients at a fixed s: dσ/dcosθ = k [P (2 − β²(1−c²)) + Q β² (1+c²) + 4 β R c]. `chis` optionally supplies precomputed propagators. */
export function ewCoefficients(s: number, Qi: number, Qf: number, exchanges: readonly Exchange[], alpha: number, colour: number, mf = 0, chis?: readonly Complex[]): EwCoefficients {
  const b2 = mf > 0 ? Math.max(0, 1 - (4 * mf * mf) / s) : 1;
  const beta = Math.sqrt(b2);
  let P = 0, Q = 0, R = 0;
  for (let i = 0; i < 2; i++) {
    let Vre = Qi * Qf, Vim = 0, Are = 0, Aim = 0;
    for (let e = 0; e < exchanges.length; e++) {
      const ex = exchanges[e]!;
      const c = chis ? chis[e]! : chi(s, ex.mass, ex.width, ex.running ?? true);
      const gi = i === 0 ? ex.gi.L : ex.gi.R;
      const cv = ex.kappa * gi * 0.5 * (ex.gf.L + ex.gf.R);
      const ca = ex.kappa * gi * 0.5 * (ex.gf.L - ex.gf.R);
      Vre += cv * c.re;
      Vim += cv * c.im;
      Are += ca * c.re;
      Aim += ca * c.im;
    }
    P += Vre * Vre + Vim * Vim;
    Q += Are * Are + Aim * Aim;
    R += (i === 0 ? 1 : -1) * (Vre * Are + Vim * Aim);
  }
  return { P, Q, R, k: (colour * Math.PI * alpha * alpha * beta) / (4 * s), beta };
}
/** dσ/dcosθ in GeV⁻² from the coefficients. */
export function ewDiff(co: EwCoefficients, c: number): number {
  const b2 = co.beta * co.beta;
  return co.k * (co.P * (2 - b2 * (1 - c * c)) + co.Q * b2 * (1 + c * c) + 4 * co.beta * co.R * c);
}
/** The angle-integrated cross-section in GeV⁻². */
export function ewTotal(co: EwCoefficients): number {
  const b2 = co.beta * co.beta;
  return co.k * (co.P * (4 - (4 * b2) / 3) + co.Q * b2 * (8 / 3));
}
/** The forward–backward asymmetry (σ_F − σ_B)/(σ_F + σ_B). */
export function ewAfb(co: EwCoefficients): number {
  const tot = ewTotal(co);
  if (tot === 0) return 0;
  return (co.k * 4 * co.beta * co.beta * co.R) / tot;
}
/** The maximum of dσ/dcosθ over [−1, 1] (for accept–reject). */
export function ewMax(co: EwCoefficients): number {
  let m = Math.max(ewDiff(co, -1), ewDiff(co, 1));
  // the quadratic a + b c + d c²: interior extremum at c = −b/(2d)
  const b2 = co.beta * co.beta;
  const d = co.k * (co.P * b2 + co.Q * b2);
  const b = co.k * 4 * co.beta * co.R;
  if (d < 0) {
    const cv = -b / (2 * d);
    if (cv > -1 && cv < 1) m = Math.max(m, ewDiff(co, cv));
  }
  return m;
}

/** The Standard-Model Z as an exchange for a given initial and final fermion (couplings from `zCouplings`). */
export function zExchange(gi: Chiral, gf: Chiral, alpha: number, width = GAMMA_Z): Exchange {
  return { mass: M_Z, width, gi, gf, kappa: zKappa(alpha), running: true };
}
export { ALPHA_0 };
