/**
 * Materials the detector model knows about, with the numbers that matter for charged-particle and shower physics.
 *
 * Values are rounded from the PDG "Atomic and nuclear properties of materials" tables (Review of Particle
 * Physics, 2024). Radiation lengths and nuclear interaction lengths are stored in g/cm² (the natural unit: the
 * physics depends on the mass of material crossed) and converted to cm with the density. Entries marked
 * *approximate* are rounded from memory of the PDG table and are good to a few per cent; nothing in the course
 * depends on more.
 */

/** Sternheimer's parametrisation of the density effect δ(βγ) (the polarisation of the medium at high energy). */
export interface DensityEffect {
  /** x = log10(βγ) below which the effect is (nearly) absent, and above which it is fully developed. */
  x0: number;
  x1: number;
  /** Fit parameters of the intermediate region: δ = 2 ln10 x − C + a (x1 − x)^m. */
  a: number;
  m: number;
  /** −C̄ of the asymptotic form δ → 2 ln10 x − C̄. */
  C: number;
  /** Value at x < x0 for conductors (0 for insulators): δ = δ0 · 10^{2(x − x0)}. */
  delta0: number;
}

export interface Material {
  /** Short key, e.g. 'Si'. */
  name: string;
  /** Human-readable name. */
  label: string;
  /** Atomic number (effective for mixtures). */
  Z: number;
  /** Atomic mass in g/mol (effective for mixtures). */
  A: number;
  /** ⟨Z/A⟩ in mol/g. */
  ZoverA: number;
  /** Density in g/cm³. */
  density: number;
  /** Radiation length in g/cm². */
  X0: number;
  /** Nuclear interaction length in g/cm². */
  lambdaI: number;
  /** Mean excitation energy in eV. */
  I: number;
  /** Critical energy for electrons in MeV (where ionisation loss equals bremsstrahlung loss; Rossi's definition). */
  Ec: number;
  /** Plasma energy ħωp in eV. */
  plasmaEnergy: number;
  /** Density-effect parameters. */
  densityEffect: DensityEffect;
  /** Radiation length in cm (X0 / density). */
  X0cm: number;
  /** Nuclear interaction length in cm. */
  lambdaIcm: number;
}

function mk(
  name: string,
  label: string,
  Z: number,
  A: number,
  ZoverA: number,
  density: number,
  X0: number,
  lambdaI: number,
  I: number,
  Ec: number,
  de?: { plasma: number; C: number; x0: number; x1: number; a: number; m: number; delta0: number },
): Material {
  const plasma = de?.plasma ?? 28.816 * Math.sqrt(density * ZoverA);
  // Generic density-effect parameters (Sternheimer & Peierls 1971 rules of thumb) when the table value is not given.
  const gas = density < 0.01;
  const C = de?.C ?? 1 + 2 * Math.log(I / plasma);
  const x0 = de?.x0 ?? (gas ? 1.7 : 0.2);
  const x1 = de?.x1 ?? (gas ? 4.0 : 3.0);
  const m = de?.m ?? 3;
  // Continuity at x0 (δ = 0 for insulators there): a (x1 − x0)^m = 2 ln10 x0 − ... fixed by requiring δ(x0) = 0.
  const a = de?.a ?? Math.max(0, (C - 2 * Math.LN10 * x0) / Math.pow(x1 - x0, m));
  return {
    name,
    label,
    Z,
    A,
    ZoverA,
    density,
    X0,
    lambdaI,
    I,
    Ec,
    plasmaEnergy: plasma,
    densityEffect: { x0, x1, a, m, C, delta0: de?.delta0 ?? 0 },
    X0cm: X0 / density,
    lambdaIcm: lambdaI / density,
  };
}

/**
 * The table. Keys: Si, Fe, Pb, PbWO4, H2O, scintillator, Cu, air, W, Al, LAr.
 * The radiation lengths of the four the course quotes are: Pb 0.56 cm, Fe 1.76 cm, Si 9.37 cm, PbWO4 0.89 cm.
 */
export const materials: Record<string, Material> = {
  Si: mk('Si', 'Silicon', 14, 28.0855, 0.49848, 2.329, 21.82, 108.4, 173.0, 40.19, { plasma: 31.055, C: 4.4351, x0: 0.2015, x1: 2.8716, a: 0.14921, m: 3.2546, delta0: 0.14 }),
  Fe: mk('Fe', 'Iron (steel)', 26, 55.845, 0.46557, 7.874, 13.84, 132.1, 286.0, 21.68, { plasma: 55.172, C: 4.2911, x0: -0.0012, x1: 3.1531, a: 0.1468, m: 2.9632, delta0: 0.12 }),
  Pb: mk('Pb', 'Lead', 82, 207.2, 0.39575, 11.35, 6.37, 199.6, 823.0, 7.43, { plasma: 61.072, C: 6.2018, x0: 0.3776, x1: 3.8073, a: 0.09359, m: 3.1608, delta0: 0.14 }),
  Cu: mk('Cu', 'Copper', 29, 63.546, 0.45636, 8.96, 12.86, 137.3, 322.0, 19.42, { plasma: 58.27, C: 4.419, x0: -0.0254, x1: 3.2792, a: 0.14339, m: 2.9044, delta0: 0.08 }),
  W: mk('W', 'Tungsten', 74, 183.84, 0.40252, 19.3, 6.76, 191.9, 727.0, 7.97, { plasma: 80.315, C: 5.4059, x0: 0.2167, x1: 3.496, a: 0.15509, m: 2.8447, delta0: 0.14 }),
  Al: mk('Al', 'Aluminium', 13, 26.9815, 0.48181, 2.699, 24.01, 107.2, 166.0, 42.7, { plasma: 32.86, C: 4.2395, x0: 0.1708, x1: 3.0127, a: 0.08024, m: 3.6345, delta0: 0.12 }),
  // approximate from here on: composite materials with effective Z, A
  PbWO4: mk('PbWO4', 'Lead tungstate', 68, 170.0, 0.41315, 8.28, 7.39, 185.0, 600.0, 9.31),
  H2O: mk('H2O', 'Water', 7.22, 13.0, 0.55509, 1.0, 36.08, 83.3, 75.0, 78.33, { plasma: 21.469, C: 3.5017, x0: 0.24, x1: 2.8004, a: 0.09116, m: 3.4773, delta0: 0 }),
  scintillator: mk('scintillator', 'Plastic scintillator (polystyrene)', 3.5, 6.5, 0.53768, 1.032, 43.79, 82.0, 68.7, 94.0),
  LAr: mk('LAr', 'Liquid argon', 18, 39.948, 0.45059, 1.396, 19.55, 119.7, 188.0, 32.84),
  air: mk('air', 'Air (dry, sea level)', 7.3, 14.6, 0.49919, 1.205e-3, 36.62, 90.0, 85.7, 87.92),
};

/** Look a material up by key (or pass a Material through). Throws for an unknown key. */
export function material(m: Material | string): Material {
  if (typeof m !== 'string') return m;
  const found = materials[m];
  if (!found) throw new Error(`unknown material: ${m}`);
  return found;
}

/** Radiation length X0 in cm. The distance over which an electron keeps 1/e of its energy against bremsstrahlung. */
export function radiationLength(m: Material | string): number {
  return material(m).X0cm;
}

/** Nuclear interaction length λI in cm. */
export function interactionLength(m: Material | string): number {
  return material(m).lambdaIcm;
}

/** Critical energy in GeV: below it an electron loses more by ionisation than by radiation, and a shower stops growing. */
export function criticalEnergy(m: Material | string): number {
  return material(m).Ec * 1e-3;
}

/** Molière radius in cm, R_M = 21.2 MeV × X0 / Ec: the radius of the cylinder holding ≈ 90 % of a shower's energy. */
export function moliereRadius(m: Material | string): number {
  const mat = material(m);
  return (21.2 * mat.X0cm) / mat.Ec;
}
