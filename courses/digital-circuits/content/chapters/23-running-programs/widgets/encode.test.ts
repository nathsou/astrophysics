import { describe, expect, test } from 'vitest';
import { DECODE_TABLE, assemble, isCanonical } from '$lib/sim/cpu/octet';
import { cellsOf, explain, mnemonics, withMnemonic } from './encode';

describe('the bits of a first byte', () => {
  test('ADD R1, R2 is 0x86: opcode 1000, dd 01, ss 10', () => {
    const c = cellsOf(0x86);
    expect(c.map((x) => x.kind)).toEqual(['op', 'op', 'op', 'op', 'dd', 'dd', 'ss', 'ss']);
    expect(c.map((x) => x.value).join('')).toBe('10000110');
    const e = explain(0x86);
    expect(e.text).toBe('ADD R1, R2');
    expect([e.d, e.s, e.cycles]).toEqual([1, 2, 6]);
  });

  test('a jump uses all four low bits as a condition', () => {
    const c = cellsOf(0xf3);
    expect(c.slice(4).every((x) => x.kind === 'cond')).toBe(true);
    expect(explain(0xf3, 6).text).toBe('JNZ 0x06');
  });

  test('PUSH R2 has a register in dd and a fixed operation in ss; its unused bits are not ignored, they select PUSH', () => {
    const c = cellsOf(0x78 | 0);
    expect(c.slice(4).map((x) => x.kind)).toEqual(['dd', 'dd', 'fixed', 'fixed']);
    expect(explain(0x78).text).toBe('PUSH R2');
    expect(explain(0x72, 0x20).text).toBe('CALL 0x20');
    // CALL ignores its dd bits, so 0x7A does the same but is not the byte the assembler writes.
    expect(explain(0x7a).nonCanonical).toBe(true);
  });

  test('HLT ignores all four low bits, so 0x0F is HLT too, but not canonical', () => {
    expect(explain(0x0f).text).toBe('.byte 0x0F');
    expect(explain(0x0f).nonCanonical).toBe(true);
    expect(DECODE_TABLE[0x0f]!.mnemonic).toBe('HLT');
    expect(explain(0x00).nonCanonical).toBe(false);
    expect(cellsOf(0x0f).slice(4).every((x) => x.kind === 'ignored')).toBe(true);
  });

  test('every byte is some instruction, and its canonical text assembles back to the same bytes', () => {
    for (let b = 0; b < 256; b++) {
      const e = explain(b, 0x42);
      expect(cellsOf(b).reduce((v, x) => v * 2 + x.value, 0)).toBe(b);
      if (!isCanonical(b)) continue;
      const p = assemble(`        ${e.text}\n`);
      // Jumps and calls print a numeric target; everything else must assemble as written.
      expect(p.ok, `${b.toString(16)} ${e.text}`).toBe(true);
      expect([...p.image.slice(0, e.bytes.length)]).toEqual(e.bytes);
    }
  });
});

describe('choosing an instruction', () => {
  test('keeps the register fields where the new instruction has them', () => {
    expect(withMnemonic(0x86, 'SUB')).toBe(0x96);
    expect(withMnemonic(0x86, 'INC')).toBe(0xe4 | 3);
    expect(withMnemonic(0x86, 'MOV')).toBe(0x16);
    expect(withMnemonic(0x86, 'HLT')).toBe(0x00);
    expect(withMnemonic(0x86, 'JNZ')).toBe(0xf3);
  });
  test('the picker lists all 37 instructions once, in seven groups', () => {
    const groups = mnemonics();
    expect(groups).toHaveLength(7);
    expect(groups.flatMap((g) => g.items)).toHaveLength(37 - 0);
    expect(new Set(groups.flatMap((g) => g.items)).size).toBe(37);
  });
});
