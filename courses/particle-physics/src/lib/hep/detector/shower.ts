/**
 * Showers and calorimeter response.
 *
 * An electromagnetic shower is a cascade of bremsstrahlung (e → eγ) and pair production (γ → e⁺e⁻), each of which
 * happens about once per radiation length X0 and splits the energy between two particles, until the particles fall
 * below the critical energy Ec and lose their energy to ionisation. The Heitler toy model keeps only that.
 * The shower's longitudinal shape is a gamma distribution in t = depth/X0; its transverse size is set by the
 * Molière radius. A hadronic shower is the same idea with the nuclear interaction length λI in place of X0 and a
 * longer, wider development.
 *
 * Calorimeter response: the visible energy is a sum of many small, independent, random contributions, so its
 * fluctuation is Poissonian (σ/E = a/√E, the *stochastic* term), plus a fixed fractional error (the *constant*
 * term, from non-uniformity and calibration) plus electronic noise (σ_n/E). Those three add in quadrature.
 */
import { normal, poisson, uniform, type Rng } from '../random/index.ts';
import type { DetectorConfig } from './config.ts';
import { criticalEnergy, material, radiationLength, type Material } from './materials.ts';
import { gammaP, lnGamma } from './physics.ts';

// ── Heitler's toy model ───────────────────────────────────────────────────────────────────────

export interface HeitlerGeneration {
  /** Generation number g = 0, 1, 2, … (g splittings so far). */
  generation: number;
  /** Depth in radiation lengths: each generation is one splitting length ln2 · X0 deeper. */
  depthX0: number;
  /** Number of particles in this generation (those still able to split plus those that stop here). */
  count: number;
  /** Mean energy per particle (GeV). */
  meanEnergy: number;
  /** Energy (GeV) of the particles of this generation that are below Ec and deposit it locally. */
  deposited: number;
  /** Number of particles of this generation that stop (E < Ec). */
  stopped: number;
}

export interface HeitlerShower {
  E0: number;
  Ec: number;
  generations: HeitlerGeneration[];
  /** Largest number of particles in any generation. */
  nMax: number;
  /** Generation with the most particles and its depth in X0 (the shower maximum). */
  maxGeneration: number;
  tMaxX0: number;
  /** Sum of all locally deposited energies: equals E0 (energy conservation). */
  totalDeposited: number;
  /** Total number of particles created. */
  totalParticles: number;
}

export interface HeitlerOptions {
  /** How a particle's energy is shared at each splitting: 'equal' halves (the textbook model), 'uniform' draws the fraction from U(0.1, 0.9). */
  split?: 'equal' | 'uniform';
  /** Give up tracking individual particles above this many per generation and use the analytic halving instead. */
  maxParticles?: number;
}

/**
 * The Heitler model of an electromagnetic shower. Each particle with energy above `Ec` splits in two after one splitting
 * length ln 2 · X0 (electron → e + γ, photon → e⁺ e⁻), sharing its energy; a particle at or below `Ec` stops and
 * deposits its energy. With equal sharing generation g has 2^g particles of E0/2^g; the shower stops growing after
 * g_max = log2(E0/Ec) generations, at depth ln(E0/Ec) · X0, with N_max = E0/Ec particles.
 * With an `rng`, the sharing is random (`split: 'uniform'`) and the multiplicity fluctuates.
 */
export function heitlerShower(E0: number, Ec: number, rng?: Rng, opts: HeitlerOptions = {}): HeitlerShower {
  const split = opts.split ?? (rng ? 'uniform' : 'equal');
  if (split === 'uniform' && !rng) throw new Error('heitlerShower: split "uniform" needs an rng');
  const maxParticles = opts.maxParticles ?? 200_000;
  const generations: HeitlerGeneration[] = [];
  let total = 0;
  let totalParticles = 0;
  if (split === 'equal') {
    // Analytic: generation g has 2^g particles of E0 / 2^g each; they stop when that energy is ≤ Ec.
    for (let g = 0; g < 1000; g++) {
      const count = 2 ** g;
      const meanEnergy = E0 / count;
      const stop = meanEnergy <= Ec;
      generations.push({ generation: g, depthX0: g * Math.LN2, count, meanEnergy, deposited: stop ? E0 : 0, stopped: stop ? count : 0 });
      totalParticles += count;
      if (stop) {
        total = E0;
        break;
      }
    }
  } else {
    let energies: number[] = [E0];
    for (let g = 0; energies.length > 0; g++) {
      const next: number[] = [];
      let stopped = 0;
      let deposited = 0;
      let sum = 0;
      for (const e of energies) {
        sum += e;
        if (e <= Ec) {
          stopped++;
          deposited += e;
        } else {
          const f = uniform(rng!, 0.1, 0.9);
          next.push(e * f, e * (1 - f));
        }
      }
      if (next.length > maxParticles) throw new Error('heitlerShower: too many particles; use split "equal" or raise maxParticles');
      generations.push({ generation: g, depthX0: g * Math.LN2, count: energies.length, meanEnergy: sum / energies.length, deposited, stopped });
      total += deposited;
      totalParticles += energies.length;
      energies = next;
    }
  }
  let nMax = 0;
  let gMax = 0;
  for (const gen of generations) {
    if (gen.count > nMax) {
      nMax = gen.count;
      gMax = gen.generation;
    }
  }
  return { E0, Ec, generations, nMax, maxGeneration: gMax, tMaxX0: gMax * Math.LN2, totalDeposited: total, totalParticles };
}

// ── Longitudinal and lateral profiles ─────────────────────────────────────────────────────────

/** Shape parameters of the gamma-distribution longitudinal profile dE/dt = E0 b (bt)^{a−1} e^{−bt} / Γ(a). */
export function showerShape(E0: number, Ec: number, kind: 'electron' | 'photon' = 'electron'): { a: number; b: number; tMax: number } {
  const b = 0.5;
  const y = Math.log(Math.max(E0 / Ec, 1.0001));
  const tMax = Math.max(0, y + (kind === 'electron' ? -0.5 : 0.5));
  return { a: 1 + b * tMax, b, tMax };
}

/**
 * Longitudinal profile of an electromagnetic shower: dE/dt in GeV per radiation length at depth t (in X0) for a
 * primary of energy E0 and critical energy Ec (both GeV), the gamma distribution of Longo and Sestili:
 *
 *     dE/dt = E0 · b (b t)^{a−1} e^{−b t} / Γ(a),   b ≈ 0.5,   a = 1 + b t_max,   t_max = ln(E0/Ec) − 0.5 (e) or + 0.5 (γ).
 */
export function longitudinalProfile(E0: number, t: number, Ec: number, kind: 'electron' | 'photon' = 'electron'): number {
  if (t <= 0) return 0;
  const { a, b } = showerShape(E0, Ec, kind);
  return E0 * Math.exp(Math.log(b) + (a - 1) * Math.log(b * t) - b * t - lnGamma(a));
}

/** The fraction of the shower's energy deposited between depths t0 and t1 (in X0). */
export function longitudinalFraction(E0: number, Ec: number, t0: number, t1: number, kind: 'electron' | 'photon' = 'electron'): number {
  const { a, b } = showerShape(E0, Ec, kind);
  return gammaP(a, b * Math.max(0, t1)) - gammaP(a, b * Math.max(0, t0));
}

/** Molière-radius-like lateral profile: a narrow core plus a wide halo, both Gaussian, in units of R_M. */
export const LATERAL_EM = { coreWeight: 0.9, coreSigma: 0.4, haloSigma: 1.2 } as const;
/** Hadronic lateral profile in units of λI. */
export const LATERAL_HAD = { coreWeight: 0.8, coreSigma: 0.25, haloSigma: 0.8 } as const;

/** Hadronic shower parameters: depth in λI, dE/dl ∝ l^{a−1} e^{−l/s}, maximum at ≈ 0.2 ln E + 0.7 λ. */
export function hadronShape(E: number): { a: number; s: number } {
  const s = 1;
  const lMax = Math.max(0.3, 0.2 * Math.log(Math.max(E, 1)) + 0.7);
  return { a: 1 + lMax / s, s };
}

// ── Calorimeter response ──────────────────────────────────────────────────────────────────────

/**
 * The measured energy of a particle of true energy E (GeV) absorbed in the calorimeter of `cfg`:
 *
 *     E_meas = a² · Poisson(E / a²) · (1 + b ξ) + n √nCells η,
 *
 * with a = stochastic term (√GeV), b = constant term, n = noise per cell (GeV), ξ and η standard normals. The mean
 * number of "quanta" E/a² makes σ/E = a/√E emerge from the Poisson statistics; the three terms add in quadrature:
 * σ_E/E = √(a²/E + b² + n² nCells / E²). `kind` selects the ECAL ('em') or the HCAL ('had').
 */
export function caloResponse(kind: 'em' | 'had', E: number, cfg: DetectorConfig, rng: Rng, nCells = 1): number {
  const c = kind === 'em' ? cfg.ecal : cfg.hcal;
  return smear(E, c.stochastic, c.constant, c.noise ?? 0, rng, nCells);
}

/** The resolution σ_E/E predicted by the parameters, for comparison with the simulation. */
export function caloResolution(kind: 'em' | 'had', E: number, cfg: DetectorConfig, nCells = 1): number {
  const c = kind === 'em' ? cfg.ecal : cfg.hcal;
  const n = c.noise ?? 0;
  return Math.sqrt((c.stochastic * c.stochastic) / E + c.constant * c.constant + (n * n * nCells) / (E * E));
}

/** Smear an energy with stochastic a, constant b and noise n (see `caloResponse`). */
export function smear(E: number, a: number, b: number, n: number, rng: Rng, nCells = 1): number {
  let e = E;
  if (a > 0 && E > 0) e = a * a * poisson(rng, E / (a * a));
  if (b > 0) e *= 1 + b * normal(rng);
  if (n > 0) e += n * Math.sqrt(nCells) * normal(rng);
  return e;
}

/** Depth of a calorimeter in radiation lengths converted to a path length in mm in its material. */
export function depthMm(mat: Material | string, depthX0: number): number {
  return depthX0 * radiationLength(mat) * 10;
}

/** Critical energy of the ECAL material in GeV (convenience for the shower functions). */
export function ecalCriticalEnergy(cfg: DetectorConfig): number {
  return criticalEnergy(material(cfg.ecal.material ?? 'PbWO4'));
}
