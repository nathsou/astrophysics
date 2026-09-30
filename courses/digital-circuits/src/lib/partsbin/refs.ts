/**
 * Reference implementations of the parts-bin parts, as drawable gate-level circuits generated with the
 * CircuitBuilder, each built from the parts that precede it (a full adder from two half adders and an OR,
 * an 8-bit register from D flip-flops, a D flip-flop from two D latches, a D latch from NAND gates).
 */
import type { Circuit, Placed, Wire } from '../sim/netlist/types';
import { CircuitBuilder } from './builder';

export const bits = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** A resolver context: builders need the pin lists of the parts they instantiate. */
export type Ctx = { parts: (type: string) => Circuit | undefined };
const B = (title: string, ctx: Ctx) => new CircuitBuilder(title, { parts: ctx.parts });

/** AND/OR of any number of nets with gates of at most 4 inputs. */
function tree(b: CircuitBuilder, type: 'and' | 'or', nets: string[], out?: string): string {
  if (nets.length === 1) return nets[0]!;
  if (nets.length <= 4) return b.gate(type, nets, out);
  const groups: string[] = [];
  for (let i = 0; i < nets.length; i += 4) groups.push(tree(b, type, nets.slice(i, i + 4)));
  return tree(b, type, groups, out);
}

/** Sum of products: for each output, the OR of the minterms (input i is bit i of the minterm number). */
function sop(b: CircuitBuilder, inputs: string[], outputs: { name: string; minterms: number[] }[]): void {
  const inv = inputs.map((n) => b.gate('not', [n], `${n}_n`));
  const minterm = new Map<number, string>();
  const get = (m: number) => {
    let net = minterm.get(m);
    if (!net) {
      net = b.gate('and', inputs.map((n, i) => (m >> i) & 1 ? n : inv[i]!), `m${m}`);
      minterm.set(m, net);
    }
    return net;
  };
  for (const o of outputs) {
    if (!o.minterms.length) {
      b.constant(0, o.name);
      continue;
    }
    // A single minterm is the AND gate itself: give it the output's name via a buffer-free trick.
    const nets = o.minterms.map(get);
    if (nets.length === 1) b.gate('buffer', nets, o.name);
    else tree(b, 'or', nets, o.name);
  }
  for (const o of outputs) b.output(o.name);
}

// ── Transistor-level and behavioural gates ─────────────────────────────────────

const two = (a: Placed[], w: Wire[]) => ({ components: a, wires: w });

/** RTL inverter (analog): base resistor, NPN, collector resistor to +5 V. */
export function rtlNot(): Circuit {
  return {
    version: 1,
    title: 'NOT (RTL)',
    engine: 'analog',
    ...two(
      [
        { id: 'A', type: 'port', x: 2, y: 0, params: { name: 'A', dir: 'in' }, label: '' },
        { id: 'R1', type: 'resistor', x: 6, y: 0, params: { resistance: 10000 } },
        { id: 'Q1', type: 'npn', x: 12, y: 0 },
        { id: 'R2', type: 'resistor', x: 15, y: -6, rot: 90, params: { resistance: 1000 } },
        { id: 'VCC', type: 'rail', x: 15, y: -6, params: { voltage: 5 } },
        { id: 'G1', type: 'ground', x: 15, y: 2 },
        { id: 'Y', type: 'port', x: 20, y: -2, flip: true, params: { name: 'Y', dir: 'out' }, label: '' },
      ],
      [
        { points: [[2, 0], [6, 0]] },
        { points: [[10, 0], [12, 0]] },
        { points: [[15, -2], [20, -2]] },
      ],
    ),
  };
}

export function cmosNot(): Circuit {
  return {
    version: 1,
    title: 'NOT (CMOS)',
    engine: 'switch',
    ...two(
      [
        { id: 'A', type: 'port', x: 3, y: 4, params: { name: 'A', dir: 'in' }, label: '' },
        { id: 'P1', type: 'pmos', x: 6, y: 0 },
        { id: 'N1', type: 'nmos', x: 6, y: 6 },
        { id: 'VDD', type: 'rail', x: 9, y: -2 },
        { id: 'GND', type: 'ground', x: 9, y: 8 },
        { id: 'Y', type: 'port', x: 12, y: 3, flip: true, params: { name: 'Y', dir: 'out' }, label: '' },
      ],
      [
        { points: [[3, 4], [6, 4]] },
        { points: [[6, 0], [6, 6]] },
        { points: [[9, 2], [9, 4]] },
        { points: [[9, 3], [12, 3]] },
      ],
    ),
  };
}

/** Two-input CMOS NAND: parallel pMOS above, series nMOS below. */
export function cmosNand(): Circuit {
  return {
    version: 1,
    title: 'NAND (CMOS)',
    engine: 'switch',
    ...two(
      [
        { id: 'A', type: 'port', x: 2, y: 0, params: { name: 'A', dir: 'in' }, label: '' },
        { id: 'B', type: 'port', x: 2, y: 12, params: { name: 'B', dir: 'in' }, label: '' },
        { id: 'P1', type: 'pmos', x: 6, y: 0 },
        { id: 'P2', type: 'pmos', x: 14, y: 0 },
        { id: 'N1', type: 'nmos', x: 12, y: 8 },
        { id: 'N2', type: 'nmos', x: 12, y: 12 },
        { id: 'VDD', type: 'rail', x: 13, y: -4 },
        { id: 'GND', type: 'ground', x: 15, y: 14 },
        { id: 'Y', type: 'port', x: 22, y: 4, flip: true, params: { name: 'Y', dir: 'out' }, label: '' },
      ],
      [
        { points: [[2, 0], [6, 0]] },
        { points: [[4, 0], [4, 8], [12, 8]] },
        { points: [[2, 12], [12, 12]] },
        { points: [[11, 12], [11, 0], [14, 0]] },
        { points: [[9, -2], [17, -2]] },
        { points: [[13, -4], [13, -2]] },
        { points: [[9, 2], [9, 4], [17, 4], [17, 2]] },
        { points: [[15, 6], [15, 4]] },
        { points: [[17, 4], [22, 4]] },
      ],
    ),
  };
}

/** Two-input CMOS NOR: series pMOS above, parallel nMOS below. */
export function cmosNor(): Circuit {
  return {
    version: 1,
    title: 'NOR (CMOS)',
    engine: 'switch',
    ...two(
      [
        { id: 'A', type: 'port', x: 2, y: 0, params: { name: 'A', dir: 'in' }, label: '' },
        { id: 'B', type: 'port', x: 2, y: 4, params: { name: 'B', dir: 'in' }, label: '' },
        { id: 'P1', type: 'pmos', x: 12, y: 0 },
        { id: 'P2', type: 'pmos', x: 12, y: 4 },
        { id: 'N1', type: 'nmos', x: 6, y: 10 },
        { id: 'N2', type: 'nmos', x: 14, y: 10 },
        { id: 'VDD', type: 'rail', x: 15, y: -4 },
        { id: 'GND', type: 'ground', x: 13, y: 14 },
        { id: 'Y', type: 'port', x: 22, y: 8, flip: true, params: { name: 'Y', dir: 'out' }, label: '' },
      ],
      [
        { points: [[2, 0], [12, 0]] },
        { points: [[4, 0], [4, 10], [6, 10]] },
        { points: [[2, 4], [12, 4]] },
        { points: [[10, 4], [10, 10], [14, 10]] },
        { points: [[15, -4], [15, -2]] },
        { points: [[15, 6], [15, 8]] },
        { points: [[9, 8], [17, 8]] },
        { points: [[17, 8], [22, 8]] },
        { points: [[9, 12], [17, 12]] },
        { points: [[13, 12], [13, 14]] },
      ],
    ),
  };
}

/** A single behavioural gate wearing the part's pins (the stand-in for transistor-level parts). */
export function behaviouralGate(type: 'not' | 'nand' | 'nor', ctx: Ctx): Circuit {
  const b = B(`${type.toUpperCase()}`, ctx);
  const ins = type === 'not' ? ['A'] : ['A', 'B'];
  ins.forEach((n) => b.input(n));
  b.gate(type, ins, 'Y');
  b.output('Y');
  return b.build();
}

// ── Gates from gates ───────────────────────────────────────────────────────────

export function and2(ctx: Ctx): Circuit {
  const b = B('AND', ctx);
  b.input('A');
  b.input('B');
  const n = b.net();
  b.part('nand', { A: 'A', B: 'B', Y: n });
  b.part('not', { A: n, Y: 'Y' });
  b.output('Y');
  return b.build();
}
export function or2(ctx: Ctx): Circuit {
  const b = B('OR', ctx);
  b.input('A');
  b.input('B');
  const n = b.net();
  b.part('nor', { A: 'A', B: 'B', Y: n });
  b.part('not', { A: n, Y: 'Y' });
  b.output('Y');
  return b.build();
}
/** XOR from four NANDs: the classic. */
function xorNets(b: CircuitBuilder, a: string, c: string, out: string): void {
  const m = b.net();
  const p = b.net();
  const q = b.net();
  b.part('nand', { A: a, B: c, Y: m });
  b.part('nand', { A: a, B: m, Y: p });
  b.part('nand', { A: m, B: c, Y: q });
  b.part('nand', { A: p, B: q, Y: out });
}
export function xor2(ctx: Ctx): Circuit {
  const b = B('XOR', ctx);
  b.input('A');
  b.input('B');
  xorNets(b, 'A', 'B', 'Y');
  b.output('Y');
  return b.build();
}
export function xnor2(ctx: Ctx): Circuit {
  const b = B('XNOR', ctx);
  b.input('A');
  b.input('B');
  const x = b.net();
  b.part('xor', { A: 'A', B: 'B', Y: x });
  b.part('not', { A: x, Y: 'Y' });
  b.output('Y');
  return b.build();
}
export function tristate(ctx: Ctx): Circuit {
  const b = B('Tri-state buffer', ctx);
  b.input('A');
  b.input('EN');
  b.comp('tristate', { A: 'A', EN: 'EN', Y: 'Y' });
  b.output('Y');
  return b.build();
}

// ── Building blocks ────────────────────────────────────────────────────────────

/** Y = D0·S̄ + D1·S: two ANDs, an OR and an inverter, from the parts before it. */
function mux2Nets(b: CircuitBuilder, d0: string, d1: string, s: string, out: string): void {
  const ns = b.net();
  const p = b.net();
  const q = b.net();
  b.part('not', { A: s, Y: ns });
  b.part('and', { A: d0, B: ns, Y: p });
  b.part('and', { A: d1, B: s, Y: q });
  b.part('or', { A: p, B: q, Y: out });
}
export function mux2(ctx: Ctx): Circuit {
  const b = B('MUX2', ctx);
  b.input('D0');
  b.input('D1');
  b.input('S');
  mux2Nets(b, 'D0', 'D1', 'S', 'Y');
  b.output('Y');
  return b.build();
}
export function mux4(ctx: Ctx): Circuit {
  const b = B('MUX4', ctx);
  bits('D', 4).forEach((n) => b.input(n));
  b.input('S0');
  b.input('S1');
  const lo = b.net();
  const hi = b.net();
  b.part('mux2', { D0: 'D0', D1: 'D1', S: 'S0', Y: lo });
  b.part('mux2', { D0: 'D2', D1: 'D3', S: 'S0', Y: hi });
  b.part('mux2', { D0: lo, D1: hi, S: 'S1', Y: 'Y' });
  b.output('Y');
  return b.build();
}
export function mux8(ctx: Ctx): Circuit {
  const b = B('MUX8', ctx);
  bits('D', 8).forEach((n) => b.input(n));
  bits('S', 3).forEach((n) => b.input(n));
  const lo = b.net();
  const hi = b.net();
  b.part('mux4', { D0: 'D0', D1: 'D1', D2: 'D2', D3: 'D3', S0: 'S0', S1: 'S1', Y: lo });
  b.part('mux4', { D0: 'D4', D1: 'D5', D2: 'D6', D3: 'D7', S0: 'S0', S1: 'S1', Y: hi });
  b.part('mux2', { D0: lo, D1: hi, S: 'S2', Y: 'Y' });
  b.output('Y');
  return b.build();
}

/** A decoder: one AND gate per output, fed by the inputs and their inverses. */
function decoder(title: string, n: number, ctx: Ctx): Circuit {
  const b = B(title, ctx);
  const a = bits('A', n).map((x) => b.input(x));
  b.input('EN');
  const inv = a.map((x) => b.gate('not', [x], `${x}_n`));
  for (let y = 0; y < 1 << n; y++) b.gate('and', [...a.map((x, i) => ((y >> i) & 1 ? x : inv[i]!)), 'EN'], `Y${y}`);
  for (let y = 0; y < 1 << n; y++) b.output(`Y${y}`);
  return b.build();
}
export const dec2to4 = (ctx: Ctx) => decoder('DEC 2→4', 2, ctx);
export const dec3to8 = (ctx: Ctx) => decoder('DEC 3→8', 3, ctx);

/** Segments a–g (a = bit 0) for the hexadecimal digits 0–F. */
export const SEG7 = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];
export const SEG_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
export function seg7(ctx: Ctx): Circuit {
  const b = B('7-segment decoder', ctx);
  const d = bits('D', 4).map((n) => b.input(n));
  sop(
    b,
    d,
    SEG_NAMES.map((name, s) => ({ name, minterms: SEG7.flatMap((v, digit) => ((v >> s) & 1 ? [digit] : [])) })),
  );
  return b.build();
}

export function comparator(ctx: Ctx): Circuit {
  const b = B('Comparator', ctx);
  const A = bits('A', 4).map((n) => b.input(n));
  const Bv = bits('B', 4).map((n) => b.input(n));
  const eq = A.map((a, i) => {
    b.part('xnor', { A: a, B: Bv[i]!, Y: `eq${i}` });
    return `eq${i}`;
  });
  const gt = A.map((a, i) => b.gate('and', [a, b.gate('not', [Bv[i]!])], `gt${i}`));
  const lt = A.map((a, i) => b.gate('and', [b.gate('not', [a]), Bv[i]!], `lt${i}`));
  // A > B when, from the top bit down, all higher bits are equal and this bit is greater.
  const chain = (bit: string[]) => {
    const terms: string[] = [];
    for (let i = 3; i >= 0; i--) terms.push(tree(b, 'and', [...eq.slice(i + 1), bit[i]!]));
    return tree(b, 'or', terms);
  };
  b.gate('buffer', [chain(gt)], 'GT');
  b.gate('buffer', [chain(lt)], 'LT');
  tree(b, 'and', eq, 'EQ');
  b.output('EQ');
  b.output('LT');
  b.output('GT');
  return b.build();
}

// ── Arithmetic ─────────────────────────────────────────────────────────────────

export function halfAdder(ctx: Ctx): Circuit {
  const b = B('Half adder', ctx);
  b.input('A');
  b.input('B');
  b.part('xor', { A: 'A', B: 'B', Y: 'S' });
  b.part('and', { A: 'A', B: 'B', Y: 'C' });
  b.output('S');
  b.output('C');
  return b.build();
}
export function fullAdder(ctx: Ctx): Circuit {
  const b = B('Full adder', ctx);
  b.input('A');
  b.input('B');
  b.input('CIN');
  const s1 = b.net();
  const c1 = b.net();
  const c2 = b.net();
  b.part('half-adder', { A: 'A', B: 'B', S: s1, C: c1 });
  b.part('half-adder', { A: s1, B: 'CIN', S: 'S', C: c2 });
  b.part('or', { A: c1, B: c2, Y: 'COUT' });
  b.output('S');
  b.output('COUT');
  return b.build();
}
export function adder8(ctx: Ctx): Circuit {
  const b = B('8-bit adder/subtractor', ctx);
  const A = bits('A', 8).map((n) => b.input(n));
  const Bv = bits('B', 8).map((n) => b.input(n));
  b.input('SUB');
  let carry = 'SUB';
  for (let i = 0; i < 8; i++) {
    const xb = b.net();
    b.part('xor', { A: Bv[i]!, B: 'SUB', Y: xb });
    const cout = i === 7 ? 'COUT' : b.net('c');
    b.part('full-adder', { A: A[i]!, B: xb, CIN: carry, S: `S${i}`, COUT: cout });
    carry = cout;
  }
  bits('S', 8).forEach((n) => b.output(n));
  b.output('COUT');
  return b.build();
}
export function shifter(ctx: Ctx): Circuit {
  const b = B('Shifter', ctx);
  const D = bits('D', 8).map((n) => b.input(n));
  bits('SH', 3).forEach((n) => b.input(n));
  b.input('DIR');
  const zero = b.constant(0, 'zero');
  // Right shifts are left shifts of the bit-reversed word.
  let x = D.map((d, i) => {
    const out = b.net();
    b.part('mux2', { D0: d, D1: D[7 - i]!, S: 'DIR', Y: out });
    return out;
  });
  for (let k = 0; k < 3; k++) {
    const s = 1 << k;
    x = x.map((cur, i) => {
      const out = b.net();
      b.part('mux2', { D0: cur, D1: i - s >= 0 ? x[i - s]! : zero, S: `SH${k}`, Y: out });
      return out;
    });
  }
  x.forEach((cur, i) => b.part('mux2', { D0: cur, D1: x[7 - i]!, S: 'DIR', Y: `Y${i}` }));
  bits('Y', 8).forEach((n) => b.output(n));
  return b.build();
}

// ── Latches, flip-flops and registers ─────────────────────────────────────────

export function srLatch(ctx: Ctx): Circuit {
  const b = B('SR latch', ctx);
  b.input('S');
  b.input('R');
  b.part('nor', { A: 'R', B: 'Qn', Y: 'Q' });
  b.part('nor', { A: 'S', B: 'Q', Y: 'Qn' });
  b.output('Q');
  b.output('Qn');
  return b.build();
}
export function dLatch(ctx: Ctx): Circuit {
  const b = B('D latch', ctx);
  b.input('D');
  b.input('EN');
  const nd = b.net();
  b.part('not', { A: 'D', Y: nd });
  b.part('nand', { A: 'D', B: 'EN', Y: 's_n' });
  b.part('nand', { A: nd, B: 'EN', Y: 'r_n' });
  b.part('nand', { A: 's_n', B: 'Qn', Y: 'Q' });
  b.part('nand', { A: 'r_n', B: 'Q', Y: 'Qn' });
  b.output('Q');
  b.output('Qn');
  return b.build();
}
/** Master–slave: the master latch is open while the clock is low, the slave while it is high. */
export function dff(ctx: Ctx): Circuit {
  const b = B('D flip-flop', ctx);
  b.input('D');
  b.input('CLK');
  b.part('not', { A: 'CLK', Y: 'CLK_n' });
  b.part('d-latch', { D: 'D', EN: 'CLK_n', Q: 'm', Qn: b.net('mn') });
  b.part('d-latch', { D: 'm', EN: 'CLK', Q: 'Q', Qn: 'Qn' });
  b.output('Q');
  b.output('Qn');
  return b.build();
}

/** D of each bit for a register: hold, load or clear (all synchronous). */
export function register(ctx: Ctx): Circuit {
  const b = B('Register', ctx);
  const D = bits('D', 8).map((n) => b.input(n));
  b.input('CLK');
  b.input('EN');
  b.input('CLR');
  b.part('not', { A: 'CLR', Y: 'CLR_n' });
  D.forEach((d, i) => {
    const m = b.net();
    const nx = b.net();
    b.part('mux2', { D0: `Q${i}`, D1: d, S: 'EN', Y: m });
    b.part('and', { A: m, B: 'CLR_n', Y: nx });
    b.part('d-flip-flop', { D: nx, CLK: 'CLK', Q: `Q${i}`, Qn: b.net('qn') });
  });
  bits('Q', 8).forEach((n) => b.output(n));
  return b.build();
}

/** Synchronous up-counter with load and clear: an incrementer of half adders in front of the flip-flops. */
export function counter(ctx: Ctx): Circuit {
  const b = B('Counter', ctx);
  b.input('CLK');
  b.input('EN');
  b.input('CLR');
  b.input('LOAD');
  const D = bits('D', 8).map((n) => b.input(n));
  b.part('not', { A: 'CLR', Y: 'CLR_n' });
  let carry = 'EN';
  D.forEach((d, i) => {
    const inc = b.net();
    const next = b.net('c');
    b.part('half-adder', { A: `Q${i}`, B: carry, S: inc, C: next });
    carry = next;
    const ld = b.net();
    const nx = b.net();
    b.part('mux2', { D0: inc, D1: d, S: 'LOAD', Y: ld });
    b.part('and', { A: ld, B: 'CLR_n', Y: nx });
    b.part('d-flip-flop', { D: nx, CLK: 'CLK', Q: `Q${i}`, Qn: b.net('qn') });
  });
  bits('Q', 8).forEach((n) => b.output(n));
  return b.build();
}

export function shiftRegister(ctx: Ctx): Circuit {
  const b = B('Shift register', ctx);
  b.input('CLK');
  b.input('SI');
  b.input('EN');
  b.input('CLR');
  b.part('not', { A: 'CLR', Y: 'CLR_n' });
  for (let i = 0; i < 8; i++) {
    const m = b.net();
    const nx = b.net();
    b.part('mux2', { D0: `Q${i}`, D1: i === 0 ? 'SI' : `Q${i - 1}`, S: 'EN', Y: m });
    b.part('and', { A: m, B: 'CLR_n', Y: nx });
    b.part('d-flip-flop', { D: nx, CLK: 'CLK', Q: `Q${i}`, Qn: b.net('qn') });
  }
  bits('Q', 8).forEach((n) => b.output(n));
  return b.build();
}

/** 8-bit Fibonacci LFSR with taps at bits 7, 5, 4 and 3 (x⁸ + x⁶ + x⁵ + x⁴ + 1); RST loads 00000001. */
export const LFSR_TAPS = 0xb8;
export function lfsr(ctx: Ctx): Circuit {
  const b = B('LFSR', ctx);
  b.input('CLK');
  b.input('RST');
  b.part('not', { A: 'RST', Y: 'RST_n' });
  const fb = b.gate('xor', [7, 5, 4, 3].map((i) => `Q${i}`), 'fb');
  for (let i = 0; i < 8; i++) {
    const nx = b.net();
    if (i === 0) {
      const t = b.net();
      b.part('and', { A: fb, B: 'RST_n', Y: t });
      b.part('or', { A: t, B: 'RST', Y: nx });
    } else b.part('and', { A: `Q${i - 1}`, B: 'RST_n', Y: nx });
    b.part('d-flip-flop', { D: nx, CLK: 'CLK', Q: `Q${i}`, Qn: b.net('qn') });
  }
  bits('Q', 8).forEach((n) => b.output(n));
  return b.build();
}

// ── Memory ─────────────────────────────────────────────────────────────────────

export function ram(ctx: Ctx): Circuit {
  const b = B('RAM 256×8', ctx);
  const A = bits('A', 8).map((n) => b.input(n));
  const DI = bits('DI', 8).map((n) => b.input(n));
  b.input('WE');
  b.input('CLK');
  b.comp('ram', { ...Object.fromEntries(A.map((n) => [n, n])), ...Object.fromEntries(DI.map((n) => [n, n])), WE: 'WE', CLK: 'CLK', ...Object.fromEntries(bits('DO', 8).map((n) => [n, n])) }, { addrBits: 8, dataBits: 8 });
  bits('DO', 8).forEach((n) => b.output(n));
  return b.build();
}

/** The words of the parts-bin ROM: n² mod 256 for n = 0 … 15. */
export const ROM_WORDS = Array.from({ length: 16 }, (_, n) => (n * n) & 255);
export function rom(ctx: Ctx): Circuit {
  const b = B('ROM 16×8', ctx);
  const A = bits('A', 4).map((n) => b.input(n));
  sop(
    b,
    A,
    bits('DO', 8).map((name, bit) => ({ name, minterms: ROM_WORDS.flatMap((w, a) => ((w >> bit) & 1 ? [a] : [])) })),
  );
  return b.build();
}

// ── The computer ───────────────────────────────────────────────────────────────

export function alu(ctx: Ctx): Circuit {
  const b = B('ALU', ctx);
  const A = bits('A', 8).map((n) => b.input(n));
  const Bv = bits('B', 8).map((n) => b.input(n));
  bits('OP', 3).forEach((n) => b.input(n));
  const zero = b.constant(0, 'zero');
  // The adder subtracts when OP0 is 1 (op 1).
  b.part('adder8', { ...Object.fromEntries(A.map((n, i) => [`A${i}`, n])), ...Object.fromEntries(Bv.map((n, i) => [`B${i}`, n])), SUB: 'OP0', ...Object.fromEntries(bits('S', 8).map((n) => [n, `sum${n.slice(1)}`])), COUT: 'cout' });
  for (let i = 0; i < 8; i++) {
    const and = b.gate('and', [A[i]!, Bv[i]!]);
    const or = b.gate('or', [A[i]!, Bv[i]!]);
    const xor = b.gate('xor', [A[i]!, Bv[i]!]);
    const shl = i === 0 ? zero : A[i - 1]!;
    const shr = i === 7 ? zero : A[i + 1]!;
    const not = b.gate('not', [A[i]!]);
    b.part('mux8', { D0: `sum${i}`, D1: `sum${i}`, D2: and, D3: or, D4: xor, D5: shl, D6: shr, D7: not, S0: 'OP0', S1: 'OP1', S2: 'OP2', Y: `Y${i}` });
  }
  const n1 = b.gate('not', ['OP1']);
  const n2 = b.gate('not', ['OP2']);
  b.gate('and', ['cout', n1, n2], 'C');
  const lo = b.gate('nor', bits('Y', 4));
  const hi = b.gate('nor', bits('Y', 8).slice(4));
  b.gate('and', [lo, hi], 'Z');
  bits('Y', 8).forEach((n) => b.output(n));
  b.output('Z');
  b.output('C');
  return b.build();
}

/** Four 8-bit registers, one write port and two read ports. */
export function registerFile(ctx: Ctx): Circuit {
  const b = B('Register file', ctx);
  const WD = bits('WD', 8).map((n) => b.input(n));
  b.input('WA0');
  b.input('WA1');
  b.input('WE');
  b.input('RA0');
  b.input('RA1');
  b.input('RB0');
  b.input('RB1');
  b.input('CLK');
  const zero = b.constant(0, 'zero');
  b.part('dec2-4', { A0: 'WA0', A1: 'WA1', EN: 'WE', Y0: 'w0', Y1: 'w1', Y2: 'w2', Y3: 'w3' });
  for (let r = 0; r < 4; r++) {
    b.part('register', { ...Object.fromEntries(WD.map((n, i) => [`D${i}`, n])), CLK: 'CLK', EN: `w${r}`, CLR: zero, ...Object.fromEntries(bits('Q', 8).map((n, i) => [n, `r${r}_${i}`])) });
  }
  for (let i = 0; i < 8; i++) {
    b.part('mux4', { D0: `r0_${i}`, D1: `r1_${i}`, D2: `r2_${i}`, D3: `r3_${i}`, S0: 'RA0', S1: 'RA1', Y: `QA${i}` });
    b.part('mux4', { D0: `r0_${i}`, D1: `r1_${i}`, D2: `r2_${i}`, D3: `r3_${i}`, S0: 'RB0', S1: 'RB1', Y: `QB${i}` });
  }
  bits('QA', 8).forEach((n) => b.output(n));
  bits('QB', 8).forEach((n) => b.output(n));
  return b.build();
}

/** Two 8-bit sources sharing one bus through tri-state buffers. */
export function bus(ctx: Ctx): Circuit {
  const b = B('Bus', ctx);
  const A = bits('A', 8).map((n) => b.input(n));
  b.input('ENA');
  const Bv = bits('B', 8).map((n) => b.input(n));
  b.input('ENB');
  for (let i = 0; i < 8; i++) {
    b.part('tri-state', { A: A[i]!, EN: 'ENA', Y: `BUS${i}` });
    b.part('tri-state', { A: Bv[i]!, EN: 'ENB', Y: `BUS${i}` });
  }
  bits('BUS', 8).forEach((n) => b.output(n));
  return b.build();
}
