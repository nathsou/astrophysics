/**
 * Cross-sections for the rate calculator (Chapter 3). The Z, W and tt̄ values are leading-order results of this course's generator
 * (`hep/gen`, toy parton distributions) at √s = 13 TeV, stored here so that a figure does not train the generator in the reader's
 * browser; `rates.test.ts` checks that they equal what `hep/gen` computes. They are not measurements, and a real NLO or NNLO value
 * differs by tens of per cent.
 */
import { SIGMA_INEL_MB } from '../../hep/machine/luminosity.ts';

export interface RateProcess {
  id: string;
  label: string;
  /** Cross-section in picobarn. */
  sigmaPb: number;
  /** Where the number comes from. */
  source: string;
}

export const PB_TO_CM2 = 1e-36;

export const RATE_PROCESSES: RateProcess[] = [
  { id: 'inel', label: 'any inelastic pp collision', sigmaPb: SIGMA_INEL_MB * 1e9, source: 'about 80 mb at 13 TeV (approximate public value)' },
  { id: 'w', label: 'pp → W → μν', sigmaPb: 16814, source: 'leading order, hep/gen, 13 TeV' },
  { id: 'z', label: 'pp → Z → μ⁺μ⁻ (60 < m < 120 GeV)', sigmaPb: 1587.0, source: 'leading order, hep/gen, 13 TeV' },
  { id: 'tt', label: 'pp → t t̄', sigmaPb: 439.0, source: 'leading order, hep/gen, 13 TeV' },
  { id: 'h', label: 'pp → H (all production modes)', sigmaPb: 50, source: 'about 50 pb, the value quoted in Chapter 0' },
];

/** Rate σ L in Hz for σ in pb and L in cm⁻² s⁻¹. */
export const rateHz = (sigmaPb: number, lumi: number): number => sigmaPb * PB_TO_CM2 * lumi;
/** Integrated luminosity in pb⁻¹ for L in cm⁻² s⁻¹ over t seconds: L t × 10⁻³⁶ (1 pb⁻¹ = 10³⁶ cm⁻²). */
export const integratedPb = (lumi: number, seconds: number): number => lumi * seconds * 1e-36;
