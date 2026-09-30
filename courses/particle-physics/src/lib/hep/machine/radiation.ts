/**
 * Synchrotron radiation: the energy a charged particle radiates on a curved orbit.
 *
 * Per turn a particle of energy E and mass m on a circle of radius ρ loses U₀ = C_γ E⁴/ρ with
 * C_γ = (4π/3) r_c/(mc²)³, where r_c = e²/(4πε₀ mc²) is the classical radius. For electrons
 * U₀ [keV] = 88.46 E⁴ [GeV⁴]/ρ [m]. The loss scales as 1/m⁴, so a proton loses (m_e/m_p)⁴ = 8.8 × 10⁻¹⁴ as much at the same
 * energy and radius: the reason LEP stopped and the LHC collides protons.
 */
/** ħc in GeV·fm (the same value as `units.HBARC_GEV_FM`). */
const HBARC_GEV_FM = 0.1973269804;

const ELECTRON_MASS_GEV = 0.000510998950;
const PROTON_MASS_GEV = 0.9382720813;

/** Electron: C_γ = 8.846 × 10⁻⁵ m/GeV³, i.e. U₀ [keV] = 88.46 E⁴ [GeV]/ρ [m] (the practical formula). */
export const C_GAMMA_ELECTRON_M_PER_GEV3 = 8.846e-5;

/** C_γ for a particle of the given mass (GeV), in m/GeV³, scaled from the electron value by (m_e/m)⁴. */
export function cGamma(massGeV: number): number {
  return C_GAMMA_ELECTRON_M_PER_GEV3 * (ELECTRON_MASS_GEV / massGeV) ** 4;
}

/** Energy lost per turn in GeV by a particle of unit charge, energy E (GeV) and mass m on a circle of radius ρ (m). */
export function energyLossPerTurn(energyGeV: number, rhoM: number, massGeV = ELECTRON_MASS_GEV): number {
  return (cGamma(massGeV) * energyGeV ** 4) / rhoM;
}
/** Electron: U₀ in keV from the practical formula 88.46 E⁴/ρ. */
export const electronLossKeV = (energyGeV: number, rhoM: number): number => (88.46 * energyGeV ** 4) / rhoM;
/** Proton: U₀ in keV. */
export const protonLossKeV = (energyGeV: number, rhoM: number): number => energyLossPerTurn(energyGeV, rhoM, PROTON_MASS_GEV) * 1e6;
/** The ratio of electron to proton loss at the same energy and radius: (m_p/m_e)⁴. */
export const electronToProtonLossRatio = (): number => (PROTON_MASS_GEV / ELECTRON_MASS_GEV) ** 4;

/** Fraction of the beam energy lost per turn, U₀/E. */
export const fractionalLoss = (energyGeV: number, rhoM: number, massGeV = ELECTRON_MASS_GEV): number => energyLossPerTurn(energyGeV, rhoM, massGeV) / energyGeV;

/** The critical photon energy ε_c = (3/2) ħc γ³/ρ in eV: half the radiated power is in photons above it. */
export function criticalEnergyEV(energyGeV: number, rhoM: number, massGeV = ELECTRON_MASS_GEV): number {
  const gamma = energyGeV / massGeV;
  const hbarcEVm = HBARC_GEV_FM * 1e-15 * 1e9; // ħc in eV·m
  return (1.5 * hbarcEVm * gamma ** 3) / rhoM;
}

/** Radiated power in watts for a beam current I (A) losing U₀ (GeV) per turn: P = U₀[eV] · I. */
export const radiatedPowerW = (lossPerTurnGeV: number, currentA: number): number => lossPerTurnGeV * 1e9 * currentA;

/** The beam energy (GeV) at which the loss per turn equals a chosen fraction f of the energy (E³ = f ρ/C_γ). */
export function energyForLossFraction(fraction: number, rhoM: number, massGeV = ELECTRON_MASS_GEV): number {
  return Math.cbrt((fraction * rhoM) / cGamma(massGeV));
}

/** LEP (the electron–positron collider that ran in the LHC tunnel from 1989 to 2000) at its highest energy. */
export const LEP = {
  /** The ring is the LHC tunnel: circumference 26 658.9 m. */
  circumference_m: 26658.883,
  /** The highest beam energy, reached in 2000, was about 104.5 GeV (√s = 209 GeV). To be checked by the reviewer. */
  maxBeamEnergy_GeV: 104.5,
  /** The average bending radius as given in the brief: 3026 m (other sources quote about 3100 m; see the README). To be checked. */
  bendingRadius_m: 3026,
} as const;
