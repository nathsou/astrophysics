// Shared formulas for Chapter 7 (Jeans analysis, IMF, pre-main-sequence tracks).

const kB = 1.380649e-23, mH = 1.6735575e-27, G = 6.6743e-11, MSUN = 1.98847e30, PC = 3.0856775814913673e16, MYR = 3.15576e13;
export const MU = 2.33; // mean mass per particle in molecular gas (H₂ + He), in m_H

/** Jeans quantities for number density n (cm⁻³, particles) and temperature T (K). */
export function jeans(n: number, T: number) {
  const rho = MU * mH * n * 1e6;            // kg m⁻³
  const cs = Math.sqrt((kB * T) / (MU * mH)); // m s⁻¹
  const lambda = cs * Math.sqrt(Math.PI / (G * rho));
  const MJ = ((Math.PI ** 2.5) / 6) * cs ** 3 / (G ** 1.5 * Math.sqrt(rho)); // M = (4π/3) ρ (λ_J/2)³
  const tff = Math.sqrt((3 * Math.PI) / (32 * G * rho));
  return { rho, cs, MJ: MJ / MSUN, lambdaPc: lambda / PC, tffMyr: tff / MYR };
}

// ---- Kroupa (2001) IMF: dN/dM ∝ M^-α with α = 0.3 (M < 0.08), 1.3 (0.08–0.5), 2.3 (> 0.5) ----
export const IMF_MIN = 0.01, IMF_MAX = 150;
const BREAKS = [IMF_MIN, 0.08, 0.5, IMF_MAX];
const ALPHAS = [0.3, 1.3, 2.3];
// continuity constants
const K = [1, 0.08 ** (1.3 - 0.3), 0];
K[2] = K[1] * 0.5 ** (2.3 - 1.3);
const segInt = (a: number, lo: number, hi: number, p: number) => // ∫ M^(p-a) dM
  Math.abs(p - a + 1) < 1e-9 ? Math.log(hi / lo) : (hi ** (p - a + 1) - lo ** (p - a + 1)) / (p - a + 1);
const W = ALPHAS.map((a, i) => K[i] * segInt(a, BREAKS[i], BREAKS[i + 1], 0));
const WTOT = W.reduce((s, x) => s + x, 0);

/** Kroupa dN/dM, normalised to ∫ dN/dM dM = 1 over [0.01, 150] M☉. */
export function kroupa(M: number) {
  if (M < IMF_MIN || M > IMF_MAX) return 0;
  const i = M < 0.08 ? 0 : M < 0.5 ? 1 : 2;
  return (K[i] * M ** -ALPHAS[i]) / WTOT;
}
/** Mean stellar mass of the Kroupa IMF over [0.01, 150]. */
export const kroupaMean = ALPHAS.reduce((s, a, i) => s + K[i] * segInt(a, BREAKS[i], BREAKS[i + 1], 1), 0) / WTOT;

/** Draw one mass from the Kroupa IMF by exact inverse CDF of each power-law segment. */
export function sampleKroupa(u1: number, u2: number) {
  let t = u1 * WTOT, i = 0;
  while (i < 2 && t > W[i]) { t -= W[i]; i++; }
  const a = ALPHAS[i], lo = BREAKS[i], hi = BREAKS[i + 1], e = 1 - a;
  return (lo ** e + u2 * (hi ** e - lo ** e)) ** (1 / e);
}

/** Salpeter (1955): dN/dM ∝ M^-2.35 over [0.1, 150], normalised to unit number. */
export function salpeter(M: number) {
  if (M < 0.1 || M > IMF_MAX) return 0;
  const norm = (0.1 ** -1.35 - IMF_MAX ** -1.35) / 1.35;
  return M ** -2.35 / norm;
}

/** Chabrier (2003) system IMF, dN/dlog10 M: lognormal below 1 M☉, Salpeter-like power law above. */
export function chabrierLog(M: number) {
  const lo = (m: number) => 0.086 * Math.exp(-((Math.log10(m) - Math.log10(0.22)) ** 2) / (2 * 0.57 ** 2));
  return M <= 1 ? lo(M) : lo(1) * M ** -1.3;
}
