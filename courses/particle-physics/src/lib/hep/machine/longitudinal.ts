/**
 * Longitudinal dynamics: phase stability, the RF bucket and the synchrotron motion.
 *
 * Each turn a particle crosses the RF cavity at a phase φ = φ_s + Δφ relative to the crest of the wave and gains the energy
 * eV sin φ. The synchronous particle has Δφ = 0 and gains exactly what the ring needs (for a stationary bucket, nothing).
 * A particle that is a little off in energy (ΔE) has a slightly different revolution time, set by the slip factor
 * η = α_c − 1/γ², so it arrives a little early or late. Together this is the standard map, applied once per turn:
 *
 *     ΔE′ = ΔE + eV [sin(φ_s + Δφ) − sin φ_s]
 *     Δφ′ = Δφ + 2π h η ΔE′/(β² E₀)
 *
 * with h the harmonic number (RF frequency over revolution frequency). For small amplitudes this is a pendulum, and the
 * oscillation (measured in turns) has the synchrotron tune Q_s² = −h η eV cos φ_s/(2π β² E₀).
 * Phase stability needs η cos φ_s < 0: below transition (η < 0) φ_s is in the rising half of the wave, above transition
 * (η > 0) in the falling half.
 *
 * Units: energies in GeV, voltages in volts, phases in radians. δ = ΔE/(β² E₀) = Δp/p.
 */
import { hook } from '../hooks.ts';

export interface RfParams {
  /** Harmonic number h = f_RF/f_rev. */
  harmonic: number;
  /** Peak RF voltage per turn in volts. */
  voltage: number;
  /** Synchronous phase φ_s (rad); the stable fixed point sits at Δφ = 0. */
  phiS: number;
  /** Slip factor η = α_c − 1/γ². */
  eta: number;
  /** Total energy of the synchronous particle in GeV. */
  energy: number;
  /** Rest mass in GeV (proton by default). */
  mass?: number;
  /** Charge in units of e (default 1). */
  charge?: number;
}

const PROTON_MASS = 0.9382720813;

const betaSquared = (p: RfParams): number => {
  const m = p.mass ?? PROTON_MASS;
  return 1 - (m / p.energy) ** 2;
};
/** eV in GeV. */
const eV = (p: RfParams): number => (p.charge ?? 1) * p.voltage * 1e-9;

/** The slip factor η = α_c − 1/γ² (positive above transition). */
export const slipFactor = (gamma: number, alphaC: number): number => alphaC - 1 / (gamma * gamma);
/** Transition γ_t = 1/√α_c. */
export const transitionGamma = (alphaC: number): number => 1 / Math.sqrt(alphaC);
/** The transition energy γ_t m in GeV. */
export const transitionEnergy = (alphaC: number, mass = PROTON_MASS): number => transitionGamma(alphaC) * mass;
/**
 * When a beam crosses transition (η changes sign) the stable phase must jump from φ_s to π − φ_s so that the particles stay
 * at the stable point; the machines that cross it (the PS, the SPS in its early days) do this with a phase jump of the RF.
 * The size of the jump is π − 2φ_s.
 */
export const phaseJumpAtTransition = (phiS: number): number => Math.PI - 2 * phiS;
/** The stable synchronous phase for a fraction g = (energy gain per turn)/(eV) ∈ [0, 1]: asin(g) below transition, π − asin(g) above. */
export function stablePhase(eta: number, gainFraction: number): number {
  const a = Math.asin(Math.max(-1, Math.min(1, gainFraction)));
  return eta < 0 ? a : Math.PI - a;
}

/** The two coefficients of the map: Δφ advances by a·δ, and δ receives b·[sin(φ_s + Δφ) − sin φ_s], with a = 2π h η and b = eV/(β² E₀). */
export function mapCoefficients(p: RfParams): { a: number; b: number } {
  return { a: 2 * Math.PI * p.harmonic * p.eta, b: eV(p) / (betaSquared(p) * p.energy) };
}

/** Phase stability: η cos φ_s < 0 (and a non-zero voltage). */
export function isPhaseStable(p: RfParams): boolean {
  return p.voltage > 0 && p.eta * Math.cos(p.phiS) < 0;
}

/** The synchrotron tune Q_s (oscillations per turn) for small amplitudes: Q_s = √(−h η eV cos φ_s/(2π β² E)). NaN if unstable. */
export function synchrotronTune(p: RfParams): number {
  const { a, b } = mapCoefficients(p);
  const q2 = -(a * b * Math.cos(p.phiS)) / (4 * Math.PI * Math.PI);
  return q2 > 0 ? Math.sqrt(q2) : NaN;
}
/** The exact tune of the linearised one-turn map, cos 2πQ = 1 + a b cos φ_s/2 (equal to `synchrotronTune` for Q_s ≪ 1). */
export function synchrotronTuneExact(p: RfParams): number {
  const { a, b } = mapCoefficients(p);
  const c = 1 + (a * b * Math.cos(p.phiS)) / 2;
  return Math.abs(c) < 1 ? Math.acos(c) / (2 * Math.PI) : NaN;
}
/** The synchrotron frequency in Hz for a given revolution frequency. */
export const synchrotronFrequency = (p: RfParams, revolutionHz: number): number => synchrotronTune(p) * revolutionHz;

/** The (scaled) invariant of the motion, H = ½|a|δ² + s b [cos(φ_s + Δφ) + Δφ sin φ_s], s = sign(a). It is constant on the smooth flow. */
export function hamiltonian(p: RfParams, dphi: number, delta: number): number {
  const { a, b } = mapCoefficients(p);
  const s = Math.sign(a) || 1;
  return 0.5 * Math.abs(a) * delta * delta + s * b * (Math.cos(p.phiS + dphi) + dphi * Math.sin(p.phiS));
}
const potential = (p: RfParams, dphi: number): number => hamiltonian(p, dphi, 0);

export interface BucketGeometry {
  stable: boolean;
  /** The unstable fixed point on the separatrix (Δφ, rad) and the turning point on the other side. */
  unstablePoint: number;
  otherEdge: number;
  /** Left and right edges of the bucket in Δφ. */
  left: number;
  right: number;
  /** H on the separatrix. */
  hSeparatrix: number;
  /** The half-height of the bucket at Δφ = 0 in δ = Δp/p. */
  halfHeight: number;
  /** The bucket area in (Δφ [rad], δ) units: ∮ δ dΔφ. */
  area: number;
}

/** The separatrix passes through the unstable fixed point at Δφ = π − 2φ_s (wrapped to (−π, π]). */
export function bucketGeometry(p: RfParams): BucketGeometry {
  if (!isPhaseStable(p)) return { stable: false, unstablePoint: NaN, otherEdge: NaN, left: NaN, right: NaN, hSeparatrix: NaN, halfHeight: 0, area: 0 };
  const wrap = (x: number) => {
    let y = (x + Math.PI) % (2 * Math.PI);
    if (y < 0) y += 2 * Math.PI;
    return y - Math.PI;
  };
  const u = wrap(Math.PI - 2 * p.phiS);
  const hu = potential(p, u);
  // Turning point on the other side of the well: W(Δφ) = W(u), found by bisection between the stable point and the next hill.
  const dir = u >= 0 ? -1 : 1;
  let lo = 0;
  let hi = dir * (2 * Math.PI - Math.abs(u));
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (potential(p, mid) < hu) lo = mid;
    else hi = mid;
  }
  const other = 0.5 * (lo + hi);
  const left = Math.min(u, other);
  const right = Math.max(u, other);
  const { a } = mapCoefficients(p);
  const height = (x: number) => Math.sqrt(Math.max(0, (2 * (hu - potential(p, x))) / Math.abs(a)));
  const n = 2000;
  let area = 0;
  for (let i = 0; i <= n; i++) {
    const x = left + ((right - left) * i) / n;
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    area += w * height(x);
  }
  area *= (2 * (right - left)) / (3 * n);
  return { stable: true, unstablePoint: u, otherEdge: other, left, right, hSeparatrix: hu, halfHeight: height(0), area };
}

/** The upper branch of the separatrix as arrays of Δφ and δ (the lower branch is −δ). */
export function separatrix(p: RfParams, n = 200): { dphi: number[]; delta: number[] } {
  const g = bucketGeometry(p);
  const dphi: number[] = [];
  const delta: number[] = [];
  if (!g.stable) return { dphi, delta };
  const { a } = mapCoefficients(p);
  for (let i = 0; i <= n; i++) {
    const x = g.left + ((g.right - g.left) * i) / n;
    dphi.push(x);
    delta.push(Math.sqrt(Math.max(0, (2 * (g.hSeparatrix - potential(p, x))) / Math.abs(a))));
  }
  return { dphi, delta };
}

/** The half-height of a stationary bucket (φ_s = 0 or π): δ_max = √(2 eV/(π h |η| β² E₀)) = 2 Q_s/(h |η|). */
export function stationaryHalfHeight(p: RfParams): number {
  const { a, b } = mapCoefficients(p);
  return Math.sqrt((4 * b) / Math.abs(a));
}
/** The area of a stationary bucket, 8 δ_max in (rad, δ) units (the small-amplitude ellipse has area π Δφ δ). */
export const stationaryBucketArea = (p: RfParams): number => 8 * stationaryHalfHeight(p);
/**
 * The ratio of the moving-bucket half-height to the stationary one, √Y(φ_s) with Y = cos φ_s − (π/2 − φ_s) sin φ_s, for the
 * stable phase φ_s measured from the zero crossing (0 ≤ φ_s < π/2). Shrinks to zero as φ_s → π/2.
 */
export function movingBucketHeightRatio(phiFromStationary: number): number {
  const y = Math.cos(phiFromStationary) - (Math.PI / 2 - phiFromStationary) * Math.sin(phiFromStationary);
  return Math.sqrt(Math.max(0, y));
}
/** Converts a bucket area in (rad, δ) units to eV·s: area × β² E₀ /(2π f_RF), with E₀ in eV. */
export function bucketAreaEVs(areaRadDelta: number, p: RfParams, rfFrequencyHz: number): number {
  return (areaRadDelta * betaSquared(p) * p.energy * 1e9) / (2 * Math.PI * rfFrequencyHz);
}

/** A particle's longitudinal coordinates: phase offset (rad) and energy offset (GeV). */
export interface LongParticle {
  dphi: number;
  dE: number;
  /** Set once the particle has left the bucket (sticky). */
  lost?: boolean;
}

/** δ = ΔE/(β² E₀). */
export const deltaOf = (p: RfParams, dE: number): number => dE / (betaSquared(p) * p.energy);
/** The inverse: ΔE from δ. */
export const energyOffsetOf = (p: RfParams, delta: number): number => delta * betaSquared(p) * p.energy;

/** One turn of the standard map, in place. */
export function stepLongitudinal(q: LongParticle, p: RfParams): void {
  q.dE += eV(p) * (Math.sin(p.phiS + q.dphi) - Math.sin(p.phiS));
  q.dphi += (2 * Math.PI * p.harmonic * p.eta * q.dE) / (betaSquared(p) * p.energy);
}

/** Is the particle inside the separatrix (and between the edges of the bucket)? */
export function inBucket(q: { dphi: number; dE: number }, p: RfParams, geometry: BucketGeometry = bucketGeometry(p)): boolean {
  if (!geometry.stable) return false;
  if (q.dphi < geometry.left || q.dphi > geometry.right) return false;
  return hamiltonian(p, q.dphi, deltaOf(p, q.dE)) < geometry.hSeparatrix;
}

/**
 * The reference longitudinal tracker: n turns of the standard map for each particle. The input is not modified. Particles that
 * leave the bucket are marked `lost` (and go on drifting). Hook: `machine.trackLongitudinal`.
 */
export function referenceTrackLongitudinal(particles: readonly LongParticle[], params: RfParams, nTurns: number): LongParticle[] {
  const g = bucketGeometry(params);
  const out = particles.map((q) => ({ ...q }));
  for (const q of out) {
    for (let i = 0; i < nTurns; i++) {
      stepLongitudinal(q, params);
      if (!q.lost && !inBucket(q, params, g)) q.lost = true;
    }
  }
  return out;
}
/** Track particles for n turns (through the reader's hook if one is installed). */
export function trackLongitudinal(particles: readonly LongParticle[], params: RfParams, nTurns: number): LongParticle[] {
  return hook('machine.trackLongitudinal', referenceTrackLongitudinal)(particles, params, nTurns);
}

/** The phase and energy of one particle on every turn, for measuring the synchrotron tune. */
export function longitudinalHistory(start: LongParticle, params: RfParams, nTurns: number): { dphi: number[]; dE: number[] } {
  const q = { ...start };
  const dphi: number[] = [];
  const dE: number[] = [];
  for (let i = 0; i < nTurns; i++) {
    dphi.push(q.dphi);
    dE.push(q.dE);
    stepLongitudinal(q, params);
  }
  return { dphi, dE };
}

/** The LHC's RF system at a given beam energy (above transition, stationary bucket): h = 35 640, 16 MV at 7 TeV, 8 MV at injection. */
export function lhcRf(energyGeV: number, voltageV?: number): RfParams {
  const alphaC = 3.225e-4; // LHC Design Report, CERN-2004-003, Table 2.1
  const gamma = energyGeV / PROTON_MASS;
  const eta = slipFactor(gamma, alphaC);
  return {
    harmonic: 35640, // LHC Design Report, CERN-2004-003
    voltage: voltageV ?? (energyGeV > 1000 ? 16e6 : 8e6),
    phiS: Math.PI,
    eta,
    energy: energyGeV,
  };
}
