/**
 * Magnetic rigidity, bending radius and the LHC numbers.
 *
 * The rule to remember is p [GeV/c] = 0.29979 · B [T] · ρ [m]: the momentum a magnetic field can bend round a circle of
 * radius ρ. (The constant is c/10⁹ in SI units.)
 */
/** Speed of light in m/s (the same value as `units.C_M_S`; repeated here so that this module has no imports). */
const C_M_S = 299792458;

/** 0.299792458: p [GeV/c] = CHARGE_RIGIDITY · B [T] · ρ [m] for a particle of unit charge. */
export const GEV_PER_TESLA_METRE = C_M_S * 1e-9;

/** Momentum (GeV/c) of a unit-charge particle bent with radius ρ (m) by a field B (T): p = 0.29979 B ρ. */
export function momentumFromField(B_T: number, rho_m: number): number {
  return GEV_PER_TESLA_METRE * B_T * rho_m;
}
/** The dipole field (T) needed to bend a momentum p (GeV/c) on a radius ρ (m). */
export function fieldFromMomentum(pGeV: number, rho_m: number): number {
  return pGeV / (GEV_PER_TESLA_METRE * rho_m);
}
/** The bending radius (m) of momentum p (GeV/c) in a field B (T). */
export function bendingRadius(pGeV: number, B_T: number): number {
  return pGeV / (GEV_PER_TESLA_METRE * B_T);
}
/** Magnetic rigidity Bρ in T·m for momentum p (GeV/c). */
export function rigidity(pGeV: number): number {
  return pGeV / GEV_PER_TESLA_METRE;
}
/** Normalised quadrupole strength k = g/(Bρ) in m⁻², from the gradient g (T/m) and the momentum (GeV/c). */
export function quadStrength(gradient_T_per_m: number, pGeV: number): number {
  return gradient_T_per_m / rigidity(pGeV);
}
/** The field gradient (T/m) for a normalised strength k (m⁻²) at momentum p. */
export function gradientFromStrength(k: number, pGeV: number): number {
  return k * rigidity(pGeV);
}
/** The revolution frequency (Hz) of a ring of circumference C (m) for a particle of speed β. */
export function revolutionFrequency(circumference_m: number, beta = 1): number {
  return (beta * C_M_S) / circumference_m;
}
/** Lorentz factor γ = E/m. */
export const gammaOf = (energyGeV: number, massGeV: number): number => energyGeV / massGeV;
/** βγ = p/m for momentum p and mass m. */
export const betaGammaOf = (pGeV: number, massGeV: number): number => pGeV / massGeV;
/** Speed β = p/E. */
export const betaOf = (pGeV: number, massGeV: number): number => pGeV / Math.hypot(pGeV, massGeV);

/**
 * The LHC as a preset. Every number is taken from the public machine design documents: **"LHC Design Report, CERN-2004-003"**
 * (Vol. I, The LHC Main Ring, chapters 1–2 and the main-parameter tables), except the Run-3 values which are from the
 * machine's public operation reports. To be checked by the reviewer against the sources named in each comment.
 */
export const LHC = {
  /** Circumference 26 658.883 m (LHC Design Report, CERN-2004-003, Table 2.1). */
  circumference_m: 26658.883,
  /** Number of main dipoles: 1232 (LHC Design Report, CERN-2004-003, ch. 7). */
  nDipoles: 1232,
  /** Magnetic length of a main dipole: 14.3 m (LHC Design Report, CERN-2004-003, ch. 7). */
  dipoleLength_m: 14.3,
  /** Dipole field at 7 TeV: 8.33 T (LHC Design Report, CERN-2004-003, Table 2.1). */
  dipoleField7TeV_T: 8.33,
  /** Bending radius 2803.95 m (LHC Design Report, CERN-2004-003, Table 2.1; 2804 m). */
  bendingRadius_m: 2803.95,
  /** Design beam energy 7 TeV, injection energy 450 GeV (LHC Design Report, CERN-2004-003, Table 2.1). */
  designBeamEnergy_GeV: 7000,
  injectionEnergy_GeV: 450,
  /** Run 3 beam energy 6.8 TeV (13.6 TeV in the centre of mass), the value announced for 2022 onward. */
  run3BeamEnergy_GeV: 6800,
  /** Main quadrupole gradient at 7 TeV: 223 T/m, and length 3.1 m (LHC Design Report, CERN-2004-003, ch. 7). */
  quadGradient7TeV_T_per_m: 223,
  quadLength_m: 3.1,
  /** Number of main quadrupoles in the arcs and dispersion suppressors: 392 in the arcs (LHC Design Report, CERN-2004-003, ch. 7). */
  nArcQuads: 392,
  /** Arc FODO cell: 106.9 m long, 90° phase advance, βmax ≈ 177 m and βmin ≈ 30 m at 7 TeV (LHC Design Report, CERN-2004-003, ch. 2). */
  arcCell: { length_m: 106.9, phaseAdvanceDeg: 90, betaMax_m: 177, betaMin_m: 30, dipolesPerCell: 6, quadsPerCell: 2 },
  /** Momentum compaction factor 3.225 × 10⁻⁴ (LHC Design Report, CERN-2004-003, Table 2.1) and transition γ ≈ 55.7. */
  momentumCompaction: 3.225e-4,
  /** RF: 400.79 MHz, harmonic number 35 640, 16 MV per beam at 7 TeV, 8 MV at injection (LHC Design Report, CERN-2004-003, ch. 4/Table 2.1). */
  rf: { frequency_Hz: 400.789e6, harmonic: 35640, voltage7TeV_V: 16e6, voltageInjection_V: 8e6 },
  /** Bunch population 1.15 × 10¹¹, 2808 bunches, 25 ns spacing (3564 slots) (LHC Design Report, CERN-2004-003, Table 2.1). */
  bunch: { intensity: 1.15e11, nBunches: 2808, spacing_ns: 25, slots: 3564 },
  /** Normalised emittance 3.75 µm, β* = 0.55 m, full crossing angle 285 µrad, σz = 7.55 cm, L = 10³⁴ cm⁻² s⁻¹ (Table 2.1). */
  optics: { epsNormalised_m: 3.75e-6, betaStar_m: 0.55, crossingAngle_rad: 285e-6, sigmaZ_m: 0.0755, designLuminosity_cm2s: 1e34 },
  /** Stored energy per beam at 7 TeV: 362 MJ (LHC Design Report, CERN-2004-003, Table 2.1). */
  storedEnergy7TeV_MJ: 362,
} as const;

/** The dipole field (T) needed at the LHC's bending radius for a beam energy E (GeV): 8.33 T at 7 TeV, about 8.09 T at 6.8 TeV. */
export function lhcDipoleField(energyGeV: number): number {
  return fieldFromMomentum(energyGeV, LHC.bendingRadius_m);
}
/** The bending angle of one LHC dipole: 2π/1232 = 5.1 mrad. */
export const lhcDipoleAngle = (): number => (2 * Math.PI) / LHC.nDipoles;
