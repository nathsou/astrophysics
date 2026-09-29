/**
 * Pinouts of the chips in the Build it for real labs, for Appendix A. Pin names follow the Texas
 * Instruments data sheets (SN74HC00 … SN74HC595, NE555). Pins are listed in order, pin 1 first; a
 * DIP is numbered counter-clockwise seen from above, starting left of the notch.
 */

export type Role = 'in' | 'out' | 'power' | 'ground' | 'clock' | 'control' | 'io';

export interface Pin {
  /** The name printed in data sheets. */
  name: string;
  role: Role;
  /** Active low: drawn with an overbar. */
  low?: boolean;
  /** What the pin does, in a few words. */
  note?: string;
}

export interface Chip {
  id: string;
  /** Short name, e.g. "74HC00". */
  part: string;
  title: string;
  /** What is inside. */
  summary: string;
  pins: Pin[];
  /** Lab or chapter that uses it. */
  used?: string;
  note?: string;
}

const i = (name: string, note?: string): Pin => ({ name, role: 'in', note });
const o = (name: string, note?: string): Pin => ({ name, role: 'out', note });
const c = (name: string, note?: string, low = false): Pin => ({ name, role: 'control', low, note });
const clk = (name: string, note?: string): Pin => ({ name, role: 'clock', note });
const VCC: Pin = { name: 'VCC', role: 'power', note: 'supply, 2 V to 6 V' };
const GND: Pin = { name: 'GND', role: 'ground' };

/** Four 2-input gates in the 7400 layout: 1A 1B 1Y 2A 2B 2Y GND 3Y 3A 3B 4Y 4A 4B VCC. */
const quad = (): Pin[] => [i('1A'), i('1B'), o('1Y'), i('2A'), i('2B'), o('2Y'), GND, o('3Y'), i('3A'), i('3B'), o('4Y'), i('4A'), i('4B'), VCC];

export const CHIPS: Chip[] = [
  {
    id: '74hc00',
    part: '74HC00',
    title: 'Quad 2-input NAND',
    summary: 'Four NAND gates. Y = ¬(A · B).',
    pins: quad(),
    used: 'Chapters 11 (XOR from four NANDs) and 16 (NAND latch)',
  },
  {
    id: '74hc02',
    part: '74HC02',
    title: 'Quad 2-input NOR',
    summary: 'Four NOR gates. Y = ¬(A + B).',
    pins: [o('1Y'), i('1A'), i('1B'), o('2Y'), i('2A'), i('2B'), GND, i('3A'), i('3B'), o('3Y'), i('4A'), i('4B'), o('4Y'), VCC],
    used: 'Gate and latch experiments (Chapters 11, 16)',
    note: 'The odd one out: the outputs are on pins 1, 4, 10 and 13, not in the 7400 layout. Wiring a NOR into a socket meant for a NAND is a classic mistake.',
  },
  {
    id: '74hc04',
    part: '74HC04',
    title: 'Hex inverter',
    summary: 'Six NOT gates. Y = ¬A.',
    pins: [i('1A'), o('1Y'), i('2A'), o('2Y'), i('3A'), o('3Y'), GND, o('4Y'), i('4A'), o('5Y'), i('5A'), o('6Y'), i('6A'), VCC],
    used: 'Chapters 10 (transfer curve) and 16 (ring oscillator)',
    note: 'Tie the inputs of unused gates to VCC or GND: a floating CMOS input wanders through the middle and wastes current.',
  },
  {
    id: '74hc08',
    part: '74HC08',
    title: 'Quad 2-input AND',
    summary: 'Four AND gates. Y = A · B.',
    pins: quad(),
    used: 'Gate experiments (Chapters 11, 13, 14)',
  },
  {
    id: '74hc32',
    part: '74HC32',
    title: 'Quad 2-input OR',
    summary: 'Four OR gates. Y = A + B.',
    pins: quad(),
    used: 'Gate experiments (Chapters 11, 13, 14)',
  },
  {
    id: '74hc86',
    part: '74HC86',
    title: 'Quad 2-input XOR',
    summary: 'Four exclusive-OR gates. Y = A ⊕ B.',
    pins: quad(),
    used: 'Chapters 11 and 14 (sums and parity)',
  },
  {
    id: '74hc74',
    part: '74HC74',
    title: 'Dual D flip-flop',
    summary: 'Two edge-triggered D flip-flops, each with asynchronous preset and clear (both active low).',
    pins: [
      c('1CLR', 'clear: Q = 0 while low', true),
      i('1D'),
      clk('1CLK', 'rising edge'),
      c('1PRE', 'preset: Q = 1 while low', true),
      o('1Q'),
      { name: '1Q', role: 'out', low: true, note: 'inverse of 1Q' },
      GND,
      { name: '2Q', role: 'out', low: true, note: 'inverse of 2Q' },
      o('2Q'),
      c('2PRE', 'preset: Q = 1 while low', true),
      clk('2CLK', 'rising edge'),
      i('2D'),
      c('2CLR', 'clear: Q = 0 while low', true),
      VCC,
    ],
    used: 'Chapter 17 (debounced toggle)',
    note: 'Unused PRE and CLR must be tied high, or the flip-flop is held in reset.',
  },
  {
    id: '74hc161',
    part: '74HC161',
    title: '4-bit synchronous binary counter',
    summary: 'Counts 0 to 15 on each rising edge while both enables are high; loads in parallel; asynchronous clear.',
    pins: [
      c('CLR', 'asynchronous clear, active low', true),
      clk('CLK', 'rising edge'),
      i('A', 'parallel data, least significant bit'),
      i('B'),
      i('C'),
      i('D', 'parallel data, most significant bit'),
      c('ENP', 'count enable (parallel)'),
      GND,
      c('LOAD', 'synchronous load, active low', true),
      c('ENT', 'count enable (trickle); also enables RCO'),
      o('QD', 'most significant bit'),
      o('QC'),
      o('QB'),
      o('QA', 'least significant bit'),
      o('RCO', 'ripple carry out: high at 15 while ENT is high'),
      VCC,
    ],
    used: 'Chapter 18 (counter on LEDs)',
    note: 'The 74HC163 has the same pins but clears synchronously.',
  },
  {
    id: '74hc283',
    part: '74HC283',
    title: '4-bit full adder with fast carry',
    summary: 'Adds two 4-bit numbers and a carry in: Σ = A + B + C0, carry out C4.',
    pins: [
      o('Σ2', 'sum bit 2 (weight 2)'),
      i('B2'),
      i('A2'),
      o('Σ1', 'sum bit 1 (weight 1, the least significant)'),
      i('A1'),
      i('B1'),
      i('C0', 'carry in'),
      GND,
      o('C4', 'carry out'),
      o('Σ4', 'sum bit 4 (weight 8, the most significant)'),
      i('B4'),
      i('A4'),
      o('Σ3', 'sum bit 3 (weight 4)'),
      i('A3'),
      i('B3'),
      VCC,
    ],
    used: 'Chapter 14 (4-bit adder)',
    note: 'The bits are numbered 1 to 4, not 0 to 3, and the pins are jumbled so that the sums and inputs of neighbouring bits sit near each other.',
  },
  {
    id: '74hc595',
    part: '74HC595',
    title: '8-bit shift register with output latches',
    summary: 'Serial in, parallel out: shift bits in on SRCLK, copy them to the outputs on RCLK.',
    pins: [
      o('QB'),
      o('QC'),
      o('QD'),
      o('QE'),
      o('QF'),
      o('QG'),
      o('QH', 'last output'),
      GND,
      o('QH′', 'serial out: chain to the next chip’s SER'),
      c('SRCLR', 'shift-register clear, active low', true),
      clk('SRCLK', 'shift clock: rising edge shifts'),
      clk('RCLK', 'storage clock: rising edge copies to the outputs'),
      c('OE', 'output enable, active low', true),
      i('SER', 'serial data in'),
      o('QA', 'first output'),
      VCC,
    ],
    used: 'Chapter 18 (8 LEDs)',
    note: 'Some makers call the pins SH_CP, ST_CP, DS, MR and Q7S. Tie SRCLR high and OE low for everyday use.',
  },
  {
    id: 'ne555',
    part: 'NE555',
    title: 'Timer',
    summary: 'A comparator pair, an SR latch and a discharge transistor: a monostable or an astable oscillator.',
    pins: [
      GND,
      { name: 'TRIG', role: 'in', low: true, note: 'trigger: starts the timing when below 1/3 VCC' },
      o('OUT'),
      { name: 'RESET', role: 'control', low: true, note: 'forces OUT low; tie high if unused' },
      c('CTRL', 'control voltage: 2/3 VCC; decouple with 10 nF'),
      i('THRES', 'threshold: ends the timing above 2/3 VCC'),
      { name: 'DISCH', role: 'io', note: 'discharge: open-collector transistor to GND' },
      { name: 'VCC', role: 'power', note: 'supply, 4.5 V to 16 V' },
    ],
    used: 'Chapters 17 (astable) and 24 (PWM)',
    note: 'An 8-pin DIP: pin 1 is at the notch, on the left.',
  },
];

export const chipById = (id: string): Chip => {
  const chip = CHIPS.find((x) => x.id === id);
  if (!chip) throw new Error(`no chip ${id}`);
  return chip;
};

/** Pins on each side of a DIP: pins 1…n/2 down the left, then up the right (n/2+1 at the bottom). */
export function sides(chip: Chip): { left: { n: number; pin: Pin }[]; right: { n: number; pin: Pin }[] } {
  const n = chip.pins.length;
  const half = n / 2;
  const left = chip.pins.slice(0, half).map((pin, k) => ({ n: k + 1, pin }));
  // Right side, top to bottom: pin n, n-1, …, half+1.
  const right = chip.pins.slice(half).map((pin, k) => ({ n: half + k + 1, pin })).reverse();
  return { left, right };
}

/** Plain-text name of a pin, for accessibility: "CLR (active low)". */
export const pinLabel = (p: Pin) => (p.low ? `${p.name}, active low` : p.name);
