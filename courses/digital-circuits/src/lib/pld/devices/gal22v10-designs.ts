/**
 * The course's GAL22V10 example designs, as fitter input: a combinational decoder, a registered
 * traffic-light controller and a seven-segment decoder. `gal22v10-fixtures.ts` freezes the galette
 * `.pld` file and galette's JEDEC output for each.
 */
import { designFromEquations, type GalDesign } from './gal22v10-fit';

export const SEVEN_SEGMENT_PATTERNS = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b] as const;
export const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** Sum of minterms over the variables listed most significant first: `!D & !C | ...`. */
export function mintermsExpr(vars: string[], minterms: number[]): string {
  if (minterms.length === 0) return '0';
  return minterms
    .map((m) => vars.map((v, i) => ((m >> (vars.length - 1 - i)) & 1 ? v : `!${v}`)).join(' & '))
    .join(' | ');
}

/**
 * A 3-to-8 line decoder with one active-high and one active-low enable, like the 74138: exactly
 * one of Y0..Y7 goes low when the enables are on. Eight outputs of one product term each, active
 * low.
 */
export function decoderDesign(): GalDesign {
  const eq = Array.from({ length: 8 }, (_, k) => {
    const sel = mintermsExpr(['C', 'B', 'A'], [k]);
    return `Y${k} = !(G1 & !G2N & ${sel})`;
  }).join('\n');
  return designFromEquations(eq, { inputs: ['A', 'B', 'C', 'G1', 'G2N'], signature: 'DEC3TO8', title: '3-to-8 decoder with enables (74138 style), active-low outputs' });
}

/**
 * A traffic-light controller for a main road with a side road that has a car sensor. State bits Q1
 * and Q0 are registered outputs (00 main green, 01 main amber, 10 side green, 11 side amber);
 * the six lamps are combinational outputs decoded from them, so the state feeds back into the
 * array. CAR is the side-road sensor, T a slow timer tick and RST an asynchronous reset to the
 * main-green state.
 *
 *   00 → 01 when CAR and T      01 → 10     10 → 11 when T or no CAR      11 → 00
 */
export function trafficDesign(): GalDesign {
  return designFromEquations(
    `Q1.R = Q1 ^ Q0
Q0.R = !Q1 & !Q0 & CAR & T | Q1 & !Q0 & (!CAR | T)
MG = !Q1 & !Q0
MA = !Q1 & Q0
MR = Q1
SG = Q1 & !Q0
SA = Q1 & Q0
SR = !Q1
AR = RST`,
    { inputs: ['CAR', 'T', 'RST'], clock: 'CLK', signature: 'TRAFFIC', title: 'Traffic-light controller: 2 state bits, 6 lamps, sensor and timer' },
  );
}

/**
 * A BCD to seven-segment decoder (active-high segments, common cathode). Input codes 10–15 never
 * occur, so they are don't cares and the segments are minimised with them.
 */
export function sevenSegmentDesign(): GalDesign {
  const vars = ['D', 'C', 'B', 'A'];
  return {
    title: 'BCD to seven-segment decoder, codes 10–15 unused',
    signature: '7SEG',
    inputs: ['A', 'B', 'C', 'D'],
    outputs: SEGMENT_NAMES.map((name, s) => {
      const bit = 6 - s;
      const on = SEVEN_SEGMENT_PATTERNS.map((p, digit) => ((p >> bit) & 1 ? digit : -1)).filter((d) => d >= 0);
      return { name: 'S' + name, expr: mintermsExpr(vars, on), dc: 'D & (C | B)', polarity: 'auto' as const };
    }),
  };
}
