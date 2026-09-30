/**
 * Luminosity, pile-up, integrated luminosity over a fill, and the machine stage of the pipeline.
 *
 * For two equal round Gaussian bunches of N particles colliding head-on at n bunch pairs per turn at revolution frequency f:
 *   L = N² n f /(4π σ*²),  σ*² = ε β*  (ε = ε_n/γ, the geometric emittance; β* the beta function at the collision point),
 * i.e. L = N² n f γ /(4π ε_n β*). A crossing angle θ_c makes the bunches overlap less: the geometric reduction factor is
 * F = 1/√(1 + (θ_c σ_z/(2σ*))²) (Piwinski angle φ = θ_c σ_z/2σ*).
 *
 * Units: N a number of particles, frev in Hz, ε_n in m·rad, β* and σ_z in m, θ_c in rad (the full angle between the beams).
 * L comes out in cm⁻² s⁻¹ (1 fb⁻¹ = 10³⁹ cm⁻²).
 */
import { hook } from '../hooks.ts';
import { poisson, type Rng } from '../random/index.ts';
import { revolutionFrequency, LHC } from './fields.ts';

export interface LumiParams {
  /** Particles per bunch. */
  Nb: number;
  /** Number of colliding bunch pairs. */
  nb: number;
  /** Revolution frequency in Hz. */
  frev: number;
  /** Normalised emittance in m·rad (3.75e-6 is 3.75 µm). */
  eps_n: number;
  /** β* in m. */
  betaStar: number;
  /** Lorentz factor of the beam particles. */
  gamma: number;
  /** Full crossing angle in rad. */
  crossingAngle: number;
  /** RMS bunch length in m. */
  sigmaZ: number;
}

/** The transverse RMS beam size at the collision point, σ* = √(ε_n β* / γ), in m. */
export const sigmaStar = (p: LumiParams): number => Math.sqrt((p.eps_n * p.betaStar) / p.gamma);
/** The geometric reduction factor F = 1/√(1 + (θ_c σ_z/2σ*)²). */
export function geometricFactor(p: LumiParams): number {
  const phi = (p.crossingAngle * p.sigmaZ) / (2 * sigmaStar(p));
  return 1 / Math.sqrt(1 + phi * phi);
}

/** The reference luminosity formula in cm⁻² s⁻¹. */
export function referenceLuminosity(p: LumiParams): number {
  const Lm2 = (p.Nb * p.Nb * p.nb * p.frev * p.gamma) / (4 * Math.PI * p.eps_n * p.betaStar);
  return Lm2 * 1e-4 * geometricFactor(p);
}
/** Instantaneous luminosity in cm⁻² s⁻¹. Hook: `machine.luminosity`. */
export function luminosity(p: LumiParams): number {
  return hook('machine.luminosity', referenceLuminosity)(p);
}

/** Inelastic proton–proton cross-section at 13–13.6 TeV, about 80 mb (an approximate public value; the measured value is 78–80 mb). */
export const SIGMA_INEL_MB = 80;
const MB_TO_CM2 = 1e-27;

/** Mean number of pp collisions per bunch crossing: μ = L σ_inel /(n_b f_rev). */
export function pileup(lumi_cm2s: number, nb: number, frev: number, sigmaInelMb = SIGMA_INEL_MB): number {
  return (lumi_cm2s * sigmaInelMb * MB_TO_CM2) / (nb * frev);
}
/** The interaction rate σ L in Hz. */
export const interactionRate = (lumi_cm2s: number, sigmaMb: number): number => lumi_cm2s * sigmaMb * MB_TO_CM2;

/** The number of pile-up collisions in each of `nEvents` bunch crossings: Poisson with mean μ. */
export function bunchCrossings(nEvents: number, rng: Rng, mu: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < nEvents; i++) out.push(poisson(rng, mu));
  return out;
}
/** The z positions (mm) of the collisions in a crossing: Gaussian with the luminous-region width. */
export function collisionVertices(rng: Rng, n: number, sigmaZmm: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let u = 0, v = 0, s = 0;
    do { u = 2 * rng() - 1; v = 2 * rng() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    out.push(sigmaZmm * u * Math.sqrt((-2 * Math.log(s)) / s));
  }
  return out;
}
/** The RMS length of the luminous region in m: σ_z/√2, shortened by the crossing angle to σ_z/√(2(1 + φ²)). */
export function luminousRegionSigmaZ(p: LumiParams): number {
  const phi = (p.crossingAngle * p.sigmaZ) / (2 * sigmaStar(p));
  return p.sigmaZ / Math.sqrt(2 * (1 + phi * phi));
}

// ── Filling pattern ────────────────────────────────────────────────────────────────────────────────

/**
 * A simplified LHC filling pattern over `slots` (3564) 25 ns slots: bunches come in trains of 72, three trains to an SPS batch
 * (8 empty slots between trains, 30 between batches), with an abort gap of 119 slots (3 µs) at the end. The real pattern has a few more
 * details (injection gaps of 38 slots, slightly different batch counts); the nominal 2808 bunches fit here too.
 */
export function fillingPattern(nBunches = 2808, slots = 3564): boolean[] {
  const pattern: boolean[] = new Array(slots).fill(false);
  const abortGap = 119;
  let slot = 0;
  let placed = 0;
  let train = 0;
  while (placed < nBunches && slot < slots - abortGap) {
    const len = Math.min(72, nBunches - placed, slots - abortGap - slot);
    for (let i = 0; i < len; i++) pattern[slot + i] = true;
    slot += len;
    placed += len;
    train++;
    slot += train % 3 === 0 ? 30 : 8;
  }
  return pattern;
}
/** Number of filled slots of a pattern. */
export const countBunches = (pattern: readonly boolean[]): number => pattern.reduce((s, b) => s + (b ? 1 : 0), 0);

// ── Integrated luminosity over a fill ───────────────────────────────────────────────────────────────

/**
 * The luminosity during a fill, L(t) = L₀ y(t)², with the beam intensity y = N/N₀ falling by burn-off (collisions remove
 * protons: dy/dt ∝ −y²/τ_b) and by all other losses with an exponential lifetime τ_o: dy/dt = −y/τ_o − y²/τ_b, whose solution is
 * y = 1/((1 + τ_o/τ_b) e^{t/τ_o} − τ_o/τ_b). Times in seconds; pass Infinity to switch a mechanism off.
 */
export function luminosityAt(t: number, L0: number, tauBurn: number, tauOther: number): number {
  const rb = Number.isFinite(tauBurn) ? 1 / tauBurn : 0;
  let y: number;
  if (!Number.isFinite(tauOther)) y = 1 / (1 + rb * t);
  else y = 1 / ((1 + tauOther * rb) * Math.exp(t / tauOther) - tauOther * rb);
  return L0 * y * y;
}
/** The burn-off time constant τ_b = N₀/(k σ L₀) for N₀ total protons, k collision points and σ the burn-off cross-section (mb). */
export function burnOffTime(Ntotal: number, lumi0_cm2s: number, nIP = 2, sigmaMb = SIGMA_INEL_MB): number {
  return Ntotal / (nIP * sigmaMb * MB_TO_CM2 * lumi0_cm2s);
}
/** ∫₀ᵀ L dt in cm⁻² (Simpson's rule). */
export function integratedLuminosity(T: number, L0: number, tauBurn: number, tauOther: number, steps = 600): number {
  const n = steps % 2 ? steps + 1 : steps;
  const h = T / n;
  let s = luminosityAt(0, L0, tauBurn, tauOther) + luminosityAt(T, L0, tauBurn, tauOther);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * luminosityAt(i * h, L0, tauBurn, tauOther);
  return (s * h) / 3;
}
/** Convert cm⁻² to fb⁻¹. */
export const cm2ToInvFb = (x: number): number => x * 1e-39;

export interface FillOptimum {
  /** The best length of the stable-beams period in seconds. */
  fillLength: number;
  /** Average luminosity over a whole cycle (fill + turnaround), cm⁻² s⁻¹. */
  averageLumi: number;
  /** Integrated luminosity of the fill in cm⁻². */
  integrated: number;
}
/** The fill length that maximises the average luminosity over a whole cycle of stable beams plus the turnaround (seconds). */
export function optimalFill(L0: number, tauBurn: number, tauOther: number, turnaround: number, maxLength = 48 * 3600): FillOptimum {
  let best: FillOptimum = { fillLength: 0, averageLumi: 0, integrated: 0 };
  const n = 480;
  for (let i = 1; i <= n; i++) {
    const T = (maxLength * i) / n;
    const I = integratedLuminosity(T, L0, tauBurn, tauOther, 200);
    const avg = I / (T + turnaround);
    if (avg > best.averageLumi) best = { fillLength: T, averageLumi: avg, integrated: I };
  }
  return best;
}

// ── The machine stage ───────────────────────────────────────────────────────────────────────────────

export interface MachineConfig {
  mode?: 'pp' | 'ee' | 'ppbar';
  /** Energy per beam in GeV (6800 by default, i.e. 13.6 TeV in the centre of mass). */
  beamEnergyGeV?: number;
  bunchIntensity?: number;
  nBunches?: number;
  bunchSpacingNs?: number;
  /** Normalised emittance (m·rad), β* (m), full crossing angle (rad), bunch length (m). */
  epsN?: number;
  betaStar?: number;
  crossingAngle?: number;
  sigmaZ?: number;
  circumference?: number;
  sigmaInelMb?: number;
  /** Set this to give the luminosity directly (cm⁻² s⁻¹) instead of computing it from the beam parameters. */
  lumi?: number;
}

export interface MachineStageResult {
  /** Instantaneous luminosity, cm⁻² s⁻¹. */
  lumi: number;
  /** Mean collisions per crossing (0 for lepton colliders). */
  mu: number;
  bunchSpacingNs: number;
  /** Centre-of-mass energy, GeV. */
  sqrtS: number;
  /** Average bunch-crossing rate of the colliding bunches (Hz): n_b f_rev. */
  crossingRateHz: number;
  /** The maximum rate the spacing allows (40 MHz for 25 ns). */
  maxCrossingRateHz: number;
  /** The LumiParams that were used. */
  params: LumiParams;
}

const M_PROTON = 0.9382720813;
const M_ELECTRON = 0.000510998950;

/** The machine stage: from beam parameters to luminosity, pile-up and crossing rates. Run-3-like defaults (see the README). */
export function machineStage(config: MachineConfig = {}): MachineStageResult {
  const mode = config.mode ?? 'pp';
  const E = config.beamEnergyGeV ?? 6800;
  const m = mode === 'ee' ? M_ELECTRON : M_PROTON;
  const C = config.circumference ?? LHC.circumference_m;
  const params: LumiParams = {
    Nb: config.bunchIntensity ?? RUN3_LIKE.Nb,
    nb: config.nBunches ?? RUN3_LIKE.nb,
    frev: revolutionFrequency(C),
    eps_n: config.epsN ?? RUN3_LIKE.eps_n,
    betaStar: config.betaStar ?? RUN3_LIKE.betaStar,
    gamma: E / m,
    crossingAngle: config.crossingAngle ?? RUN3_LIKE.crossingAngle,
    sigmaZ: config.sigmaZ ?? RUN3_LIKE.sigmaZ,
  };
  const lumi = config.lumi ?? luminosity(params);
  const mu = mode === 'ee' ? 0 : pileup(lumi, params.nb, params.frev, config.sigmaInelMb ?? SIGMA_INEL_MB);
  const spacing = config.bunchSpacingNs ?? 25;
  return { lumi, mu, bunchSpacingNs: spacing, sqrtS: 2 * E, crossingRateHz: params.nb * params.frev, maxCrossingRateHz: 1e9 / spacing, params };
}

/** Lorentz factor of a 7 TeV proton (used for the design parameters). */
const GAMMA_7TEV = 7000 / M_PROTON;

/**
 * The LHC design luminosity parameters (LHC Design Report, CERN-2004-003, Table 2.1): 1.15 × 10¹¹ protons per bunch,
 * 2808 bunches, ε_n = 3.75 µm, β* = 0.55 m, θ_c = 285 µrad, σ_z = 7.55 cm, at 7 TeV: L ≈ 10³⁴ cm⁻² s⁻¹.
 */
export const LHC_DESIGN: LumiParams = {
  Nb: LHC.bunch.intensity,
  nb: LHC.bunch.nBunches,
  frev: revolutionFrequency(LHC.circumference_m),
  eps_n: LHC.optics.epsNormalised_m,
  betaStar: LHC.optics.betaStar_m,
  gamma: GAMMA_7TEV,
  crossingAngle: LHC.optics.crossingAngle_rad,
  sigmaZ: LHC.optics.sigmaZ_m,
};
/**
 * Illustrative Run-3-like parameters at 6.8 TeV (not an official table): 1.6 × 10¹¹ protons per bunch, 2400 bunches,
 * ε_n = 2.5 µm at collisions, β* = 0.6 m, a full crossing angle of 320 µrad. They give a peak luminosity of about 2 × 10³⁴ cm⁻² s⁻¹
 * (twice the design value) and a pile-up of about 60 collisions per crossing, the right order for the machine's public Run-3 figures.
 */
export const RUN3_LIKE: LumiParams = {
  Nb: 1.6e11,
  nb: 2400,
  frev: revolutionFrequency(LHC.circumference_m),
  eps_n: 2.5e-6,
  betaStar: 0.6,
  gamma: 6800 / M_PROTON,
  crossingAngle: 320e-6,
  sigmaZ: 0.075,
};
