/**
 * **RV32I**, the base integer instruction set of RISC-V (Chapter 31): the 40 instructions of the
 * unprivileged specification (version 20191213), as data, with the bit-level encoders and the
 * decoder. The assembler, disassembler, reference interpreter and random-program generator all read
 * this file.
 *
 * ## Programmer's model
 *
 * - 32 registers x0–x31 of 32 bits; x0 always reads 0 and ignores writes. ABI names: zero, ra, sp,
 *   gp, tp, t0–t2, s0/fp, s1, a0–a7, s2–s11, t3–t6.
 * - A 32-bit program counter. Every instruction is 4 bytes, little-endian, and must be 4-byte
 *   aligned (no C extension).
 * - No flags: comparisons produce a 0 or 1 in a register (`slt`) or branch directly (`blt`).
 *
 * ## Formats
 *
 * ```
 *  31        25 24  20 19  15 14  12 11        7 6      0
 * | funct7     | rs2  | rs1  |funct3| rd        | opcode |  R
 * | imm[11:0]         | rs1  |funct3| rd        | opcode |  I
 * | imm[11:5]  | rs2  | rs1  |funct3| imm[4:0]  | opcode |  S
 * | imm[12|10:5]| rs2 | rs1  |funct3| imm[4:1|11]| opcode |  B
 * | imm[31:12]                      | rd        | opcode |  U
 * | imm[20|10:1|11|19:12]           | rd        | opcode |  J
 * ```
 *
 * The sign bit of every immediate is instruction bit 31, so sign extension is the same wiring for
 * all formats. B and J immediates have no bit 0 (branch and jump targets are even; here, because
 * there is no C extension, multiples of 4 to be useful).
 *
 * ## What this file leaves out
 *
 * `FENCE.I` and the CSR instructions (Zifencei, Zicsr) are not part of RV32I since 2019. The board's
 * timer is memory-mapped (see `board.ts`) instead of a CSR. Multiplication, division and atomics
 * (M, A) are absent: the course programs multiply by shift-and-add.
 *
 * ## Timing model
 *
 * The reference multi-cycle core (Chapter 31) fetches in one cycle and executes in another; loads
 * and stores add a memory cycle, and instructions that change the PC through the adder add one
 * more. `RV32_TIMING` lists the totals; the interpreter counts them so that ISA-level and
 * gate-level runs can be compared cycle for cycle.
 */

export const REGISTER_NAMES = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6',
] as const;

const REGISTER_BY_NAME = new Map<string, number>();
REGISTER_NAMES.forEach((n, i) => {
  REGISTER_BY_NAME.set(n, i);
  REGISTER_BY_NAME.set(`x${i}`, i);
});
REGISTER_BY_NAME.set('fp', 8);

/** Register number from `x5`, `t0`, `fp`, … (case-insensitive), or undefined. */
export function parseRegister(name: string): number | undefined {
  return REGISTER_BY_NAME.get(name.toLowerCase());
}

/** The ABI name of a register (`a0`), or `x10` when `abi` is false. */
export function registerName(n: number, abi = true): string {
  return abi ? REGISTER_NAMES[n & 31]! : `x${n & 31}`;
}

export type Rv32Format = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';

export type Rv32Group = 'upper' | 'jump' | 'branch' | 'load' | 'store' | 'alu-imm' | 'alu' | 'system' | 'fence';

/** How the assembler and disassembler treat an instruction's operands. */
export type Rv32Kind =
  | 'r' // rd, rs1, rs2
  | 'i' // rd, rs1, imm12
  | 'shift' // rd, rs1, shamt
  | 'load' // rd, imm(rs1)
  | 'store' // rs2, imm(rs1)
  | 'branch' // rs1, rs2, target
  | 'lui' // rd, imm20
  | 'jal' // rd, target
  | 'jalr' // rd, imm(rs1)
  | 'fence'
  | 'none';

export interface Rv32Instruction {
  mnemonic: string;
  format: Rv32Format;
  /** The 7-bit major opcode (bits 6–0). */
  opcode: number;
  funct3?: number;
  funct7?: number;
  kind: Rv32Kind;
  group: Rv32Group;
  /** Assembly syntax. */
  syntax: string;
  summary: string;
  /** What it does, in register-transfer notation. */
  operation: string;
}

const OP_LUI = 0x37;
const OP_AUIPC = 0x17;
const OP_JAL = 0x6f;
const OP_JALR = 0x67;
const OP_BRANCH = 0x63;
const OP_LOAD = 0x03;
const OP_STORE = 0x23;
const OP_IMM = 0x13;
const OP_REG = 0x33;
const OP_FENCE = 0x0f;
const OP_SYSTEM = 0x73;

function ins(
  mnemonic: string,
  format: Rv32Format,
  opcode: number,
  funct3: number | undefined,
  funct7: number | undefined,
  kind: Rv32Kind,
  group: Rv32Group,
  syntax: string,
  summary: string,
  operation: string,
): Rv32Instruction {
  return { mnemonic, format, opcode, funct3, funct7, kind, group, syntax, summary, operation };
}

/** The 40 instructions of RV32I, in the order of the specification's opcode map. */
export const RV32I_INSTRUCTIONS: Rv32Instruction[] = [
  ins('lui', 'U', OP_LUI, undefined, undefined, 'lui', 'upper', 'lui rd, imm20', 'Load upper immediate.', 'rd ← imm20 << 12'),
  ins('auipc', 'U', OP_AUIPC, undefined, undefined, 'lui', 'upper', 'auipc rd, imm20', 'Add upper immediate to the PC.', 'rd ← pc + (imm20 << 12)'),
  ins('jal', 'J', OP_JAL, undefined, undefined, 'jal', 'jump', 'jal rd, target', 'Jump and link.', 'rd ← pc + 4; pc ← pc + offset'),
  ins('jalr', 'I', OP_JALR, 0, undefined, 'jalr', 'jump', 'jalr rd, imm(rs1)', 'Jump and link register (the lowest bit of the target is cleared).', 't ← pc + 4; pc ← (rs1 + imm) & ~1; rd ← t'),
  ins('beq', 'B', OP_BRANCH, 0, undefined, 'branch', 'branch', 'beq rs1, rs2, target', 'Branch if equal.', 'if rs1 = rs2: pc ← pc + offset'),
  ins('bne', 'B', OP_BRANCH, 1, undefined, 'branch', 'branch', 'bne rs1, rs2, target', 'Branch if not equal.', 'if rs1 ≠ rs2: pc ← pc + offset'),
  ins('blt', 'B', OP_BRANCH, 4, undefined, 'branch', 'branch', 'blt rs1, rs2, target', 'Branch if less than (signed).', 'if rs1 < rs2 (signed): pc ← pc + offset'),
  ins('bge', 'B', OP_BRANCH, 5, undefined, 'branch', 'branch', 'bge rs1, rs2, target', 'Branch if greater than or equal (signed).', 'if rs1 ≥ rs2 (signed): pc ← pc + offset'),
  ins('bltu', 'B', OP_BRANCH, 6, undefined, 'branch', 'branch', 'bltu rs1, rs2, target', 'Branch if less than (unsigned).', 'if rs1 < rs2 (unsigned): pc ← pc + offset'),
  ins('bgeu', 'B', OP_BRANCH, 7, undefined, 'branch', 'branch', 'bgeu rs1, rs2, target', 'Branch if greater than or equal (unsigned).', 'if rs1 ≥ rs2 (unsigned): pc ← pc + offset'),
  ins('lb', 'I', OP_LOAD, 0, undefined, 'load', 'load', 'lb rd, imm(rs1)', 'Load a byte, sign-extended.', 'rd ← sext(M8[rs1 + imm])'),
  ins('lh', 'I', OP_LOAD, 1, undefined, 'load', 'load', 'lh rd, imm(rs1)', 'Load a halfword, sign-extended.', 'rd ← sext(M16[rs1 + imm])'),
  ins('lw', 'I', OP_LOAD, 2, undefined, 'load', 'load', 'lw rd, imm(rs1)', 'Load a word.', 'rd ← M32[rs1 + imm]'),
  ins('lbu', 'I', OP_LOAD, 4, undefined, 'load', 'load', 'lbu rd, imm(rs1)', 'Load a byte, zero-extended.', 'rd ← zext(M8[rs1 + imm])'),
  ins('lhu', 'I', OP_LOAD, 5, undefined, 'load', 'load', 'lhu rd, imm(rs1)', 'Load a halfword, zero-extended.', 'rd ← zext(M16[rs1 + imm])'),
  ins('sb', 'S', OP_STORE, 0, undefined, 'store', 'store', 'sb rs2, imm(rs1)', 'Store a byte.', 'M8[rs1 + imm] ← rs2[7:0]'),
  ins('sh', 'S', OP_STORE, 1, undefined, 'store', 'store', 'sh rs2, imm(rs1)', 'Store a halfword.', 'M16[rs1 + imm] ← rs2[15:0]'),
  ins('sw', 'S', OP_STORE, 2, undefined, 'store', 'store', 'sw rs2, imm(rs1)', 'Store a word.', 'M32[rs1 + imm] ← rs2'),
  ins('addi', 'I', OP_IMM, 0, undefined, 'i', 'alu-imm', 'addi rd, rs1, imm', 'Add an immediate.', 'rd ← rs1 + imm'),
  ins('slti', 'I', OP_IMM, 2, undefined, 'i', 'alu-imm', 'slti rd, rs1, imm', 'Set if less than an immediate (signed).', 'rd ← (rs1 < imm signed) ? 1 : 0'),
  ins('sltiu', 'I', OP_IMM, 3, undefined, 'i', 'alu-imm', 'sltiu rd, rs1, imm', 'Set if less than an immediate (unsigned; the immediate is sign-extended first).', 'rd ← (rs1 < imm unsigned) ? 1 : 0'),
  ins('xori', 'I', OP_IMM, 4, undefined, 'i', 'alu-imm', 'xori rd, rs1, imm', 'Exclusive OR with an immediate.', 'rd ← rs1 ⊕ imm'),
  ins('ori', 'I', OP_IMM, 6, undefined, 'i', 'alu-imm', 'ori rd, rs1, imm', 'OR with an immediate.', 'rd ← rs1 | imm'),
  ins('andi', 'I', OP_IMM, 7, undefined, 'i', 'alu-imm', 'andi rd, rs1, imm', 'AND with an immediate.', 'rd ← rs1 & imm'),
  ins('slli', 'I', OP_IMM, 1, 0x00, 'shift', 'alu-imm', 'slli rd, rs1, shamt', 'Shift left logical by a constant.', 'rd ← rs1 << shamt'),
  ins('srli', 'I', OP_IMM, 5, 0x00, 'shift', 'alu-imm', 'srli rd, rs1, shamt', 'Shift right logical by a constant.', 'rd ← rs1 >>u shamt'),
  ins('srai', 'I', OP_IMM, 5, 0x20, 'shift', 'alu-imm', 'srai rd, rs1, shamt', 'Shift right arithmetic by a constant.', 'rd ← rs1 >>s shamt'),
  ins('add', 'R', OP_REG, 0, 0x00, 'r', 'alu', 'add rd, rs1, rs2', 'Add.', 'rd ← rs1 + rs2'),
  ins('sub', 'R', OP_REG, 0, 0x20, 'r', 'alu', 'sub rd, rs1, rs2', 'Subtract.', 'rd ← rs1 − rs2'),
  ins('sll', 'R', OP_REG, 1, 0x00, 'r', 'alu', 'sll rd, rs1, rs2', 'Shift left logical (by rs2[4:0]).', 'rd ← rs1 << rs2[4:0]'),
  ins('slt', 'R', OP_REG, 2, 0x00, 'r', 'alu', 'slt rd, rs1, rs2', 'Set if less than (signed).', 'rd ← (rs1 < rs2 signed) ? 1 : 0'),
  ins('sltu', 'R', OP_REG, 3, 0x00, 'r', 'alu', 'sltu rd, rs1, rs2', 'Set if less than (unsigned).', 'rd ← (rs1 < rs2 unsigned) ? 1 : 0'),
  ins('xor', 'R', OP_REG, 4, 0x00, 'r', 'alu', 'xor rd, rs1, rs2', 'Exclusive OR.', 'rd ← rs1 ⊕ rs2'),
  ins('srl', 'R', OP_REG, 5, 0x00, 'r', 'alu', 'srl rd, rs1, rs2', 'Shift right logical (by rs2[4:0]).', 'rd ← rs1 >>u rs2[4:0]'),
  ins('sra', 'R', OP_REG, 5, 0x20, 'r', 'alu', 'sra rd, rs1, rs2', 'Shift right arithmetic (by rs2[4:0]).', 'rd ← rs1 >>s rs2[4:0]'),
  ins('or', 'R', OP_REG, 6, 0x00, 'r', 'alu', 'or rd, rs1, rs2', 'OR.', 'rd ← rs1 | rs2'),
  ins('and', 'R', OP_REG, 7, 0x00, 'r', 'alu', 'and rd, rs1, rs2', 'AND.', 'rd ← rs1 & rs2'),
  ins('fence', 'I', OP_FENCE, 0, undefined, 'fence', 'fence', 'fence [pred, succ]', 'Order memory accesses (a no-op here: one hart, no caches).', 'nothing'),
  ins('ecall', 'I', OP_SYSTEM, 0, undefined, 'none', 'system', 'ecall', 'Environment call: a request to the environment (reported as a trap).', 'trap (ecall)'),
  ins('ebreak', 'I', OP_SYSTEM, 0, undefined, 'none', 'system', 'ebreak', 'Breakpoint (reported as a trap; the course programs use it to stop).', 'trap (breakpoint)'),
];

const BY_MNEMONIC = new Map(RV32I_INSTRUCTIONS.map((i) => [i.mnemonic, i]));

export function instructionByMnemonic(mnemonic: string): Rv32Instruction | undefined {
  return BY_MNEMONIC.get(mnemonic.toLowerCase());
}

/** Fixed words: `ecall` and `ebreak` are I-format with everything else zero. */
export const ECALL_WORD = 0x00000073;
export const EBREAK_WORD = 0x00100073;
/** `fence iorw, iorw`. */
export const FENCE_WORD = 0x0ff0000f;
export const NOP_WORD = 0x00000013;

// ---------------------------------------------------------------------------------------------
// Immediates

/** Sign-extend the low `bits` bits of `v`. */
export function signExtend(v: number, bits: number): number {
  const s = 32 - bits;
  return (v << s) >> s;
}

/** The 32-bit two's-complement reading of an integer in −2³¹ … 2³²−1 (else NaN). */
export function int32(v: number): number {
  return Number.isInteger(v) && v >= -0x80000000 && v <= 0xffffffff ? v | 0 : NaN;
}

/** Does `v` fit a 12-bit signed immediate? Values are read as 32-bit numbers, so 0xFFFFFF08 is −248. */
export function fitsImm12(v: number): boolean {
  const x = int32(v);
  return x >= -2048 && x <= 2047;
}

/** `%hi`: the upper 20 bits, adjusted for the sign extension of `%lo`. */
export function hi20(v: number): number {
  return ((v + 0x800) >>> 12) & 0xfffff;
}

/** `%lo`: the low 12 bits as a signed number (−2048 … 2047). */
export function lo12(v: number): number {
  return signExtend(v & 0xfff, 12);
}

export class EncodeError extends Error {}

const need = (ok: boolean, message: string) => {
  if (!ok) throw new EncodeError(message);
};

export interface Rv32Fields {
  rd?: number;
  rs1?: number;
  rs2?: number;
  /** I, S, B, J: the signed immediate (B and J: the byte offset). U: the 20-bit field (0 … 0xFFFFF). Shifts: the shift amount. */
  imm?: number;
}

const reg = (n: number | undefined, what: string): number => {
  need(n !== undefined && Number.isInteger(n) && n >= 0 && n < 32, `${what} must be a register 0–31`);
  return n!;
};

/** Encode an instruction to its 32-bit word (unsigned). Throws `EncodeError` for a bad operand. */
export function encode(mnemonic: string, f: Rv32Fields = {}): number {
  const s = instructionByMnemonic(mnemonic);
  if (!s) throw new EncodeError(`unknown instruction '${mnemonic}'`);
  const op = s.opcode;
  const f3 = (s.funct3 ?? 0) << 12;
  switch (s.kind) {
    case 'r':
      return (((s.funct7! << 25) | (reg(f.rs2, 'rs2') << 20) | (reg(f.rs1, 'rs1') << 15) | f3 | (reg(f.rd, 'rd') << 7) | op) >>> 0);
    case 'i':
    case 'load':
    case 'jalr': {
      const imm = f.imm ?? 0;
      need(fitsImm12(imm), `immediate ${imm} does not fit in 12 bits (−2048 to 2047)`);
      return ((((imm & 0xfff) << 20) | (reg(f.rs1, 'rs1') << 15) | f3 | (reg(f.rd, 'rd') << 7) | op) >>> 0);
    }
    case 'shift': {
      const sh = f.imm ?? 0;
      need(Number.isInteger(sh) && sh >= 0 && sh <= 31, `shift amount ${sh} is outside 0–31`);
      return (((s.funct7! << 25) | (sh << 20) | (reg(f.rs1, 'rs1') << 15) | f3 | (reg(f.rd, 'rd') << 7) | op) >>> 0);
    }
    case 'store': {
      const imm = f.imm ?? 0;
      need(fitsImm12(imm), `offset ${imm} does not fit in 12 bits (−2048 to 2047)`);
      const u = imm & 0xfff;
      return ((((u >> 5) << 25) | (reg(f.rs2, 'rs2') << 20) | (reg(f.rs1, 'rs1') << 15) | f3 | ((u & 0x1f) << 7) | op) >>> 0);
    }
    case 'branch': {
      const imm = f.imm ?? 0;
      need(imm % 2 === 0, `branch offset ${imm} is odd`);
      need(imm >= -4096 && imm <= 4094, `branch offset ${imm} is out of range (−4096 to 4094 bytes)`);
      const u = imm & 0x1fff;
      return (
        (((u >> 12) << 31) |
          (((u >> 5) & 0x3f) << 25) |
          (reg(f.rs2, 'rs2') << 20) |
          (reg(f.rs1, 'rs1') << 15) |
          f3 |
          (((u >> 1) & 0xf) << 8) |
          (((u >> 11) & 1) << 7) |
          op) >>>
        0
      );
    }
    case 'lui': {
      const imm = f.imm ?? 0;
      need(Number.isInteger(imm) && imm >= 0 && imm <= 0xfffff, `immediate ${imm} does not fit in 20 bits (0 to 0xFFFFF)`);
      return (((imm << 12) | (reg(f.rd, 'rd') << 7) | op) >>> 0);
    }
    case 'jal': {
      const imm = f.imm ?? 0;
      need(imm % 2 === 0, `jump offset ${imm} is odd`);
      need(imm >= -1048576 && imm <= 1048574, `jump offset ${imm} is out of range (±1 MiB)`);
      const u = imm & 0x1fffff;
      return (
        (((u >> 20) << 31) | (((u >> 1) & 0x3ff) << 21) | (((u >> 11) & 1) << 20) | (((u >> 12) & 0xff) << 12) | (reg(f.rd, 'rd') << 7) | op) >>> 0
      );
    }
    case 'fence': {
      // imm: predecessor set in bits 7–4, successor set in bits 3–0 (i, o, r, w = 8, 4, 2, 1).
      const imm = f.imm ?? 0xff;
      need(Number.isInteger(imm) && imm >= 0 && imm <= 0xff, 'fence sets are 8 bits');
      return (((imm << 20) | OP_FENCE) >>> 0);
    }
    case 'none':
      return s.mnemonic === 'ecall' ? ECALL_WORD : EBREAK_WORD;
  }
}

export interface Rv32Decoded {
  spec: Rv32Instruction;
  rd: number;
  rs1: number;
  rs2: number;
  /**
   * The immediate as the hardware sees it, sign-extended to 32 bits: I, S: −2048…2047; B, J: the
   * byte offset; U: the upper 20 bits already shifted left by 12 (as a signed 32-bit number);
   * shifts: the shift amount.
   */
  imm: number;
  word: number;
}

/**
 * Decode a 32-bit word. Returns undefined if it is not a valid RV32I instruction: an unknown
 * opcode or function code, a shift with a non-zero upper field, or an `ecall`/`ebreak`/`fence`
 * with reserved bits set.
 */
export function decode(word: number): Rv32Decoded | undefined {
  const w = word | 0;
  const opcode = w & 0x7f;
  const rd = (w >> 7) & 31;
  const f3 = (w >> 12) & 7;
  const rs1 = (w >> 15) & 31;
  const rs2 = (w >> 20) & 31;
  const f7 = (w >>> 25) & 0x7f;
  const uw = w >>> 0;
  const found = (mnemonic: string, imm: number): Rv32Decoded => ({
    spec: BY_MNEMONIC.get(mnemonic)!,
    rd,
    rs1,
    rs2,
    imm,
    word: uw,
  });
  switch (opcode) {
    case OP_LUI:
      return found('lui', w & 0xfffff000);
    case OP_AUIPC:
      return found('auipc', w & 0xfffff000);
    case OP_JAL:
      return found('jal', immJ(w));
    case OP_JALR:
      return f3 === 0 ? found('jalr', w >> 20) : undefined;
    case OP_BRANCH: {
      const m = [ 'beq', 'bne', undefined, undefined, 'blt', 'bge', 'bltu', 'bgeu' ][f3];
      return m ? found(m, immB(w)) : undefined;
    }
    case OP_LOAD: {
      const m = ['lb', 'lh', 'lw', undefined, 'lbu', 'lhu'][f3];
      return m ? found(m, w >> 20) : undefined;
    }
    case OP_STORE: {
      const m = ['sb', 'sh', 'sw'][f3];
      return m ? found(m, immS(w)) : undefined;
    }
    case OP_IMM:
      if (f3 === 1) return f7 === 0 ? found('slli', rs2) : undefined;
      if (f3 === 5) return f7 === 0 ? found('srli', rs2) : f7 === 0x20 ? found('srai', rs2) : undefined;
      return found(['addi', '', 'slti', 'sltiu', 'xori', '', 'ori', 'andi'][f3]!, w >> 20);
    case OP_REG: {
      if (f7 === 0x00) return found(['add', 'sll', 'slt', 'sltu', 'xor', 'srl', 'or', 'and'][f3]!, 0);
      if (f7 === 0x20 && f3 === 0) return found('sub', 0);
      if (f7 === 0x20 && f3 === 5) return found('sra', 0);
      return undefined;
    }
    case OP_FENCE:
      // fm (bits 31–28), rs1, rd and funct3 are reserved: only the canonical form is accepted.
      return f3 === 0 && rd === 0 && rs1 === 0 && (uw >>> 28) === 0 ? found('fence', (w >> 20) & 0xff) : undefined;
    case OP_SYSTEM:
      if (uw === ECALL_WORD) return found('ecall', 0);
      if (uw === EBREAK_WORD) return found('ebreak', 1);
      return undefined;
    default:
      return undefined;
  }
}

/** The B-type immediate (byte offset) of a word. */
export function immB(w: number): number {
  return ((w >> 31) << 12) | (((w >> 7) & 1) << 11) | (((w >> 25) & 0x3f) << 5) | (((w >> 8) & 0xf) << 1);
}

/** The S-type immediate of a word. */
export function immS(w: number): number {
  return ((w >> 25) << 5) | ((w >> 7) & 0x1f);
}

/** The J-type immediate (byte offset) of a word. */
export function immJ(w: number): number {
  return ((w >> 31) << 20) | (w & 0xff000) | (((w >> 20) & 1) << 11) | (((w >> 21) & 0x3ff) << 1);
}

// ---------------------------------------------------------------------------------------------
// Timing

/**
 * Clock cycles per instruction of the reference multi-cycle core: fetch, execute, and the extra
 * cycles below. A model, not a measurement: the DCL core of Chapter 31 is built to match it.
 */
export const RV32_TIMING = {
  /** Register and immediate arithmetic, lui, auipc, fence, and a branch that is not taken. */
  alu: 2,
  /** Loads and stores: fetch, address, memory access. */
  load: 3,
  store: 3,
  /** A taken branch and `jal`/`jalr`: the target is computed by the adder in an extra cycle. */
  taken: 3,
  jump: 3,
  /** ecall, ebreak: reported, then the core stops. */
  system: 2,
} as const;

/** Cycles of a decoded instruction (a conditional branch: `taken` says whether it was). */
export function cyclesOf(mnemonic: string, taken = false): number {
  const s = instructionByMnemonic(mnemonic);
  switch (s?.group) {
    case 'load':
      return RV32_TIMING.load;
    case 'store':
      return RV32_TIMING.store;
    case 'jump':
      return RV32_TIMING.jump;
    case 'branch':
      return taken ? RV32_TIMING.taken : RV32_TIMING.alu;
    case 'system':
      return RV32_TIMING.system;
    default:
      return RV32_TIMING.alu;
  }
}

// ---------------------------------------------------------------------------------------------
// Pseudo-instructions (documentation; the assembler implements them)

export interface Rv32Pseudo {
  name: string;
  syntax: string;
  expansion: string;
  /** How many real instructions it becomes. */
  size: string;
}

export const RV32_PSEUDOS: Rv32Pseudo[] = [
  { name: 'nop', syntax: 'nop', expansion: 'addi x0, x0, 0', size: '1' },
  { name: 'li', syntax: 'li rd, imm', expansion: 'addi rd, x0, imm  (or  lui rd, %hi(imm); addi rd, rd, %lo(imm))', size: '1–2' },
  { name: 'la', syntax: 'la rd, symbol', expansion: 'auipc rd, hi(symbol − pc); addi rd, rd, lo(symbol − pc)', size: '2' },
  { name: 'lla', syntax: 'lla rd, symbol', expansion: 'the same as la (there is no position-independent code here)', size: '2' },
  { name: 'mv', syntax: 'mv rd, rs', expansion: 'addi rd, rs, 0', size: '1' },
  { name: 'not', syntax: 'not rd, rs', expansion: 'xori rd, rs, -1', size: '1' },
  { name: 'neg', syntax: 'neg rd, rs', expansion: 'sub rd, x0, rs', size: '1' },
  { name: 'seqz', syntax: 'seqz rd, rs', expansion: 'sltiu rd, rs, 1', size: '1' },
  { name: 'snez', syntax: 'snez rd, rs', expansion: 'sltu rd, x0, rs', size: '1' },
  { name: 'sltz', syntax: 'sltz rd, rs', expansion: 'slt rd, rs, x0', size: '1' },
  { name: 'sgtz', syntax: 'sgtz rd, rs', expansion: 'slt rd, x0, rs', size: '1' },
  { name: 'beqz', syntax: 'beqz rs, target', expansion: 'beq rs, x0, target', size: '1' },
  { name: 'bnez', syntax: 'bnez rs, target', expansion: 'bne rs, x0, target', size: '1' },
  { name: 'blez', syntax: 'blez rs, target', expansion: 'bge x0, rs, target', size: '1' },
  { name: 'bgez', syntax: 'bgez rs, target', expansion: 'bge rs, x0, target', size: '1' },
  { name: 'bltz', syntax: 'bltz rs, target', expansion: 'blt rs, x0, target', size: '1' },
  { name: 'bgtz', syntax: 'bgtz rs, target', expansion: 'blt x0, rs, target', size: '1' },
  { name: 'bgt', syntax: 'bgt rs, rt, target', expansion: 'blt rt, rs, target', size: '1' },
  { name: 'ble', syntax: 'ble rs, rt, target', expansion: 'bge rt, rs, target', size: '1' },
  { name: 'bgtu', syntax: 'bgtu rs, rt, target', expansion: 'bltu rt, rs, target', size: '1' },
  { name: 'bleu', syntax: 'bleu rs, rt, target', expansion: 'bgeu rt, rs, target', size: '1' },
  { name: 'j', syntax: 'j target', expansion: 'jal x0, target', size: '1' },
  { name: 'jal', syntax: 'jal target', expansion: 'jal ra, target', size: '1' },
  { name: 'jr', syntax: 'jr rs', expansion: 'jalr x0, 0(rs)', size: '1' },
  { name: 'jalr', syntax: 'jalr rs', expansion: 'jalr ra, 0(rs)', size: '1' },
  { name: 'ret', syntax: 'ret', expansion: 'jalr x0, 0(ra)', size: '1' },
  { name: 'call', syntax: 'call target', expansion: 'auipc ra, hi(target − pc); jalr ra, lo(target − pc)(ra)', size: '2' },
  { name: 'tail', syntax: 'tail target', expansion: 'auipc t1, hi(target − pc); jalr x0, lo(target − pc)(t1)', size: '2' },
  { name: 'lb, lh, lw, lbu, lhu', syntax: 'lw rd, symbol', expansion: 'auipc rd, hi(symbol − pc); lw rd, lo(symbol − pc)(rd)', size: '2' },
  { name: 'sb, sh, sw', syntax: 'sw rs, symbol, rt', expansion: 'auipc rt, hi(symbol − pc); sw rs, lo(symbol − pc)(rt)', size: '2' },
];
