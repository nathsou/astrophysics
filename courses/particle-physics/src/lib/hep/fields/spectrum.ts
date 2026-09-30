/**
 * The masses of the Standard Model particles on one logarithmic axis, and the Yukawa couplings y = √2 m/v that go with them.
 * Masses come from `hep/particles`; neutrinos are not in the table with a mass (the table has 0), so they are a band from
 * the constants below.
 */
import { particle } from '../particles/index.ts';
import { V_EW_GEV, yukawaCoupling } from './higgs.ts';

/**
 * Direct upper limit on the electron-antineutrino mass from KATRIN (tritium beta decay): m < 0.8 eV at 90 % C.L. (2022).
 * FROM MEMORY, FLAG FOR REVIEW: a later KATRIN analysis (2025) gave a tighter limit (about 0.45 eV); the course text should
 * quote whichever the bibliography cites.
 */
export const NEUTRINO_LIMIT_EV = 0.8;
/**
 * Lower bound on the heaviest neutrino mass from oscillations: at least √Δm²_atm ≈ 0.05 eV. FROM MEMORY, FLAG FOR REVIEW
 * (Δm²_32 ≈ 2.5×10⁻³ eV²).
 */
export const NEUTRINO_HEAVIEST_LOWER_EV = 0.05;

export type SpectrumGroup = 'quark' | 'lepton' | 'boson';
export interface SpectrumEntry {
  id: string;
  symbol: string;
  group: SpectrumGroup;
  /** Mass in GeV. */
  mass: number;
  pdg: number;
  /** Generation (1–3) for fermions, 0 otherwise. */
  generation: number;
}
export interface NeutrinoBand {
  /** GeV. */
  lower: number;
  upper: number;
}

/** The massive particles of the Standard Model from `hep/particles`, sorted by mass. */
export function spectrumEntries(): SpectrumEntry[] {
  const spec: [number, SpectrumGroup, number][] = [
    [2, 'quark', 1], [1, 'quark', 1], [3, 'quark', 2], [4, 'quark', 2], [5, 'quark', 3], [6, 'quark', 3],
    [11, 'lepton', 1], [13, 'lepton', 2], [15, 'lepton', 3],
    [24, 'boson', 0], [23, 'boson', 0], [25, 'boson', 0],
  ];
  return spec
    .map(([pdg, group, generation]) => {
      const p = particle(pdg);
      return { id: p.name, symbol: p.symbol.replace('⁺', '').replace('⁻', ''), group, mass: p.mass, pdg, generation };
    })
    .sort((a, b) => a.mass - b.mass);
}
/** The neutrino mass band in GeV: between ≈0.05 eV (heaviest, from oscillations) and <0.8 eV (direct limit). */
export function neutrinoBand(): NeutrinoBand {
  return { lower: NEUTRINO_HEAVIEST_LOWER_EV * 1e-9, upper: NEUTRINO_LIMIT_EV * 1e-9 };
}
/** y = √2 m/v for every entry (for W, Z and H this is just a rescaling of the mass: their masses do not come from a Yukawa coupling). */
export function withYukawa(list: SpectrumEntry[], v: number = V_EW_GEV): (SpectrumEntry & { y: number })[] {
  return list.map((e) => ({ ...e, y: yukawaCoupling(e.mass, v) }));
}
