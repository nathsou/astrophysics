import { describe, expect, test } from 'vitest';
import {
  DECODE_TABLE,
  OCTET_CONDITIONS,
  OCTET_INSTRUCTIONS,
  OCTET_IO,
  OCTET_IO_REGISTERS,
  encodeFirstByte,
  encodingPattern,
  instructionByMnemonic,
  isCanonical,
  referenceCard,
  referenceCardMarkdown,
} from './spec';

describe('Octet ISA table', () => {
  test('uses exactly the 16 opcodes', () => {
    const ops = new Set(OCTET_INSTRUCTIONS.map((i) => i.opcode));
    expect([...ops].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });

  test('mnemonics are unique and all present', () => {
    const names = OCTET_INSTRUCTIONS.map((i) => i.mnemonic);
    expect(new Set(names).size).toBe(names.length);
    for (const m of ['HLT', 'MOV', 'LDI', 'LD', 'ST', 'LDR', 'STR', 'ADD', 'SUB', 'AND', 'OR', 'XOR', 'CMP'])
      expect(names).toContain(m);
    for (const m of ['SHL', 'SHR', 'NOT', 'INC', 'JMP', 'JZ', 'JNZ', 'JC', 'JNC', 'JN', 'CALL', 'RET', 'PUSH', 'POP'])
      expect(names).toContain(m);
  });

  test('every byte decodes to exactly one instruction, and canonical bytes re-encode', () => {
    for (let b = 0; b < 256; b++) {
      const i = DECODE_TABLE[b]!;
      expect(i.opcode).toBe(b >> 4);
      if (isCanonical(b)) expect(encodeFirstByte(i, (b >> 2) & 3, b & 3)).toBe(b);
    }
  });

  test('the number of canonical first bytes', () => {
    // HLT 1, MOV 16, LDI 4, LD 4, ST 4, LDR 16, STR 16, PUSH 4, POP 4, CALL 1, RET 1,
    // 6 ALU × 16, 4 unary × 4, 16 jumps.
    const canonical = [...Array(256).keys()].filter(isCanonical).length;
    expect(canonical).toBe(1 + 16 + 4 + 4 + 4 + 16 + 16 + 4 + 4 + 1 + 1 + 96 + 16 + 16);
  });

  test('cycles: 2 fetch + 1 decode + one per execute step', () => {
    const cycles = Object.fromEntries(OCTET_INSTRUCTIONS.map((i) => [i.mnemonic, i.cycles]));
    expect(cycles).toMatchObject({
      HLT: 4, MOV: 4, LDI: 5, LD: 6, ST: 6, LDR: 5, STR: 5, PUSH: 6, POP: 5, CALL: 8, RET: 5,
      ADD: 6, CMP: 6, SHL: 5, INC: 5, JMP: 5, JZ: 5,
    });
    for (const i of OCTET_INSTRUCTIONS) expect(i.cycles).toBe(3 + i.steps.length);
  });

  test('bytes: two for immediates and addresses', () => {
    for (const i of OCTET_INSTRUCTIONS) {
      const two = ['LDI', 'LD', 'ST', 'CALL'].includes(i.mnemonic) || i.group === 'jump';
      expect(i.bytes, i.mnemonic).toBe(two ? 2 : 1);
    }
  });

  test('only the ALU and unary groups write flags', () => {
    for (const i of OCTET_INSTRUCTIONS) expect(i.flags !== '').toBe(i.opcode >= 8 && i.opcode <= 0xe);
  });

  test('encodings of a few instructions', () => {
    expect(encodeFirstByte(instructionByMnemonic('ADD')!, 1, 2)).toBe(0x86);
    expect(encodeFirstByte(instructionByMnemonic('MOV')!, 0, 0)).toBe(0x10);
    expect(encodeFirstByte(instructionByMnemonic('PUSH')!, 3)).toBe(0x7c);
    expect(encodeFirstByte(instructionByMnemonic('POP')!, 3)).toBe(0x7d);
    expect(encodeFirstByte(instructionByMnemonic('CALL')!)).toBe(0x72);
    expect(encodeFirstByte(instructionByMnemonic('RET')!)).toBe(0x73);
    expect(encodeFirstByte(instructionByMnemonic('INC')!, 2)).toBe(0xeb);
    expect(encodeFirstByte(instructionByMnemonic('JMP')!)).toBe(0xf0);
    expect(encodeFirstByte(instructionByMnemonic('JNZ')!)).toBe(0xf3);
    expect(encodeFirstByte(instructionByMnemonic('JEQ')!)).toBe(0xf2);
    expect(encodingPattern(instructionByMnemonic('ADD')!)).toBe('1000 ddss');
    expect(encodingPattern(instructionByMnemonic('LDI')!)).toBe('0010 dd00  iiiiiiii');
    expect(encodingPattern(instructionByMnemonic('SHR')!)).toBe('1110 dd01');
    expect(encodingPattern(instructionByMnemonic('JC')!)).toBe('1111 0100  aaaaaaaa');
  });
});

describe('jump conditions', () => {
  const allFlags = [...Array(16).keys()].map((k) => ({ z: !!(k & 1), c: !!(k & 2), n: !!(k & 4), v: !!(k & 8) }));

  test('codes 0–15 in order; odd codes invert even ones', () => {
    expect(OCTET_CONDITIONS.map((c) => c.code)).toEqual([...Array(16).keys()]);
    for (let k = 0; k < 16; k += 2)
      for (const f of allFlags) expect(OCTET_CONDITIONS[k + 1]!.test(f)).toBe(!OCTET_CONDITIONS[k]!.test(f));
  });

  test('comparison conditions mean what they say after CMP a, b', () => {
    const cond = (m: string) => OCTET_CONDITIONS.find((c) => c.mnemonic === m)!;
    for (let a = 0; a < 256; a += 7) {
      for (let b = 0; b < 256; b += 5) {
        const r = (a - b) & 0xff;
        const sa = a > 127 ? a - 256 : a;
        const sb = b > 127 ? b - 256 : b;
        const f = { z: r === 0, c: a < b, n: r > 127, v: sa - sb < -128 || sa - sb > 127 };
        expect(cond('JZ').test(f)).toBe(a === b);
        expect(cond('JC').test(f)).toBe(a < b);
        expect(cond('JNC').test(f)).toBe(a >= b);
        expect(cond('JLS').test(f)).toBe(a <= b);
        expect(cond('JHI').test(f)).toBe(a > b);
        expect(cond('JLT').test(f)).toBe(sa < sb);
        expect(cond('JGE').test(f)).toBe(sa >= sb);
        expect(cond('JLE').test(f)).toBe(sa <= sb);
        expect(cond('JGT').test(f)).toBe(sa > sb);
      }
    }
  });
});

describe('memory map and reference card', () => {
  test('I/O registers fill 0xF0–0xFF', () => {
    const addrs = new Set<number>(Object.values(OCTET_IO));
    for (let a = 0xf8; a <= 0xff; a++) expect(addrs.has(a)).toBe(true);
    expect(OCTET_IO.MATRIX).toBe(0xf0);
    expect(OCTET_IO_REGISTERS).toHaveLength(9);
  });

  test('reference card has every instruction and renders to Markdown', () => {
    const card = referenceCard();
    const ids = card.sections.map((s) => s.id);
    expect(ids).toEqual(['registers', 'encoding', 'instructions', 'conditions', 'flags', 'memory', 'io', 'assembler']);
    const rows = card.sections.find((s) => s.id === 'instructions')!.table!.rows;
    // Every non-jump instruction, plus one row for the jump group.
    expect(rows).toHaveLength(OCTET_INSTRUCTIONS.filter((i) => i.group !== 'jump').length + 1);
    const md = referenceCardMarkdown(card);
    expect(md).toContain('# Octet reference card');
    expect(md).toContain('| ADD Rd, Rs | 1000 ddss | 1 | 6 | Z C N V | Rd ← Rd + Rs; flags |');
    expect(md).toContain('| 0xFB | HEX |');
  });
});
