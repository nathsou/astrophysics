/** Multiple Coulomb scattering, for process noise and for road widths. */

/**
 * Highland's formula for the rms projected scattering angle (rad) of a particle of momentum p (GeV) and mass
 * `mass` (GeV) crossing t = x/X0 radiation lengths: θ0 = 13.6 MeV/(βp) · √t · (1 + 0.038 ln t).
 */
export function highland(p: number, t: number, mass = 0.13957): number {
  if (t <= 0) return 0;
  const beta = p / Math.sqrt(p * p + mass * mass);
  return Math.max(0, (0.0136 / (beta * p)) * Math.sqrt(t) * (1 + 0.038 * Math.log(t)));
}
