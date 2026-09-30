/**
 * Unit conversion between SI-style units and natural units (ħ = c = 1), for the converter widget and for tests.
 *
 * Every unit belongs to a dimension class, and each class has a natural-unit form:
 *   energy (also mass, momentum, temperature)  → GeV
 *   length                                     → GeV⁻¹
 *   time                                       → GeV⁻¹
 *   cross-section (area)                       → GeV⁻²
 */
import { HBARC_GEV_FM, HBAR_GEV_S, GEV_KG, E_COULOMB, K_B_EV_K, HBARC2_GEV2_MB, C_M_S } from './index.ts';

export type Dimension = 'energy' | 'length' | 'time' | 'area';

export interface UnitDef {
  id: string;
  label: string;
  dimension: Dimension;
  /** Value of one of this unit in natural units (GeV, GeV⁻¹ or GeV⁻²). */
  natural: number;
}

const GEV_PER_J = 1 / (E_COULOMB * 1e9);
const M_TO_INV_GEV = 1e15 / HBARC_GEV_FM; // 1 m in GeV⁻¹
const S_TO_INV_GEV = 1 / HBAR_GEV_S; // 1 s in GeV⁻¹

export const UNITS: UnitDef[] = [
  { id: 'TeV', label: 'TeV', dimension: 'energy', natural: 1e3 },
  { id: 'GeV', label: 'GeV', dimension: 'energy', natural: 1 },
  { id: 'MeV', label: 'MeV', dimension: 'energy', natural: 1e-3 },
  { id: 'keV', label: 'keV', dimension: 'energy', natural: 1e-6 },
  { id: 'eV', label: 'eV', dimension: 'energy', natural: 1e-9 },
  { id: 'J', label: 'J (joule)', dimension: 'energy', natural: GEV_PER_J },
  { id: 'kg', label: 'kg (mass, E = mc²)', dimension: 'energy', natural: 1 / GEV_KG },
  { id: 'K', label: 'K (temperature, E = k_B T)', dimension: 'energy', natural: K_B_EV_K * 1e-9 },
  { id: 'inv-m', label: 'm⁻¹ (E = ħc / length)', dimension: 'energy', natural: HBARC_GEV_FM * 1e-15 },
  { id: 'inv-s', label: 's⁻¹ (E = ħ × frequency)', dimension: 'energy', natural: HBAR_GEV_S },

  { id: 'km', label: 'km', dimension: 'length', natural: 1e3 * M_TO_INV_GEV },
  { id: 'm', label: 'm', dimension: 'length', natural: M_TO_INV_GEV },
  { id: 'mm', label: 'mm', dimension: 'length', natural: 1e-3 * M_TO_INV_GEV },
  { id: 'um', label: 'µm', dimension: 'length', natural: 1e-6 * M_TO_INV_GEV },
  { id: 'nm', label: 'nm', dimension: 'length', natural: 1e-9 * M_TO_INV_GEV },
  { id: 'fm', label: 'fm', dimension: 'length', natural: 1 / HBARC_GEV_FM },
  { id: 'am', label: 'am (10⁻¹⁸ m)', dimension: 'length', natural: 1e-18 * M_TO_INV_GEV },
  { id: 'inv-GeV-l', label: 'GeV⁻¹', dimension: 'length', natural: 1 },

  { id: 's', label: 's', dimension: 'time', natural: S_TO_INV_GEV },
  { id: 'ms', label: 'ms', dimension: 'time', natural: 1e-3 * S_TO_INV_GEV },
  { id: 'us', label: 'µs', dimension: 'time', natural: 1e-6 * S_TO_INV_GEV },
  { id: 'ns', label: 'ns', dimension: 'time', natural: 1e-9 * S_TO_INV_GEV },
  { id: 'ps', label: 'ps', dimension: 'time', natural: 1e-12 * S_TO_INV_GEV },
  { id: 'fs', label: 'fs', dimension: 'time', natural: 1e-15 * S_TO_INV_GEV },
  { id: 'ys', label: 'ys (10⁻²⁴ s)', dimension: 'time', natural: 1e-24 * S_TO_INV_GEV },
  { id: 'inv-GeV-t', label: 'GeV⁻¹', dimension: 'time', natural: 1 },

  { id: 'inv-GeV2', label: 'GeV⁻²', dimension: 'area', natural: 1 },
  { id: 'barn', label: 'b (barn)', dimension: 'area', natural: 1e3 / HBARC2_GEV2_MB },
  { id: 'mb', label: 'mb', dimension: 'area', natural: 1 / HBARC2_GEV2_MB },
  { id: 'ub', label: 'µb', dimension: 'area', natural: 1e-3 / HBARC2_GEV2_MB },
  { id: 'nb', label: 'nb', dimension: 'area', natural: 1e-6 / HBARC2_GEV2_MB },
  { id: 'pb', label: 'pb', dimension: 'area', natural: 1e-9 / HBARC2_GEV2_MB },
  { id: 'fb', label: 'fb', dimension: 'area', natural: 1e-12 / HBARC2_GEV2_MB },
  { id: 'cm2', label: 'cm²', dimension: 'area', natural: 1e24 * 1e3 / HBARC2_GEV2_MB },
];

export function unit(id: string): UnitDef {
  const u = UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return u;
}

/** Convert a value between two units of the same dimension class. */
export function convert(value: number, from: string, to: string): number {
  const a = unit(from), b = unit(to);
  if (a.dimension !== b.dimension) throw new Error(`cannot convert ${a.dimension} to ${b.dimension}`);
  return (value * a.natural) / b.natural;
}

/** All equivalents of a value in every unit of its class, plus the natural-unit form. */
export function equivalents(value: number, from: string): { natural: number; naturalUnit: string; all: { id: string; label: string; value: number }[] } {
  const a = unit(from);
  const natural = value * a.natural;
  const all = UNITS.filter((u) => u.dimension === a.dimension).map((u) => ({ id: u.id, label: u.label, value: natural / u.natural }));
  const naturalUnit = a.dimension === 'energy' ? 'GeV' : a.dimension === 'area' ? 'GeV⁻²' : 'GeV⁻¹';
  return { natural, naturalUnit, all };
}

/** The energy scale that corresponds to a length (E = ħc/L) or a time (E = ħ/t), in GeV. */
export function energyScale(value: number, from: string): number | null {
  const a = unit(from);
  if (a.dimension === 'length' || a.dimension === 'time') return 1 / (value * a.natural);
  if (a.dimension === 'energy') return value * a.natural;
  return null;
}
export { C_M_S };
