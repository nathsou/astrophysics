/**
 * View-model for Appendix E: everything the reference card draws is derived from the ISA data in
 * `src/lib/sim/cpu/octet/spec.ts`, so the card cannot disagree with the assembler or the CPU.
 */
import {
  OCTET_CONDITIONS,
  OCTET_INSTRUCTIONS,
  OCTET_IO,
  OCTET_IO_REGISTERS,
  OCTET_MEMORY,
  encodeFirstByte,
  registerBits,
  type OctetFlags,
  type OctetGroup,
  type OctetInstruction,
} from '$lib/sim/cpu/octet/spec';

export type BitKind = 'op' | 'dd' | 'ss' | 'fixed' | 'ignored' | 'cond' | 'imm' | 'addr';

export interface BitCell {
  /** '0' or '1', 'd' or 's' (a register number bit), 'c' (a condition bit), 'i' or 'a'. */
  text: string;
  kind: BitKind;
}

/** The eight bits of an instruction's first byte, most significant first. */
export function firstByteCells(i: OctetInstruction, generic = false): BitCell[] {
  const cells: BitCell[] = [];
  for (let b = 7; b >= 4; b--) cells.push({ text: String((i.opcode >> (b - 4)) & 1), kind: 'op' });
  const regBits = registerBits(i);
  for (let b = 3; b >= 0; b--) {
    const m = 1 << b;
    if (generic && i.group === 'jump') cells.push({ text: 'c', kind: 'cond' });
    else if (regBits & m) cells.push({ text: b >= 2 ? 'd' : 's', kind: b >= 2 ? 'dd' : 'ss' });
    else if (i.ignored & m) cells.push({ text: '0', kind: 'ignored' });
    else cells.push({ text: String((i.fixed >> b) & 1), kind: i.group === 'jump' ? 'cond' : 'fixed' });
  }
  return cells;
}

/** The eight bits of the second byte, if there is one. */
export function secondByteCells(i: OctetInstruction): BitCell[] | undefined {
  if (i.bytes === 1) return undefined;
  const imm = i.operands.includes('imm');
  return Array.from({ length: 8 }, () => ({ text: imm ? 'i' : 'a', kind: imm ? ('imm' as const) : ('addr' as const) }));
}

/** The first byte with every register field 0: the encoding as printed on a card (e.g. RET is 0x73). */
export const canonicalByte = (i: OctetInstruction) => encodeFirstByte(i, 0, 0);

export const hex2 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');

export interface GroupInfo {
  id: OctetGroup;
  title: string;
  blurb: string;
}

export const GROUPS: GroupInfo[] = [
  { id: 'system', title: 'System', blurb: 'Stop the machine.' },
  { id: 'move', title: 'Move', blurb: 'Copy a register or load a constant.' },
  { id: 'memory', title: 'Memory', blurb: 'Load and store, by fixed address or through a register.' },
  { id: 'stack', title: 'Stack', blurb: 'Push, pop, call and return.' },
  { id: 'alu', title: 'ALU', blurb: 'Two-register arithmetic and logic. They write all four flags.' },
  { id: 'unary', title: 'One register', blurb: 'Shift, invert, increment. They write all four flags.' },
  { id: 'jump', title: 'Jump', blurb: 'One opcode, sixteen conditions (see the table of conditions).' },
];

export interface Row {
  /** What is shown: the instruction, or for jumps the one generic row `Jcc`. */
  ins: OctetInstruction;
  syntax: string;
  mnemonic: string;
  generic: boolean;
  operation: string;
  summary: string;
}

/** One row per instruction, jumps collapsed into a single `Jcc` row, grouped and in opcode order. */
export function rowsByGroup(): { group: GroupInfo; rows: Row[] }[] {
  return GROUPS.map((g) => ({
    group: g,
    rows: OCTET_INSTRUCTIONS.filter((i) => i.group === g.id && (i.group !== 'jump' || i.fixed === 0)).map((ins) => {
      const generic = ins.group === 'jump';
      return {
        ins,
        generic,
        mnemonic: generic ? 'Jcc' : ins.mnemonic,
        syntax: generic ? 'Jcc addr' : ins.syntax,
        operation: generic ? 'if cond: PC ← addr' : ins.operation,
        summary: generic ? 'Jump if the condition holds.' : ins.summary,
      };
    }),
  })).filter((g) => g.rows.length);
}

/** The cycle-by-cycle plan of an instruction: 2 fetch, 1 decode, then its steps. */
export function cyclePlan(i: OctetInstruction): { phase: 'fetch' | 'decode' | 'execute'; text: string }[] {
  return [
    { phase: 'fetch', text: 'MAR ← PC' },
    { phase: 'fetch', text: 'IR ← M[MAR]; PC ← PC + 1' },
    { phase: 'decode', text: 'decode IR' },
    ...i.steps.map((text) => ({ phase: 'execute' as const, text })),
  ];
}

/** For a set of flags, which of the sixteen condition codes would take a jump. */
export function conditionsTaken(f: OctetFlags): { code: number; mnemonic: string; taken: boolean }[] {
  return OCTET_CONDITIONS.map((c) => ({ code: c.code, mnemonic: c.mnemonic, taken: c.test(f) }));
}

export const flagsFromBits = (z: boolean, c: boolean, n: boolean, v: boolean): OctetFlags => ({ z, c, n, v });

export interface RegisterInfo {
  name: string;
  width: number;
  reset: string;
  use: string;
  visible: boolean;
}

/** The registers a program sees, and the ones only the hardware has. */
export const REGISTERS: RegisterInfo[] = [
  { name: 'R0', width: 8, reset: '0', use: 'General purpose', visible: true },
  { name: 'R1', width: 8, reset: '0', use: 'General purpose', visible: true },
  { name: 'R2', width: 8, reset: '0', use: 'General purpose', visible: true },
  { name: 'R3', width: 8, reset: '0', use: 'General purpose', visible: true },
  { name: 'PC', width: 8, reset: hex2(OCTET_MEMORY.resetPc), use: 'Address of the next instruction byte', visible: true },
  { name: 'SP', width: 8, reset: hex2(OCTET_MEMORY.resetSp), use: 'Stack pointer: the address of the last byte pushed; the stack grows down', visible: true },
  { name: 'IR', width: 8, reset: '—', use: 'Instruction register: the first byte of the instruction being executed', visible: false },
  { name: 'MAR', width: 8, reset: '—', use: 'Memory address register: the address on the memory’s address pins', visible: false },
  { name: 'A', width: 8, reset: '—', use: 'ALU operand latch, first operand', visible: false },
  { name: 'B', width: 8, reset: '—', use: 'ALU operand latch, second operand', visible: false },
  { name: 'T', width: 8, reset: '—', use: 'Temporary, used only by CALL to hold the target while the return address is pushed', visible: false },
];

export interface FlagInfo {
  name: 'Z' | 'C' | 'N' | 'V';
  title: string;
  meaning: string;
}

export const FLAGS: FlagInfo[] = [
  { name: 'Z', title: 'Zero', meaning: 'The result is 0.' },
  { name: 'C', title: 'Carry / borrow', meaning: 'ADD, INC: the carry out of bit 7. SUB, CMP: the borrow, 1 when the first operand is lower than the second (unsigned).' },
  { name: 'N', title: 'Negative', meaning: 'Bit 7 of the result.' },
  { name: 'V', title: 'Overflow', meaning: 'The result does not fit in a signed byte: the signs of the operands make the sign of the result impossible.' },
];

export interface MemoryBlock {
  id: string;
  from: number;
  to: number;
  title: string;
  detail: string;
}

/** The memory map as three blocks, in address order. */
export function memoryBlocks(): MemoryBlock[] {
  const { ramSize, ioBase } = OCTET_MEMORY;
  return [
    { id: 'ram', from: 0, to: ramSize - 1, title: 'RAM', detail: 'Program from 0x00 (where PC starts), then data. The stack grows down from 0xEF.' },
    { id: 'matrix', from: ioBase, to: OCTET_IO.MATRIX + 7, title: 'LED matrix', detail: '8 × 8 frame buffer, one byte per row; readable and writable like RAM.' },
    { id: 'io', from: OCTET_IO.LEDS, to: 0xff, title: 'I/O registers', detail: 'LEDS, SWITCHES, BUTTONS, HEX, CONSOLE, RANDOM, PWM, DAC/ADC.' },
  ];
}

export const IO_TABLE = OCTET_IO_REGISTERS;
