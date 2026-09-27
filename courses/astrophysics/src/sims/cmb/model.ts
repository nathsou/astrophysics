// Approximate ΛCDM temperature power spectrum for Chapter 27.
//
// This is a *fitting model*, not a Boltzmann code (CAMB/CLASS). It keeps the physics that sets the
// shape of D_ℓ, so that the peaks move and change height for the right reasons:
//   • a Sachs–Wolfe plateau Θ ≈ Ψ/3 with tilt n_s,
//   • acoustic oscillations of the photon–baryon fluid, [(1+3R) cos(k r_s + phase) − 3R],
//     projected with k ≈ ℓ / D_M (so peak n sits at ℓ ≈ ℓ_A (n − φ)),
//   • a Doppler (velocity) term ∝ sin, out of phase with the density term, which fills the troughs,
//   • radiation driving: modes that entered the horizon before matter–radiation equality are boosted,
//     and their potential wells have decayed (so the baryon offset −3RΨ fades at high ℓ),
//   • Silk damping ∝ exp(−(ℓ/ℓ_D)^1.2), and reionisation suppression e^{−2τ}.
// Calibrated by hand against the Planck 2018 best fit to ~10–15 % over 2 ≤ ℓ ≤ 2000.
// Units: D_ℓ in μK², distances in Mpc (comoving).

export interface CosmoParams {
  ombh2: number; // Ω_b h²
  omch2: number; // Ω_c h²
  omk: number; // Ω_k (curvature; > 0 open, < 0 closed)
  ns: number; // scalar spectral index
  As: number; // primordial amplitude (×10⁻⁹)
  h: number; // H0 / 100 km/s/Mpc
  tau: number; // reionisation optical depth
}

export const PLANCK: CosmoParams = { ombh2: 0.02237, omch2: 0.1200, omk: 0, ns: 0.9649, As: 2.1, h: 0.6736, tau: 0.0544 };

export const T0 = 2.7255; // K
const C_KMS = 299792.458;
const ZSTAR = 1090;
const OMNU_H2 = 0.00064;
const OMGAM_H2 = 2.47e-5;
const OMRAD_H2 = OMGAM_H2 * (1 + 0.2271 * 3.046);

/** Fitting coefficients (calibrated against Planck 2018 TT; see PLANCK_POINTS). */
export const FIT = { K: 1.424, p: 1.062, drive: 2.146, well: 0.0828, phi: 0.2664, dop: 0.748, isw: 0.0053, rb: 0.183, kD: 0.0589, alpha: 1.261 };

export interface Derived {
  R: number; // baryon-to-photon momentum ratio at z*
  cs: number; // sound speed / c at z*
  rs: number; // comoving sound horizon at z* (Mpc)
  DM: number; // comoving angular-diameter distance to z* (Mpc)
  theta: number; // θ* = r_s / D_M (rad)
  lA: number; // acoustic scale π / θ*
  lEq: number; // multipole of the horizon at matter–radiation equality
  lD: number; // damping multipole
  zEq: number;
  OmL: number;
}

/** Comoving sound horizon at z*: r_s = ∫ c_s dt/a, integrated numerically (Mpc). */
function soundHorizon(p: CosmoParams): number {
  const om = p.ombh2 + p.omch2 + OMNU_H2;
  const Rfac = (3 * p.ombh2) / (4 * OMGAM_H2);
  // integrate in a from 0 to a* : r_s = ∫ c_s da / (a² H) ; H = 100 h E  →  use h-free ω's
  const aStar = 1 / (1 + ZSTAR);
  const N = 400;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * aStar;
    const H = 100 * Math.sqrt(OMRAD_H2 / a ** 4 + om / a ** 3); // km/s/Mpc, Λ and curvature negligible
    const cs = 1 / Math.sqrt(3 * (1 + Rfac * a));
    s += (cs * C_KMS) / (a * a * H);
  }
  return (s * aStar) / N;
}

function comovingDistance(p: CosmoParams): { DM: number; OmL: number } {
  const h2 = p.h * p.h;
  const Om = (p.ombh2 + p.omch2 + OMNU_H2) / h2, Or = OMRAD_H2 / h2;
  const OmL = 1 - Om - Or - p.omk;
  // χ = (c/H0) ∫ dz / E(z), integrated in u = ln(1+z) with the midpoint rule
  const N = 600, U = Math.log(1 + ZSTAR);
  let chi = 0;
  for (let i = 0; i < N; i++) {
    const u = ((i + 0.5) / N) * U, zp = Math.exp(u);
    const E = Math.sqrt(Or * zp ** 4 + Om * zp ** 3 + p.omk * zp * zp + OmL);
    chi += zp / E;
  }
  const DH = C_KMS / (100 * p.h);
  chi *= (U / N) * DH;
  const sk = Math.sqrt(Math.abs(p.omk)) / DH;
  const DM = p.omk > 1e-6 ? Math.sinh(sk * chi) / sk : p.omk < -1e-6 ? Math.sin(sk * chi) / sk : chi;
  return { DM, OmL };
}

export function derive(p: CosmoParams): Derived {
  const R = (3 * p.ombh2) / (4 * OMGAM_H2) / (1 + ZSTAR);
  const rs = soundHorizon(p);
  const { DM, OmL } = comovingDistance(p);
  const om = p.ombh2 + p.omch2 + OMNU_H2;
  const zEq = om / OMRAD_H2 - 1;
  const kEq = 0.0731 * om; // Mpc⁻¹ (≈ a_eq H_eq / c)
  const kD = FIT.kD * (p.ombh2 / 0.02237) ** 0.26 * (om / 0.143) ** 0.2; // Silk damping wavenumber (Mpc⁻¹), fit
  return { R, cs: 1 / Math.sqrt(3 * (1 + R)), rs, DM, theta: rs / DM, lA: (Math.PI * DM) / rs, lEq: kEq * DM, lD: kD * DM, zEq, OmL };
}

/**
 * Fill `out[ℓ]` with D_ℓ = ℓ(ℓ+1)C_ℓ/2π in μK² for ℓ = 0..lmax (ℓ = 0, 1 set to 0).
 * Returns the derived quantities.
 */
export function spectrum(p: CosmoParams, lmax: number, out: Float64Array = new Float64Array(lmax + 1)): Derived {
  const d = derive(p);
  const { R, lA, lEq, lD } = d;
  // Sachs–Wolfe normalisation: D_ℓ(SW) = T0² Δ²_R / 25 ; ×1.55 for early+late ISW (fit)
  const norm = ((T0 * 1e6) ** 2 * p.As * 1e-9) / 25 * FIT.K;
  const lPivot = 0.05 * d.DM; // k_pivot = 0.05 Mpc⁻¹
  const reion = Math.exp(-2 * p.tau);
  out[0] = 0;
  if (lmax >= 1) out[1] = 0;
  for (let l = 2; l <= lmax; l++) {
    const x = l / lA;
    const q = l / lEq;
    const q2 = q * q;
    const qp = q ** FIT.p;
    const drive = 1 + ((FIT.drive - 1) * qp) / (1 + qp); // amplitude of the oscillating part: 1 on super-horizon scales
    const well = 1 / (1 + FIT.well * q2); // decayed potential at recombination → smaller baryon offset
    const phase = Math.PI * (x + FIT.phi * (1 - Math.exp(-3 * x)));
    const damp = Math.exp(-((l / lD) ** FIT.alpha));
    const Rb = FIT.rb * R; // effective baryon loading after projection smoothing (fit)
    const S = drive * ((1 + 3 * Rb) * Math.cos(phase) - 3 * Rb * well);
    const V = ((1 + 3 * R) / Math.sqrt(3 * (1 + R))) * drive * Math.sin(phase);
    const tilt = (l / lPivot) ** (p.ns - 1);
    // reionisation damps anisotropies inside the horizon at z_re (ℓ ≳ 10)
    const re = reion + (1 - reion) * Math.exp(-((l / 10) ** 2));
    // early + late integrated Sachs–Wolfe: extra large-angle power from decaying potentials
    const isw = FIT.isw / (1 + (l / 40) ** 2);
    out[l] = norm * tilt * re * ((S * S + FIT.dop * V * V) * damp + isw);
  }
  return d;
}

/** Approximate Planck 2018 TT band powers (μK²), read off the published spectrum; for visual reference only. */
export const PLANCK_POINTS: [number, number, number][] = [
  // [ℓ, D_ℓ, σ]
  [2, 225, 700], [3, 940, 500], [5, 1150, 350], [8, 980, 270], [12, 1080, 210], [18, 1060, 160], [25, 1100, 130],
  [35, 1290, 100], [50, 1520, 90], [75, 1940, 80], [100, 2450, 70], [125, 3200, 70], [150, 4040, 70],
  [175, 4860, 70], [200, 5470, 70], [220, 5740, 70], [250, 5460, 65], [275, 4820, 60], [300, 3930, 55],
  [330, 3030, 50], [360, 2280, 45], [400, 1840, 40], [425, 1760, 40], [450, 1860, 40], [480, 2170, 40],
  [510, 2470, 40], [537, 2580, 40], [570, 2440, 38], [600, 2110, 35], [640, 1830, 32], [675, 1780, 30],
  [720, 2030, 30], [770, 2420, 30], [813, 2520, 30], [850, 2340, 30], [900, 1780, 28], [950, 1260, 26],
  [1000, 990, 24], [1050, 1030, 24], [1100, 1180, 24], [1130, 1220, 24], [1180, 1080, 22], [1230, 840, 20],
  [1300, 690, 20], [1350, 740, 20], [1420, 780, 20], [1480, 700, 20], [1550, 520, 20], [1650, 420, 20],
  [1750, 380, 22], [1850, 310, 24], [2000, 230, 26], [2200, 150, 30], [2400, 95, 35],
];
