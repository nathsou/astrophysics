/**
 * The electroweak relations of Chapter 23: the masses of the W and Z from G_F, α and the weak mixing angle at tree level,
 * the range of the weak force, the neutral-current ratios of neutrino scattering, the Jacobian edge of the lepton's transverse
 * momentum and the stochastic-cooling toy.
 */
import { M_W, M_Z, ALPHA_0, ALPHA_MZ_MSBAR, G_F, SIN2W_EFF, SIN2W_MSBAR } from '$lib/hep/sm';
import { HBARC_GEV_FM } from '$lib/hep/units';
import { normal, type Rng } from '$lib/hep/random';

/** A = (π α / (√2 G_F))^{1/2}, in GeV: the tree-level relation m_W sin θ_W = A and m_Z sin θ_W cos θ_W = A (37.28 GeV for α = 1/137.036). */
export const aScale = (alpha: number, GF = G_F): number => Math.sqrt((Math.PI * alpha) / (Math.SQRT2 * GF));

/** Tree-level masses from (α, G_F) and sin²θ_W: m_W = A/sinθ, m_Z = A/(sinθ cosθ). */
export function treeMasses(sin2w: number, alpha: number = ALPHA_0, GF = G_F): { mW: number; mZ: number; A: number } {
  const A = aScale(alpha, GF);
  const s = Math.sqrt(sin2w), c = Math.sqrt(1 - sin2w);
  return { mW: A / s, mZ: A / (s * c), A };
}

/** The value of α(0) and of α at the Z scale (MS-bar, 1/127.952), as used in the widget's two columns. */
export const ALPHAS = { zero: ALPHA_0, atZ: ALPHA_MZ_MSBAR };
export { SIN2W_EFF, SIN2W_MSBAR };

/** The on-shell definition sin²θ_W = 1 − m_W²/m_Z². */
export const sin2wOnShell = (mW = M_W, mZ = M_Z): number => 1 - (mW / mZ) ** 2;

/** The range of a force carried by a particle of mass m (GeV): ħc/(m c²) in femtometres. */
export const rangeFm = (mGeV: number): number => HBARC_GEV_FM / mGeV;

/** G_F/√2 = g²/(8 m_W²) with g = e/sinθ_W: the Fermi constant from the W mass and the coupling, in GeV⁻². */
export function fermiFromW(mW: number, sin2w: number, alpha: number): number {
  const g2 = (4 * Math.PI * alpha) / sin2w;
  return (Math.SQRT2 * g2) / (8 * mW * mW);
}

/**
 * The neutral-current to charged-current ratios of ν and ν̄ scattering on an isoscalar target (quark model, no sea),
 * R_ν = ½ − s² + (5/9)(1 + r) s⁴ and R_ν̄ = ½ − s² + (5/9)(1 + 1/r) s⁴ with s² = sin²θ_W and r = σ(ν̄ CC)/σ(ν CC) ≈ 0.4.
 */
export function neutralCurrentRatios(sin2w: number, r = 0.4): { nu: number; nubar: number } {
  const base = 0.5 - sin2w;
  const s4 = (5 / 9) * sin2w * sin2w;
  return { nu: base + s4 * (1 + r), nubar: base + s4 * (1 + 1 / r) };
}

// ── the Jacobian edge ────────────────────────────────────────────────────────────────────────────

/**
 * The density of the charged lepton's transverse momentum in W → ℓν for a W at rest: with cosθ* = √(1 − (2 p_T/m)²) and the decay
 * distribution (1 + cos²θ*) (the sum of the (1 ∓ cosθ*)² of the two charges), dN/dp_T = (3/4)(1 + c²)·4 p_T/(m² c) for p_T < m/2.
 * It is normalised to 1 and diverges (integrably) at p_T = m/2: the Jacobian peak.
 */
export function jacobianDensity(pt: number, m: number): number {
  const x = (2 * pt) / m;
  if (pt <= 0 || x >= 1) return 0;
  const c = Math.sqrt(1 - x * x);
  return (0.75 * (1 + c * c) * 4 * pt) / (m * m * c);
}

/** The same for the transverse mass of a W at rest: m_T = 2 p_T, so the density in m_T is the one above at p_T = m_T/2, halved. */
export function mtDensityAtRest(mt: number, m: number): number {
  return 0.5 * jacobianDensity(mt / 2, m);
}

// ── stochastic cooling ───────────────────────────────────────────────────────────────────────────

export interface CoolingRun {
  /** rms of the transverse positions after each turn (arbitrary units), starting at 1. */
  rms: number[];
  /** The prediction (1 − 2g/s + g²/s)^(n/2) for independent samples. */
  predicted: number[];
}

/**
 * A toy of van der Meer's stochastic cooling. `N` particles have transverse offsets x_i (rms 1). Each turn the particles are
 * shuffled (the mixing of the real machine), split into samples of `s` particles, and every particle in a sample is corrected by
 * −g times the mean offset of its sample. For independent offsets the variance falls by the factor 1 − 2g/s + g²/s each turn, which
 * is best at g = 1: 1 − 1/s. Fewer particles per sample, or more turns, cool faster.
 */
export function coolingToy(r: Rng, N: number, s: number, g: number, turns: number): CoolingRun {
  const x = Array.from({ length: N }, () => normal(r, 0, 1));
  const rmsOf = () => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / N);
  const r0 = rmsOf();
  const rms = [1];
  const predicted = [1];
  const f = 1 - (2 * g) / s + (g * g) / s;
  for (let t = 1; t <= turns; t++) {
    // shuffle by a Fisher–Yates pass
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = x[i]!;
      x[i] = x[j]!;
      x[j] = tmp;
    }
    for (let a = 0; a + s <= N; a += s) {
      let m = 0;
      for (let k = 0; k < s; k++) m += x[a + k]!;
      m /= s;
      for (let k = 0; k < s; k++) x[a + k]! -= g * m;
    }
    rms.push(rmsOf() / r0);
    predicted.push(Math.pow(Math.max(f, 0), t / 2));
  }
  return { rms, predicted };
}
