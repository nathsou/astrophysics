/**
 * Octet's control unit (Chapter 22), in its two forms, as circuits of the same parts as the datapath.
 * Both read IR and the flags from the datapath and drive the 24 datapath control lines (plus HALT and
 * the bus window), and both work on the rising edge of the one clock:
 *
 *  - the **sequencer** (a step counter, or a micro-program counter) advances on the rising edge;
 *  - the **control lines** are pure logic of the sequencer's state, IR and the flags, so they settle
 *    during the cycle and the datapath acts on them at the *next* rising edge;
 *  - the **bus window** (`BUSWIN`) keeps the bus drivers off during the first half of the cycle,
 *    while the lines are still settling, and lets them on only in the second half. A driver never
 *    switches on while another is still switching off (Chapter 10's contention; Chapter 15's glitches).
 *
 * The two only differ in how the lines are made from (step, IR, flags):
 *
 *  - `addHardwired`: a 3-bit step counter, an AND gate for each instruction, an AND for each
 *    (instruction, step) pair, and an OR for each control line.
 *  - `addMicrocoded`: a 6-bit micro-program counter addressing a ROM of 24-bit micro-instructions,
 *    and a second ROM that maps the byte in IR to the address where its routine starts.
 */
import { Hw, names } from '../../21-datapath/hardware/hw';
import { FLAG_NETS } from '../../21-datapath/hardware/datapath';
import {
  DATAPATH_LINES,
  OE_LINES,
  ROUTINES,
  WORD_BITS,
  dispatchTable,
  fieldOffset,
  romContents,
  romWords,
  type ControlLine,
  type FieldName,
  type Fields,
  type Routine,
} from '../../21-datapath/hardware/control-word';

/** Delay of the bus window's rising edge, in nanoseconds: longer than any control line takes to settle. */
export const WINDOW_DELAY_NS = 12;

/** The jump condition circuit: eight base conditions selected by IR bits 3–1, inverted by IR bit 0. Returns the net TAKEN. */
export function addTaken(hw: Hw, ir: string[], out = 'TAKEN'): string {
  const { Z, C, N, V } = FLAG_NETS;
  const nv = hw.xor(N, V);
  const base = [hw.one, Z, C, N, V, nv, hw.or([C, Z]), hw.or([Z, nv])];
  const sel = hw.mux8(base, [ir[1]!, ir[2]!, ir[3]!]);
  return hw.xor(sel, ir[0]!, out);
}

/**
 * The bus window: high in the second half of the cycle (CLK low), but only after a delay, and it falls as soon as
 * the clock rises. `BUSWIN = CLKN · delayed(CLKN)`.
 */
export function addBusWindow(hw: Hw): void {
  hw.not('CLK', 'CLKN');
  hw.comp('buffer', { A: 'CLKN', Y: 'CLKN_LATE' }, { delay: WINDOW_DELAY_NS });
  hw.and(['CLKN', 'CLKN_LATE'], 'BUSWIN');
}

/** A named net that is the OR of `ins` (a constant 0 if there are none). */
function line(hw: Hw, name: string, ins: string[]): void {
  if (ins.length === 0) hw.comp('const', { Y: name }, { value: 0 });
  else if (ins.length === 1) hw.buffer(ins[0]!, name);
  else hw.or(ins, name);
}

/** The hardwired control unit. `IR0…IR7`, the flag nets, CLK and RST must exist; the lines are nets named as in `CONTROL_LINES`. */
export function addHardwired(hw: Hw, routines: Routine[] = ROUTINES): void {
  const ir = names('IR', 8);
  addBusWindow(hw);

  // The step counter: STEP0 and STEP1 fetch, STEP2 decodes, STEP3… execute. It restarts (END) after the last step.
  const T = names('TS', 3);
  const steps = names('STEP', 8);
  hw.counter('TS', names('TSD', 8).map(() => hw.zero), { clk: 'CLK', en: 'TSEN', load: 'END', clr: 'RST' });
  hw.dec3(T, hw.one, steps);

  // One AND gate per instruction, from the bits of IR and their inverses.
  const nir = ir.map((n) => hw.not(n));
  const lit = (bit: number, v: number) => (v ? ir[bit]! : nir[bit]!);
  const cube = (op: number, ss?: number): string[] => {
    const lits = [0, 1, 2, 3].map((k) => lit(4 + k, (op >> k) & 1));
    if (ss !== undefined) lits.push(lit(0, ss & 1), lit(1, (ss >> 1) & 1));
    return lits;
  };
  const CUBES: Record<string, string[]> = {
    HLT: cube(0),
    MOV: cube(1),
    LDI: cube(2),
    LD: cube(3),
    ST: cube(4),
    LDR: cube(5),
    STR: cube(6),
    PUSH: cube(7, 0),
    POP: cube(7, 1),
    CALL: cube(7, 2),
    RET: cube(7, 3),
    ADD: cube(8),
    SUB: cube(9),
    AND: cube(10),
    OR: cube(11),
    XOR: cube(12),
    CMP: cube(13),
    SHL: cube(14, 0),
    SHR: cube(14, 1),
    NOT: cube(14, 2),
    INC: cube(14, 3),
    Jcc: cube(15),
  };
  const instr = new Map<string, string>();
  for (const r of routines) if (CUBES[r.name]) instr.set(r.name, hw.and(CUBES[r.name]!, `I_${r.name}`));

  // One AND gate for every (instruction, step) that does something.
  const taken = addTaken(hw, ir);
  const ntaken = hw.not(taken);
  interface Term {
    net: string;
    fields: Fields;
  }
  const terms: Term[] = [];
  const fetch = routines.find((r) => r.name === 'FETCH')!;
  fetch.steps.forEach((s, j) => terms.push({ net: steps[j]!, fields: s.fields }));
  for (const r of routines) {
    const l = instr.get(r.name);
    if (!l) continue;
    r.steps.forEach((s, j) => terms.push({ net: hw.and([l, steps[3 + j]!]), fields: s.fields }));
  }
  const gather = (name: string, pred: (f: Fields) => boolean, cj?: string): void => {
    const ins = terms.filter((t) => pred(t.fields)).map((t) => t.net);
    // Conditional jumps: the step's own term, ANDed with TAKEN (PC_LD) or its inverse (PC_INC).
    if (cj) for (const t of terms) if (t.fields.cj) ins.push(hw.and([t.net, cj]));
    line(hw, name, ins);
  };
  const bit = (name: FieldName, k = 0) => (f: Fields) => (Math.floor(f[name] / 2 ** k) & 1) === 1;

  OE_LINES.forEach((n, i) => gather(n, (f) => f.drive === i + 1));
  gather('LD_MAR', bit('ldMar'));
  gather('LD_IR', bit('ldIr'));
  gather('LD_A', bit('ldA'));
  gather('LD_B', bit('ldB'));
  gather('LD_T', bit('ldT'));
  gather('WE_R', bit('weR'));
  gather('LD_FLAGS', bit('ldFlags'));
  gather('PC_LD', bit('pcLd'), taken);
  gather('PC_INC', bit('pcInc'), ntaken);
  gather('SP_INC', bit('spInc'));
  gather('SP_DEC', bit('spDec'));
  gather('MEM_WR', bit('memWr'));
  gather('ALU_OP0', bit('aluOp', 0));
  gather('ALU_OP1', bit('aluOp', 1));
  gather('ALU_OP2', bit('aluOp', 2));
  gather('BSEL_A', bit('bselA'));
  gather('BSEL_1', bit('bsel1'));
  gather('HALT', bit('halt'));
  gather('END', bit('end'));
  hw.not('HALT', 'TSEN');
}

/** The ROM's output net for a field bit: a control line's own name where the field is that line. */
const UW: Record<string, string> = {
  ldMar: 'LD_MAR',
  ldIr: 'LD_IR',
  ldA: 'LD_A',
  ldB: 'LD_B',
  ldT: 'LD_T',
  weR: 'WE_R',
  ldFlags: 'LD_FLAGS',
  spInc: 'SP_INC',
  spDec: 'SP_DEC',
  memWr: 'MEM_WR',
  bselA: 'BSEL_A',
  bsel1: 'BSEL_1',
  halt: 'HALT',
  pcLd: 'UPC_LD',
  pcInc: 'UPC_INC',
  cj: 'UCJ',
  end: 'UEND',
  disp: 'UDISP',
};
const uwNet = (name: FieldName, k = 0): string => {
  if (name === 'drive') return `UDRV${k}`;
  if (name === 'aluOp') return `ALU_OP${k}`;
  return UW[name]!;
};

/**
 * The microcoded control unit. `words` and `dispatch` are the contents of the two ROMs (the defaults
 * are the course's microprogram). Returns the ids of the two ROM elements, so an editor can change
 * their `contents` while the machine runs.
 */
export function addMicrocoded(hw: Hw, o: { words?: number[]; dispatch?: number[] } = {}): { rom: string; dispatch: string } {
  const ir = names('IR', 8);
  addBusWindow(hw);
  const upc = names('UPC', 6);
  const dsp = names('DSP', 8);

  // The micro-program counter counts on the clock, loads the routine's address after DECODE and 0 after END.
  const nEnd = hw.not('UEND');
  const dsel = upc.map((_, i) => hw.and([dsp[i]!, nEnd]));
  hw.counter('UPC', [...dsel, hw.zero, hw.zero], { clk: 'CLK', en: hw.not('HALT'), load: hw.or(['UDISP', 'UEND']), clr: 'RST' });

  // The 24 bits of the micro-instruction ROM: bits that are control lines are named as the lines.
  const outs: Record<string, string> = {};
  for (const f of ['drive', 'aluOp', ...Object.keys(UW)] as FieldName[]) {
    const width = fieldOffset(f).width;
    for (let k = 0; k < width; k++) outs[`DO${fieldOffset(f).lo + k}`] = uwNet(f, k);
  }
  if (Object.keys(outs).length !== WORD_BITS) throw new Error('every ROM bit needs a net');
  const rom = hw.comp(
    'rom',
    { ...Object.fromEntries(upc.map((n, i) => [`A${i}`, n])), ...outs },
    { addrBits: 6, dataBits: WORD_BITS, contents: romContents(o.words ?? romWords()) },
  );
  const dispatch = hw.comp(
    'rom',
    { ...Object.fromEntries(ir.map((n, i) => [`A${i}`, n])), ...Object.fromEntries(dsp.map((n, i) => [`DO${i}`, n])) },
    { addrBits: 8, dataBits: 8, contents: romContents(o.dispatch ?? dispatchTable()) },
  );

  // The bus driver field is a 3-bit number: decode it, so that at most one driver is ever enabled.
  const drv = names('DRV', 8);
  hw.dec3([uwNet('drive', 0), uwNet('drive', 1), uwNet('drive', 2)], hw.one, drv);
  OE_LINES.forEach((n, i) => hw.buffer(drv[i + 1]!, n));

  // A conditional jump loads the PC if the condition holds, and otherwise counts on.
  const taken = addTaken(hw, ir);
  hw.or(['UPC_LD', hw.and(['UCJ', taken])], 'PC_LD');
  hw.or(['UPC_INC', hw.and(['UCJ', hw.not(taken)])], 'PC_INC');
  return { rom, dispatch };
}

export type { ControlLine };
export { DATAPATH_LINES };
