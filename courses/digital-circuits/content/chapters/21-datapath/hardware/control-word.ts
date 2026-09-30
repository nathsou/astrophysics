/**
 * The control word of Octet's datapath, and the microprogram that drives it.
 *
 * The datapath of Chapter 21 has no brain: every cycle it does exactly what 24 control lines tell it
 * to (`DATAPATH_LINES`). Chapter 22's control unit produces those lines, either with gates (hardwired)
 * or by reading them from a ROM (microcoded). Both read the *same table*, defined here from the
 * instruction set of `src/lib/sim/cpu/octet/spec.ts`: for each instruction, one micro-operation per
 * clock cycle after fetch and decode, in the notation of the spec (`steps`).
 *
 * The 24-bit **micro-instruction** that the microcode ROM stores packs the lines more tightly than the
 * datapath sees them: the seven bus drivers are a 3-bit number (so that two drivers can never be
 * enabled together), and three bits sequence the ROM itself (`end`, `disp`, `halt`).
 */
import { DECODE_TABLE, OCTET_INSTRUCTIONS, type OctetInstruction } from '$lib/sim/cpu/octet/spec';

/** Who drives the bus in a cycle. The number is the 3-bit code stored in the microcode ROM. */
export const DRIVERS = ['none', 'Rd', 'Rs', 'PC', 'SP', 'ALU', 'MEM', 'T'] as const;
export type Driver = (typeof DRIVERS)[number];

/** Datapath inputs that enable one tri-state driver of the bus, in the order of `DRIVERS[1…]`. */
export const OE_LINES = ['OE_RD', 'OE_RS', 'OE_PC', 'OE_SP', 'OE_ALU', 'OE_MEM', 'OE_T'] as const;
/** Datapath inputs that make a register listen to the bus on the next rising clock edge. */
export const LOAD_LINES = ['LD_MAR', 'LD_IR', 'LD_A', 'LD_B', 'LD_T', 'WE_R', 'LD_FLAGS'] as const;
export const COUNT_LINES = ['PC_LD', 'PC_INC', 'SP_INC', 'SP_DEC'] as const;
export const OTHER_LINES = ['MEM_WR', 'ALU_OP0', 'ALU_OP1', 'ALU_OP2', 'BSEL_A', 'BSEL_1'] as const;

/** The 24 lines a control unit drives into the datapath. */
export const DATAPATH_LINES = [...OE_LINES, ...LOAD_LINES, ...COUNT_LINES, ...OTHER_LINES] as const;
export type DatapathLine = (typeof DATAPATH_LINES)[number];
/** The datapath lines and HALT, which lights a lamp and stops the sequencer. */
export const CONTROL_LINES = [...DATAPATH_LINES, 'HALT'] as const;
export type ControlLine = (typeof CONTROL_LINES)[number];

export const LINE_HELP: Record<ControlLine, string> = {
  OE_RD: 'Put register Rd (the register named in bits 3–2 of IR) on the bus.',
  OE_RS: 'Put register Rs (bits 1–0 of IR) on the bus.',
  OE_PC: 'Put the program counter on the bus.',
  OE_SP: 'Put the stack pointer on the bus.',
  OE_ALU: 'Put the ALU’s result on the bus.',
  OE_MEM: 'Put the memory byte addressed by MAR on the bus.',
  OE_T: 'Put the temporary register T on the bus.',
  LD_MAR: 'Load the memory address register from the bus at the next clock edge.',
  LD_IR: 'Load the instruction register from the bus.',
  LD_A: 'Load ALU operand latch A from the bus.',
  LD_B: 'Load ALU operand latch B from the bus.',
  LD_T: 'Load the temporary register T from the bus.',
  WE_R: 'Write the bus into register Rd.',
  LD_FLAGS: 'Load the flags Z, C, N, V from the ALU.',
  PC_LD: 'Load the program counter from the bus.',
  PC_INC: 'Add one to the program counter.',
  SP_INC: 'Add one to the stack pointer.',
  SP_DEC: 'Subtract one from the stack pointer.',
  MEM_WR: 'Write the bus into the memory byte addressed by MAR.',
  ALU_OP0: 'ALU operation, bit 0.',
  ALU_OP1: 'ALU operation, bit 1.',
  ALU_OP2: 'ALU operation, bit 2.',
  BSEL_A: 'Feed A to the ALU’s second input instead of B (SHL is A + A).',
  BSEL_1: 'Feed the constant 1 to the ALU’s second input instead of B (INC is A + 1).',
  HALT: 'Stop the sequencer.',
};

/** ALU operations, as the 3-bit code the ALU part takes. The codes of ADD to XOR are the opcode minus 8. */
export const ALU_OPS = ['ADD', 'SUB', 'AND', 'OR', 'XOR', '–', 'SHR', 'NOT'] as const;
export type AluOp = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'SHR' | 'NOT';
export const aluCode = (op: AluOp): number => ALU_OPS.indexOf(op);

// ---------------------------------------------------------------------------------------------
// The micro-instruction word

/** Fields of a micro-instruction, low bit first. `width` is 1 unless given. */
export const WORD_FIELDS = [
  { name: 'drive', width: 3, label: 'Bus driver' },
  { name: 'ldMar', label: 'LD_MAR' },
  { name: 'ldIr', label: 'LD_IR' },
  { name: 'ldA', label: 'LD_A' },
  { name: 'ldB', label: 'LD_B' },
  { name: 'ldT', label: 'LD_T' },
  { name: 'weR', label: 'WE_R' },
  { name: 'ldFlags', label: 'LD_FLAGS' },
  { name: 'pcLd', label: 'PC_LD' },
  { name: 'pcInc', label: 'PC_INC' },
  { name: 'cj', label: 'CJ (PC_LD if the jump is taken, else PC_INC)' },
  { name: 'spInc', label: 'SP_INC' },
  { name: 'spDec', label: 'SP_DEC' },
  { name: 'memWr', label: 'MEM_WR' },
  { name: 'aluOp', width: 3, label: 'ALU operation' },
  { name: 'bselA', label: 'BSEL_A' },
  { name: 'bsel1', label: 'BSEL_1' },
  { name: 'halt', label: 'HALT' },
  { name: 'end', label: 'END (this is the last micro-step)' },
  { name: 'disp', label: 'DISP (jump to the routine for IR)' },
] as const;
export type FieldName = (typeof WORD_FIELDS)[number]['name'];
export type Fields = Record<FieldName, number>;
export const WORD_BITS = 24;

const OFFSETS = (() => {
  const out = {} as Record<FieldName, { lo: number; width: number }>;
  let lo = 0;
  for (const f of WORD_FIELDS) {
    const width = 'width' in f ? f.width : 1;
    out[f.name] = { lo, width };
    lo += width;
  }
  if (lo !== WORD_BITS) throw new Error(`control word is ${lo} bits, expected ${WORD_BITS}`);
  return out;
})();
export const fieldOffset = (name: FieldName) => OFFSETS[name];

export const ZERO_FIELDS: Readonly<Fields> = Object.fromEntries(WORD_FIELDS.map((f) => [f.name, 0])) as Fields;

export function pack(f: Partial<Fields>): number {
  let word = 0;
  for (const [name, { lo, width }] of Object.entries(OFFSETS) as [FieldName, { lo: number; width: number }][]) {
    const v = f[name] ?? 0;
    if (v < 0 || v >= 2 ** width) throw new Error(`field ${name} = ${v} does not fit in ${width} bits`);
    word += v * 2 ** lo;
  }
  return word;
}

export function unpack(word: number): Fields {
  const out = { ...ZERO_FIELDS };
  for (const [name, { lo, width }] of Object.entries(OFFSETS) as [FieldName, { lo: number; width: number }][]) {
    out[name] = Math.floor(word / 2 ** lo) % 2 ** width;
  }
  return out;
}

/**
 * The lines a micro-instruction asks for, before the control unit resolves a conditional jump: with
 * `taken` known, `CJ` becomes PC_LD (taken) or PC_INC (not taken).
 */
export function linesOf(f: Fields, taken = false): Record<ControlLine, number> {
  const line = {} as Record<ControlLine, number>;
  OE_LINES.forEach((n, i) => (line[n] = f.drive === i + 1 ? 1 : 0));
  line.LD_MAR = f.ldMar;
  line.LD_IR = f.ldIr;
  line.LD_A = f.ldA;
  line.LD_B = f.ldB;
  line.LD_T = f.ldT;
  line.WE_R = f.weR;
  line.LD_FLAGS = f.ldFlags;
  line.PC_LD = f.pcLd | (f.cj && taken ? 1 : 0);
  line.PC_INC = f.pcInc | (f.cj && !taken ? 1 : 0);
  line.SP_INC = f.spInc;
  line.SP_DEC = f.spDec;
  line.MEM_WR = f.memWr;
  line.ALU_OP0 = f.aluOp & 1;
  line.ALU_OP1 = (f.aluOp >> 1) & 1;
  line.ALU_OP2 = (f.aluOp >> 2) & 1;
  line.BSEL_A = f.bselA;
  line.BSEL_1 = f.bsel1;
  line.HALT = f.halt;
  return line;
}

/** The names of the lines that are 1. */
export const activeLines = (lines: Record<ControlLine, number>): ControlLine[] => CONTROL_LINES.filter((n) => lines[n]);

// ---------------------------------------------------------------------------------------------
// The microprogram

/** One micro-operation of the notation used in the ISA spec, as fields of the micro-instruction. */
export interface MicroStep {
  /** The register transfer, as the spec writes it: `MAR ← PC`. */
  text: string;
  fields: Fields;
}

export interface Routine {
  /** `FETCH`, `DECODE`, or the mnemonic (`Jcc` for all sixteen conditional jumps). */
  name: string;
  /** The mnemonics that run this routine. */
  mnemonics: string[];
  steps: MicroStep[];
  /** ROM address of the first step. */
  start: number;
}

const f = (o: Partial<Fields>): Fields => ({ ...ZERO_FIELDS, ...o });
const D: Record<Exclude<Driver, 'none'>, number> = { Rd: 1, Rs: 2, PC: 3, SP: 4, ALU: 5, MEM: 6, T: 7 };

/** The micro-operations of one instruction (after fetch and decode), aligned with `instr.steps`. */
export function executeSteps(instr: OctetInstruction): Fields[] {
  const m = instr.mnemonic;
  const end = { end: 1 } as const;
  switch (m) {
    case 'HLT':
      return [f({ halt: 1 })];
    case 'MOV':
      return [f({ drive: D.Rs, weR: 1, ...end })];
    case 'LDI':
      return [f({ drive: D.PC, ldMar: 1 }), f({ drive: D.MEM, weR: 1, pcInc: 1, ...end })];
    case 'LD':
      return [f({ drive: D.PC, ldMar: 1 }), f({ drive: D.MEM, ldMar: 1, pcInc: 1 }), f({ drive: D.MEM, weR: 1, ...end })];
    case 'ST':
      return [f({ drive: D.PC, ldMar: 1 }), f({ drive: D.MEM, ldMar: 1, pcInc: 1 }), f({ drive: D.Rd, memWr: 1, ...end })];
    case 'LDR':
      return [f({ drive: D.Rs, ldMar: 1 }), f({ drive: D.MEM, weR: 1, ...end })];
    case 'STR':
      return [f({ drive: D.Rd, ldMar: 1 }), f({ drive: D.Rs, memWr: 1, ...end })];
    case 'PUSH':
      return [f({ spDec: 1 }), f({ drive: D.SP, ldMar: 1 }), f({ drive: D.Rd, memWr: 1, ...end })];
    case 'POP':
      return [f({ drive: D.SP, ldMar: 1 }), f({ drive: D.MEM, weR: 1, spInc: 1, ...end })];
    case 'CALL':
      return [
        f({ drive: D.PC, ldMar: 1, spDec: 1 }),
        f({ drive: D.MEM, ldT: 1, pcInc: 1 }),
        f({ drive: D.SP, ldMar: 1 }),
        f({ drive: D.PC, memWr: 1 }),
        f({ drive: D.T, pcLd: 1, ...end }),
      ];
    case 'RET':
      return [f({ drive: D.SP, ldMar: 1 }), f({ drive: D.MEM, pcLd: 1, spInc: 1, ...end })];
    case 'ADD':
    case 'SUB':
    case 'AND':
    case 'OR':
    case 'XOR':
      return [
        f({ drive: D.Rd, ldA: 1 }),
        f({ drive: D.Rs, ldB: 1 }),
        f({ drive: D.ALU, weR: 1, ldFlags: 1, aluOp: aluCode(m), ...end }),
      ];
    case 'CMP':
      return [f({ drive: D.Rd, ldA: 1 }), f({ drive: D.Rs, ldB: 1 }), f({ ldFlags: 1, aluOp: aluCode('SUB'), ...end })];
    // SHL is ADD with both operands A (the flags come out as for ADD Rd, Rd), and INC is ADD with the constant 1.
    case 'SHL':
      return [f({ drive: D.Rd, ldA: 1 }), f({ drive: D.ALU, weR: 1, ldFlags: 1, aluOp: aluCode('ADD'), bselA: 1, ...end })];
    case 'SHR':
      return [f({ drive: D.Rd, ldA: 1 }), f({ drive: D.ALU, weR: 1, ldFlags: 1, aluOp: aluCode('SHR'), ...end })];
    case 'NOT':
      return [f({ drive: D.Rd, ldA: 1 }), f({ drive: D.ALU, weR: 1, ldFlags: 1, aluOp: aluCode('NOT'), ...end })];
    case 'INC':
      return [f({ drive: D.Rd, ldA: 1 }), f({ drive: D.ALU, weR: 1, ldFlags: 1, aluOp: aluCode('ADD'), bsel1: 1, ...end })];
    default:
      // Every conditional jump: MAR ← PC, then PC ← M[MAR] if the condition holds, else PC ← PC + 1.
      if (instr.group === 'jump') return [f({ drive: D.PC, ldMar: 1 }), f({ drive: D.MEM, cj: 1, ...end })];
      throw new Error(`no microcode for ${m}`);
  }
}

/** Text of the micro-steps of one instruction: the spec's, except for the jumps, which share one routine. */
function stepTexts(instr: OctetInstruction): string[] {
  return instr.group === 'jump' ? ['MAR ← PC', 'if the condition holds: PC ← M[MAR], else PC ← PC + 1'] : instr.steps;
}

/** The mnemonic of the routine that a first byte runs. */
export const routineOfByte = (byte: number): string => {
  const i = DECODE_TABLE[byte & 0xff]!;
  return i.group === 'jump' ? 'Jcc' : i.mnemonic;
};

/** The routines in ROM order: fetch (addresses 0 and 1), decode (2), then one per instruction. */
export function buildRoutines(): Routine[] {
  const routines: Routine[] = [];
  let at = 0;
  const add = (name: string, mnemonics: string[], steps: MicroStep[]) => {
    routines.push({ name, mnemonics, steps, start: at });
    at += steps.length;
  };
  add('FETCH', [], [
    { text: 'MAR ← PC', fields: f({ drive: D.PC, ldMar: 1 }) },
    { text: 'IR ← M[MAR]; PC ← PC + 1', fields: f({ drive: D.MEM, ldIr: 1, pcInc: 1 }) },
  ]);
  add('DECODE', [], [{ text: 'decode IR', fields: f({ disp: 1 }) }]);
  const seen = new Set<string>();
  for (const instr of OCTET_INSTRUCTIONS) {
    const name = instr.group === 'jump' ? 'Jcc' : instr.mnemonic;
    if (seen.has(name)) continue;
    seen.add(name);
    const texts = stepTexts(instr);
    const steps = executeSteps(instr);
    if (texts.length !== steps.length) throw new Error(`${name}: ${steps.length} micro-steps for ${texts.length} spec steps`);
    add(
      name,
      instr.group === 'jump' ? OCTET_INSTRUCTIONS.filter((i) => i.group === 'jump').map((i) => i.mnemonic) : [name],
      steps.map((fields, i) => ({ text: texts[i]!, fields })),
    );
  }
  return routines;
}

export const ROUTINES: Routine[] = buildRoutines();
export const ROM_WORDS = ROUTINES.reduce((n, r) => n + r.steps.length, 0);
/** The ROM has 64 words: a 6-bit micro-program counter. */
export const ROM_SIZE = 64;
export const FETCH_ADDRESS = 0;

/** The routine that starts at each ROM address, or that a step belongs to. */
export function routineAt(address: number, routines: Routine[] = ROUTINES): { routine: Routine; step: number } | undefined {
  for (const r of routines) if (address >= r.start && address < r.start + r.steps.length) return { routine: r, step: address - r.start };
  return undefined;
}

/** The ROM's words, as numbers (unused words are 0). */
export function romWords(routines: Routine[] = ROUTINES): number[] {
  const words = new Array<number>(ROM_SIZE).fill(0);
  for (const r of routines) r.steps.forEach((s, i) => (words[r.start + i] = pack(s.fields)));
  return words;
}

/** The decode table of the second ROM: for each of the 256 byte values, where its routine starts. */
export function dispatchTable(routines: Routine[] = ROUTINES): number[] {
  const start = new Map(routines.map((r) => [r.name, r.start]));
  return Array.from({ length: 256 }, (_, byte) => {
    const name = routineOfByte(byte);
    const s = start.get(name);
    if (s === undefined) throw new Error(`no routine ${name} for byte ${byte}`);
    return s;
  });
}

/** Hexadecimal contents in the format of the catalog's `rom` block: words separated by commas. */
export const romContents = (words: number[]): string => words.map((w) => w.toString(16)).join(',');

/**
 * What the machine does in one cycle: the micro-step for `state` of the instruction in `ir`, as
 * datapath lines. This is the reference the gate-level control units are tested against.
 * `step` counts from 0 (fetch) through 2 (decode); the execute steps are 3 and up.
 */
export function referenceLines(step: number, ir: number, taken: boolean, routines: Routine[] = ROUTINES): Record<ControlLine, number> {
  const fetch = routines[0]!;
  if (step < 2) return linesOf(fetch.steps[step]!.fields, taken);
  if (step === 2) return linesOf(f({}), taken);
  const name = routineOfByte(ir);
  const r = routines.find((x) => x.name === name)!;
  const s = r.steps[step - 3];
  return s ? linesOf(s.fields, taken) : linesOf(f({}), taken);
}

/** Did the jump condition of a first byte (`1111 cccc`) hold, for these flags? */
export { OCTET_CONDITIONS } from '$lib/sim/cpu/octet/spec';
