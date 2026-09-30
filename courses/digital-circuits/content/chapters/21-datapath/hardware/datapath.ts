/**
 * Octet's datapath (Chapter 21), built from the parts bin's parts, as a circuit the digital engine runs.
 *
 *  - one 8-bit **bus**, `BUS0…BUS7`, with seven tri-state drivers on it (`OE_*`);
 *  - the registers that listen to it: MAR, IR, A, B, T, the register file R0–R3, the program counter
 *    (a counter that can also load), the stack pointer (a register with a ±1 adder) and the flags;
 *  - the ALU, with an input selector that lets SHL be ADD A, A and INC be ADD A, 1;
 *  - the memory interface: the RAM addressed by MAR, which drives the bus through `OE_MEM` and stores
 *    the bus on `MEM_WR`.
 *
 * Everything is controlled by the 24 `DATAPATH_LINES`, and nothing else (plus CLK, RST and `BUSWIN`, the
 * bus window: drivers can only be on while it is 1). It reports back only IR (for the control unit to
 * decode) and the flags.
 */
import { Hw, names } from './hw';
import { DATAPATH_LINES } from './control-word';

/** Nets of the flags register: FL0 = Z, FL1 = C, FL2 = N, FL3 = V. */
export const FLAG_NETS = { Z: 'FL0', C: 'FL1', N: 'FL2', V: 'FL3' } as const;

export interface DatapathOptions {
  /** `ram`: the 256-byte RAM is part of the circuit. `external`: the memory is outside, and its data arrives on `MD0…MD7`. */
  memory: 'ram' | 'external';
  /** Add an input (a logic switch, or a port) for each control line, the clock, RST and (if external) MD. */
  declareInputs?: boolean;
  /** A front panel: eight switches `SW0…SW7` that can drive the bus through an eighth driver, `OE_SW` (not part of Octet: for the explorer). */
  panel?: boolean;
}

/** The ALU of the parts bin, or its equivalent built from the simulator's blocks. */
function alu(hw: Hw, a: string[], b: string[], op: string[]): { y: string[]; z: string; c: string } {
  const y = names('ALU_Y', 8);
  if (hw.level === 'parts') {
    const pins: Record<string, string> = { Z: 'ALU_Z', C: 'ALU_C' };
    a.forEach((n, i) => (pins[`A${i}`] = n));
    b.forEach((n, i) => (pins[`B${i}`] = n));
    op.forEach((n, i) => (pins[`OP${i}`] = n));
    y.forEach((n, i) => (pins[`Y${i}`] = n));
    hw.part('alu', pins);
    return { y, z: 'ALU_Z', c: 'ALU_C' };
  }
  // The same circuit as the part's reference: an adder that subtracts when OP0 is 1, gates for the rest, a mux per bit.
  const sums = names('ALU_S', 8);
  const bx = b.map((n) => hw.xor(n, op[0]!));
  const pins: Record<string, string> = { CIN: op[0]!, COUT: 'ALU_COUT' };
  a.forEach((n, i) => (pins[`A${i}`] = n));
  bx.forEach((n, i) => (pins[`B${i}`] = n));
  sums.forEach((n, i) => (pins[`S${i}`] = n));
  hw.comp('adder', pins, { bits: 8 });
  for (let i = 0; i < 8; i++) {
    const and = hw.and([a[i]!, b[i]!]);
    const or = hw.or([a[i]!, b[i]!]);
    const xor = hw.xor(a[i]!, b[i]!);
    const shl = i === 0 ? hw.zero : a[i - 1]!;
    const shr = i === 7 ? hw.zero : a[i + 1]!;
    const not = hw.not(a[i]!);
    hw.mux8([sums[i]!, sums[i]!, and, or, xor, shl, shr, not], op, y[i]!);
  }
  const n1 = hw.not(op[1]!);
  const n2 = hw.not(op[2]!);
  hw.and(['ALU_COUT', n1, n2], 'ALU_C');
  hw.and([hw.nor(y.slice(0, 4)), hw.nor(y.slice(4))], 'ALU_Z');
  return { y, z: 'ALU_Z', c: 'ALU_C' };
}

/** Add the datapath to `hw`. Control lines, CLK and RST are nets of those names, driven by the caller (or by `declareInputs`). */
export function addDatapath(hw: Hw, o: DatapathOptions): void {
  if (o.declareInputs) {
    for (const n of DATAPATH_LINES) hw.input(n);
    hw.input('CLK');
    hw.input('RST');
    hw.input('BUSWIN', true);
    if (o.panel) hw.input('OE_SW');
    if (o.memory === 'external') names('MD', 8).forEach((n) => hw.input(n));
  }
  const clk = 'CLK';
  const rst = 'RST';
  const BUS = names('BUS', 8);

  // The registers that listen to the bus.
  const MAR = hw.reg('MAR', BUS, { clk, en: 'LD_MAR', clr: rst });
  const IR = hw.reg('IR', BUS, { clk, en: 'LD_IR', clr: rst });
  const A = hw.reg('A', BUS, { clk, en: 'LD_A', clr: rst });
  const B = hw.reg('B', BUS, { clk, en: 'LD_B', clr: rst });
  const T = hw.reg('T', BUS, { clk, en: 'LD_T', clr: rst });
  const PC = hw.counter('PC', BUS, { clk, en: 'PC_INC', load: 'PC_LD', clr: rst });

  // The stack pointer: SP + 1 or SP − 1 (B = 0000 0001 or 1111 1111) is the adder's own output; a reset loads 0xF0.
  const spSum = names('SP_S', 8);
  const spPins: Record<string, string> = { COUT: 'SP_COUT' };
  const SPQ = names('SP', 8);
  SPQ.forEach((n, i) => (spPins[`A${i}`] = n));
  for (let i = 0; i < 8; i++) spPins[`B${i}`] = i === 0 ? hw.one : 'SP_DEC';
  spSum.forEach((n, i) => (spPins[`S${i}`] = n));
  if (hw.level === 'parts') hw.part('adder8', { ...spPins, SUB: hw.zero });
  else hw.comp('adder', { ...spPins, CIN: hw.zero }, { bits: 8 });
  const nrst = hw.not(rst);
  const spD = spSum.map((s, i) => (i < 4 ? hw.and([s, nrst]) : hw.or([s, rst])));
  const spEn = hw.or(['SP_INC', 'SP_DEC', rst]);
  hw.reg('SP', spD, { clk, en: spEn, clr: hw.zero, init: 0xf0 });

  // The register file: a decoder for the write, two multiplexers per bit for the reads.
  const sel = names('RW', 4);
  hw.dec2(IR[2]!, IR[3]!, 'WE_R', sel);
  const R = [0, 1, 2, 3].map((r) => hw.reg(`R${r}_`, BUS, { clk, en: sel[r]!, clr: rst }));
  const RD = names('RD', 8);
  const RS = names('RS', 8);
  for (let i = 0; i < 8; i++) {
    const col = R.map((q) => q[i]!);
    hw.mux4(col, IR[2]!, IR[3]!, RD[i]);
    hw.mux4(col, IR[0]!, IR[1]!, RS[i]);
  }

  // The ALU's second input: B, or A (for SHL), or the constant 1 (for INC).
  const nb1 = hw.not('BSEL_1');
  const bin = B.map((n, i) => {
    const m = hw.mux2(n, A[i]!, 'BSEL_A');
    return i === 0 ? hw.or([m, 'BSEL_1']) : hw.and([m, nb1]);
  });
  const op = names('ALU_OP', 3);
  const u = alu(hw, A, bin, op);

  // Flags. Z and N come from the result; C and V depend on the operation.
  const arith = hw.and([hw.not(op[1]!), hw.not(op[2]!)]); // ADD or SUB
  const isSub = hw.and([op[0]!, arith]);
  const isShr = hw.and([op[2]!, op[1]!, hw.not(op[0]!)]);
  const c = hw.or([hw.xor(u.c, isSub), hw.and([isShr, A[0]!])]);
  // Signed overflow: the operands (with B inverted for SUB) have the same sign and the result's is different.
  const v = hw.and([arith, hw.xnor(A[7]!, hw.xor(bin[7]!, isSub)), hw.xor(u.y[7]!, A[7]!)]);
  hw.reg('FL', [u.z, c, u.y[7]!, v, hw.zero, hw.zero, hw.zero, hw.zero], { clk, en: 'LD_FLAGS', clr: rst });

  // The bus and its drivers.
  const drivers: [string[], string][] = [
    [RD, 'OE_RD'],
    [RS, 'OE_RS'],
    [PC, 'OE_PC'],
    [SPQ, 'OE_SP'],
    [u.y, 'OE_ALU'],
    [T, 'OE_T'],
  ];
  const md = names('MD', 8);
  drivers.push([md, 'OE_MEM']);
  if (o.panel) drivers.push([hw.inputs('SW', 8), 'OE_SW']);
  // A driver is on only while its OE line is 1 *and* the bus window is open, so that a driver never switches on while
  // another is still switching off (the control unit opens the window only when the OE lines have settled).
  for (const [src, en] of drivers) {
    const on = hw.and([en, 'BUSWIN']);
    src.forEach((n, i) => hw.tri(n, on, BUS[i]!));
  }
  if (o.memory === 'ram') hw.ram(MAR, BUS, 'MEM_WR', clk, md);
}
