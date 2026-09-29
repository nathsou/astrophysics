/**
 * Example designs for the vCPLD-32, used by the tests and by Chapter 27: a counter, a traffic-light
 * FSM, a BCD counter driving a seven-segment decoder, a ripple-carry adder with buried carries, and
 * two functions that stress the product-term allocator.
 */
import type { CpldDesign, CpldOutputSpec } from './design';
import { designFromEquations } from './design';

export const SEVEN_SEGMENT_PATTERNS = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b] as const;
export const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** Sum of minterms over the variables listed most significant first: `!D & !C | ...`. */
export function mintermsExpr(vars: string[], minterms: number[]): string {
  if (minterms.length === 0) return '0';
  return minterms
    .map((m) => vars.map((v, i) => ((m >> (vars.length - 1 - i)) & 1 ? v : `!${v}`)).join(' & '))
    .join(' | ');
}

/** A 4-bit binary counter with count enable EN and synchronous clear CLR. */
export function counter4Design(): CpldDesign {
  return designFromEquations(
    `Q0.R = !CLR & (Q0 ^ EN)
Q1.R = !CLR & (Q1 ^ (EN & Q0))
Q2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))
Q3.R = !CLR & (Q3 ^ (EN & Q0 & Q1 & Q2))`,
    { inputs: ['EN', 'CLR'], title: '4-bit counter with enable and clear', usercode: 'CNT4' },
  );
}

/**
 * A traffic-light controller for a main road with a side road that has a car sensor. State bits Q1
 * and Q0 are registered (00 main green, 01 main amber, 10 side green, 11 side amber); the six lamps
 * are combinational outputs decoded from them. CAR is the sensor, T a slow timer tick, RST a
 * synchronous reset to main green.
 *
 *   00 → 01 when CAR and T      01 → 10     10 → 11 when T or no CAR      11 → 00
 */
export function trafficDesign(): CpldDesign {
  return designFromEquations(
    `Q1.R = !RST & (Q1 ^ Q0)
Q0.R = !RST & (!Q1 & !Q0 & CAR & T | Q1 & !Q0 & (!CAR | T))
MG = !Q1 & !Q0
MA = !Q1 & Q0
MR = Q1
SG = Q1 & !Q0
SA = Q1 & Q0
SR = !Q1`,
    { inputs: ['CAR', 'T', 'RST'], title: 'Traffic-light controller', usercode: 'TRAF' },
  );
}

/** A BCD to seven-segment decoder (active-high segments), codes 10–15 are don't cares. */
export function sevenSegmentDesign(): CpldDesign {
  const vars = ['D', 'C', 'B', 'A'];
  return {
    title: 'BCD to seven-segment decoder',
    usercode: '7SEG',
    inputs: ['A', 'B', 'C', 'D'],
    outputs: SEGMENT_NAMES.map((name, s): CpldOutputSpec => {
      const bit = 6 - s;
      const on = SEVEN_SEGMENT_PATTERNS.map((p, digit) => ((p >> bit) & 1 ? digit : -1)).filter((d) => d >= 0);
      return { name: 'S' + name, expr: mintermsExpr(vars, on), dc: 'D & (C | B)' };
    }),
  };
}

/**
 * A decade (BCD) counter with enable EN and synchronous clear CLR whose four state bits drive a
 * seven-segment decoder: four registered outputs and seven combinational ones that read them.
 * The unreachable states 10–15 are don't cares for the decoder.
 */
export function bcdDisplayDesign(): CpldDesign {
  const q = ['Q3', 'Q2', 'Q1', 'Q0'];
  const eqs: string[] = [];
  for (let bit = 3; bit >= 0; bit--) {
    // Next-state minterms over (CLR, EN, Q3, Q2, Q1, Q0), most significant first.
    const on: number[] = [];
    for (let m = 0; m < 64; m++) {
      const clr = (m >> 5) & 1;
      const en = (m >> 4) & 1;
      const state = m & 15;
      if (state > 9) continue;
      const next = clr ? 0 : en ? (state + 1) % 10 : state;
      if ((next >> bit) & 1) on.push(m);
    }
    eqs.push(`Q${bit}.R = ${mintermsExpr(['CLR', 'EN', ...q], on)}`);
  }
  const seg = SEGMENT_NAMES.map((name, s) => {
    const on = SEVEN_SEGMENT_PATTERNS.map((p, digit) => ((p >> (6 - s)) & 1 ? digit : -1)).filter((d) => d >= 0);
    return `S${name} = ${mintermsExpr(q, on)}`;
  });
  const design = designFromEquations([...eqs, ...seg].join('\n'), { inputs: ['EN', 'CLR'], title: 'BCD counter and seven-segment display', usercode: 'BCD7' });
  // Unreachable codes are don't cares for the decoder (the next-state logic above ignores them already).
  for (const o of design.outputs) if (o.name.startsWith('S')) o.dc = 'Q3 & (Q2 | Q1)';
  return design;
}

/** A 4-bit adder: the sum bits are combinational pins, the carries C1–C3 buried macrocells. */
export function adder4Design(): CpldDesign {
  const eq = [
    'C1 = A0 & B0 | A0 & CIN | B0 & CIN',
    'C2 = A1 & B1 | A1 & C1 | B1 & C1',
    'C3 = A2 & B2 | A2 & C2 | B2 & C2',
    'S0 = A0 ^ B0 ^ CIN',
    'S1 = A1 ^ B1 ^ C1',
    'S2 = A2 ^ B2 ^ C2',
    'S3 = A3 ^ B3 ^ C3',
    'COUT = A3 & B3 | A3 & C3 | B3 & C3',
  ].join('\n');
  return designFromEquations(eq, {
    inputs: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'CIN'],
    buried: ['C1', 'C2', 'C3'],
    title: '4-bit adder with buried carries',
    usercode: 'ADD4',
  });
}

/** Parity of four inputs: eight product terms either way, so its macrocell borrows three from a neighbour. */
export function parity4Design(): CpldDesign {
  return designFromEquations('P = A ^ B ^ C ^ D', { inputs: ['A', 'B', 'C', 'D'], title: '4-input parity (borrows product terms)', usercode: 'PAR4' });
}
