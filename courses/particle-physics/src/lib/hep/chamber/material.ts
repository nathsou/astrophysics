/**
 * Material physics for the chamber simulation: mean energy loss (Bethe–Bloch, simplified), range, radiation length,
 * multiple scattering (Highland) and helix geometry. Self-contained: it does not depend on `hep/detector`.
 *
 * Units inside this file: energies and momenta in MeV unless a name says GeV; lengths in mm or g/cm² as stated.
 * Formulas follow the PDG review "Passage of particles through matter" (Bethe–Bloch with the density effect,
 * Highland's formula, radiation length and critical energy).
 */

export const ME_MEV = 0.51099895;
/** K = 4π N_A r_e² m_e c² in MeV cm²/mol. */
export const K_MEV_CM2_MOL = 0.307075;
/** Bending constant: R[m] = p[GeV/c] / (0.29979 · |q| · B[T]). */
export const CURVATURE_CONST = 0.299792458;

/** Sternheimer density-effect parameters: δ(x) with x = log10(βγ). */
export interface DensityEffect {
  /** −C̄ is usually tabulated; here C = −(−C̄) i.e. the positive number C̄ as printed in the PDG tables. */
  C: number;
  x0: number;
  x1: number;
  a: number;
  k: number;
  delta0?: number;
}

export interface Material {
  name: string;
  /** Plain-English label for the UI. */
  label: string;
  /** Density in g/cm³. */
  density: number;
  /** Z/A in mol/g. */
  zOverA: number;
  /** Mean excitation energy in eV. */
  I: number;
  /** Radiation length in g/cm². */
  X0: number;
  /** Electron critical energy in MeV (informational). */
  Ec: number;
  densityEffect: DensityEffect;
  /** Delta rays above this kinetic energy (MeV) are produced as separate tracks; below it they are part of the local ionisation. */
  deltaCut: number;
  /** Is the material opaque (tracks inside it are not seen)? True for absorber plates. */
  opaque: boolean;
}

/**
 * Generic density-effect parameters when no tabulated set is to hand (Sternheimer, Berger and Seltzer 1984 rules
 * for x0, x1 and k; a fixed by continuity at x1). Used for propane.
 */
function genericDensity(C: number, I_eV: number): DensityEffect {
  const x1 = I_eV < 100 ? 2.0 : 3.0;
  const x0 = C < 3.681 ? 0.2 : 0.326 * C - 1.0;
  const k = 3.0;
  const a = (2 * Math.LN10 * x1 - C) / Math.pow(x1 - x0, k);
  return { C, x0, x1, a, k };
}

// Values marked "memory" were typed from the PDG atomic-and-nuclear-properties tables from memory and should be
// re-checked against pdg.lbl.gov (see the README of hep/chamber).
export const MATERIALS = {
  /** Dry air at 1 atm as a stand-in for the air + alcohol vapour of a cloud chamber (the vapour is ~1 % by number). */
  air: {
    name: 'air+alcohol vapour',
    label: 'air and alcohol vapour',
    density: 1.205e-3,
    zOverA: 0.49919,
    I: 85.7,
    X0: 36.62,
    Ec: 87.92,
    densityEffect: { C: 10.5961, x0: 1.7418, x1: 4.2759, a: 0.10914, k: 3.3994 }, // memory
    deltaCut: 0.005,
    opaque: false,
  },
  /** Liquid hydrogen at about 26 K. X0 = 63.04 g/cm² = 8.9 m. */
  hydrogen: {
    name: 'liquid hydrogen',
    label: 'liquid hydrogen',
    density: 0.0708,
    zOverA: 0.99212,
    I: 21.8,
    X0: 63.04,
    Ec: 344.8, // memory
    densityEffect: { C: 3.2632, x0: 0.4759, x1: 1.9215, a: 0.13483, k: 5.6249 }, // memory
    deltaCut: 0.1,
    opaque: false,
  },
  /** Liquid propane (C3H8) at bubble-chamber conditions; approximate values. */
  propane: {
    name: 'propane',
    label: 'propane',
    density: 0.43,
    zOverA: 0.5896,
    I: 47.1,
    X0: 45.2, // memory
    Ec: 100, // approximate
    densityEffect: genericDensity(3.6, 47.1),
    deltaCut: 0.1,
    opaque: false,
  },
  /** Lead absorber plate: X0 = 6.37 g/cm² = 0.56 cm. */
  lead: {
    name: 'lead',
    label: 'lead',
    density: 11.35,
    zOverA: 0.39575,
    I: 823,
    X0: 6.37,
    Ec: 7.43,
    densityEffect: { C: 6.2018, x0: 0.3776, x1: 3.8073, a: 0.09359, k: 3.1608, delta0: 0.14 }, // memory
    deltaCut: 2,
    opaque: true,
  },
} as const satisfies Record<string, Material>;

export type MaterialName = keyof typeof MATERIALS;
/** The media a chamber can be filled with. */
export type MediumName = 'air+alcohol vapour' | 'liquid hydrogen' | 'propane';

export const MEDIA: Record<MediumName, Material> = {
  'air+alcohol vapour': MATERIALS.air,
  'liquid hydrogen': MATERIALS.hydrogen,
  propane: MATERIALS.propane,
};

export function resolveMedium(m: MediumName | Material): Material {
  return typeof m === 'string' ? MEDIA[m] : m;
}
export function resolveMaterial(m: MaterialName | MediumName | Material): Material {
  if (typeof m !== 'string') return m;
  return (MATERIALS as Record<string, Material>)[m] ?? MEDIA[m as MediumName];
}

/** Radiation length in mm. */
export const radiationLengthMm = (m: Material): number => (m.X0 / m.density) * 10;

/** Density correction δ(βγ) (Sternheimer). */
export function densityCorrection(bg: number, d: DensityEffect): number {
  const x = Math.log10(bg);
  if (x >= d.x1) return 2 * Math.LN10 * x - d.C;
  if (x >= d.x0) return 2 * Math.LN10 * x - d.C + d.a * Math.pow(d.x1 - x, d.k);
  return (d.delta0 ?? 0) * Math.pow(10, 2 * (x - d.x0));
}

export interface Species {
  /** Mass in MeV. */
  mass: number;
  /** Charge in units of e. */
  charge: number;
}

/** β and γ from momentum (MeV/c) and mass (MeV). */
export function kinematicsOf(pMeV: number, massMeV: number): { beta: number; gamma: number; betaGamma: number; E: number; T: number } {
  const E = Math.hypot(pMeV, massMeV);
  return { beta: pMeV / E, gamma: E / massMeV, betaGamma: pMeV / massMeV, E, T: E - massMeV };
}

const isElectron = (s: Species) => Math.abs(s.mass - ME_MEV) < 1e-3;

/**
 * Mean ionisation energy loss, MeV cm²/g, for a particle of momentum `pMeV`.
 *
 * Heavy particles (μ, π, K, p, α): the Bethe–Bloch formula with the density effect; the logarithm is written
 * ln(1 + x) so that it stays positive at low velocity (a smooth Bragg peak instead of a sign change), and alpha
 * particles use Ziegler's effective charge so that they pick up electrons at the end of the range.
 * Electrons and positrons: the Rohrlich–Carlson form of the collision loss (as used by ESTAR).
 *
 * `cut` (MeV): if given, the loss restricted to delta-ray energies below `cut` (what stays near the track).
 */
export function ionisationLoss(sp: Species, pMeV: number, mat: Material, cut?: number): number {
  if (pMeV <= 0) return 0;
  const { beta, gamma, betaGamma, T } = kinematicsOf(pMeV, sp.mass);
  const b2 = beta * beta;
  const Iev = mat.I * 1e-6; // MeV
  const delta = densityCorrection(betaGamma, mat.densityEffect);
  const kz = mat.zOverA;
  if (isElectron(sp)) {
    const tau = T / ME_MEV;
    let F: number;
    if (sp.charge < 0) F = 1 - b2 + (tau * tau / 8 - (2 * tau + 1) * Math.LN2) / ((tau + 1) * (tau + 1));
    else F = 2 * Math.LN2 - (b2 / 12) * (23 + 14 / (tau + 2) + 10 / ((tau + 2) ** 2) + 4 / ((tau + 2) ** 3));
    const arg = (tau * tau * (tau + 2)) / (2 * (Iev / ME_MEV) ** 2);
    const L = Math.log(1 + arg) + F - delta;
    let S = (K_MEV_CM2_MOL / 2) * kz * Math.max(L, 0.02) / b2;
    if (cut !== undefined && cut < T / 2) {
      // Restricted loss: replace the Møller/Bhabha tail above `cut` by its integral; approximated by the heavy-particle form.
      const wmax = T / 2;
      S -= (K_MEV_CM2_MOL / 2) * kz / b2 * Math.log(wmax / cut) * 0.6;
      S = Math.max(S, 0.15 * (K_MEV_CM2_MOL / 2) * kz / b2);
    }
    return S;
  }
  // Heavy particle. Below the Bragg peak the stopping power falls in proportion to the velocity (Lindhard), not as
  // Bethe's formula would have it; continue from the peak with S ∝ β.
  const bp = braggPeakBeta(sp, mat);
  if (beta < bp) return heavyBethe(sp, bp, mat, undefined) * (beta / bp);
  return heavyBethe(sp, beta, mat, cut);
}

/** Bethe–Bloch for a heavy particle at velocity β (no low-energy correction). */
function heavyBethe(sp: Species, beta: number, mat: Material, cut?: number): number {
  const b2 = beta * beta;
  const gamma = 1 / Math.sqrt(1 - b2);
  const betaGamma = beta * gamma;
  const Iev = mat.I * 1e-6;
  const delta = densityCorrection(betaGamma, mat.densityEffect);
  const z = Math.abs(sp.charge);
  let z2 = z * z;
  if (z >= 2) {
    const zeff = z * (1 - Math.exp((-170 * beta) / Math.pow(z, 2 / 3)));
    z2 = zeff * zeff;
  }
  const r = ME_MEV / sp.mass;
  const wmaxFull = (2 * ME_MEV * betaGamma * betaGamma) / (1 + 2 * gamma * r + r * r);
  const wmax = cut !== undefined ? Math.min(cut, wmaxFull) : wmaxFull;
  const arg = (2 * ME_MEV * betaGamma * betaGamma * wmax) / (Iev * Iev);
  const L = 0.5 * Math.log(1 + arg) - (b2 / 2) * (1 + wmax / wmaxFull) - delta / 2;
  return Math.max(0, (K_MEV_CM2_MOL * mat.zOverA * z2 * L) / b2);
}

const peakCache = new Map<string, number>();
/** The velocity at which the (modified) Bethe stopping power of a heavy particle peaks: the Bragg peak. */
function braggPeakBeta(sp: Species, mat: Material): number {
  const key = `${sp.mass}|${sp.charge}|${mat.name}|${mat.I}`;
  const hit = peakCache.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  let bestB = 0.01;
  for (let i = 0; i <= 300; i++) {
    const b = 0.004 * Math.pow(0.06 / 0.004, i / 300);
    const s = heavyBethe(sp, b, mat);
    if (s > best) {
      best = s;
      bestB = b;
    }
  }
  peakCache.set(key, bestB);
  return bestB;
}

/** The largest energy transfer to a free electron (MeV) by a particle of momentum p. */
export function maxEnergyTransfer(sp: Species, pMeV: number): number {
  const { gamma, betaGamma, T } = kinematicsOf(pMeV, sp.mass);
  if (isElectron(sp)) return sp.charge < 0 ? T / 2 : T;
  const r = ME_MEV / sp.mass;
  return (2 * ME_MEV * betaGamma * betaGamma) / (1 + 2 * gamma * r + r * r);
}

/**
 * Radiative (bremsstrahlung) energy loss of an electron or positron, MeV cm²/g: (E/X0) for E ≫ m_e, with a smooth
 * suppression at low energy. Zero for heavy particles (their radiative losses matter only above ~100 GeV for muons).
 */
export function radiativeLoss(sp: Species, pMeV: number, mat: Material): number {
  if (!isElectron(sp)) return 0;
  const { E, T } = kinematicsOf(pMeV, sp.mass);
  return ((E / mat.X0) * T) / (T + 2 * ME_MEV);
}

/** Total mean loss in MeV cm²/g. */
export function totalLoss(sp: Species, pMeV: number, mat: Material): number {
  return ionisationLoss(sp, pMeV, mat) + radiativeLoss(sp, pMeV, mat);
}

/** Bethe–Bloch mean stopping power in MeV/mm for a particle with momentum p (GeV/c). */
export function dedxMevPerMm(sp: { mass: number; charge: number }, pGeV: number, mat: Material): number {
  return (totalLoss(sp, pGeV * 1000, mat) * mat.density) / 10;
}

const mipCache = new Map<string, number>();
/**
 * The minimum of the muon's ionisation loss in this material, MeV cm²/g (the "MIP" the droplet density is measured in).
 * With `restricted` the loss counts only energy transfers below the material's delta-ray cut: the ionisation that stays
 * on the track, which is what `TrackPoint.dedx` records.
 */
export function mipLoss(mat: Material, restricted = false): number {
  const key = `${mat.name}|${restricted}`;
  const hit = mipCache.get(key);
  if (hit !== undefined) return hit;
  const mu: Species = { mass: 105.6583755, charge: -1 };
  let best = Infinity;
  for (let i = 0; i <= 200; i++) {
    const bg = 10 ** (0 + (i / 200) * 2.5);
    best = Math.min(best, ionisationLoss(mu, bg * mu.mass, mat, restricted ? mat.deltaCut : undefined));
  }
  mipCache.set(key, best);
  return best;
}

/**
 * CSDA range (mm) of a particle of kinetic energy T (MeV): ∫ dT / (dE/dx) with the total mean loss,
 * from `tStop` (1 keV) upwards; the last kilo-electron-volt is added as T_stop / S(T_stop).
 */
export function csdaRange(sp: Species, tMeV: number, mat: Material, tStop = 0.001): number {
  if (tMeV <= tStop) return 0;
  const n = 400;
  const lo = Math.log(tStop);
  const hi = Math.log(tMeV);
  let sum = 0;
  const sOf = (t: number) => {
    const p = Math.sqrt(t * (t + 2 * sp.mass));
    return totalLoss(sp, p, mat);
  };
  let prev = tStop / sOf(tStop); // integrand in log T: T / S
  for (let i = 1; i <= n; i++) {
    const t = Math.exp(lo + ((hi - lo) * i) / n);
    const f = t / Math.max(sOf(t), 1e-9);
    sum += 0.5 * (prev + f) * ((hi - lo) / n);
    prev = f;
  }
  const s0 = sOf(tStop);
  const gPerCm2 = sum + (tStop / s0) * 0.5;
  return (gPerCm2 / mat.density) * 10;
}

/** Kinetic energy (MeV) of a particle that has `rangeMm` of range left. Inverse of `csdaRange` by bisection. */
export function energyFromRange(sp: Species, rangeMm: number, mat: Material): number {
  let lo = 0.001;
  let hi = 1e6;
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi);
    if (csdaRange(sp, mid, mat) < rangeMm) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/**
 * Highland's formula: the RMS of the projected multiple-scattering angle after a thickness x (in units of the
 * radiation length): θ0 = 13.6 MeV/(β c p) · z · √(x/X0) · [1 + 0.038 ln(x z² / (X0 β²))].
 */
export function highland(pMeV: number, beta: number, charge: number, xOverX0: number): number {
  const z = Math.abs(charge);
  const f = 1 + 0.038 * Math.log((xOverX0 * z * z) / (beta * beta));
  return ((13.6 / (beta * pMeV)) * z * Math.sqrt(xOverX0)) * Math.max(f, 0.4);
}

/** Radius of curvature in metres of a track with transverse momentum pT (GeV/c) in a field B (T). */
export function radiusOfCurvature(pT: number, B: number, charge = 1): number {
  return pT / (CURVATURE_CONST * Math.abs(charge) * Math.abs(B));
}
/** Transverse momentum (GeV/c) from a radius of curvature in metres: pT = 0.29979 · |q| · B · R. */
export function momentumFromRadius(R: number, B: number, charge = 1): number {
  return CURVATURE_CONST * Math.abs(charge) * Math.abs(B) * R;
}
/** Sagitta (same unit as the chord) of an arc of radius R across a chord L: s ≈ L²/(8R). */
export const sagitta = (R: number, L: number): number => R - Math.sqrt(Math.max(0, R * R - (L * L) / 4));

/**
 * Probability per mm that a photon of energy k (MeV) converts to e⁺e⁻ in the material: (7/9)/X0 at high energy,
 * with a threshold at 2 m_e and the slow rise seen in the pair cross-section at a few MeV.
 */
export function pairConversionRate(kMeV: number, mat: Material): number {
  const thr = 2 * ME_MEV;
  if (kMeV <= thr) return 0;
  const g = (kMeV - thr) / (kMeV - thr + 13);
  return ((7 / 9) / radiationLengthMm(mat)) * g;
}
