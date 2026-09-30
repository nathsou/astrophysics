/**
 * Example designs for each device, as Studio source text. Chapters 25–27 refer to them by id:
 * `::device-studio{device="gal22v10" example="traffic-light"}`.
 */
import type { ExampleDesign } from './types';

/** Segment patterns a–g as bits 6…0, digits 0–F. */
const SEG = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b, 0x77, 0x1f, 0x4e, 0x3d, 0x4f, 0x47];
const SEG_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const bits = (v: number, n: number) => v.toString(2).padStart(n, '0').split('');

/** A truth table for the seven-segment decoder, digits 0 … `last`, codes above are don't cares (`dc`) or omitted. */
function sevenSegmentTable(last: number, dc: boolean): string {
  const rows = [`D C B A | ${SEG_NAMES.join(' ')}`];
  for (let d = 0; d < 16; d++) {
    if (d > last && !dc) break;
    const out = d <= last ? bits(SEG[d]!, 7) : Array(7).fill('-');
    rows.push(`${bits(d, 4).join(' ')} | ${out.join(' ')}`);
  }
  return rows.join('\n');
}

/** Sum of minterms over variables listed most significant first. */
function minterms(vars: string[], on: number[]): string {
  if (!on.length) return '0';
  return on.map((m) => vars.map((v, i) => ((m >> (vars.length - 1 - i)) & 1 ? v : `!${v}`)).join(' & ')).join(' | ');
}

/** Seven-segment equations on the named variables, digits 0–9 (BCD). */
function sevenSegmentEquations(vars: string[]): string {
  return SEG_NAMES.map((n, s) => {
    const on = SEG.slice(0, 10).map((p, d) => ((p >> (6 - s)) & 1 ? d : -1)).filter((d) => d >= 0);
    return `S${n} = ${minterms(vars, on)}`;
  }).join('\n');
}

function adderTable(): string {
  const rows = ['A1 A0 B1 B0 | C S1 S0'];
  for (let m = 0; m < 16; m++) {
    const a = m >> 2;
    const b = m & 3;
    const s = a + b;
    rows.push(`${bits(a, 2).join(' ')} ${bits(b, 2).join(' ')} | ${bits(s, 3).join(' ')}`);
  }
  return rows.join('\n');
}

const BCD_COUNTER = (() => {
  const q = ['Q3', 'Q2', 'Q1', 'Q0'];
  const eqs: string[] = [];
  for (let bit = 3; bit >= 0; bit--) {
    const on: number[] = [];
    for (let m = 0; m < 64; m++) {
      const clr = (m >> 5) & 1;
      const en = (m >> 4) & 1;
      const state = m & 15;
      if (state > 9) continue;
      const next = clr ? 0 : en ? (state + 1) % 10 : state;
      if ((next >> bit) & 1) on.push(m);
    }
    eqs.push(`Q${bit}.R = ${minterms(['CLR', 'EN', ...q], on)}`);
  }
  return eqs.join('\n');
})();

const TRAFFIC_GAL = `# @title Traffic-light controller
# @clock CLK
// State Q1 Q0: 00 main green, 01 main amber, 10 side green, 11 side amber.
// CAR: a car waits on the side road.  T: the slow timer ticked.  RST: asynchronous reset.
Q1.R = Q1 ^ Q0
Q0.R = !Q1 & !Q0 & CAR & T | Q1 & !Q0 & (!CAR | T)
MG = !Q1 & !Q0
MA = !Q1 & Q0
MR = Q1
SG = Q1 & !Q0
SA = Q1 & Q0
SR = !Q1
AR = RST
`;

const TRAFFIC_CPLD = `# @title Traffic-light controller
// State Q1 Q0: 00 main green, 01 main amber, 10 side green, 11 side amber.
// CAR: a car waits on the side road.  T: the slow timer ticked.  RST: synchronous reset.
Q1.R = !RST & (Q1 ^ Q0)
Q0.R = !RST & (!Q1 & !Q0 & CAR & T | Q1 & !Q0 & (!CAR | T))
MG = !Q1 & !Q0
MA = !Q1 & Q0
MR = Q1
SG = Q1 & !Q0
SA = Q1 & Q0
SR = !Q1
`;

export const EXAMPLES: Record<'prom' | 'pla' | 'gal22v10' | 'cpld32', ExampleDesign[]> = {
  prom: [
    {
      id: 'seven-segment',
      title: '7-segment decoder',
      blurb: 'BCD digits 0–9 to the seven segments of a display: 4 address lines, 7 outputs, 16 words. Blow the fuses of every 1.',
      source: `# @title BCD to seven-segment decoder\n// Address = the digit (D is the most significant bit). Codes 10–15 are not used and read as blank.\n${sevenSegmentTable(9, false)}\n`,
    },
    {
      id: 'hex-display',
      title: 'Hexadecimal display',
      blurb: 'The same decoder for all sixteen codes: digits 0–9 and A, b, C, d, E, F.',
      source: `# @title Hexadecimal seven-segment decoder\n${sevenSegmentTable(15, false)}\n`,
    },
    {
      id: 'adder',
      title: '2-bit adder',
      blurb: 'A + B for two 2-bit numbers: 16 words of 3 bits. Any function of 4 inputs is a table of 16 words.',
      source: `# @title 2-bit adder\n${adderTable()}\n`,
    },
    {
      id: 'gray-code',
      title: 'Binary to Gray code',
      blurb: 'Equations work too: each output is filled in for every address where it is 1.',
      source: `# @title Binary to Gray code\n# @inputs B3 B2 B1 B0\nG3 = B3\nG2 = B3 ^ B2\nG1 = B2 ^ B1\nG0 = B1 ^ B0\n`,
    },
  ],
  pla: [
    {
      id: 'seven-segment',
      title: '7-segment decoder',
      blurb: 'The same decoder as the PROM, but with don’t-care codes: the fitter shares product terms between segments.',
      source: `# @title BCD to seven-segment decoder\n# @polarity auto\n${sevenSegmentTable(9, true)}\n`,
    },
    {
      id: 'full-adder',
      title: 'Full adder',
      blurb: 'Sum and carry of three bits: seven product terms serve both outputs.',
      source: `# @title Full adder\nS = A ^ B ^ CIN\nCOUT = A & B | A & CIN | B & CIN\n`,
    },
    {
      id: 'priority',
      title: 'Priority encoder',
      blurb: 'The highest request wins: a 4-input priority encoder with a valid flag.',
      source: `# @title 4-input priority encoder\nR3 R2 R1 R0 | Y1 Y0 V\n1 - - - | 1 1 1\n0 1 - - | 1 0 1\n0 0 1 - | 0 1 1\n0 0 0 1 | 0 0 1\n0 0 0 0 | 0 0 0\n`,
    },
    {
      id: 'comparator',
      title: '2-bit comparator',
      blurb: 'A > B, A = B and A < B for two 2-bit numbers.',
      source: `# @title 2-bit magnitude comparator\nA1 A0 B1 B0 | GT EQ LT\n${Array.from({ length: 16 }, (_, m) => {
        const a = m >> 2;
        const b = m & 3;
        return `${bits(a, 2).join(' ')} ${bits(b, 2).join(' ')} | ${a > b ? 1 : 0} ${a === b ? 1 : 0} ${a < b ? 1 : 0}`;
      }).join('\n')}\n`,
    },
  ],
  gal22v10: [
    {
      id: 'traffic-light',
      title: 'Traffic-light controller',
      blurb: 'A two-bit state machine in registered outputs, six lamps decoded from it, and an asynchronous reset.',
      source: TRAFFIC_GAL,
    },
    {
      id: 'seven-segment',
      title: '7-segment decoder',
      blurb: 'Seven outputs of a 4-input decoder; the fitter picks the cheaper output polarity for each segment.',
      source: `# @title BCD to seven-segment decoder\n# @dc S* : D & (C | B)\n// Codes 10–15 never occur, so they are don’t cares.\n${sevenSegmentEquations(['D', 'C', 'B', 'A'])}\n`,
    },
    {
      id: 'counter',
      title: '4-bit counter',
      blurb: 'A synchronous binary counter with count enable and clear; carry-out is a combinational output.',
      source: `# @title 4-bit counter\n# @clock CLK\nQ0.R = !CLR & (Q0 ^ EN)\nQ1.R = !CLR & (Q1 ^ (EN & Q0))\nQ2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))\nQ3.R = !CLR & (Q3 ^ (EN & Q0 & Q1 & Q2))\nCO = EN & Q0 & Q1 & Q2 & Q3\n`,
    },
    {
      id: 'decoder',
      title: '3-to-8 decoder',
      blurb: 'Like a 74138: one of eight active-low outputs, with two enables. Every output is a single product term.',
      source: `# @title 3-to-8 decoder\n${Array.from({ length: 8 }, (_, k) => `Y${k} = !(G1 & !G2N & ${minterms(['C', 'B', 'A'], [k])})`).join('\n')}\n`,
    },
  ],
  cpld32: [
    {
      id: 'counter',
      title: '4-bit counter',
      blurb: 'The counter on a CPLD: the fitter picks T flip-flops, so each bit toggles on one product term.',
      source: `# @title 4-bit counter with enable and clear\nQ0.R = !CLR & (Q0 ^ EN)\nQ1.R = !CLR & (Q1 ^ (EN & Q0))\nQ2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))\nQ3.R = !CLR & (Q3 ^ (EN & Q0 & Q1 & Q2))\n`,
    },
    {
      id: 'traffic-light',
      title: 'Traffic-light controller',
      blurb: 'The state machine of the GAL example, with a synchronous reset.',
      source: TRAFFIC_CPLD,
    },
    {
      id: 'bcd-display',
      title: 'BCD counter and display',
      blurb: 'A decade counter drives a seven-segment decoder: four registers and seven combinational outputs across function blocks.',
      source: `# @title BCD counter and seven-segment display\n# @dc S* : Q3 & (Q2 | Q1)\n// A decade counter with enable and synchronous clear; the display decodes its state.\n${BCD_COUNTER}\n${sevenSegmentEquations(['Q3', 'Q2', 'Q1', 'Q0'])}\n`,
    },
    {
      id: 'seven-segment',
      title: '7-segment decoder',
      blurb: 'Seven segments of a 4-input decoder; outputs that need more than five terms borrow from their neighbours.',
      source: `# @title BCD to seven-segment decoder\n# @dc S* : D & (C | B)\n${sevenSegmentEquations(['D', 'C', 'B', 'A'])}\n`,
    },
    {
      id: 'adder',
      title: '4-bit adder (buried carries)',
      blurb: 'A ripple-carry adder whose carries live in buried macrocells: logic with no pin.',
      source: `# @title 4-bit adder with buried carries\n# @inputs A0 A1 A2 A3 B0 B1 B2 B3 CIN\n# @buried C1 C2 C3\nC1 = A0 & B0 | A0 & CIN | B0 & CIN\nC2 = A1 & B1 | A1 & C1 | B1 & C1\nC3 = A2 & B2 | A2 & C2 | B2 & C2\nS0 = A0 ^ B0 ^ CIN\nS1 = A1 ^ B1 ^ C1\nS2 = A2 ^ B2 ^ C2\nS3 = A3 ^ B3 ^ C3\nCOUT = A3 & B3 | A3 & C3 | B3 & C3\n`,
    },
    {
      id: 'parity',
      title: 'Parity (borrows terms)',
      blurb: 'Four-input parity needs eight product terms, more than one macrocell owns: the allocator borrows three from a neighbour.',
      source: `# @title 4-input parity\n# @inputs A B C D\nP = A ^ B ^ C ^ D\n`,
    },
  ],
};

export function findExample(device: keyof typeof EXAMPLES, id: string): ExampleDesign | undefined {
  return EXAMPLES[device].find((e) => e.id === id);
}
