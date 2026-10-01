/** Two-path interference with phasors (Chapter 3). */

export interface Slits {
  /** Slit separation over wavelength, a/λ. */
  aOverLambda: number;
  /** Amplitude of the second path relative to the first. */
  ratio: number;
}

/** The phase difference between the two paths for a screen at angle θ (far field): δ = 2π (a/λ) sin θ. */
export const phaseDifference = (s: Slits, theta: number): number => 2 * Math.PI * s.aOverLambda * Math.sin(theta);

/** The two amplitudes as phasors (re, im): the first path at phase −δ/2, the second at +δ/2 (a common phase does not matter). */
export function phasors(s: Slits, theta: number): { a1: [number, number]; a2: [number, number] } {
  const d = phaseDifference(s, theta) / 2;
  return { a1: [Math.cos(-d), Math.sin(-d)], a2: [s.ratio * Math.cos(d), s.ratio * Math.sin(d)] };
}

/** With no way to tell which slit the particle took, amplitudes add before squaring: |A₁ + A₂|² = 1 + r² + 2r cos δ. */
export function intensityCoherent(s: Slits, theta: number): number {
  const { a1, a2 } = phasors(s, theta);
  return (a1[0] + a2[0]) ** 2 + (a1[1] + a2[1]) ** 2;
}
/** If the path is recorded, probabilities add: |A₁|² + |A₂|² = 1 + r². No fringes. */
export function intensityWhichPath(s: Slits): number {
  return 1 + s.ratio * s.ratio;
}
