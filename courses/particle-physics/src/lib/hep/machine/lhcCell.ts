/**
 * The LHC arc FODO cell as a lattice: QF, three dipoles, QD, three dipoles; 106.9 m long (LHC Design Report, CERN-2004-003).
 * The quadrupole strength is solved so that the phase advance per cell is exactly 90°, the design value.
 */
import { LHC, lhcDipoleAngle, gradientFromStrength } from './fields.ts';
import { fodoCell, solveStrengthForPhaseAdvance, type Element } from './optics.ts';

/** The gap between magnets (m) that makes the cell 106.9 m long: four equal gaps per half-cell. */
export const LHC_CELL_GAP_M = (LHC.arcCell.length_m / 2 - LHC.quadLength_m - 3 * LHC.dipoleLength_m) / 4;

/** The arc cell for a given normalised quadrupole strength k (m⁻²). */
export function lhcArcCell(k: number): Element[] {
  return fodoCell({ kF: k, quadLength: LHC.quadLength_m, gap: LHC_CELL_GAP_M, nDipoles: 3, dipoleLength: LHC.dipoleLength_m, dipoleAngle: lhcDipoleAngle() });
}
/** The strength k (m⁻²) for which the arc cell has the given phase advance (default 90°), and the matching gradient at `energyGeV`. */
export function lhcArcCellDesign(muDeg = 90, energyGeV = 7000): { k: number; gradient_T_per_m: number; cell: Element[] } {
  const k = solveStrengthForPhaseAdvance(lhcArcCell, (muDeg * Math.PI) / 180, 1e-4, 0.03);
  return { k, gradient_T_per_m: gradientFromStrength(k, energyGeV), cell: lhcArcCell(k) };
}
