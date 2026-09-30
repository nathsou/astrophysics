/**
 * The parts bin's registry: every part the course adds, with its pins, the spec its checker uses and
 * its reference implementation (built lazily, as a subcircuit with ports).
 */
import type { Circuit } from '../sim/netlist/types';
import type { SeqModel } from '../sim/check';
import * as R from './refs';
import { CircuitBuilder } from './builder';
import type { PartCheck, PartGroup, PartPin, PartSpec } from './types';

/** "A0-7 EN" → A0 … A7, EN. */
export function expandPins(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((t) => {
      const m = /^([A-Za-z_]+)(\d+)-(\d+)$/.exec(t);
      return m ? Array.from({ length: Number(m[3]) - Number(m[2]) + 1 }, (_, i) => `${m[1]}${Number(m[2]) + i}`) : [t];
    });
}
const pinList = (ins: string, outs: string): PartPin[] => [...expandPins(ins).map((name) => ({ name, dir: 'in' as const })), ...expandPins(outs).map((name) => ({ name, dir: 'out' as const }))];

// ── Resolving parts inside references ──────────────────────────────────────────

const natural = new Map<string, Circuit>();
const digital = new Map<string, Circuit>();

/** Builders get the digital stand-ins, so every reference is simulated on the digital engine. */
const ctx: R.Ctx = { parts: (type) => (type.startsWith('part:') ? behaviourOf(type.slice(5)) : undefined) };

/** The reference circuit of a part, in its natural form (transistor-level for the CMOS and RTL parts). */
export function referenceOf(id: string): Circuit | undefined {
  const hit = natural.get(id);
  if (hit) return hit;
  const c = PART_MAP.get(id)?.reference?.();
  if (c) natural.set(id, c);
  return c;
}

/** The digital-engine version of a part: the reference itself, or a behavioural gate for transistor-level parts. */
export function behaviourOf(id: string): Circuit | undefined {
  const hit = digital.get(id);
  if (hit) return hit;
  const p = PART_MAP.get(id);
  if (!p) return undefined;
  const c = (p.behaviour ?? p.reference)?.();
  if (c) digital.set(id, c);
  return c;
}

// ── Specs ──────────────────────────────────────────────────────────────────────

/** The simulator's own latch or flip-flop wrapped with the part's pins: the specification of the sequential basics. */
function catalogElement(type: string, ins: string[]): Circuit {
  const b = new CircuitBuilder(`${type} (behavioural)`);
  ins.forEach((n) => b.input(n));
  b.comp(type, { ...Object.fromEntries(ins.map((n) => [n, n])), Q: 'Q', Qn: 'Qn' });
  b.output('Q');
  b.output('Qn');
  return b.build();
}

const comb = (spec: Extract<PartCheck, { kind: 'comb' }>['spec'], options?: Extract<PartCheck, { kind: 'comb' }>['options']): PartCheck => ({ kind: 'comb', spec, options });
const seq = (spec: Extract<PartCheck, { kind: 'seq' }>['spec']): PartCheck => ({ kind: 'seq', spec });

const num = (v: Record<string, number>, prefix: string, n: number): number => {
  let x = 0;
  for (let i = 0; i < n; i++) x |= (v[`${prefix}${i}`] ? 1 : 0) << i;
  return x;
};
const asBits = (x: number, n: number): (0 | 1)[] => Array.from({ length: n }, (_, i) => ((x >> i) & 1) as 0 | 1);
const named = (prefix: string, x: number, n: number): Record<string, number> => Object.fromEntries(asBits(x, n).map((b, i) => [`${prefix}${i}`, b]));
const parity = (x: number) => {
  let p = 0;
  for (; x; x >>= 1) p ^= x & 1;
  return p;
};

/** A register-like model: `state` is a number of 8 bits. */
function wordModel(inputs: string[], step: (s: number, v: Record<string, number>) => number): SeqModel<number> {
  return {
    inputs,
    outputs: R.bits('Q', 8),
    initial: () => 0,
    key: (s) => String(s),
    step: (s, v) => {
      const next = step(s, v) & 255;
      return { next, pre: asBits(s, 8), post: asBits(next, 8) };
    },
  };
}

const registerModel = wordModel([...R.bits('D', 8), 'EN', 'CLR'], (s, v) => (v.CLR ? 0 : v.EN ? num(v, 'D', 8) : s));
const counterModel = wordModel(['EN', 'CLR', 'LOAD', ...R.bits('D', 8)], (s, v) => (v.CLR ? 0 : v.LOAD ? num(v, 'D', 8) : v.EN ? s + 1 : s));
const shiftModel = wordModel(['SI', 'EN', 'CLR'], (s, v) => (v.CLR ? 0 : v.EN ? (s << 1) | (v.SI ? 1 : 0) : s));
const lfsrModel: SeqModel<number> = {
  ...wordModel(['RST'], (s, v) => (v.RST ? 1 : ((s << 1) | parity(s & R.LFSR_TAPS)) & 255)),
  initial: () => 1,
};

/** Memory with unknown contents until written: outputs of an unwritten word are don't-care. */
function memoryModel(addrIn: string[], dataIn: string[], outputs: string[], words: number): SeqModel<(number | null)[]> {
  const read = (m: (number | null)[], a: number) => (m[a] === null || m[a] === undefined ? outputs.map(() => null) : asBits(m[a]!, outputs.length));
  return {
    inputs: [...addrIn, ...dataIn, 'WE'],
    outputs,
    initial: () => new Array<number | null>(words).fill(null),
    key: (m) => m.join(','),
    step: (m, v) => {
      const a = num(v, 'A', addrIn.length);
      const next = v.WE ? m.map((w, i) => (i === a ? num(v, 'DI', dataIn.length) : w)) : m;
      return { next, pre: read(m, a), post: read(next, a) };
    },
  };
}

const ramModel = memoryModel(R.bits('A', 8), R.bits('DI', 8), R.bits('DO', 8), 256);

/** Two-bit-address register file: four words. */
const regfileModel: SeqModel<(number | null)[]> = {
  inputs: [...R.bits('WD', 8), 'WA0', 'WA1', 'WE', 'RA0', 'RA1', 'RB0', 'RB1'],
  outputs: [...R.bits('QA', 8), ...R.bits('QB', 8)],
  initial: () => [null, null, null, null],
  key: (m) => m.join(','),
  step: (m, v) => {
    const wa = (v.WA0 ? 1 : 0) | (v.WA1 ? 2 : 0);
    const next = v.WE ? m.map((w, i) => (i === wa ? num(v, 'WD', 8) : w)) : m;
    const read = (mm: (number | null)[]) => {
      const a = mm[(v.RA0 ? 1 : 0) | (v.RA1 ? 2 : 0)];
      const b = mm[(v.RB0 ? 1 : 0) | (v.RB1 ? 2 : 0)];
      return [...(a === null || a === undefined ? Array<null>(8).fill(null) : asBits(a, 8)), ...(b === null || b === undefined ? Array<null>(8).fill(null) : asBits(b, 8))];
    };
    return { next, pre: read(m), post: read(next) };
  },
};

function aluFn(v: Record<string, number>): Record<string, number> {
  const a = num(v, 'A', 8);
  const b = num(v, 'B', 8);
  const op = num(v, 'OP', 3);
  let y = 0;
  let c = 0;
  switch (op) {
    case 0:
      y = a + b;
      c = y > 255 ? 1 : 0;
      break;
    case 1:
      y = a - b;
      c = a >= b ? 1 : 0;
      break;
    case 2:
      y = a & b;
      break;
    case 3:
      y = a | b;
      break;
    case 4:
      y = a ^ b;
      break;
    case 5:
      y = a << 1;
      break;
    case 6:
      y = a >> 1;
      break;
    default:
      y = ~a;
  }
  y &= 255;
  return { ...named('Y', y, 8), Z: y === 0 ? 1 : 0, C: c };
}

// ── The registry ───────────────────────────────────────────────────────────────

interface Def {
  id: string;
  name: string;
  chapter: number;
  group: PartGroup;
  ins: string;
  outs: string;
  description: string;
  check?: PartCheck;
  reference?: (c: R.Ctx) => Circuit;
  behaviour?: (c: R.Ctx) => Circuit;
  engine?: PartSpec['engine'];
  substitutable?: boolean;
}

const G1: PartGroup = 'Transistors and gates';
const G2: PartGroup = 'Building blocks';
const G3: PartGroup = 'Arithmetic';
const G4: PartGroup = 'Memory and time';
const G5: PartGroup = 'The computer';
const G6: PartGroup = 'Talking to the world';

const gateSpec = (type: 'nand' | 'nor', engine?: 'switch') => comb({ expression: `Y = ${type === 'nand' ? '!(A & B)' : '!(A | B)'}`, inputs: ['A', 'B'] }, engine ? { engine } : undefined);
const HEX_SEG = (v: Record<string, number>) => Object.fromEntries(R.SEG_NAMES.map((n, s) => [n, (R.SEG7[num(v, 'D', 4)]! >> s) & 1]));

const DEFS: Def[] = [
  // Transistors and gates
  { id: 'not-rtl', name: 'NOT (RTL)', chapter: 8, group: G1, ins: 'A', outs: 'Y', description: 'A resistor–transistor inverter: one NPN transistor and two resistors. A high input saturates the transistor and pulls the output low; a low input lets the collector resistor pull it high.', check: comb({ expression: 'Y = !A' }, { engine: 'analog' }), reference: () => R.rtlNot(), behaviour: (c) => R.behaviouralGate('not', c), engine: 'analog', substitutable: false },
  { id: 'not', name: 'NOT (CMOS)', chapter: 9, group: G1, ins: 'A', outs: 'Y', description: 'The CMOS inverter: a pMOS pulling up and an nMOS pulling down, never both on, so almost no current flows when the output is steady.', check: comb({ expression: 'Y = !A' }, { engine: 'switch' }), reference: () => R.cmosNot(), behaviour: (c) => R.behaviouralGate('not', c), engine: 'switch', substitutable: false },
  { id: 'nand', name: 'NAND (CMOS)', chapter: 9, group: G1, ins: 'A B', outs: 'Y', description: 'Two pMOS in parallel above two nMOS in series: the output falls only when both inputs are high. NAND is universal: every other gate can be built from it.', check: gateSpec('nand', 'switch'), reference: () => R.cmosNand(), behaviour: (c) => R.behaviouralGate('nand', c), engine: 'switch', substitutable: false },
  { id: 'nor', name: 'NOR (CMOS)', chapter: 9, group: G1, ins: 'A B', outs: 'Y', description: 'Two pMOS in series above two nMOS in parallel: the output rises only when both inputs are low. The dual of NAND, and also universal.', check: gateSpec('nor', 'switch'), reference: () => R.cmosNor(), behaviour: (c) => R.behaviouralGate('nor', c), engine: 'switch', substitutable: false },
  { id: 'tri-state', name: 'Tri-state buffer', chapter: 10, group: G1, ins: 'A EN', outs: 'Y', description: 'Copies A to Y while EN is 1; otherwise lets go of the wire (high impedance), so several drivers can share a bus. Only the enabled rows are specified.', check: comb({ fn: (v) => ({ Y: v.EN ? v.A! : null }), inputs: ['A', 'EN'], outputs: ['Y'] }), reference: R.tristate },
  { id: 'and', name: 'AND', chapter: 11, group: G1, ins: 'A B', outs: 'Y', description: 'Outputs 1 only when both inputs are 1. Built as a NAND followed by a NOT.', check: comb({ expression: 'Y = A & B' }), reference: R.and2 },
  { id: 'or', name: 'OR', chapter: 11, group: G1, ins: 'A B', outs: 'Y', description: 'Outputs 1 when at least one input is 1. Built as a NOR followed by a NOT.', check: comb({ expression: 'Y = A | B' }), reference: R.or2 },
  { id: 'xor', name: 'XOR', chapter: 11, group: G1, ins: 'A B', outs: 'Y', description: 'Outputs 1 when exactly one input is 1: the sum bit of a half adder. Four NAND gates make one.', check: comb({ expression: 'Y = A ^ B' }), reference: R.xor2 },
  { id: 'xnor', name: 'XNOR', chapter: 11, group: G1, ins: 'A B', outs: 'Y', description: 'Outputs 1 when the inputs are equal: an XOR followed by a NOT.', check: comb({ expression: 'Y = !(A ^ B)' }), reference: R.xnor2 },
  // Building blocks
  { id: 'mux2', name: 'MUX2', chapter: 13, group: G2, ins: 'D0 D1 S', outs: 'Y', description: 'A two-way multiplexer: Y = D0 when S is 0, D1 when S is 1. A lookup table with one address bit.', check: comb({ expression: 'Y = D0 & !S | D1 & S', inputs: ['D0', 'D1', 'S'] }), reference: R.mux2 },
  { id: 'mux4', name: 'MUX4', chapter: 13, group: G2, ins: 'D0-3 S0-1', outs: 'Y', description: 'A four-way multiplexer, made of three MUX2 parts: the select inputs S1 S0 give the number of the data input that reaches Y.', check: comb({ fn: (v) => ({ Y: v[`D${num(v, 'S', 2)}`]! }), inputs: [...R.bits('D', 4), 'S0', 'S1'], outputs: ['Y'] }), reference: R.mux4 },
  { id: 'mux8', name: 'MUX8', chapter: 13, group: G2, ins: 'D0-7 S0-2', outs: 'Y', description: 'An eight-way multiplexer: two MUX4 parts and a MUX2. Also a 3-input lookup table, the heart of an FPGA.', check: comb({ fn: (v) => ({ Y: v[`D${num(v, 'S', 3)}`]! }), inputs: [...R.bits('D', 8), ...R.bits('S', 3)], outputs: ['Y'] }), reference: R.mux8 },
  { id: 'dec2-4', name: 'DEC 2→4', chapter: 13, group: G2, ins: 'A0-1 EN', outs: 'Y0-3', description: 'A 2-to-4 decoder: while EN is 1, exactly one output (the one whose number is on A1 A0) is 1.', check: comb({ fn: (v) => Object.fromEntries(R.bits('Y', 4).map((n, i) => [n, v.EN && num(v, 'A', 2) === i ? 1 : 0])), inputs: ['A0', 'A1', 'EN'], outputs: R.bits('Y', 4) }), reference: R.dec2to4 },
  { id: 'dec3-8', name: 'DEC 3→8', chapter: 13, group: G2, ins: 'A0-2 EN', outs: 'Y0-7', description: 'A 3-to-8 decoder: one AND gate per output, so exactly the addressed line is 1 while EN is 1.', check: comb({ fn: (v) => Object.fromEntries(R.bits('Y', 8).map((n, i) => [n, v.EN && num(v, 'A', 3) === i ? 1 : 0])), inputs: [...R.bits('A', 3), 'EN'], outputs: R.bits('Y', 8) }), reference: R.dec3to8 },
  { id: 'seg7', name: '7-segment decoder', chapter: 13, group: G2, ins: 'D0-3', outs: 'a b c d e f g', description: 'Turns a 4-bit number into the seven segments a–g that draw its hexadecimal digit (0–F).', check: comb({ fn: HEX_SEG, inputs: R.bits('D', 4), outputs: R.SEG_NAMES }), reference: R.seg7 },
  { id: 'comparator', name: 'Comparator (4-bit)', chapter: 13, group: G2, ins: 'A0-3 B0-3', outs: 'EQ LT GT', description: 'Compares two 4-bit unsigned numbers: EQ when A = B, LT when A < B, GT when A > B.', check: comb({ fn: (v) => { const a = num(v, 'A', 4); const b = num(v, 'B', 4); return { EQ: +(a === b), LT: +(a < b), GT: +(a > b) }; }, inputs: [...R.bits('A', 4), ...R.bits('B', 4)], outputs: ['EQ', 'LT', 'GT'] }), reference: R.comparator },
  // Arithmetic
  { id: 'half-adder', name: 'Half adder', chapter: 14, group: G3, ins: 'A B', outs: 'S C', description: 'Adds two bits: the sum is the XOR, the carry is the AND.', check: comb({ expression: ['S = A ^ B', 'C = A & B'], inputs: ['A', 'B'] }), reference: R.halfAdder },
  { id: 'full-adder', name: 'Full adder', chapter: 14, group: G3, ins: 'A B CIN', outs: 'S COUT', description: 'Adds two bits and a carry in: two half adders and an OR. Chain eight of them for a byte.', check: comb({ fn: (v) => { const t = v.A! + v.B! + v.CIN!; return { S: t & 1, COUT: t >> 1 }; }, inputs: ['A', 'B', 'CIN'], outputs: ['S', 'COUT'] }), reference: R.fullAdder },
  { id: 'adder8', name: '8-bit adder/subtractor', chapter: 14, group: G3, ins: 'A0-7 B0-7 SUB', outs: 'S0-7 COUT', description: 'A ripple-carry chain of eight full adders. With SUB = 1 the B inputs are inverted and the carry in is 1, which computes A − B in two’s complement (COUT = 1 when there is no borrow).', check: comb({ fn: (v) => { const a = num(v, 'A', 8); const b = num(v, 'B', 8); const t = v.SUB ? a + (~b & 255) + 1 : a + b; return { ...named('S', t & 255, 8), COUT: t >> 8 }; }, inputs: [...R.bits('A', 8), ...R.bits('B', 8), 'SUB'], outputs: [...R.bits('S', 8), 'COUT'] }), reference: R.adder8 },
  { id: 'shifter', name: 'Shifter (8-bit)', chapter: 14, group: G3, ins: 'D0-7 SH0-2 DIR', outs: 'Y0-7', description: 'A barrel shifter: shifts D left (DIR = 0) or right (DIR = 1) by 0–7 places in three stages of multiplexers, filling with zeros.', check: comb({ fn: (v) => { const d = num(v, 'D', 8); const s = num(v, 'SH', 3); return named('Y', v.DIR ? d >> s : (d << s) & 255, 8); }, inputs: [...R.bits('D', 8), ...R.bits('SH', 3), 'DIR'], outputs: R.bits('Y', 8) }), reference: R.shifter },
  // Memory and time
  { id: 'sr-latch', name: 'SR latch', chapter: 16, group: G4, ins: 'S R', outs: 'Q Qn', description: 'Two cross-coupled NOR gates that remember one bit: S sets Q to 1, R resets it to 0, and with both low it holds. S = R = 1 is forbidden.', check: seq({ reference: catalogElement('srlatch', ['S', 'R']), clock: false, singleStep: true, forbidden: [{ S: 1, R: 1 }], init: [{ S: 1, R: 0 }, { S: 0, R: 0 }] }), reference: R.srLatch },
  { id: 'd-latch', name: 'D latch', chapter: 17, group: G4, ins: 'D EN', outs: 'Q Qn', description: 'A latch that is transparent while EN is 1 (Q follows D) and holds its value while EN is 0: an SR latch of NAND gates with steering logic in front.', check: seq({ reference: catalogElement('dlatch', ['D', 'EN']), clock: false, singleStep: true, init: [{ D: 1, EN: 1 }, { D: 1, EN: 0 }, { D: 0, EN: 0 }] }), reference: R.dLatch },
  { id: 'd-flip-flop', name: 'D flip-flop', chapter: 17, group: G4, ins: 'D CLK', outs: 'Q Qn', description: 'Copies D to Q on each rising edge of CLK: a master D latch (open while the clock is low) followed by a slave D latch (open while it is high).', check: seq({ reference: catalogElement('dff', ['D', 'CLK']) }), reference: R.dff },
  { id: 'register', name: 'Register (8-bit)', chapter: 18, group: G4, ins: 'D0-7 CLK EN CLR', outs: 'Q0-7', description: 'Eight D flip-flops with a load enable and a synchronous clear: on each rising edge Q takes D if EN is 1, keeps its value if EN is 0, and goes to 0 if CLR is 1.', check: seq({ model: registerModel as never, reset: 'CLR', cycles: 600 }), reference: R.register },
  { id: 'counter', name: 'Counter (8-bit)', chapter: 18, group: G4, ins: 'CLK EN CLR LOAD D0-7', outs: 'Q0-7', description: 'A synchronous up-counter, the future program counter: on each rising edge Q counts up by one (while EN is 1), loads D (LOAD), or clears (CLR, which wins). Wraps from 255 to 0.', check: seq({ model: counterModel as never, reset: 'CLR', cycles: 700, bias: { EN: 0.9, LOAD: 0.03, CLR: 0.01 }, stimulus: (_, i) => (i === 100 ? { LOAD: 1, CLR: 0, EN: 1, ...named('D', 250, 8) } : i > 100 && i < 130 ? { LOAD: 0, CLR: 0, EN: 1 } : undefined) }), reference: R.counter },
  { id: 'shift-register', name: 'Shift register (8-bit)', chapter: 18, group: G4, ins: 'CLK SI EN CLR', outs: 'Q0-7', description: 'Eight flip-flops in a chain: on each rising edge every bit moves up one place and SI enters at Q0. CLR clears it.', check: seq({ model: shiftModel as never, reset: 'CLR', cycles: 500, bias: { EN: 0.85, CLR: 0.01 } }), reference: R.shiftRegister },
  { id: 'lfsr', name: 'LFSR (8-bit)', chapter: 18, group: G4, ins: 'CLK RST', outs: 'Q0-7', description: 'A linear-feedback shift register with taps at bits 7, 5, 4 and 3: it steps through all 255 non-zero values before repeating. RST loads 00000001.', check: seq({ model: lfsrModel as never, reset: 'RST', cycles: 300, bias: { RST: 0.005 } }), reference: R.lfsr },
  { id: 'ram', name: 'RAM 256×8', chapter: 20, group: G4, ins: 'A0-7 DI0-7 WE CLK', outs: 'DO0-7', description: 'A memory of 256 bytes: on a rising clock edge with WE = 1 it stores DI at address A; DO always shows the byte at A. The reference is the simulator’s memory block, which no reader wires by hand at full size.', check: seq({ model: ramModel as never, cycles: 500, stimulus: (rand) => ({ ...named('A', [0, 1, 2, 255][Math.floor(rand() * 4)]!, 8) }) }), reference: R.ram },
  { id: 'rom', name: 'ROM 16×8', chapter: 20, group: G4, ins: 'A0-3', outs: 'DO0-7', description: 'A read-only memory of sixteen bytes (here the squares 0², 1², … 15² mod 256), wired as a decoder followed by OR gates: a ROM is a truth table.', check: comb({ fn: (v) => named('DO', R.ROM_WORDS[num(v, 'A', 4)]!, 8), inputs: R.bits('A', 4), outputs: R.bits('DO', 8) }), reference: R.rom },
  // The computer
  { id: 'alu', name: 'ALU (8-bit)', chapter: 21, group: G5, ins: 'A0-7 B0-7 OP0-2', outs: 'Y0-7 Z C', description: 'Computes Y from A and B according to OP: 0 add, 1 subtract, 2 AND, 3 OR, 4 XOR, 5 A shifted left, 6 A shifted right, 7 NOT A. Z is 1 when Y is 0; C is the carry out (no-borrow for subtract) of add and subtract.', check: comb({ fn: aluFn, inputs: [...R.bits('A', 8), ...R.bits('B', 8), ...R.bits('OP', 3)], outputs: [...R.bits('Y', 8), 'Z', 'C'] }, { samples: 2500 }), reference: R.alu },
  { id: 'register-file', name: 'Register file (4×8)', chapter: 21, group: G5, ins: 'WD0-7 WA0-1 WE RA0-1 RB0-1 CLK', outs: 'QA0-7 QB0-7', description: 'Four 8-bit registers with one write port (WA, WD, WE) and two read ports (RA and RB) that are always active. A write shows at the read ports after the clock edge.', check: seq({ model: regfileModel as never, cycles: 500, bias: { WE: 0.6 } }), reference: R.registerFile },
  { id: 'bus', name: 'Bus (2 sources)', chapter: 21, group: G5, ins: 'A0-7 ENA B0-7 ENB', outs: 'BUS0-7', description: 'Two 8-bit sources share one bus through tri-state buffers. Exactly one enable may be 1; with neither the bus floats, with both the drivers fight (contention). Only the one-driver rows are specified.', check: comb({ fn: (v) => (v.ENA && !v.ENB ? named('BUS', num(v, 'A', 8), 8) : v.ENB && !v.ENA ? named('BUS', num(v, 'B', 8), 8) : Object.fromEntries(R.bits('BUS', 8).map((n) => [n, null]))), inputs: [...R.bits('A', 8), 'ENA', ...R.bits('B', 8), 'ENB'], outputs: R.bits('BUS', 8) }, { samples: 2000 }), reference: R.bus },
];

/** Planned parts: they appear in the bin as placeholders until their chapters are built. */
const PLANNED: { id: string; name: string; chapter: number; group: PartGroup; ins: string; outs: string; description: string }[] = [
  { id: 'open-drain', name: 'Open-drain buffer', chapter: 10, group: G1, ins: 'A', outs: 'Y', description: 'Pulls the wire low or lets go; a pull-up resistor does the rest. Arrives with Chapter 10’s analogue models.' },
  { id: 'timer-555', name: '555 timer', chapter: 17, group: G4, ins: 'TRIG THRESH RESET', outs: 'OUT', description: 'A timer built from two comparators and an SR latch. Arrives with the analogue comparator in Chapter 17.' },
  { id: 'control-unit', name: 'Control unit', chapter: 22, group: G5, ins: 'CLK RST IR0-7 Z C N V', outs: 'OE_RD OE_RS OE_PC OE_SP OE_ALU OE_MEM OE_T LD_MAR LD_IR LD_A LD_B LD_T WE_R LD_FLAGS PC_LD PC_INC SP_INC SP_DEC MEM_WR ALU_OP0 ALU_OP1 ALU_OP2 BSEL_A BSEL_1 HALT BUSWIN', description: 'Octet’s control unit, which Chapter 22 builds twice (hardwired, then microcoded): it reads IR and the flags Z, C, N, V and drives the 24 control lines of the datapath, plus HALT and BUSWIN, the window in which the bus drivers may be on.' },
  { id: 'octet', name: 'Octet CPU', chapter: 23, group: G5, ins: 'CLK RST', outs: 'ADDR0-7 DATA0-7 WE', description: 'The reader’s 8-bit CPU from the parts bin, running Octet programs. Arrives with Chapter 23.' },
  { id: 'io-ports', name: 'I/O ports', chapter: 24, group: G6, ins: 'CLK A0-7 DI0-7 WE', outs: 'DO0-7 PORT0-7', description: 'Memory-mapped input and output registers that connect the CPU to LEDs and buttons. Arrives with Chapter 24.' },
  { id: 'pwm', name: 'PWM generator', chapter: 24, group: G6, ins: 'CLK DUTY0-7', outs: 'OUT', description: 'A counter and a comparator: the output is high while the counter is below the duty value. Arrives with Chapter 24.' },
  { id: 'dac', name: 'DAC (R-2R)', chapter: 24, group: G6, ins: 'D0-7', outs: 'VOUT', description: 'An R-2R ladder that turns a byte into a voltage. Arrives with Chapter 24.' },
  { id: 'adc', name: 'ADC (successive approximation)', chapter: 24, group: G6, ins: 'CLK START VIN', outs: 'D0-7 DONE', description: 'A binary search with a comparator and the DAC. Arrives with Chapter 24.' },
];

function makeSpec(d: Def): PartSpec {
  return {
    id: d.id,
    name: d.name,
    chapter: d.chapter,
    group: d.group,
    pins: pinList(d.ins, d.outs),
    description: d.description,
    status: 'reference',
    check: d.check,
    reference: d.reference ? () => d.reference!(ctx) : undefined,
    behaviour: d.behaviour ? () => d.behaviour!(ctx) : undefined,
    engine: d.engine,
    substitutable: d.substitutable ?? true,
  };
}

export const PARTS: PartSpec[] = [
  ...DEFS.map(makeSpec),
  ...PLANNED.map((p): PartSpec => ({ id: p.id, name: p.name, chapter: p.chapter, group: p.group, pins: pinList(p.ins, p.outs), description: p.description, status: 'planned', substitutable: false })),
];
const PART_MAP = new Map(PARTS.map((p) => [p.id, p]));

export const getPart = (id: string): PartSpec | undefined => PART_MAP.get(id);
