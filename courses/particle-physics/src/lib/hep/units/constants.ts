/**
 * Natural units (ħ = c = 1) and the constants the course uses.
 *
 * Energies, momenta and masses are in GeV throughout the library; lengths are in fm only when a
 * function says so; times in seconds only when a function says so. Convert with the factors below.
 * Values are CODATA 2018 / PDG 2024.
 */

/** ħc in GeV·fm. A length of 1 fm corresponds to an energy of ħc/1 fm = 0.1973 GeV. */
export const HBARC_GEV_FM = 0.1973269804;
/** ħc in MeV·fm (the form most people remember: 197.3). */
export const HBARC_MEV_FM = 197.3269804;
/** ħ in GeV·s. A width of 1 GeV corresponds to a lifetime ħ/Γ = 6.582e-25 s. */
export const HBAR_GEV_S = 6.582119569e-25;
/** Speed of light in m/s. */
export const C_M_S = 299792458;
/** Speed of light in mm/ns (handy for detector times). */
export const C_MM_NS = 299.792458;
/** (ħc)² in GeV²·mb, to convert cross-sections from GeV⁻² to millibarn. */
export const HBARC2_GEV2_MB = 0.3893793721;
/** (ħc)² in GeV²·pb. */
export const HBARC2_GEV2_PB = 0.3893793721e9;
/** (ħc)² in GeV²·nb. */
export const HBARC2_GEV2_NB = 0.3893793721e6;
/** Fine-structure constant at zero momentum transfer. */
export const ALPHA = 1 / 137.035999084;
/** Fine-structure constant at the Z mass (running value, about 1/127.95). */
export const ALPHA_MZ = 1 / 127.952;
/** Strong coupling at the Z mass. */
export const ALPHA_S_MZ = 0.1180;
/** Fermi constant in GeV⁻². */
export const G_F = 1.1663788e-5;
/** sin²θ_W (on-shell, from m_W and m_Z). */
export const SIN2_THETA_W = 0.2229;
/** Boltzmann constant in eV/K. */
export const K_B_EV_K = 8.617333262e-5;
/** Elementary charge in coulombs. */
export const E_COULOMB = 1.602176634e-19;
/** One GeV/c² in kilograms. */
export const GEV_KG = 1.78266192e-27;
/** Atomic mass unit in GeV/c². */
export const AMU_GEV = 0.93149410242;
/** Avogadro's number. */
export const N_A = 6.02214076e23;
/** Planck mass in GeV. */
export const M_PLANCK_GEV = 1.220890e19;

/** Metre ↔ GeV⁻¹: 1 m = 1e15 fm / ħc. */
export const M_PER_INV_GEV = HBARC_GEV_FM * 1e-15;

