// Physical and astronomical constants (SI unless noted).
// `CONST` powers the <C k="..."/> tooltip component; import the plain values for maths.

export interface ConstantInfo {
  symbol: string; // LaTeX-free display symbol
  value: number;
  unit: string;
  name: string;
  note?: string;
}

export const CONST = {
  G: { symbol: 'G', value: 6.6743e-11, unit: 'm³ kg⁻¹ s⁻²', name: 'Gravitational constant', note: 'The weakest-known coupling in physics, yet it runs the cosmos because mass has no negative charge to cancel it.' },
  c: { symbol: 'c', value: 2.99792458e8, unit: 'm s⁻¹', name: 'Speed of light', note: 'Exact by definition of the metre.' },
  h: { symbol: 'h', value: 6.62607015e-34, unit: 'J s', name: 'Planck constant' },
  hbar: { symbol: 'ħ', value: 1.054571817e-34, unit: 'J s', name: 'Reduced Planck constant' },
  kB: { symbol: 'k_B', value: 1.380649e-23, unit: 'J K⁻¹', name: 'Boltzmann constant', note: 'k_B T ≈ 1 eV at T ≈ 11,600 K.' },
  sigma: { symbol: 'σ', value: 5.670374419e-8, unit: 'W m⁻² K⁻⁴', name: 'Stefan–Boltzmann constant' },
  a_rad: { symbol: 'a', value: 7.565723e-16, unit: 'J m⁻³ K⁻⁴', name: 'Radiation constant', note: 'a = 4σ/c' },
  me: { symbol: 'm_e', value: 9.1093837015e-31, unit: 'kg', name: 'Electron mass' },
  mp: { symbol: 'm_p', value: 1.67262192369e-27, unit: 'kg', name: 'Proton mass', note: '≈ 1836 electron masses.' },
  mu: { symbol: 'm_u', value: 1.66053906660e-27, unit: 'kg', name: 'Atomic mass unit' },
  e: { symbol: 'e', value: 1.602176634e-19, unit: 'C', name: 'Elementary charge' },
  eps0: { symbol: 'ε₀', value: 8.8541878128e-12, unit: 'F m⁻¹', name: 'Vacuum permittivity' },
  sigmaT: { symbol: 'σ_T', value: 6.6524587321e-29, unit: 'm²', name: 'Thomson cross-section', note: 'Electron–photon scattering cross-section at low energy.' },
  eV: { symbol: 'eV', value: 1.602176634e-19, unit: 'J', name: 'Electron-volt' },
  Msun: { symbol: 'M☉', value: 1.98847e30, unit: 'kg', name: 'Solar mass', note: '≈ 333,000 Earth masses.' },
  Rsun: { symbol: 'R☉', value: 6.957e8, unit: 'm', name: 'Solar radius', note: '≈ 109 Earth radii.' },
  Lsun: { symbol: 'L☉', value: 3.828e26, unit: 'W', name: 'Solar luminosity' },
  Tsun: { symbol: 'T☉', value: 5772, unit: 'K', name: 'Solar effective temperature' },
  Mearth: { symbol: 'M⊕', value: 5.9722e24, unit: 'kg', name: 'Earth mass' },
  Rearth: { symbol: 'R⊕', value: 6.371e6, unit: 'm', name: 'Earth radius' },
  Mjup: { symbol: 'M_J', value: 1.89813e27, unit: 'kg', name: 'Jupiter mass', note: '≈ 318 Earth masses, ≈ 1/1047 M☉.' },
  AU: { symbol: 'AU', value: 1.495978707e11, unit: 'm', name: 'Astronomical unit', note: 'Mean Earth–Sun distance; light takes 8.3 minutes.' },
  ly: { symbol: 'ly', value: 9.4607304725808e15, unit: 'm', name: 'Light-year' },
  pc: { symbol: 'pc', value: 3.0856775814913673e16, unit: 'm', name: 'Parsec', note: 'Distance at which 1 AU subtends 1 arcsecond. ≈ 3.26 ly.' },
  yr: { symbol: 'yr', value: 3.15576e7, unit: 's', name: 'Julian year', note: '≈ π × 10⁷ s — a famously handy approximation.' },
  H0: { symbol: 'H₀', value: 67.7, unit: 'km s⁻¹ Mpc⁻¹', name: 'Hubble constant', note: 'Planck 2018 value; local distance-ladder measurements give ≈ 73 (the "Hubble tension").' },
} satisfies Record<string, ConstantInfo>;

export type ConstKey = keyof typeof CONST;

export const G = CONST.G.value;
export const c = CONST.c.value;
export const h = CONST.h.value;
export const hbar = CONST.hbar.value;
export const kB = CONST.kB.value;
export const sigmaSB = CONST.sigma.value;
export const me = CONST.me.value;
export const mp = CONST.mp.value;
export const Msun = CONST.Msun.value;
export const Rsun = CONST.Rsun.value;
export const Lsun = CONST.Lsun.value;
export const Mearth = CONST.Mearth.value;
export const AU = CONST.AU.value;
export const pc = CONST.pc.value;
export const ly = CONST.ly.value;
export const yr = CONST.yr.value;
