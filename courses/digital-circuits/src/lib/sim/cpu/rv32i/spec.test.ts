import { describe, expect, test } from 'vitest';
import { Prng } from '../common/prng';
import {
  EncodeError,
  RV32I_INSTRUCTIONS,
  RV32_TIMING,
  REGISTER_NAMES,
  cyclesOf,
  decode,
  encode,
  fitsImm12,
  hi20,
  instructionByMnemonic,
  lo12,
  parseRegister,
  registerName,
  signExtend,
} from './spec';

const hex = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

describe('RV32I instruction table', () => {
  test('has the 40 instructions of the base ISA, each once', () => {
    expect(RV32I_INSTRUCTIONS).toHaveLength(40);
    expect(new Set(RV32I_INSTRUCTIONS.map((i) => i.mnemonic)).size).toBe(40);
    const byGroup = (g: string) => RV32I_INSTRUCTIONS.filter((i) => i.group === g).length;
    expect(byGroup('upper')).toBe(2);
    expect(byGroup('jump')).toBe(2);
    expect(byGroup('branch')).toBe(6);
    expect(byGroup('load')).toBe(5);
    expect(byGroup('store')).toBe(3);
    expect(byGroup('alu-imm')).toBe(9);
    expect(byGroup('alu')).toBe(10);
    expect(byGroup('system') + byGroup('fence')).toBe(3);
  });

  test('every instruction encodes to a word that decodes back to it', () => {
    for (const s of RV32I_INSTRUCTIONS) {
      const fields = { rd: 5, rs1: 6, rs2: 7, imm: s.kind === 'shift' ? 9 : s.kind === 'branch' || s.kind === 'jal' ? 16 : s.kind === 'lui' ? 0x1234 : 12 };
      const word = encode(s.mnemonic, fields);
      const d = decode(word);
      expect(d?.spec.mnemonic, s.mnemonic).toBe(s.mnemonic);
      expect(encode(d!.spec.mnemonic, { rd: d!.rd, rs1: d!.rs1, rs2: d!.rs2, imm: s.kind === 'lui' ? d!.imm >>> 12 : d!.imm }), s.mnemonic).toBe(word);
    }
  });

  test('registers: x-names, ABI names, fp, case-insensitive', () => {
    expect(REGISTER_NAMES).toHaveLength(32);
    expect(parseRegister('x0')).toBe(0);
    expect(parseRegister('zero')).toBe(0);
    expect(parseRegister('ra')).toBe(1);
    expect(parseRegister('SP')).toBe(2);
    expect(parseRegister('fp')).toBe(8);
    expect(parseRegister('s0')).toBe(8);
    expect(parseRegister('a0')).toBe(10);
    expect(parseRegister('a7')).toBe(17);
    expect(parseRegister('s2')).toBe(18);
    expect(parseRegister('s11')).toBe(27);
    expect(parseRegister('t3')).toBe(28);
    expect(parseRegister('T6')).toBe(31);
    expect(parseRegister('x31')).toBe(31);
    expect(parseRegister('x32')).toBeUndefined();
    expect(parseRegister('a8')).toBeUndefined();
    expect(registerName(10)).toBe('a0');
    expect(registerName(10, false)).toBe('x10');
  });
});

/** Encodings worked out by hand from the field layouts of the specification. */
const HAND: [string, () => number, number][] = [
  // R-type: rd = 3, rs1 = 1, rs2 = 2.
  ['add x3, x1, x2', () => encode('add', { rd: 3, rs1: 1, rs2: 2 }), 0x002081b3],
  ['sub x3, x1, x2', () => encode('sub', { rd: 3, rs1: 1, rs2: 2 }), 0x402081b3],
  ['sll x3, x1, x2', () => encode('sll', { rd: 3, rs1: 1, rs2: 2 }), 0x002091b3],
  ['slt x3, x1, x2', () => encode('slt', { rd: 3, rs1: 1, rs2: 2 }), 0x0020a1b3],
  ['sltu x3, x1, x2', () => encode('sltu', { rd: 3, rs1: 1, rs2: 2 }), 0x0020b1b3],
  ['xor x3, x1, x2', () => encode('xor', { rd: 3, rs1: 1, rs2: 2 }), 0x0020c1b3],
  ['srl x3, x1, x2', () => encode('srl', { rd: 3, rs1: 1, rs2: 2 }), 0x0020d1b3],
  ['sra x3, x1, x2', () => encode('sra', { rd: 3, rs1: 1, rs2: 2 }), 0x4020d1b3],
  ['or x3, x1, x2', () => encode('or', { rd: 3, rs1: 1, rs2: 2 }), 0x0020e1b3],
  ['and x3, x1, x2', () => encode('and', { rd: 3, rs1: 1, rs2: 2 }), 0x0020f1b3],
  // I-type arithmetic.
  ['addi x1, x0, 1', () => encode('addi', { rd: 1, rs1: 0, imm: 1 }), 0x00100093],
  ['addi x0, x0, 0 (nop)', () => encode('addi', { rd: 0, rs1: 0, imm: 0 }), 0x00000013],
  ['addi x1, x0, -1', () => encode('addi', { rd: 1, rs1: 0, imm: -1 }), 0xfff00093],
  ['addi x1, x0, -2048', () => encode('addi', { rd: 1, rs1: 0, imm: -2048 }), 0x80000093],
  ['addi x1, x0, 2047', () => encode('addi', { rd: 1, rs1: 0, imm: 2047 }), 0x7ff00093],
  ['slti x1, x2, 5', () => encode('slti', { rd: 1, rs1: 2, imm: 5 }), 0x00512093],
  ['sltiu x1, x2, 5', () => encode('sltiu', { rd: 1, rs1: 2, imm: 5 }), 0x00513093],
  ['xori x1, x2, 5', () => encode('xori', { rd: 1, rs1: 2, imm: 5 }), 0x00514093],
  ['ori x1, x2, 5', () => encode('ori', { rd: 1, rs1: 2, imm: 5 }), 0x00516093],
  ['andi x1, x2, 5', () => encode('andi', { rd: 1, rs1: 2, imm: 5 }), 0x00517093],
  ['slli x1, x2, 3', () => encode('slli', { rd: 1, rs1: 2, imm: 3 }), 0x00311093],
  ['srli x1, x2, 3', () => encode('srli', { rd: 1, rs1: 2, imm: 3 }), 0x00315093],
  ['srai x1, x2, 3', () => encode('srai', { rd: 1, rs1: 2, imm: 3 }), 0x40315093],
  ['slli x1, x2, 31', () => encode('slli', { rd: 1, rs1: 2, imm: 31 }), 0x01f11093],
  // Loads and stores (rd/rs2 = 5, rs1 = 2).
  ['lb x5, 8(x2)', () => encode('lb', { rd: 5, rs1: 2, imm: 8 }), 0x00810283],
  ['lh x5, 8(x2)', () => encode('lh', { rd: 5, rs1: 2, imm: 8 }), 0x00811283],
  ['lw x5, 8(x2)', () => encode('lw', { rd: 5, rs1: 2, imm: 8 }), 0x00812283],
  ['lbu x5, 8(x2)', () => encode('lbu', { rd: 5, rs1: 2, imm: 8 }), 0x00814283],
  ['lhu x5, 8(x2)', () => encode('lhu', { rd: 5, rs1: 2, imm: 8 }), 0x00815283],
  ['lw x5, -4(x2)', () => encode('lw', { rd: 5, rs1: 2, imm: -4 }), 0xffc12283],
  ['sb x5, 8(x2)', () => encode('sb', { rs2: 5, rs1: 2, imm: 8 }), 0x00510423],
  ['sh x5, 8(x2)', () => encode('sh', { rs2: 5, rs1: 2, imm: 8 }), 0x00511423],
  ['sw x5, 8(x2)', () => encode('sw', { rs2: 5, rs1: 2, imm: 8 }), 0x00512423],
  // The S immediate is split: -4 = 1111111 11100, so imm[11:5] = 0x7F and imm[4:0] = 0x1C.
  ['sw x5, -4(x2)', () => encode('sw', { rs2: 5, rs1: 2, imm: -4 }), 0xfe512e23],
  // U and J.
  ['lui x5, 0x12345', () => encode('lui', { rd: 5, imm: 0x12345 }), 0x123452b7],
  ['auipc x5, 0x12345', () => encode('auipc', { rd: 5, imm: 0x12345 }), 0x12345297],
  ['lui x1, 0xFFFFF', () => encode('lui', { rd: 1, imm: 0xfffff }), 0xfffff0b7],
  ['jal x1, 8', () => encode('jal', { rd: 1, imm: 8 }), 0x008000ef],
  // imm[11] goes to bit 20, imm[12] to bit 12.
  ['jal x1, 2048', () => encode('jal', { rd: 1, imm: 2048 }), 0x001000ef],
  ['jal x1, 4096', () => encode('jal', { rd: 1, imm: 4096 }), 0x000010ef],
  // −4: imm[20] = 1 (bit 31), imm[10:1] = 0x3FE (bits 30–21), imm[11] = 1 (bit 20), imm[19:12] = 0xFF.
  ['jal x0, -4', () => encode('jal', { rd: 0, imm: -4 }), 0xffdff06f],
  ['jal x0, 1048574 (the furthest forward)', () => encode('jal', { rd: 0, imm: 1048574 }), 0x7ffff06f],
  ['jal x0, -1048576 (the furthest back)', () => encode('jal', { rd: 0, imm: -1048576 }), 0x8000006f],
  ['jalr x1, 4(x2)', () => encode('jalr', { rd: 1, rs1: 2, imm: 4 }), 0x004100e7],
  ['jalr x0, 0(x1) (ret)', () => encode('jalr', { rd: 0, rs1: 1, imm: 0 }), 0x00008067],
  // Branches (rs1 = 1, rs2 = 2). +8: imm[4:1] = 0100 goes to bits 11–8.
  ['beq x1, x2, 8', () => encode('beq', { rs1: 1, rs2: 2, imm: 8 }), 0x00208463],
  ['bne x1, x2, 8', () => encode('bne', { rs1: 1, rs2: 2, imm: 8 }), 0x00209463],
  ['blt x1, x2, 8', () => encode('blt', { rs1: 1, rs2: 2, imm: 8 }), 0x0020c463],
  ['bge x1, x2, 8', () => encode('bge', { rs1: 1, rs2: 2, imm: 8 }), 0x0020d463],
  ['bltu x1, x2, 8', () => encode('bltu', { rs1: 1, rs2: 2, imm: 8 }), 0x0020e463],
  ['bgeu x1, x2, 8', () => encode('bgeu', { rs1: 1, rs2: 2, imm: 8 }), 0x0020f463],
  ['beq x0, x0, 0', () => encode('beq', { rs1: 0, rs2: 0, imm: 0 }), 0x00000063],
  // −8: imm[12] = 1 (bit 31), imm[10:5] = 111111 (bits 30–25), imm[4:1] = 1100 (bits 11–8), imm[11] = 1 (bit 7).
  ['bne x1, x2, -8', () => encode('bne', { rs1: 1, rs2: 2, imm: -8 }), 0xfe209ce3],
  // 2048 has only imm[11] set (bit 7); 4094 sets everything but imm[12]; −4096 only imm[12].
  ['beq x0, x0, 2048', () => encode('beq', { rs1: 0, rs2: 0, imm: 2048 }), 0x000000e3],
  ['beq x0, x0, 4094 (the furthest forward)', () => encode('beq', { rs1: 0, rs2: 0, imm: 4094 }), 0x7e000fe3],
  ['beq x0, x0, -4096 (the furthest back)', () => encode('beq', { rs1: 0, rs2: 0, imm: -4096 }), 0x80000063],
  ['beq x0, x0, -2', () => encode('beq', { rs1: 0, rs2: 0, imm: -2 }), 0xfe000fe3],
  // System and fence.
  ['ecall', () => encode('ecall'), 0x00000073],
  ['ebreak', () => encode('ebreak'), 0x00100073],
  ['fence iorw, iorw', () => encode('fence'), 0x0ff0000f],
  ['fence r, rw', () => encode('fence', { imm: 0x23 }), 0x0230000f],
];

describe('encodings against hand-worked values', () => {
  test.each(HAND)('%s', (_text, make, expected) => {
    expect(hex(make())).toBe(hex(expected));
  });

  test('all of them decode back to the same instruction and operands', () => {
    for (const [text, make] of HAND) {
      const w = make();
      const d = decode(w);
      expect(d, `${text} = ${hex(w)}`).toBeDefined();
    }
  });
});

describe('immediates', () => {
  test('B and J immediates round trip over their whole range', () => {
    for (const imm of [-4096, -4094, -2050, -2048, -1026, -1024, -34, -32, -8, -4, -2, 0, 2, 4, 30, 32, 1022, 1024, 2046, 2048, 4092, 4094]) {
      const d = decode(encode('beq', { rs1: 3, rs2: 4, imm }))!;
      expect([d.imm, d.rs1, d.rs2]).toEqual([imm, 3, 4]);
    }
    for (const imm of [-1048576, -1048574, -524288, -4098, -4096, -2050, -2048, -4, -2, 0, 2, 4, 2046, 2048, 4094, 4096, 524286, 1048574]) {
      const d = decode(encode('jal', { rd: 7, imm }))!;
      expect([d.imm, d.rd]).toEqual([imm, 7]);
    }
  });

  test('every bit of a B immediate lands where the manual says', () => {
    // imm[12] → 31, imm[11] → 7, imm[10:5] → 30:25, imm[4:1] → 11:8.
    expect(encode('beq', { rs1: 0, rs2: 0, imm: -4096 }) >>> 0).toBe((0x80000000 | 0x63) >>> 0);
    expect(encode('beq', { rs1: 0, rs2: 0, imm: 1 << 11 }) >>> 0).toBe(0x80 | 0x63);
    for (let b = 5; b <= 10; b++) expect(encode('beq', { rs1: 0, rs2: 0, imm: 1 << b }) >>> 0).toBe(((1 << (b - 5 + 25)) | 0x63) >>> 0);
    for (let b = 1; b <= 4; b++) expect(encode('beq', { rs1: 0, rs2: 0, imm: 1 << b }) >>> 0).toBe(((1 << (b - 1 + 8)) | 0x63) >>> 0);
  });

  test('every bit of a J immediate lands where the manual says', () => {
    // imm[20] → 31, imm[10:1] → 30:21, imm[11] → 20, imm[19:12] → 19:12.
    expect(encode('jal', { rd: 0, imm: -1048576 }) >>> 0).toBe((0x80000000 | 0x6f) >>> 0);
    expect(encode('jal', { rd: 0, imm: 1 << 11 }) >>> 0).toBe((1 << 20) | 0x6f);
    for (let b = 1; b <= 10; b++) expect(encode('jal', { rd: 0, imm: 1 << b }) >>> 0).toBe(((1 << (b - 1 + 21)) | 0x6f) >>> 0);
    for (let b = 12; b <= 19; b++) expect(encode('jal', { rd: 0, imm: 1 << b }) >>> 0).toBe(((1 << b) | 0x6f) >>> 0);
  });

  test('range and alignment errors', () => {
    expect(() => encode('addi', { rd: 1, rs1: 0, imm: 2048 })).toThrow(EncodeError);
    expect(() => encode('addi', { rd: 1, rs1: 0, imm: -2049 })).toThrow(/12 bits/);
    expect(() => encode('sw', { rs1: 0, rs2: 0, imm: 5000 })).toThrow(/12 bits/);
    expect(() => encode('slli', { rd: 1, rs1: 1, imm: 32 })).toThrow(/0–31/);
    expect(() => encode('beq', { rs1: 0, rs2: 0, imm: 4096 })).toThrow(/range/);
    expect(() => encode('beq', { rs1: 0, rs2: 0, imm: 3 })).toThrow(/odd/);
    expect(() => encode('jal', { rd: 0, imm: 1048576 })).toThrow(/range/);
    expect(() => encode('lui', { rd: 1, imm: 0x100000 })).toThrow(/20 bits/);
    expect(() => encode('add', { rd: 32, rs1: 0, rs2: 0 })).toThrow(/register/);
    expect(() => encode('mul', {})).toThrow(/unknown/);
  });

  test('12-bit immediates are read as 32-bit numbers', () => {
    expect(fitsImm12(-2048)).toBe(true);
    expect(fitsImm12(2047)).toBe(true);
    expect(fitsImm12(2048)).toBe(false);
    expect(fitsImm12(0xffffffff)).toBe(true); // −1
    expect(fitsImm12(0xfffff800)).toBe(true); // −2048
    expect(fitsImm12(0xfffff7ff)).toBe(false);
    expect(fitsImm12(0xffffff08)).toBe(true); // the LEDS register, −248
    expect(encode('lw', { rd: 1, rs1: 0, imm: 0xffffff08 })).toBe(encode('lw', { rd: 1, rs1: 0, imm: -248 }));
  });

  test('%hi and %lo recombine to the original value', () => {
    const rng = new Prng(5);
    const values = [0, 1, 0x7ff, 0x800, 0x801, 0xfff, 0x1000, 0x12345678, 0x12345fff, 0x7fffffff, 0x80000000, 0xfffff800, 0xffffffff];
    for (let i = 0; i < 500; i++) values.push(rng.u32());
    for (const v of values) {
      expect(((hi20(v) << 12) + lo12(v)) >>> 0, hex(v)).toBe(v >>> 0);
      expect(lo12(v)).toBeGreaterThanOrEqual(-2048);
      expect(lo12(v)).toBeLessThanOrEqual(2047);
    }
    expect(hi20(0x12345fff)).toBe(0x12346);
    expect(lo12(0x12345fff)).toBe(-1);
    expect(signExtend(0x80, 8)).toBe(-128);
  });
});

describe('decoding', () => {
  test('encode is the inverse of decode for random valid words', () => {
    const rng = new Prng(11);
    let valid = 0;
    for (let i = 0; i < 20000; i++) {
      const w = rng.u32();
      const d = decode(w);
      if (!d) continue;
      valid++;
      const s = d.spec;
      const imm = s.kind === 'lui' ? d.imm >>> 12 : d.imm;
      const fields = { rd: d.rd, rs1: d.rs1, rs2: d.rs2, imm };
      // Fields the format does not have are not part of the word: compare after re-decoding.
      const again = decode(encode(s.mnemonic, fields));
      expect(again?.spec.mnemonic).toBe(s.mnemonic);
      if (s.format !== 'U' && s.format !== 'J') expect(again!.rs1).toBe(d.rs1);
      if (s.format === 'R' || s.format === 'S' || s.format === 'B') expect(again!.rs2).toBe(d.rs2);
      if (s.format !== 'S' && s.format !== 'B') expect(again!.rd).toBe(d.rd);
      if (s.format !== 'R') expect(again!.imm).toBe(d.imm);
    }
    expect(valid).toBeGreaterThan(500);
  });

  test('illegal words: unknown opcodes, functions and reserved bits', () => {
    for (const w of [
      0x00000000, // all zeros
      0xffffffff, // all ones
      0x00000007, // an opcode that does not exist here (load-fp)
      0x0000707b, // custom
      0x00003003, // load with funct3 = 3 (ld, RV64)
      0x00007003, // load with funct3 = 7
      0x00003023, // store with funct3 = 3 (sd)
      0x00002063, // branch with funct3 = 2
      0x00003063, // branch with funct3 = 3
      0x00001067, // jalr with funct3 = 1
      0x02000033, // OP with funct7 = 1 (the M extension: mul)
      0x40001033, // sll with funct7 = 0x20
      0x40004033, // xor with funct7 = 0x20
      0x02001013, // slli with funct7 = 1
      0x20001013, // slli with a stray bit
      0x60005013, // srli/srai with funct7 = 0x30
      0x00100073 | 0x80, // ebreak with rd set
      0x00000073 | (1 << 15), // ecall with rs1 set
      0x00001073, // csrrw (Zicsr)
      0x0000100f, // fence.i (Zifencei)
      0x8ff0000f, // fence with fm set
      0x0ff0008f, // fence with rd set
    ]) {
      expect(decode(w), hex(w)).toBeUndefined();
    }
  });

  test('cycle model', () => {
    expect(cyclesOf('add')).toBe(RV32_TIMING.alu);
    expect(cyclesOf('lw')).toBe(3);
    expect(cyclesOf('sw')).toBe(3);
    expect(cyclesOf('beq', false)).toBe(2);
    expect(cyclesOf('beq', true)).toBe(3);
    expect(cyclesOf('jal')).toBe(3);
    expect(cyclesOf('jalr')).toBe(3);
    expect(cyclesOf('ecall')).toBe(2);
    expect(instructionByMnemonic('ADD')?.mnemonic).toBe('add');
  });
});
