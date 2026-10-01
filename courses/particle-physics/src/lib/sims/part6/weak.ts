/**
 * The numbers behind Chapter 22 (the weak force): the continuous beta spectrum, two-body decay kinematics, the angular
 * distribution of Wu's experiment, helicity suppression in pion decay and the muon lifetime from Fermi's constant.
 *
 * Everything is tree level and natural units (GeV) unless a name says otherwise. The beta-decay spectrum is the
 * phase-space part only: the Coulomb ("Fermi") function and the forbidden-decay shape factors are left out, and the widgets
 * that draw it say so.
 */
import { particle } from '$lib/hep/particles';
import { twoBodyMomentum } from '$lib/hep/kinematics';
import { G_F } from '$lib/hep/sm';
import { HBAR_GEV_S } from '$lib/hep/units';
import type { Rng } from '$lib/hep/random';

const M_E = particle(11).mass;

/**
 * The shape of the electron's kinetic-energy spectrum in a three-body beta decay with a massless neutrino and a heavy, slow recoiling nucleus:
 * dN/dT ∝ p E (T0 − T)², with E = T + m_e the electron's energy and p its momentum. T0 is the end-point (the largest kinetic
 * energy). The factor (T0 − T)² is the neutrino's phase space; p E is the electron's. The Coulomb correction is not included.
 * Units: any energy unit, as long as T, T0 and m are in the same one (default: the electron mass in GeV).
 */
export function betaSpectrum(T: number, T0: number, m = M_E): number {
  if (T <= 0 || T >= T0) return 0;
  const E = T + m;
  const p = Math.sqrt(T * T + 2 * m * T);
  return p * E * (T0 - T) * (T0 - T);
}

/** Mean kinetic energy of the electron for the spectrum above, by the trapezoid rule on n points. */
export function betaMeanEnergy(T0: number, m = M_E, n = 4000): number {
  let s0 = 0, s1 = 0;
  const h = T0 / n;
  for (let i = 1; i < n; i++) {
    const T = i * h;
    const w = betaSpectrum(T, T0, m);
    s0 += w;
    s1 += w * T;
  }
  return s1 / s0;
}

/**
 * Kinetic energy (GeV) of the electron in the decay of a particle of mass M into a daughter of mass m1 and an electron, if it were a two-body decay
 * (daughter and electron alone): fixed by the masses, so the spectrum would be a single line.
 */
export function twoBodyElectronEnergy(M: number, m1: number, m = M_E): number {
  const p = twoBodyMomentum(M, m1, m);
  return Math.hypot(p, m) - m;
}

/**
 * Wu's angular distribution. For polarised nuclei the electron's direction, at angle θ to the nuclear spin, follows
 * W(θ) ∝ 1 + a cosθ with a = A P β: A the asymmetry parameter of the decay (−1 for ⁶⁰Co β⁻ decay), P the degree of polarisation
 * (between 0 and 1) and β the electron's speed in units of c.
 */
export const wuAsymmetry = (A: number, P: number, beta = 1): number => A * P * beta;

/** Draw cosθ from (1 + a cosθ)/2 on [−1, 1] by inverting the cumulative distribution. */
export function sampleCosTheta(r: Rng, a: number): number {
  const u = r();
  if (Math.abs(a) < 1e-9) return 2 * u - 1;
  // F(c) = (c + 1)/2 + a (c² − 1)/4 = u  →  a c² + 2 c + (2 − a − 4u) = 0
  const disc = 1 - a * (2 - a - 4 * u);
  const c = (-1 + Math.sqrt(Math.max(0, disc))) / a;
  return Math.max(-1, Math.min(1, c));
}

/** The probability that the electron goes into the forward half (cosθ > 0) of the nuclear spin: ½ + a/4. */
export const forwardFraction = (a: number): number => 0.5 + a / 4;

/** Mirror image of a direction: a polar vector (momentum) flips its component along the mirror normal, an axial vector (spin) does not. */
export function mirrorCos(c: number): number {
  // with the mirror plane perpendicular to the spin axis, the electron's component along the axis changes sign and the spin does not
  return -c;
}

// ── helicity suppression ─────────────────────────────────────────────────────────────────────────

/**
 * The ratio Γ(π → e ν)/Γ(π → μ ν) at leading order: (m_e/m_μ)² ((m_π² − m_e²)/(m_π² − m_μ²))², from the masses in the particle table.
 * The measured ratio is 1.2327(23) × 10⁻⁴ (PDG); radiative corrections of order α account for the 4 % difference.
 */
export function pionLeptonicRatio(): number {
  const mpi = particle(211).mass, me = particle(11).mass, mmu = particle(13).mass;
  return (me / mmu) ** 2 * ((mpi * mpi - me * me) / (mpi * mpi - mmu * mmu)) ** 2;
}

/** The two factors of the ratio: the helicity factor (m_e/m_μ)² and the phase-space factor. */
export function pionRatioFactors(): { helicity: number; phaseSpace: number } {
  const mpi = particle(211).mass, me = particle(11).mass, mmu = particle(13).mass;
  return { helicity: (me / mmu) ** 2, phaseSpace: ((mpi * mpi - me * me) / (mpi * mpi - mmu * mmu)) ** 2 };
}

export interface PionLepton {
  /** The lepton's momentum, energy and speed in the pion's rest frame (GeV, GeV, units of c). */
  p: number;
  E: number;
  beta: number;
  /** The probability of the "wrong" helicity for a lepton made by a left-handed current: (1 − β)/2 ≈ m²/(4E²). */
  wrongHelicity: number;
  /** Γ ∝ m_ℓ² (1 − m_ℓ²/m_π²)², in units where the pion's common factor G_F² f_π² m_π |V_ud|²/(8π) is 1 (GeV²). */
  rateFactor: number;
}

/** Kinematics and helicity of the charged lepton in π⁺ → ℓ⁺ ν for a lepton of mass `ml` (GeV); zero rate if the decay is forbidden. */
export function pionDecayLepton(ml: number): PionLepton {
  const mpi = particle(211).mass;
  if (ml >= mpi) return { p: 0, E: ml, beta: 0, wrongHelicity: 0.5, rateFactor: 0 };
  const p = twoBodyMomentum(mpi, ml, 0);
  const E = Math.hypot(p, ml);
  const beta = p / E;
  // (1 − β)/2 without cancellation: 1 − β = (E − p)/E = m²/(E (E + p))
  const wrong = ml * ml / (E * (E + p)) / 2;
  return { p, E, beta, wrongHelicity: wrong, rateFactor: ml * ml * (1 - (ml * ml) / (mpi * mpi)) ** 2 };
}

// ── Fermi's constant ─────────────────────────────────────────────────────────────────────────────

/** The muon's decay width at leading order, Γ = G_F² m_μ⁵/(192π³), GeV. */
export function muonWidthFermi(GF = G_F, mmu = particle(13).mass): number {
  return (GF * GF * mmu ** 5) / (192 * Math.PI ** 3);
}

/** The mean lifetime in seconds for that width. */
export const muonLifetimeFermi = (GF = G_F): number => HBAR_GEV_S / muonWidthFermi(GF);

/** Mean free path (cm) of an antineutrino in a material with `nPerCm3` free protons per cm³, for a cross-section in cm². */
export const meanFreePathCm = (nPerCm3: number, sigmaCm2: number): number => 1 / (nPerCm3 * sigmaCm2);

/** Free protons per cm³ of water (two hydrogen atoms per molecule). */
export const protonsPerCm3Water = (): number => (2 * 6.02214076e23) / 18.01528;
