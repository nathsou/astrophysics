/**
 * **Octet**, the course CPU (Part V): the instruction set, encoding, timing and memory map, as
 * data. The assembler, disassembler, reference interpreter, reference card (appendix E) and, later,
 * the control-unit generator all read this file, so it is the single source of truth.
 *
 * ## Programmer's model
 *
 * - 8-bit data, 8-bit addresses, 256 bytes of unified memory (von Neumann: programs are data).
 * - Registers R0–R3 (general purpose), PC (program counter), SP (stack pointer), and the flags
 *   Z (zero), C (carry/borrow), N (negative) and V (signed overflow). Internally the datapath also
 *   has IR (instruction register), MAR (memory address register), A and B (ALU operand latches) and
 *   T (a temporary used by CALL).
 * - Reset: PC = 0x00, SP = 0xF0, R0–R3 = 0, flags clear.
 *
 * ## Encoding
 *
 * Every instruction is one byte `oooo ddss`, plus a second byte for an immediate or an address:
 *
 * - `oooo` is the opcode (16 of them);
 * - if an instruction names one register, it is in `dd`;
 * - if it names two, the first one written in assembly is in `dd` and the second in `ss`;
 * - the unary and stack groups use `ss` to choose the operation (`dd` is the register);
 * - the jump group uses all four bits `ddss` as the condition: three bits choose a condition and the
 *   lowest bit inverts it.
 *
 * Every one of the 256 byte values decodes to some instruction, so there are no illegal opcodes:
 * the bits an instruction does not use are ignored by the interpreter, and written as 0 by the
 * assembler. Only these canonical encodings are used in differential tests.
 *
 * ## Timing (the multi-cycle, single-bus microarchitecture of Chapter 22)
 *
 * Every instruction takes 2 fetch cycles (`MAR ← PC`, then `IR ← M[MAR]; PC ← PC + 1`), 1 decode
 * cycle, then 1–5 execute cycles, one bus transfer each; `steps` lists them. Totals range from 4
 * cycles (MOV) to 8 (CALL).
 *
 * ## Flags
 *
 * Only the ALU group (opcodes 8–E) writes flags, and it always writes all four. Loads, moves, stack
 * operations and jumps leave them alone, which is what lets a program test a result, then load or
 * move things, then branch on it.
 *
 * - Z = result is zero; N = bit 7 of the result.
 * - C, ADD/INC: the carry out of bit 7. C, SUB/CMP: the **borrow**, i.e. C = 1 when the unsigned
 *   first operand is lower than the second. So after `CMP a, b`, `JC` means "a < b (unsigned)".
 *   (In hardware: the adder's carry out, inverted when subtracting.)
 * - V = signed (two's-complement) overflow: the operands' signs make the result's sign impossible.
 * - Logic operations (AND, OR, XOR, NOT) clear C and V. SHL sets every flag exactly as `ADD Rd, Rd`
 *   would. SHR puts the bit shifted out in C and clears V (and so N).
 */

export type OctetOperand =
  /** A register in the `dd` field. */
  | 'rd'
  /** A register in the `ss` field. */
  | 'rs'
  /** The byte the register in `dd` points to. */
  | '[rd]'
  /** The byte the register in `ss` points to. */
  | '[rs]'
  /** An 8-bit immediate (second byte). */
  | 'imm'
  /** The byte at an address given in the second byte. */
  | '[addr]'
  /** A jump or call target (second byte). */
  | 'addr';

export type OctetGroup = 'system' | 'move' | 'memory' | 'stack' | 'alu' | 'unary' | 'jump';

export interface OctetInstruction {
  mnemonic: string;
  /** The high nibble. */
  opcode: number;
  /** Low-nibble bits fixed by this mnemonic (the sub-operation, or the jump condition). */
  fixed: number;
  /** Low-nibble bits this instruction ignores (the assembler writes 0 there). */
  ignored: number;
  operands: OctetOperand[];
  bytes: 1 | 2;
  /** Total clock cycles: 2 fetch + 1 decode + execute steps. */
  cycles: number;
  /** Flags written (always all four for the ALU group, none otherwise). */
  flags: '' | 'ZCNV';
  group: OctetGroup;
  /** Assembly syntax, e.g. `ADD Rd, Rs`. */
  syntax: string;
  /** One-line description. */
  summary: string;
  /** What it does, in register-transfer notation. */
  operation: string;
  /** The execute steps, one bus transfer per clock cycle (after fetch and decode). */
  steps: string[];
}

/** The fetch and decode cycles every instruction starts with. */
export const FETCH_STEPS = ['MAR ← PC', 'IR ← M[MAR]; PC ← PC + 1'] as const;
export const DECODE_STEPS = ['decode IR'] as const;
export const OVERHEAD_CYCLES = FETCH_STEPS.length + DECODE_STEPS.length;

type Def = Omit<OctetInstruction, 'cycles' | 'bytes' | 'flags' | 'fixed' | 'ignored'> & {
  fixed?: number;
  ignored?: number;
};

function def(d: Def): OctetInstruction {
  const bytes = d.operands.some((o) => o === 'imm' || o === '[addr]' || o === 'addr') ? 2 : 1;
  return {
    ...d,
    fixed: d.fixed ?? 0,
    ignored: d.ignored ?? 0,
    bytes,
    cycles: OVERHEAD_CYCLES + d.steps.length,
    flags: d.group === 'alu' || d.group === 'unary' ? 'ZCNV' : '',
  };
}

const ALU_OPS: [string, number, string, string][] = [
  ['ADD', 0x8, '+', 'Add'],
  ['SUB', 0x9, '−', 'Subtract'],
  ['AND', 0xa, 'AND', 'Bitwise AND'],
  ['OR', 0xb, 'OR', 'Bitwise OR'],
  ['XOR', 0xc, 'XOR', 'Bitwise exclusive OR'],
];

const UNARY_OPS: [string, number, string, string][] = [
  ['SHL', 0, 'Rd << 1', 'Shift left one bit (C ← bit 7, bit 0 ← 0)'],
  ['SHR', 1, 'Rd >> 1', 'Shift right one bit, logically (C ← bit 0, bit 7 ← 0)'],
  ['NOT', 2, 'NOT Rd', 'Invert every bit'],
  ['INC', 3, 'Rd + 1', 'Add one'],
];

export interface OctetCondition {
  /** The 4-bit condition code (the low nibble of a jump). */
  code: number;
  mnemonic: string;
  /** Other accepted spellings. */
  aliases: string[];
  /** The test, as a formula over the flags. */
  formula: string;
  /** What it means after `CMP a, b` (or in general). */
  meaning: string;
  test(f: OctetFlags): boolean;
}

export interface OctetFlags {
  z: boolean;
  c: boolean;
  n: boolean;
  v: boolean;
}

/**
 * The jump conditions. Bits 3–1 choose one of eight base conditions and bit 0 inverts it, so the
 * hardware is an 8-to-1 multiplexer and an XOR gate. (The inverse of "always" is "never", a
 * two-byte no-op, kept because the structure is simpler than the exception.)
 */
export const OCTET_CONDITIONS: OctetCondition[] = (() => {
  const base: [string, string, string, string, string, (f: OctetFlags) => boolean][] = [
    // [mnemonic, inverted mnemonic, formula, meaning, inverted meaning, test]
    ['JMP', 'JNEVER', '1', 'always', 'never (a two-byte no-op)', () => true],
    ['JZ', 'JNZ', 'Z', 'zero; after CMP: a = b', 'not zero; after CMP: a ≠ b', (f) => f.z],
    ['JC', 'JNC', 'C', 'carry/borrow; after CMP: a < b unsigned', 'no carry; after CMP: a ≥ b unsigned', (f) => f.c],
    ['JN', 'JNN', 'N', 'negative (bit 7 set)', 'not negative', (f) => f.n],
    ['JV', 'JNV', 'V', 'signed overflow', 'no signed overflow', (f) => f.v],
    ['JLT', 'JGE', 'N ⊕ V', 'after CMP: a < b signed', 'after CMP: a ≥ b signed', (f) => f.n !== f.v],
    ['JLS', 'JHI', 'C ∨ Z', 'after CMP: a ≤ b unsigned', 'after CMP: a > b unsigned', (f) => f.c || f.z],
    ['JLE', 'JGT', 'Z ∨ (N ⊕ V)', 'after CMP: a ≤ b signed', 'after CMP: a > b signed', (f) => f.z || f.n !== f.v],
  ];
  const aliases: Record<string, string[]> = { JZ: ['JEQ'], JNZ: ['JNE'], JC: ['JLO'], JNC: ['JHS'] };
  const out: OctetCondition[] = [];
  base.forEach(([m, mi, formula, meaning, meaningInv, test], i) => {
    out.push({ code: i << 1, mnemonic: m, aliases: aliases[m] ?? [], formula, meaning, test });
    out.push({
      code: (i << 1) | 1,
      mnemonic: mi,
      aliases: aliases[mi] ?? [],
      formula: formula === '1' ? '0' : `¬(${formula})`,
      meaning: meaningInv,
      test: (f) => !test(f),
    });
  });
  return out;
})();

/** The instruction set, in opcode order. */
export const OCTET_INSTRUCTIONS: OctetInstruction[] = [
  def({
    mnemonic: 'HLT',
    opcode: 0x0,
    ignored: 0xf,
    operands: [],
    group: 'system',
    syntax: 'HLT',
    summary: 'Stop the clock. Empty memory (all zeros) halts too.',
    operation: 'halt',
    steps: ['halt'],
  }),
  def({
    mnemonic: 'MOV',
    opcode: 0x1,
    operands: ['rd', 'rs'],
    group: 'move',
    syntax: 'MOV Rd, Rs',
    summary: 'Copy a register. MOV R0, R0 is the NOP.',
    operation: 'Rd ← Rs',
    steps: ['Rd ← Rs'],
  }),
  def({
    mnemonic: 'LDI',
    opcode: 0x2,
    ignored: 0x3,
    operands: ['rd', 'imm'],
    group: 'move',
    syntax: 'LDI Rd, imm',
    summary: 'Load an immediate value.',
    operation: 'Rd ← imm',
    steps: ['MAR ← PC', 'Rd ← M[MAR]; PC ← PC + 1'],
  }),
  def({
    mnemonic: 'LD',
    opcode: 0x3,
    ignored: 0x3,
    operands: ['rd', '[addr]'],
    group: 'memory',
    syntax: 'LD Rd, [addr]',
    summary: 'Load from a fixed address.',
    operation: 'Rd ← M[addr]',
    steps: ['MAR ← PC', 'MAR ← M[MAR]; PC ← PC + 1', 'Rd ← M[MAR]'],
  }),
  def({
    mnemonic: 'ST',
    opcode: 0x4,
    ignored: 0x3,
    operands: ['[addr]', 'rd'],
    group: 'memory',
    syntax: 'ST [addr], Rd',
    summary: 'Store to a fixed address.',
    operation: 'M[addr] ← Rd',
    steps: ['MAR ← PC', 'MAR ← M[MAR]; PC ← PC + 1', 'M[MAR] ← Rd'],
  }),
  def({
    mnemonic: 'LDR',
    opcode: 0x5,
    operands: ['rd', '[rs]'],
    group: 'memory',
    syntax: 'LDR Rd, [Rs]',
    summary: 'Load from the address in a register.',
    operation: 'Rd ← M[Rs]',
    steps: ['MAR ← Rs', 'Rd ← M[MAR]'],
  }),
  def({
    mnemonic: 'STR',
    opcode: 0x6,
    operands: ['[rd]', 'rs'],
    group: 'memory',
    syntax: 'STR [Rd], Rs',
    summary: 'Store to the address in a register.',
    operation: 'M[Rd] ← Rs',
    steps: ['MAR ← Rd', 'M[MAR] ← Rs'],
  }),
  def({
    mnemonic: 'PUSH',
    opcode: 0x7,
    fixed: 0b00,
    operands: ['rd'],
    group: 'stack',
    syntax: 'PUSH Rd',
    summary: 'Push a register (the stack grows down).',
    operation: 'SP ← SP − 1; M[SP] ← Rd',
    steps: ['SP ← SP − 1', 'MAR ← SP', 'M[MAR] ← Rd'],
  }),
  def({
    mnemonic: 'POP',
    opcode: 0x7,
    fixed: 0b01,
    operands: ['rd'],
    group: 'stack',
    syntax: 'POP Rd',
    summary: 'Pop into a register.',
    operation: 'Rd ← M[SP]; SP ← SP + 1',
    steps: ['MAR ← SP', 'Rd ← M[MAR]; SP ← SP + 1'],
  }),
  def({
    mnemonic: 'CALL',
    opcode: 0x7,
    fixed: 0b10,
    ignored: 0xc,
    operands: ['addr'],
    group: 'stack',
    syntax: 'CALL addr',
    summary: 'Push the return address and jump.',
    operation: 'SP ← SP − 1; M[SP] ← PC + 2; PC ← addr',
    steps: ['MAR ← PC; SP ← SP − 1', 'T ← M[MAR]; PC ← PC + 1', 'MAR ← SP', 'M[MAR] ← PC', 'PC ← T'],
  }),
  def({
    mnemonic: 'RET',
    opcode: 0x7,
    fixed: 0b11,
    ignored: 0xc,
    operands: [],
    group: 'stack',
    syntax: 'RET',
    summary: 'Return: pop the program counter.',
    operation: 'PC ← M[SP]; SP ← SP + 1',
    steps: ['MAR ← SP', 'PC ← M[MAR]; SP ← SP + 1'],
  }),
  ...ALU_OPS.map(([m, op, sym, summary]) =>
    def({
      mnemonic: m,
      opcode: op,
      operands: ['rd', 'rs'],
      group: 'alu',
      syntax: `${m} Rd, Rs`,
      summary: `${summary}.`,
      operation: `Rd ← Rd ${sym} Rs; flags`,
      steps: ['A ← Rd', 'B ← Rs', `Rd ← A ${sym} B; flags`],
    }),
  ),
  def({
    mnemonic: 'CMP',
    opcode: 0xd,
    operands: ['rd', 'rs'],
    group: 'alu',
    syntax: 'CMP Rd, Rs',
    summary: 'Compare: subtract, set the flags, keep neither.',
    operation: 'flags ← Rd − Rs',
    steps: ['A ← Rd', 'B ← Rs', 'flags ← A − B'],
  }),
  ...UNARY_OPS.map(([m, sub, expr, summary]) =>
    def({
      mnemonic: m,
      opcode: 0xe,
      fixed: sub,
      operands: ['rd'],
      group: 'unary',
      syntax: `${m} Rd`,
      summary: `${summary}.`,
      operation: `Rd ← ${expr}; flags`,
      steps: ['A ← Rd', `Rd ← ${expr.replace('Rd', 'A')}; flags`],
    }),
  ),
  ...OCTET_CONDITIONS.map((c) =>
    def({
      mnemonic: c.mnemonic,
      opcode: 0xf,
      fixed: c.code,
      operands: ['addr'],
      group: 'jump',
      syntax: `${c.mnemonic} addr`,
      summary: c.code === 0 ? 'Jump.' : `Jump if ${c.meaning}.`,
      operation: c.code === 0 ? 'PC ← addr' : `if ${c.formula}: PC ← addr`,
      steps: ['MAR ← PC', c.code === 0 ? 'PC ← M[MAR]' : `if ${c.formula}: PC ← M[MAR] else PC ← PC + 1`],
    }),
  ),
];

/** Mnemonics that are other names for an instruction (or a specific encoding of one). */
export const OCTET_ALIASES: { alias: string; expansion: string; note: string }[] = [
  { alias: 'NOP', expansion: 'MOV R0, R0', note: 'Does nothing for 4 cycles (0x10).' },
  ...OCTET_CONDITIONS.flatMap((c) =>
    c.aliases.map((a) => ({ alias: a, expansion: c.mnemonic, note: `Same encoding as ${c.mnemonic}.` })),
  ),
];

const BY_MNEMONIC = new Map(OCTET_INSTRUCTIONS.map((i) => [i.mnemonic, i]));
for (const c of OCTET_CONDITIONS) for (const a of c.aliases) BY_MNEMONIC.set(a, BY_MNEMONIC.get(c.mnemonic)!);

/** Look up an instruction by mnemonic (case-insensitive; includes the jump aliases, not NOP). */
export function instructionByMnemonic(mnemonic: string): OctetInstruction | undefined {
  return BY_MNEMONIC.get(mnemonic.toUpperCase());
}

/** The instruction a first byte executes as, whether or not the ignored bits are zero. */
export const DECODE_TABLE: OctetInstruction[] = Array.from({ length: 256 }, (_, byte) => {
  const op = byte >> 4;
  const low = byte & 0xf;
  const hit = OCTET_INSTRUCTIONS.find((i) => {
    if (i.opcode !== op) return false;
    const regBits = registerBits(i);
    const mask = 0xf & ~regBits & ~i.ignored;
    return (low & mask) === i.fixed;
  });
  if (!hit) throw new Error(`Octet spec: byte ${byte.toString(16)} decodes to nothing`);
  return hit;
});

/** Low-nibble bits an instruction's register operands occupy. */
export function registerBits(i: OctetInstruction): number {
  let bits = 0;
  for (const o of i.operands) {
    if (o === 'rd' || o === '[rd]') bits |= 0xc;
    if (o === 'rs' || o === '[rs]') bits |= 0x3;
  }
  return bits;
}

/** True if a first byte is in canonical form (its ignored bits are zero). */
export function isCanonical(byte: number): boolean {
  return (byte & DECODE_TABLE[byte & 0xff]!.ignored) === 0;
}

/** Encode the first byte of an instruction from its register numbers. */
export function encodeFirstByte(i: OctetInstruction, d = 0, s = 0): number {
  let byte = (i.opcode << 4) | i.fixed;
  for (const o of i.operands) {
    if (o === 'rd' || o === '[rd]') byte |= (d & 3) << 2;
    if (o === 'rs' || o === '[rs]') byte |= s & 3;
  }
  return byte;
}

// ---------------------------------------------------------------------------------------------
// Memory map

/** Reset values and the layout of the 256-byte address space. */
export const OCTET_MEMORY = {
  size: 256,
  /** RAM for program, data and stack: 0x00–0xEF. */
  ramSize: 0xf0,
  ioBase: 0xf0,
  resetPc: 0x00,
  /** SP starts just above RAM: the first PUSH writes 0xEF. */
  resetSp: 0xf0,
} as const;

/** I/O register addresses (also predefined as assembler symbols). */
export const OCTET_IO = {
  MATRIX: 0xf0,
  LEDS: 0xf8,
  SWITCHES: 0xf9,
  BUTTONS: 0xfa,
  HEX: 0xfb,
  CONSOLE: 0xfc,
  RANDOM: 0xfd,
  PWM: 0xfe,
  DAC: 0xff,
  ADC: 0xff,
} as const;

export interface IoRegister {
  address: string;
  name: string;
  read: string;
  write: string;
}

export const OCTET_IO_REGISTERS: IoRegister[] = [
  {
    address: '0xF0–0xF7',
    name: 'MATRIX',
    read: 'The row as last written.',
    write: '8 × 8 LED matrix frame buffer: 0xF0 is the top row, bit 7 the leftmost pixel; 1 = lit.',
  },
  { address: '0xF8', name: 'LEDS', read: 'The value last written.', write: 'The 8 LEDs; bit 7 is the leftmost.' },
  { address: '0xF9', name: 'SWITCHES', read: 'The 8 switches; 1 = on.', write: 'Ignored.' },
  {
    address: '0xFA',
    name: 'BUTTONS',
    read: 'Bits 0–3: buttons BTN0–BTN3, 1 while pressed. Bit 7: comparator, 1 when the analogue input is above the DAC output. Bits 4–6: 0.',
    write: 'Ignored.',
  },
  {
    address: '0xFB',
    name: 'HEX',
    read: 'The value last written.',
    write: 'Two hexadecimal 7-segment digits: high nibble on the left.',
  },
  {
    address: '0xFC',
    name: 'CONSOLE',
    read: 'The next typed character, or 0 if none is waiting.',
    write: 'Print a character (ASCII; 10 is a new line).',
  },
  {
    address: '0xFD',
    name: 'RANDOM',
    read: 'Steps the 8-bit LFSR (x⁸ + x⁶ + x⁵ + x⁴ + 1, period 255) and returns its new state. Reset state 0x01.',
    write: 'Seeds the LFSR (a write of 0 is ignored: 0 would stop it).',
  },
  {
    address: '0xFE',
    name: 'PWM',
    read: 'The value last written.',
    write: 'PWM duty: the output is high for n/256 of every period.',
  },
  {
    address: '0xFF',
    name: 'DAC / ADC',
    read: 'ADC: the analogue input converted to 0–255.',
    write: 'DAC: output voltage n/256 of full scale.',
  },
];

export const OCTET_MEMORY_MAP: { range: string; use: string }[] = [
  { range: '0x00–0xEF', use: 'RAM (240 bytes): the program from 0x00 (where PC starts), then data; the stack grows down from 0xEF.' },
  { range: '0xF0–0xF7', use: 'LED matrix frame buffer (readable and writable like RAM).' },
  { range: '0xF8–0xFF', use: 'I/O registers: LEDS, SWITCHES, BUTTONS, HEX, CONSOLE, RANDOM, PWM, DAC/ADC.' },
];

// ---------------------------------------------------------------------------------------------
// Flag rules (for documentation and tests)

export const OCTET_FLAG_RULES: { ops: string; z: string; c: string; n: string; v: string }[] = [
  { ops: 'ADD', z: 'r = 0', c: 'carry out of bit 7', n: 'r₇', v: 'a₇ = b₇ ≠ r₇' },
  { ops: 'SUB, CMP', z: 'r = 0', c: 'borrow: a < b (unsigned)', n: 'r₇', v: 'a₇ ≠ b₇ and r₇ ≠ a₇' },
  { ops: 'AND, OR, XOR, NOT', z: 'r = 0', c: '0', n: 'r₇', v: '0' },
  { ops: 'SHL', z: 'r = 0', c: 'a₇ (the bit shifted out)', n: 'r₇', v: 'a₇ ≠ a₆ (as ADD Rd, Rd)' },
  { ops: 'SHR', z: 'r = 0', c: 'a₀ (the bit shifted out)', n: '0', v: '0' },
  { ops: 'INC', z: 'r = 0', c: 'a = 0xFF', n: 'r₇', v: 'a = 0x7F' },
  { ops: 'all others', z: '—', c: '—', n: '—', v: '—' },
];

// ---------------------------------------------------------------------------------------------
// Reference card (appendix E)

export interface CardTable {
  columns: string[];
  rows: string[][];
}

export interface CardSection {
  id: string;
  title: string;
  /** Plain text paragraphs (may contain `code` in backticks). */
  intro?: string[];
  table?: CardTable;
  notes?: string[];
}

export interface ReferenceCard {
  title: string;
  sections: CardSection[];
}

const hex2 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');

/** The encoding of an instruction's first byte as a bit pattern, e.g. `1000 ddss`. */
export function encodingPattern(i: OctetInstruction): string {
  const bits: string[] = [];
  for (let b = 3; b >= 0; b--) bits.push(String((i.opcode >> b) & 1));
  const low: string[] = [];
  const regBits = registerBits(i);
  for (let b = 3; b >= 0; b--) {
    const m = 1 << b;
    if (regBits & m) low.push(b >= 2 ? 'd' : 's');
    else if (i.ignored & m) low.push('0');
    else low.push(String((i.fixed >> b) & 1));
  }
  const first = `${bits.join('')} ${low.join('')}`;
  if (i.bytes === 1) return first;
  const second = i.operands.includes('imm') ? 'iiiiiiii' : 'aaaaaaaa';
  return `${first}  ${second}`;
}

/** The data for appendix E: registers, encoding, instructions, conditions, flags and memory map. */
export function referenceCard(): ReferenceCard {
  const instructions = OCTET_INSTRUCTIONS.filter((i) => i.group !== 'jump' || i.fixed === 0);
  return {
    title: 'Octet reference card',
    sections: [
      {
        id: 'registers',
        title: 'Registers',
        table: {
          columns: ['Register', 'Width', 'Reset', 'Use'],
          rows: [
            ['R0–R3', '8', '0', 'General purpose'],
            ['PC', '8', '0x00', 'Address of the next instruction byte'],
            ['SP', '8', '0xF0', 'Stack pointer; points at the last byte pushed (the stack grows down)'],
            ['Z C N V', '1 each', '0', 'Flags: zero, carry/borrow, negative, signed overflow'],
          ],
        },
      },
      {
        id: 'encoding',
        title: 'Encoding',
        intro: [
          'Every instruction is one byte `oooo ddss`, plus a second byte for an immediate (`i`) or an address (`a`).',
          'One register operand goes in `dd`; with two, the first written goes in `dd` and the second in `ss`. The unary and stack groups use `ss` to choose the operation; jumps use `ddss` as the condition. Bits shown as 0 are ignored.',
        ],
      },
      {
        id: 'instructions',
        title: 'Instructions',
        table: {
          columns: ['Syntax', 'Encoding', 'Bytes', 'Cycles', 'Flags', 'Operation'],
          rows: instructions.map((i) => [
            i.group === 'jump' ? 'Jcc addr' : i.syntax,
            i.group === 'jump' ? '1111 cccc  aaaaaaaa' : encodingPattern(i),
            String(i.bytes),
            String(i.cycles),
            i.flags ? 'Z C N V' : '—',
            i.group === 'jump' ? 'if cond: PC ← addr' : i.operation,
          ]),
        },
        notes: [
          `Cycles include 2 to fetch and 1 to decode. Aliases: ${OCTET_ALIASES.map((a) => `${a.alias} = ${a.expansion}`).join(', ')}.`,
        ],
      },
      {
        id: 'conditions',
        title: 'Jump conditions (cccc)',
        table: {
          columns: ['cccc', 'Mnemonic', 'Jumps if', 'Meaning'],
          rows: OCTET_CONDITIONS.map((c) => [
            c.code.toString(2).padStart(4, '0'),
            [c.mnemonic, ...c.aliases].join(' / '),
            c.formula,
            c.meaning,
          ]),
        },
      },
      {
        id: 'flags',
        title: 'Flags (r = result, a and b = operands)',
        table: {
          columns: ['Instructions', 'Z', 'C', 'N', 'V'],
          rows: OCTET_FLAG_RULES.map((r) => [r.ops, r.z, r.c, r.n, r.v]),
        },
      },
      {
        id: 'memory',
        title: 'Memory map',
        table: { columns: ['Addresses', 'Use'], rows: OCTET_MEMORY_MAP.map((m) => [m.range, m.use]) },
      },
      {
        id: 'io',
        title: 'I/O registers',
        table: {
          columns: ['Address', 'Name', 'Read', 'Write'],
          rows: OCTET_IO_REGISTERS.map((r) => [r.address, r.name, r.read, r.write]),
        },
        notes: ['The names are predefined in the assembler: `ST [LEDS], R0`.'],
      },
      {
        id: 'assembler',
        title: 'Assembler',
        table: {
          columns: ['Syntax', 'Meaning'],
          rows: [
            ['label:', 'Name the address of the next byte'],
            ['.org addr', 'Continue assembling at addr'],
            ['.byte v, v, …', 'Bytes (numbers, characters or strings)'],
            ['.string "text"', 'The characters followed by a zero byte'],
            ['.ascii "text"', 'The characters, without a zero byte'],
            ['.space n[, v]', 'n bytes of v (default 0)'],
            ['.equ NAME, value', 'A named constant'],
            ['; comment', 'Ignored to the end of the line'],
            ['42, 0x2A, 0b101010, \'*\'', 'Numbers: decimal, hexadecimal, binary, character'],
            ['a + b − c, −x, (…), .', 'Expressions; . is the address of the current instruction'],
          ],
        },
        notes: ['Mnemonics and register names are case-insensitive; labels and constants are case-sensitive.'],
      },
    ],
  };
}

/** Render a reference card as Markdown (GitHub-flavoured tables). */
export function referenceCardMarkdown(card: ReferenceCard = referenceCard()): string {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const out: string[] = [`# ${card.title}`, ''];
  for (const s of card.sections) {
    out.push(`## ${s.title}`, '');
    for (const p of s.intro ?? []) out.push(p, '');
    if (s.table) {
      out.push(`| ${s.table.columns.map(esc).join(' | ')} |`);
      out.push(`|${s.table.columns.map(() => '---').join('|')}|`);
      for (const r of s.table.rows) out.push(`| ${r.map(esc).join(' | ')} |`);
      out.push('');
    }
    for (const n of s.notes ?? []) out.push(n, '');
  }
  return out.join('\n');
}

export { hex2 as octetHex };
