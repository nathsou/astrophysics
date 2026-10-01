/** Chapter 16: the three pieces of Bhabha scattering, in units of πα²/s (per unit cos θ), for massless electrons and photon exchange. */
export function bhabhaParts(c: number): { s: number; t: number; interference: number; total: number } {
  // s = 1, t = −(1 − c)/2, u = −(1 + c)/2
  const t = -(1 - c) / 2, u = -(1 + c) / 2;
  const sPart = t * t + u * u; // (t² + u²)/s²: the same as e⁺e⁻ → μ⁺μ⁻, (1 + c²)/2
  const tPart = (1 + u * u) / (t * t); // (s² + u²)/t²
  const inter = (2 * u * u) / t; // 2u²/(st)
  return { s: sPart, t: tPart, interference: inter, total: sPart + tPart + inter };
}
