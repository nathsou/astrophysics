// Shared toy cooling/heating microphysics for the ISM chapter's sims (ism-phases, ism-pressure).
//
// Below ~1.5e4 K this is the widely used analytic fit of Koyama & Inutsuka (2002, ApJ 564, L97;
// with the corrected coefficient of Vázquez-Semadeni et al. 2007):
//     Λ(T) = Γ₀ [ 1e7 exp(−114800 / (T + 1000)) + 1.4e−2 √T exp(−92 / T) ]  erg cm³ s⁻¹,
// with Γ₀ = 2e−26 erg s⁻¹: a Lyman-α term and a [C II] 158 μm fine-structure term. With a heating
// rate Γ ≈ Γ₀ it gives the classic two-phase S-curve: a cold branch (n ~ 10–100 cm⁻³, T ~ 50–200 K)
// and a warm branch (n ~ 0.1–1 cm⁻³, T ~ 5000–8000 K) coexisting at P/k ≈ 1600–5000 K cm⁻³.
// Above 1.5e4 K the fit is joined (log-log) onto a coarse collisional-ionisation-equilibrium table
// (peak near 1e5 K, bremsstrahlung above 1e7 K). Pedagogical only: do not use it for anything quantitative.

const GAMMA0 = 2e-26; // erg/s, the normalisation of the Koyama–Inutsuka fit

/** Koyama & Inutsuka (2002) cooling coefficient, valid for T ≲ 2e4 K. */
function coolingKI(T: number): number {
  return GAMMA0 * (1e7 * Math.exp(-114800 / (T + 1000)) + 1.4e-2 * Math.sqrt(T) * Math.exp(-92 / T));
}

// (log10 T [K], log10 Λ [erg cm³ s⁻¹]) for the hot gas, starting where the fit is handed over.
const T_JOIN = 1.5e4;
const ANCHORS: [number, number][] = [
  [Math.log10(T_JOIN), Math.log10(coolingKI(T_JOIN))],
  [5.0, -21.6], // 1e5 K: collisional-ionisation peak (H, He, metals)
  [5.4, -21.85],
  [5.8, -22.4],
  [6.2, -22.75], // ~1.6e6 K: hot ionised medium sits out here (mostly non-equilibrium)
  [6.6, -22.9],
  [7.0, -22.75], // bremsstrahlung slowly rising again
  [7.6, -22.35],
  [8.2, -21.9],
];

const LT = ANCHORS.map((a) => a[0]);
const LL = ANCHORS.map((a) => a[1]);

/** Cooling coefficient Λ(T) in erg cm³ s⁻¹ (solar metallicity). */
export function coolingLambda(T: number): number {
  if (T <= T_JOIN) return coolingKI(Math.max(T, 1));
  const lt = Math.log10(T);
  if (lt >= LT[LT.length - 1]) return 10 ** LL[LT.length - 1];
  let i = 1;
  while (i < LT.length - 1 && LT[i] < lt) i++;
  const t = (lt - LT[i - 1]) / (LT[i] - LT[i - 1]);
  return 10 ** (LL[i - 1] + t * (LL[i] - LL[i - 1]));
}

/**
 * The thermal-equilibrium curve traced parametrically in T: heating nΓ = cooling n²ΛZ gives
 * n = Γ / (Λ(T) Z) directly, so every branch (including the unstable one) comes out in one pass.
 */
export function equilibriumCurve(Gamma: number, Z: number, Tmin = 10, Tmax = 3e7, nPts = 400): { n: Float64Array; T: Float64Array } {
  const n = new Float64Array(nPts), T = new Float64Array(nPts);
  for (let i = 0; i < nPts; i++) {
    T[i] = Tmin * (Tmax / Tmin) ** (i / (nPts - 1));
    n[i] = Gamma / (coolingLambda(T[i]) * Z);
  }
  return { n, T };
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
