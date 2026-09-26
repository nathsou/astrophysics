// Shared toy cooling/heating microphysics for the ISM chapter's sims (ism-phases, ism-pressure).
//
// This is a *pedagogical* stand-in for real cooling functions (e.g. Sutherland & Dopita 1993,
// Wolfire et al. 1995/2003), tuned to reproduce the qualitative shape that matters for the
// two-phase medium: a fine-structure/Lyman-alpha bump that makes the equilibrium pressure curve
// P_eq(n) = Gamma*T(n)/Lambda(T(n)) non-monotonic between n ~ 0.3 and ~30 cm^-3, and a much
// stronger collisional-ionisation peak near 1e5 K that dominates the hot, low-density gas.
// It is NOT a fit to any tabulated cooling function; do not use it for anything quantitative.

// (log10 T [K], log10 Lambda [erg cm^3 s^-1]) anchor points, solar metallicity.
const ANCHORS: [number, number][] = [
  [1.0, -27.3], // 10 K: freeze-out, almost no coolants left
  [1.5, -26.7], // 30 K
  [2.0, -25.7], // 100 K: CII 158um fine-structure line
  [2.3, -25.1], // 200 K: peak of the low-T (CNM) branch
  [2.7, -25.6], // 500 K: declining — this dip is the thermal-instability saddle
  [3.2, -26.3], // 1600 K
  [3.6, -26.35], // 4000 K: shallow minimum before Lyman-alpha turns on
  [3.9, -25.6], // 8000 K: WNM sits just past here
  [4.2, -24.3], // 16000 K: Lyman-alpha rising fast
  [4.6, -22.6], // 40000 K
  [5.0, -21.6], // 1e5 K: collisional-ionisation peak (H, He, metals)
  [5.4, -21.85],
  [5.8, -22.4],
  [6.2, -22.75], // ~1.6e6 K: hot ionised medium sits out here (mostly non-equilibrium)
  [6.6, -22.9],
  [7.0, -22.75], // bremsstrahlung slowly rising again
  [7.6, -22.35],
  [8.2, -21.9],
] as const;

const LT = ANCHORS.map((a) => a[0]);
const LL = ANCHORS.map((a) => a[1]);

/** Log-log-interpolated cooling coefficient Lambda(T) in erg cm^3 s^-1, clamped outside the table. */
export function coolingLambda(T: number): number {
  const lt = Math.log10(Math.max(T, 1));
  if (lt <= LT[0]) return 10 ** LL[0];
  if (lt >= LT[LT.length - 1]) return 10 ** LL[LT.length - 1];
  let i = 1;
  while (i < LT.length - 1 && LT[i] < lt) i++;
  const t = (lt - LT[i - 1]) / (LT[i] - LT[i - 1]);
  return 10 ** (LL[i - 1] + t * (LL[i] - LL[i - 1]));
}

/** kB in erg/K, for the toy energy budget (u = 1.5 n kB T per unit volume). */
export const kB_erg = 1.380649e-16;

/**
 * Net radiative heating minus cooling per particle, dT/dt contribution [K/s], for density n [cm^-3],
 * temperature T [K], photoelectric/UV heating rate Gamma [erg/s] (per H atom) and a metallicity
 * multiplier Z on the cooling coefficient (metals and dust carry most of the coolants and grain
 * photoelectric heating, so both heating and cooling scale roughly with Z; we keep heating fixed
 * and scale only cooling here for a clearer, more didactic Z-slider).
 */
export function dTdt(n: number, T: number, Gamma: number, Z: number): number {
  const cool = n * coolingLambda(T) * Z; // erg/s per particle
  return ((Gamma - cool) / (1.5 * kB_erg)) as number;
}

/** Local cooling/heating timescale [s], used to choose a stable sub-cycle step. */
export function thermalTimescale(n: number, T: number, Gamma: number, Z: number): number {
  const rate = Math.abs(dTdt(n, T, Gamma, Z));
  return rate > 1e-30 ? T / rate : Infinity;
}

/**
 * Equilibrium temperature at fixed n (bisection on dTdt = 0). Used by the pressure-curve sim to
 * trace the full S-curve, including its unstable middle branch.
 */
export function equilibriumT(n: number, Gamma: number, Z: number, Tlo = 5, Thi = 3e7): number {
  let lo = Math.log10(Tlo), hi = Math.log10(Thi);
  let flo = dTdt(n, 10 ** lo, Gamma, Z);
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    const fm = dTdt(n, 10 ** mid, Gamma, Z);
    if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return 10 ** (0.5 * (lo + hi));
}
