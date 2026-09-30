import { describe, expect, test } from 'vitest';
import { assembleOrThrow } from './assembler';
import { disassemble, disassembleAt, toSource } from './disassembler';
import { Prng } from '../common/prng';
import { isCanonical } from './spec';

describe('Octet disassembler', () => {
  test('texts', () => {
    const p = assembleOrThrow(`
start:  LDI R0, 0x2A
        LD R1, [0x80]
        ST [LEDS], R1
        LD R2, [ADC]
        ST [DAC], R2
        ST [MATRIX + 3], R2
        LDR R3, [R1]
        STR [R2], R3
        CALL start
        JNZ start
        NOP
        PUSH R1
        HLT`);
    const texts = disassemble(p.image, 0, p.size, { labels: p.labels }).map((d) => d.text);
    expect(texts).toEqual([
      'LDI R0, 0x2A',
      'LD R1, [0x80]',
      'ST [LEDS], R1',
      'LD R2, [ADC]',
      'ST [DAC], R2',
      'ST [MATRIX+3], R2',
      'LDR R3, [R1]',
      'STR [R2], R3',
      'CALL start',
      'JNZ start',
      'NOP',
      'PUSH R1',
      'HLT',
    ]);
    expect(disassembleAt(p.image, 0, { ioNames: false }).text).toBe('LDI R0, 0x2A');
    expect(disassembleAt([0x40, 0xf8], 0, { ioNames: false }).text).toBe('ST [0xF8], R0');
    expect(disassembleAt([0xf5, 0x10], 0).target).toBe(0x10);
  });

  test('non-canonical bytes become .byte', () => {
    expect(disassembleAt([0x05], 0).text).toBe('.byte 0x05');
    expect(disassembleAt([0x21, 0x00], 0).text).toBe('.byte 0x21');
    expect(disassembleAt([0x7e], 0).text).toBe('.byte 0x7E'); // RET with dd ≠ 0
  });

  test('isInstruction marks data', () => {
    const p = assembleOrThrow('LDI R0, 1\nHLT\nx: .byte 0x81, 0x20');
    const lines = disassemble(p.image, 0, p.size, { isInstruction: (a) => p.instructionStart[a] === 1 });
    expect(lines.map((l) => l.text)).toEqual(['LDI R0, 0x01', 'HLT', '.byte 0x81', '.byte 0x20']);
  });

  test('round trip: random bytes → source → the same bytes', () => {
    const rng = new Prng(1234);
    for (let trial = 0; trial < 200; trial++) {
      const n = rng.int(1, 200);
      const start = rng.int(0, 0xef - n);
      const mem = new Uint8Array(256);
      for (let i = 0; i < n; i++) mem[start + i] = rng.int(0, 255);
      const src = toSource(mem, start, start + n);
      const back = assembleOrThrow(src);
      expect([...back.image.slice(start, start + n)]).toEqual([...mem.slice(start, start + n)]);
      expect(back.size).toBe(n);
    }
  });

  test('every canonical first byte round-trips through text', () => {
    for (let b = 0; b < 256; b++) {
      if (!isCanonical(b)) continue;
      const d = disassembleAt([b, 0x33], 0);
      const back = assembleOrThrow(d.text);
      expect([...back.image.slice(0, d.bytes.length)], d.text).toEqual(d.bytes);
    }
  });
});
