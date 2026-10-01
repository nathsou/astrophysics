/**
 * Breit–Wigner masses for unstable particles, and kinematic thresholds of decay modes.
 *
 * This file only depends on the particle table and the random module, so that the hadronisation module can
 * import it without creating a cycle with `decay/index.ts` (which imports the hadronisation).
 */
import { particle, hasParticle } from '../particles/index.ts';
import { breitWigner, type Rng } from '../random/index.ts';

/** A particle is treated as a resonance (its mass is drawn from a Breit–Wigner) if its width exceeds 1 MeV. */
export const RESONANCE_MIN_WIDTH_GEV = 1e-3;

/** Whether `pdg` is in the table and has a width above `RESONANCE_MIN_WIDTH_GEV`. */
export function isResonance(pdg: number): boolean {
  return hasParticle(pdg) && particle(pdg).width > RESONANCE_MIN_WIDTH_GEV;
}

const MIN_BR_FOR_THRESHOLD = 0.02;
const thrCache = new Map<number, number>();

/**
 * The lowest mass at which `pdg` can be produced: for a resonance, the lowest total product mass over its decay
 * modes with a branching fraction of at least 2 % (products that are resonances themselves count with their own threshold, so H → W W* is open at 125 GeV);
 * for any other particle, its mass.
 */
export function minMass(pdg: number): number {
  const key = Math.abs(pdg);
  const c = thrCache.get(key);
  if (c !== undefined) return c;
  const p = particle(key);
  let v = p.mass;
  if (p.width > RESONANCE_MIN_WIDTH_GEV && p.decays.length > 0) {
    // Guard against self-reference through a mode such as H → …: only descend into other particles.
    thrCache.set(key, p.mass);
    v = Infinity;
    for (const d of p.decays) {
      if (d.br < MIN_BR_FOR_THRESHOLD) continue; // a 0.04 % e⁺e⁻ mode of the ρ must not open the phase space below 2mπ
      let s = 0;
      for (const q of d.products) s += Math.abs(q) === key ? particle(q).mass : minMass(q);
      if (s < v) v = s;
    }
    if (!Number.isFinite(v)) v = p.mass;
    // A resonance is never lighter than the lowest threshold but the nominal mass is a cap for t and the like.
    v = Math.min(v, p.mass);
  }
  thrCache.set(key, v);
  return v;
}

export interface SampleMassOptions {
  /** Lower limit of the mass (GeV). Default: the decay threshold `minMass(pdg)`. */
  min?: number;
  /** Upper limit (GeV). Default: m + nΓ. */
  max?: number;
  /** The window is m ± nWidths Γ (default 5). */
  nWidths?: number;
}

/**
 * A mass for the particle `pdg`: the nominal mass for a narrow particle, otherwise a draw from the non-relativistic
 * Breit–Wigner (Cauchy) distribution with the table's width, truncated to [min, max] and to m ± nΓ.
 *
 * This is what makes the Z, W, top, Higgs, ρ, ω, φ, Δ … lines have a shape. The width is constant (not mass
 * dependent) and there is no parton-luminosity or phase-space weighting: the honest approximations of a toy.
 */
export function sampleMass(pdg: number, rng: Rng, opts: SampleMassOptions = {}): number {
  const p = particle(pdg);
  if (!(p.width > RESONANCE_MIN_WIDTH_GEV)) return p.mass;
  const n = opts.nWidths ?? 5;
  let lo = Math.max(opts.min ?? minMass(pdg), p.mass - n * p.width);
  let hi = Math.min(opts.max ?? Infinity, p.mass + n * p.width);
  if (lo < 0) lo = 0;
  if (!(hi > lo)) {
    // The allowed range lies outside m ± nΓ (a W* in H → WW*): take the Breit–Wigner tail down to the threshold.
    lo = Math.min(opts.min ?? minMass(pdg), hi);
    if (!(hi > lo)) return hi;
  }
  return breitWigner(rng, p.mass, p.width, lo, hi);
}
