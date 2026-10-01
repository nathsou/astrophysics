/**
 * Scattering: Rutherford's law, the classical orbit behind it, form factors, elastic electron–proton kinematics
 * and the samplers that generate Rutherford scattering angles (Chapter 4).
 *
 * Conventions: energies in MeV where a function name says `Mev` (alpha particles live there) and in GeV otherwise;
 * lengths in fm; cross-sections in fm² (1 fm² = 10 mb); angles in radians. Every random number comes from a seeded `Rng`.
 *
 * Model limits, stated once: the target is infinitely heavy (recoil neglected), the projectile is non-relativistic
 * (Rutherford) or ultra-relativistic (Mott), and only the Coulomb force acts. Nuclear forces, atomic screening,
 * multiple scattering and recoil are not in these formulas.
 */
import { hook } from '../hooks.ts';
import { ALPHA, HBARC_GEV_FM, HBARC_MEV_FM, N_A } from '../units/index.ts';
import { poisson, type Rng } from '../random/index.ts';

/** α ħc in MeV·fm: the Coulomb constant e²/(4πε₀) = 1.44 MeV·fm. */
export const ALPHA_HBARC_MEV_FM = ALPHA * HBARC_MEV_FM;
/** The Bohr radius in fm. */
export const BOHR_RADIUS_FM = HBARC_MEV_FM / (ALPHA * 0.51099895); // ħc/(α m_e c²)

// ── The classical orbit ─────────────────────────────────────────────────────────────────────────────────────────

/** Distance of closest approach in a head-on collision, d = z Z α ħc / T, in fm (T in MeV). */
export function closestApproachFm(z: number, Z: number, tMeV: number): number {
  return (z * Z * ALPHA_HBARC_MEV_FM) / tMeV;
}

/** Impact parameter that gives the deflection θ: b = (d/2) cot(θ/2), in fm. */
export function impactParameterFm(theta: number, z: number, Z: number, tMeV: number): number {
  return (closestApproachFm(z, Z, tMeV) / 2) / Math.tan(theta / 2);
}

/** Deflection angle for the impact parameter b (fm): θ = 2 arctan(d / 2b). */
export function deflectionAngle(bFm: number, z: number, Z: number, tMeV: number): number {
  return 2 * Math.atan2(closestApproachFm(z, Z, tMeV) / 2, bFm);
}

/** Distance of closest approach for scattering through θ: (d/2)(1 + 1/sin(θ/2)), in fm. Equals d at θ = π and grows as θ → 0. */
export function minApproachFm(theta: number, z: number, Z: number, tMeV: number): number {
  return (closestApproachFm(z, Z, tMeV) / 2) * (1 + 1 / Math.sin(theta / 2));
}

/** Rutherford's differential cross-section dσ/dΩ = (d/4)² / sin⁴(θ/2), in fm² per steradian. */
export function rutherfordDiffXsecFm2(theta: number, z: number, Z: number, tMeV: number): number {
  const d4 = closestApproachFm(z, Z, tMeV) / 4;
  return (d4 * d4) / Math.sin(theta / 2) ** 4;
}

/** Cross-section for scattering through more than θ₀: σ(θ > θ₀) = π (d/2)² cot²(θ₀/2) = π b(θ₀)², in fm². */
export function rutherfordXsecAboveFm2(theta0: number, z: number, Z: number, tMeV: number): number {
  const b = impactParameterFm(theta0, z, Z, tMeV);
  return Math.PI * b * b;
}

/** Cross-section for scattering into [θa, θb], in fm² (exact integral of 2π sinθ dσ/dΩ). */
export function rutherfordXsecBinFm2(thetaA: number, thetaB: number, z: number, Z: number, tMeV: number): number {
  const half = closestApproachFm(z, Z, tMeV) / 2;
  const cot2 = (t: number) => 1 / Math.tan(t / 2) ** 2;
  return Math.PI * half * half * (cot2(thetaA) - cot2(thetaB));
}

/** Thomas–Fermi radius of a neutral atom, 0.8853 a₀ / Z^{1/3}, in fm: the scale at which electrons screen the nucleus. */
export function thomasFermiRadiusFm(Z: number): number {
  return (0.8853 * BOHR_RADIUS_FM) / Math.cbrt(Z);
}

/** The angle below which screening cuts Rutherford scattering off, about d / a_TF (small-angle form of b = (d/2) cot(θ/2)). */
export function screeningAngle(z: number, Z: number, tMeV: number): number {
  return closestApproachFm(z, Z, tMeV) / thomasFermiRadiusFm(Z);
}

// ── Sampling the scattering angle ───────────────────────────────────────────────────────────────────────────────
//
// The density of the polar angle is f(θ) ∝ sinθ · dσ/dΩ ∝ sinθ / sin⁴(θ/2) = 2 cos(θ/2) / sin³(θ/2), on [θmin, π].
// It diverges like 16/θ³ as θ → 0, so a flat envelope is hopeless.

/** Unnormalised density of the angle, 2cos(θ/2)/sin³(θ/2). */
export function rutherfordAngleDensity(theta: number): number {
  return (2 * Math.cos(theta / 2)) / Math.sin(theta / 2) ** 3;
}
/** The integral of the unnormalised density from θmin to π: 2 cot²(θmin/2). */
export function rutherfordAngleNorm(thetaMin: number): number {
  return 2 / Math.tan(thetaMin / 2) ** 2;
}
/** Probability density of the angle on [θmin, π] (integrates to one). */
export function rutherfordAnglePdf(theta: number, thetaMin: number): number {
  return theta < thetaMin || theta > Math.PI ? 0 : rutherfordAngleDensity(theta) / rutherfordAngleNorm(thetaMin);
}
/** Cumulative distribution of the angle on [θmin, π]: (1/sin²(θmin/2) − 1/sin²(θ/2)) / (1/sin²(θmin/2) − 1). */
export function rutherfordAngleCdf(theta: number, thetaMin: number): number {
  if (theta <= thetaMin) return 0;
  if (theta >= Math.PI) return 1;
  const a = 1 / Math.sin(thetaMin / 2) ** 2;
  return (a - 1 / Math.sin(theta / 2) ** 2) / (a - 1);
}

/** Efficiency of accept–reject with a flat envelope of height f(θmin): ∫f / (f(θmin)(π − θmin)), about θmin/2π. */
export function flatEfficiency(thetaMin: number): number {
  return rutherfordAngleNorm(thetaMin) / (rutherfordAngleDensity(thetaMin) * (Math.PI - thetaMin));
}
/** Efficiency of accept–reject with the envelope 16/θ³: ∫f / ∫(16/θ³). Close to 1 for small θmin. */
export function importanceEfficiency(thetaMin: number): number {
  return rutherfordAngleNorm(thetaMin) / (8 * (1 / thetaMin ** 2 - 1 / Math.PI ** 2));
}

/** Naive accept–reject on a flat envelope: correct, and needs about 2π/θmin trials per sample. Returns the trials used. */
export function sampleFlatAcceptReject(r: Rng, thetaMin: number): { theta: number; trials: number } {
  const top = rutherfordAngleDensity(thetaMin);
  for (let trials = 1; ; trials++) {
    const theta = thetaMin + (Math.PI - thetaMin) * r();
    if (r() * top <= rutherfordAngleDensity(theta)) return { theta, trials };
  }
}

/**
 * Importance sampling. Draw θ from the envelope g(θ) ∝ 1/θ³ by inverse transform, then accept with probability
 * f(θ)/(16/θ³) = cos(x)(x/sin x)³ with x = θ/2, which is at most 1. The density of accepted angles is f.
 */
export function sampleImportance(r: Rng, thetaMin: number): { theta: number; trials: number } {
  const inv0 = 1 / (thetaMin * thetaMin);
  const inv1 = 1 / (Math.PI * Math.PI);
  for (let trials = 1; ; trials++) {
    const theta = 1 / Math.sqrt(inv0 - r() * (inv0 - inv1));
    const x = theta / 2;
    if (r() <= Math.cos(x) * (x / Math.sin(x)) ** 3) return { theta, trials };
  }
}

/** The exact inverse of the cumulative distribution: θ = 2 arcsin(u), 1/u² = 1/u₀² − r (1/u₀² − 1), u₀ = sin(θmin/2). */
export function sampleRutherfordInverse(r: Rng, thetaMin: number): number {
  const a = 1 / Math.sin(thetaMin / 2) ** 2;
  const inv = a - r() * (a - 1);
  return 2 * Math.asin(Math.min(1, 1 / Math.sqrt(inv)));
}

/**
 * The reference for the hook `scattering.sampleRutherfordAngle`: a Rutherford scattering angle in [θmin, π], drawn by
 * importance sampling.
 */
export function sampleRutherfordAngle(r: Rng, thetaMin: number): number {
  if (!(thetaMin > 0)) throw new Error('sampleRutherfordAngle: thetaMin must be positive (the density diverges at 0)');
  if (thetaMin >= Math.PI) return Math.PI;
  return sampleImportance(r, thetaMin).theta;
}

// ── A thin foil: the Geiger–Marsden experiment ──────────────────────────────────────────────────────────────────

export interface Foil {
  name: string;
  /** Charge number of the projectile (2 for an alpha particle). */
  z: number;
  /** Charge number of the target nucleus. */
  Z: number;
  /** Mass number of the target (g/mol). */
  A: number;
  /** Density in g/cm³. */
  densityGcm3: number;
  /** Thickness in µm. */
  thicknessUm: number;
}
export const GOLD: Foil = { name: 'gold', z: 2, Z: 79, A: 196.97, densityGcm3: 19.32, thicknessUm: 0.4 };
export const SILVER: Foil = { name: 'silver', z: 2, Z: 47, A: 107.87, densityGcm3: 10.49, thicknessUm: 0.4 };

/** Target nuclei per fm² of foil, n t. */
export function nucleiPerFm2(f: Foil): number {
  const perCm3 = (f.densityGcm3 / f.A) * N_A;
  const perCm2 = perCm3 * f.thicknessUm * 1e-4;
  return perCm2 * 1e-26; // 1 cm² = 10²⁶ fm²
}

/** Probability that one alpha scatters through more than θmin: n t σ(> θmin) (single scattering, thin foil). */
export function scatterProbability(f: Foil, tMeV: number, thetaMin: number): number {
  return nucleiPerFm2(f) * rutherfordXsecAboveFm2(thetaMin, f.z, f.Z, tMeV);
}

/** The expected number of alphas, out of `nAlpha` fired, that land in the angle bin [θa, θb]. */
export function expectedCountsInBin(f: Foil, tMeV: number, nAlpha: number, thetaA: number, thetaB: number): number {
  return nAlpha * nucleiPerFm2(f) * rutherfordXsecBinFm2(thetaA, thetaB, f.z, f.Z, tMeV);
}

/** Solid angle of the ring between two polar angles, 2π(cos θa − cos θb). */
export const ringSolidAngle = (thetaA: number, thetaB: number): number => 2 * Math.PI * (Math.cos(thetaA) - Math.cos(thetaB));

export interface FoilRun {
  /** Alphas counted in each angle bin. */
  counts: number[];
  /** How many of the `nAlpha` alphas scattered through more than θmin. */
  nScattered: number;
  /** The mean of the above, nAlpha × P. */
  nExpected: number;
}

/**
 * Fire `nAlpha` alphas at the foil and count those that land in each angle bin (`edges` are bin edges in radians, all at or above θmin).
 * The number that scatter through more than θmin is Poisson with mean nAlpha · P; each one's angle comes from the sampler, which is the
 * hook `scattering.sampleRutherfordAngle`, so the reader's sampler (when "use my code" is on) produces the counts.
 */
export function fireAlphas(r: Rng, f: Foil, tMeV: number, nAlpha: number, thetaMin: number, edges: readonly number[]): FoilRun {
  const sampler = hook('scattering.sampleRutherfordAngle', sampleRutherfordAngle);
  const nExpected = nAlpha * scatterProbability(f, tMeV, thetaMin);
  const nScattered = poisson(r, nExpected);
  const counts = new Array<number>(edges.length - 1).fill(0);
  const lo = edges[0]!;
  const hi = edges[edges.length - 1]!;
  for (let i = 0; i < nScattered; i++) {
    const th = sampler(r, thetaMin);
    if (!(th >= lo && th < hi)) continue;
    let a = 0, b = counts.length;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (edges[m]! <= th) a = m;
      else b = m;
    }
    counts[a]!++;
  }
  return { counts, nScattered, nExpected };
}

/** The gaussian ("plum-pudding") distribution of a projectile deflected by many small kicks: dP/dΩ = exp(−θ²/2σ²)/(2πσ²), per steradian per alpha. Illustrative. */
export function gaussianPerSr(theta: number, sigma: number): number {
  return Math.exp(-(theta * theta) / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma);
}

// ── Fitting the angular law ─────────────────────────────────────────────────────────────────────────────────────

export interface PowerFit {
  /** Exponent p in dN/dΩ ∝ sin⁻ᵖ(θ/2). Rutherford's law has p = 4. */
  p: number;
  /** One-standard-deviation interval on p from the profile likelihood. */
  pLo: number;
  pHi: number;
  /** The normalisation K: the expected counts in a bin are K ∫ 2π sinθ sin⁻ᵖ(θ/2) dθ over the bin. */
  K: number;
  /** K if the exponent is fixed to 4. For Rutherford's law it equals n_alpha · n t · (d/4)². */
  K4: number;
  /** 2Δ(−ln L) between p = 4 and the best fit: how strongly the data disfavour an exponent of 4 (about 1 when they do not). */
  delta4: number;
}

const FIT_LO = 0;
const FIT_HI = 10;

// 16-point Gauss–Legendre nodes and weights on [−1, 1] (positive half; the rule is symmetric)
const GL_X = [0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.755404408355003, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
const GL_W = [0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

/** ∫ 2π sinθ sin⁻ᵖ(θ/2) dθ from θa to θb: the bin's share of a power law in sin(θ/2), by Gauss–Legendre quadrature. */
export function powerLawBin(thetaA: number, thetaB: number, p: number): number {
  const h = (thetaB - thetaA) / 2;
  const m = (thetaB + thetaA) / 2;
  let s = 0;
  for (let i = 0; i < GL_X.length; i++) {
    for (const sign of [-1, 1]) {
      const th = m + sign * h * GL_X[i]!;
      s += GL_W[i]! * 2 * Math.PI * Math.sin(th) * Math.sin(th / 2) ** -p;
    }
  }
  return s * h;
}

/**
 * Poisson maximum-likelihood fit of the counts in angle bins `edges` (n + 1 edges for n counts) to the law dN/dΩ = K sin(θ/2)^(−p). The
 * expected count in a bin is K times the integral of the law over the bin's solid angle, so wide bins do not bias p. K is profiled
 * analytically (K = Σn / Σ I_i(p)), p is found by golden-section search, and its uncertainty is where 2Δ(−ln L) = 1.
 */
export function fitAnglePower(edges: readonly number[], counts: readonly number[]): PowerFit {
  const n = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const basis = (p: number) => counts.map((_, i) => powerLawBin(edges[i]!, edges[i + 1]!, p));
  const nll2 = (p: number): number => {
    const b = basis(p);
    const K = total / b.reduce((a, c) => a + c, 0);
    let v = 0;
    for (let i = 0; i < n; i++) {
      const mu = K * b[i]!;
      v += 2 * (mu - counts[i]! + (counts[i]! > 0 ? counts[i]! * Math.log(counts[i]! / mu) : 0));
    }
    return v;
  };
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = FIT_LO, b = FIT_HI;
  let c = b - phi * (b - a), d = a + phi * (b - a);
  let fc = nll2(c), fd = nll2(d);
  for (let it = 0; it < 80; it++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - phi * (b - a); fc = nll2(c); }
    else { a = c; c = d; fc = fd; d = a + phi * (b - a); fd = nll2(d); }
  }
  const p = (a + b) / 2;
  const f0 = nll2(p);
  const edge = (dir: 1 | -1): number => {
    const limit = dir === 1 ? FIT_HI - p : p - FIT_LO;
    let lo = 0, hi = Math.min(4, limit);
    if (nll2(p + dir * hi) - f0 < 1) return p + dir * hi;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (nll2(p + dir * m) - f0 < 1) lo = m;
      else hi = m;
    }
    return p + dir * ((lo + hi) / 2);
  };
  const K = total / basis(p).reduce((x, y) => x + y, 0);
  const K4 = total / basis(4).reduce((x, y) => x + y, 0);
  return { p, pLo: edge(-1), pHi: edge(1), K, K4, delta4: nll2(4) - f0 };
}

// ── Electrons and form factors ──────────────────────────────────────────────────────────────────────────────────

/** Mott's cross-section for an ultra-relativistic electron of energy E (GeV) on a point charge Z, recoil neglected: Rutherford × cos²(θ/2), in fm²/sr. */
export function mottDiffXsecFm2(theta: number, Z: number, eGeV: number): number {
  const a = (Z * ALPHA * HBARC_GEV_FM) / (2 * eGeV * Math.sin(theta / 2) ** 2);
  return a * a * Math.cos(theta / 2) ** 2;
}

export type FormFactorShape = 'point' | 'uniform' | 'exponential' | 'gaussian';
export const FORM_FACTOR_SHAPES: { id: FormFactorShape; label: string }[] = [
  { id: 'point', label: 'point charge' },
  { id: 'uniform', label: 'uniform sphere' },
  { id: 'exponential', label: 'exponential (dipole)' },
  { id: 'gaussian', label: 'Gaussian' },
];

/**
 * The form factor F(q) of a spherical charge distribution with root-mean-square radius `rmsFm`, for a momentum transfer q in GeV.
 * uniform sphere: F = 3(sin x − x cos x)/x³, x = qR/ħc with R = √(5/3) r_rms;
 * exponential density ρ ∝ e⁻ʳ/ᵃ: F = (1 + q²a²/ħ²c²)⁻², a = r_rms/√12 (the "dipole");
 * Gaussian density: F = exp(−q² r_rms²/6ħ²c²).
 * Every shape has F → 1 − q² r_rms²/(6 ħ²c²) at small q.
 */
export function formFactor(shape: FormFactorShape, qGeV: number, rmsFm: number): number {
  const k = qGeV / HBARC_GEV_FM; // q/ħ in fm⁻¹
  switch (shape) {
    case 'point':
      return 1;
    case 'uniform': {
      const x = k * Math.sqrt(5 / 3) * rmsFm;
      if (x < 1e-3) return 1 - (x * x) / 10;
      return (3 * (Math.sin(x) - x * Math.cos(x))) / (x * x * x);
    }
    case 'exponential': {
      const a = rmsFm / Math.sqrt(12);
      return 1 / (1 + k * k * a * a) ** 2;
    }
    case 'gaussian':
      return Math.exp(-(k * k * rmsFm * rmsFm) / 6);
  }
}

/** The dipole's Λ² in GeV² for a given rms radius: 12 (ħc)² / ⟨r²⟩. */
export function dipoleLambda2(rmsFm: number): number {
  return (12 * HBARC_GEV_FM ** 2) / (rmsFm * rmsFm);
}

/** Elastic scattering of an electron of energy E (GeV) through θ on a target of mass M (GeV): the scattered energy E′ = E/(1 + (E/M)(1 − cosθ)). */
export function elasticScatteredEnergy(eGeV: number, theta: number, mTarget: number): number {
  return eGeV / (1 + (eGeV / mTarget) * (1 - Math.cos(theta)));
}
/** The squared four-momentum transfer Q² = 2EE′(1 − cosθ) in GeV² (electron mass neglected), elastic. */
export function elasticQ2(eGeV: number, theta: number, mTarget: number): number {
  return 2 * eGeV * elasticScatteredEnergy(eGeV, theta, mTarget) * (1 - Math.cos(theta));
}
/** The length a momentum transfer of Q (GeV) resolves, ħc/Q, in fm. */
export const resolutionFm = (qGeV: number): number => HBARC_GEV_FM / qGeV;
/** The de Broglie wavelength ħ/p of a particle with momentum p (GeV), in fm. */
export const reducedWavelengthFm = (pGeV: number): number => HBARC_GEV_FM / pGeV;
/** Invariant mass W of the hadronic system after electron scattering: W² = M² + 2Mν − Q², with ν = E − E′. Elastic scattering has W = M. */
export function hadronicMass(mTarget: number, nu: number, q2: number): number {
  return Math.sqrt(Math.max(0, mTarget * mTarget + 2 * mTarget * nu - q2));
}
