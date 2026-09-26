// Shared thermal-history helpers for Chapter 26 (The Hot Big Bang) sims.
// Radiation-domination relations between time, temperature and the Hubble rate.
// All temperatures in MeV unless noted. Approximate g*(T) — good to ~10%, fine for
// the qualitative/pedagogical purposes of these figures (labelled "approximate" in the chapter).

export const MPL = 1.22091e22; // reduced-ish Planck mass in MeV (M_pl = 1/sqrt(G), not reduced — matches 1.66 sqrt(g*) T^2/Mpl convention)
export const HBAR_MEV_S = 6.582119569e-22; // MeV*s
export const MEV_TO_KELVIN = 1.16045e10; // 1 MeV / k_B, in Kelvin
export const TAU_N = 879.4; // s, free neutron mean lifetime
export const DELTA_M = 1.29333; // MeV, m_n - m_p
export const B_D = 2.22457; // MeV, deuterium binding energy
export const M_P_MEV = 938.272;
export const M_N_MEV = 939.565;
export const HBARC_CM = 197.3269804e-13; // MeV*cm (ħc)

/** Effective relativistic species count, photons+e⁻e⁺+3ν → photons+CνB after annihilation.
 *  Smoothed step from 10.75 (T ≳ 1 MeV) to 3.36 (T ≲ 0.05 MeV) around e⁺e⁻ annihilation,
 *  plus a small bump for QCD/EW epochs at much higher T (not resolved in this reduced model). */
export function gStar(T_MeV: number, Neff = 3.046): number {
  const gNu = 2 * (7 / 8) * (Neff / 3); // 3 flavours worth of neutrino contribution, scaled by N_eff
  const hi = 2 + gNu + 4 * (7 / 8); // photons + neutrinos + e+/e- (relativistic)
  const lo = 2 + gNu * (4 / 11) ** (4 / 3) * (11 / 4); // after annihilation, neutrinos colder — kept simple: photons + neutrinos (reheated ratio folded into T_nu elsewhere)
  // Smooth logistic transition centred near T ~ 0.15 MeV over ~ a decade in T.
  const x = Math.log(T_MeV / 0.15) / Math.log(3);
  const f = 1 / (1 + Math.exp(-x * 3));
  return lo + (hi - lo) * f;
}

/** Hubble rate during radiation domination, s^-1, from H = 1.66 sqrt(g*) T^2 / Mpl (natural units). */
export function hubble(T_MeV: number, Neff = 3.046): number {
  const g = gStar(T_MeV, Neff);
  const H_natural = 1.66 * Math.sqrt(g) * T_MeV * T_MeV / MPL; // MeV
  return H_natural / HBAR_MEV_S; // s^-1
}

/** Age of the universe at temperature T (radiation domination), s. t = 1/(2H). */
export function timeAtT(T_MeV: number, Neff = 3.046): number {
  return 1 / (2 * hubble(T_MeV, Neff));
}

/** Invert timeAtT by bisection (monotonic decreasing T with t). */
export function tempAtTime(t_s: number, Neff = 3.046): number {
  let lo = 1e-6, hi = 1e4; // MeV
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    if (timeAtT(mid, Neff) < t_s) hi = mid; else lo = mid;
  }
  return Math.sqrt(lo * hi);
}

/** Photon number density at temperature T, cm^-3 (n_γ,0 = 411 cm^-3 at T0 = 2.725 K). */
export function nGamma(T_MeV: number): number {
  const T_K = T_MeV * MEV_TO_KELVIN;
  return 411 * (T_K / 2.725) ** 3;
}

/** Baryon number density for baryon-to-photon ratio eta at temperature T, cm^-3. */
export function nBaryon(T_MeV: number, eta: number): number {
  return eta * nGamma(T_MeV);
}

/** T ∝ 1/a: scale factor relative to today (a0=1), using T0 = 2.725 K (ignores the small
 * post-annihilation photon/neutrino temperature split, which does not move a(T) at the ~0.1% level relevant here). */
export function scaleFactor(T_MeV: number): number {
  const T0_MeV = 2.725 / MEV_TO_KELVIN;
  return T0_MeV / T_MeV;
}
