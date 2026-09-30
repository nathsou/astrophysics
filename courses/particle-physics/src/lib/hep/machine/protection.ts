/**
 * Stored energy and machine protection: how much energy a beam carries, and what it would do.
 */
const E_COULOMB = 1.602176634e-19;

/** The energy of a beam of `nParticles` particles of energy E (GeV each), in MJ. */
export function beamStoredEnergyMJ(nParticles: number, energyGeV: number): number {
  return (nParticles * energyGeV * 1e9 * E_COULOMB) / 1e6;
}
/** Stored energy of a bunched beam: Nb protons per bunch × nb bunches × E (GeV), in MJ. */
export const storedEnergyMJ = (Nb: number, nb: number, energyGeV: number): number => beamStoredEnergyMJ(Nb * nb, energyGeV);

/** 1 kg of TNT releases 4.184 MJ (the thermochemical definition of the ton of TNT, 4.184 GJ). */
export const MJ_PER_KG_TNT = 4.184;
export const tntKg = (mj: number): number => mj / MJ_PER_KG_TNT;

/** The speed (km/h) at which a train of the given mass (tonnes) has a kinetic energy of `mj` MJ: v = √(2E/m). */
export function trainSpeedKmH(mj: number, massTonnes = 400): number {
  return Math.sqrt((2 * mj * 1e6) / (massTonnes * 1e3)) * 3.6;
}
/** The kinetic energy of a train, in MJ. */
export const trainEnergyMJ = (massTonnes: number, speedKmH: number): number => 0.5 * massTonnes * 1e3 * (speedKmH / 3.6) ** 2 / 1e6;

/**
 * The mass of copper (kg) that `mj` MJ would heat from 20 °C to its melting point (1085 °C) and melt: c ≈ 385 J/kg/K on
 * average and a latent heat of fusion of 205 kJ/kg, about 0.6 MJ/kg altogether (approximate handbook values).
 */
export function copperMeltedKg(mj: number): number {
  const perKg = (385 * (1085 - 20) + 205e3) / 1e6;
  return mj / perKg;
}
/** The energy density of a magnetic field, B²/2μ₀ in J/m³. */
export const fieldEnergyDensity = (B_T: number): number => (B_T * B_T) / (2 * 4e-7 * Math.PI);
