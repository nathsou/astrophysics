/**
 * Decibels for Appendix B. A decibel is a tenth of a bel, a logarithmic unit for ratios: 10 dB is a factor
 * of 10 in *power*, and because power goes as the square of voltage, 20 dB is a factor of 10 in voltage.
 */

export type Kind = 'power' | 'voltage';

const K: Record<Kind, number> = { power: 10, voltage: 20 };

/** dB for a ratio of powers (10 log₁₀) or of voltages, currents or amplitudes (20 log₁₀). */
export function toDb(ratio: number, kind: Kind): number {
  return ratio > 0 ? K[kind] * Math.log10(ratio) : NaN;
}

export function fromDb(db: number, kind: Kind): number {
  return 10 ** (db / K[kind]);
}

/** Bits of a converter give about 6.02 dB of dynamic range each: 20 log₁₀ 2. */
export const DB_PER_BIT = toDb(2, 'voltage');

export const dbOfBits = (bits: number) => bits * DB_PER_BIT;

export interface Landmark {
  db: number;
  power: string;
  voltage: string;
  note: string;
}

/** The handful of values worth remembering. Ratios are rounded as engineers say them. */
export const LANDMARKS: Landmark[] = [
  { db: 0, power: '×1', voltage: '×1', note: 'no change' },
  { db: 3, power: '×2', voltage: '×1.41', note: 'half power: the −3 dB point of a filter' },
  { db: 6, power: '×4', voltage: '×2', note: 'one more bit of resolution' },
  { db: 10, power: '×10', voltage: '×3.16', note: '' },
  { db: 20, power: '×100', voltage: '×10', note: 'a gain of 10 in voltage' },
  { db: 40, power: '×10,000', voltage: '×100', note: '' },
  { db: 60, power: '×10⁶', voltage: '×1,000', note: '' },
  { db: -3, power: '×0.5', voltage: '×0.71', note: '' },
  { db: -20, power: '×0.01', voltage: '×0.1', note: 'a 10:1 attenuator' },
];

/** Number of decimal digits in the ratio: 10^(db/20) has about db/20 zeros. */
export const zeros = (db: number) => db / 20;
