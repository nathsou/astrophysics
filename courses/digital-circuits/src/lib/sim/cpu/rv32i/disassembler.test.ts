import { describe, expect, test } from 'vitest';
import { Prng } from '../common/prng';
import { assemble, assembleOrThrow } from './assembler';
import { disassemble, disassembleWord, toSource } from './disassembler';
import { RV32_PROGRAMS } from './programs';
import { decode } from './spec';

const dis = (word: number, address = 0, options = {}) => disassembleWord(word, address, options).text;

describe('RV32I disassembler', () => {
  test('texts', () => {
    const cases: [number, string][] = [
      [0x002081b3, 'add gp, ra, sp'],
      [0x402081b3, 'sub gp, ra, sp'],
      [0x00000013, 'nop'],
      [0x00100093, 'li ra, 1'],
      [0xfff00093, 'li ra, -1'],
      [0x00058513, 'mv a0, a1'],
      [0xfff5c513, 'not a0, a1'],
      [0x40b00533, 'neg a0, a1'],
      [0x0015b513, 'seqz a0, a1'],
      [0x00b03533, 'snez a0, a1'],
      [0x00512093, 'slti ra, sp, 5'],
      [0x40315093, 'srai ra, sp, 3'],
      [0x00812283, 'lw t0, 8(sp)'],
      [0xffc12283, 'lw t0, -4(sp)'],
      [0x00512423, 'sw t0, 8(sp)'],
      [0x123452b7, 'lui t0, 0x12345'],
      [0x12345297, 'auipc t0, 0x12345'],
      [0xfffff0b7, 'lui ra, 0xFFFFF'],
      [0x00008067, 'ret'],
      [0x00050067, 'jr a0'],
      [0x000500e7, 'jalr a0'],
      [0x004100e7, 'jalr ra, 4(sp)'],
      [0x00100073, 'ebreak'],
      [0x00000073, 'ecall'],
      [0x0ff0000f, 'fence'],
      [0x0230000f, 'fence r, rw'],
      [0x00000000, '.word 0x00000000'],
      [0xffffffff, '.word 0xFFFFFFFF'],
    ];
    for (const [w, text] of cases) expect(dis(w), '0x' + w.toString(16)).toBe(text);
  });

  test('branches and jumps show absolute targets, or label names', () => {
    expect(dis(0x00208463, 0x100)).toBe('beq ra, sp, 0x0108');
    expect(dis(0xfe209ce3, 0x100)).toBe('bne ra, sp, 0x00F8');
    expect(dis(0x008000ef, 0x200)).toBe('jal 0x0208'); // jal ra, …
    expect(dis(0x0080006f, 0x200)).toBe('j 0x0208');
    expect(dis(0x00050463, 0)).toBe('beqz a0, 0x0008');
    expect(disassembleWord(0x00208463, 0x100, { labels: { there: 0x108 } }).text).toBe('beq ra, sp, there');
    expect(disassembleWord(0x00208463, 0x100).target).toBe(0x108);
    expect(disassembleWord(0x008000ef, 0x200, { labels: new Map([[0x208, ['here', 'alias']]]) }).text).toBe('jal here');
  });

  test('I/O registers are shown by name', () => {
    expect(dis(assembleOne('sw t0, LEDS(zero)'))).toBe('sw t0, LEDS(zero)');
    expect(dis(assembleOne('lw t0, TIMER(zero)'))).toBe('lw t0, TIMER(zero)');
    expect(dis(assembleOne('sb t0, MATRIX + 3(zero)'))).toBe('sb t0, MATRIX + 3(zero)');
    expect(dis(assembleOne('lw t0, ADC(zero)'))).toBe('lw t0, ADC(zero)');
    expect(dis(assembleOne('sw t0, DAC(zero)'))).toBe('sw t0, DAC(zero)');
    expect(dis(assembleOne('sw t0, LEDS(zero)'), 0, { ioNames: false })).toBe('sw t0, -248(zero)');
    expect(dis(assembleOne('sw t0, 8(a0)'))).toBe('sw t0, 8(a0)');
  });

  test('options: x-names and no pseudo-instructions', () => {
    expect(dis(0x00058513, 0, { abi: false })).toBe('mv x10, x11');
    expect(dis(0x00058513, 0, { pseudo: false })).toBe('addi a0, a1, 0');
    expect(dis(0x00008067, 0, { pseudo: false })).toBe('jalr zero, 0(ra)');
    expect(dis(0x00000013, 0, { pseudo: false })).toBe('addi zero, zero, 0');
    expect(dis(0x0080006f, 0x10, { pseudo: false })).toBe('jal zero, 0x0018');
  });

  test('a sweep over memory; data words and a short tail', () => {
    const p = assembleOrThrow('nop\nret\n.word 0x12345678\n.byte 1, 2');
    const lines = disassemble(p.image, 0, 14);
    expect(lines.map((l) => l.text)).toEqual(['nop', 'ret', '.word 0x12345678', '.byte 0x01', '.byte 0x02']);
    const marked = disassemble(p.image, 0, 12, { isInstruction: (a) => a < 8 });
    expect(marked.map((l) => l.text)).toEqual(['nop', 'ret', '.word 0x12345678']);
  });

  function assembleOne(src: string): number {
    const p = assembleOrThrow(src);
    return (p.image[0]! | (p.image[1]! << 8) | (p.image[2]! << 16) | (p.image[3]! << 24)) >>> 0;
  }

  test('round trip: every valid random word → text → the same word', () => {
    const rng = new Prng(3);
    let n = 0;
    for (let i = 0; i < 60000 && n < 4000; i++) {
      const w = rng.u32();
      const d = decode(w);
      if (!d) continue;
      // The assembler refuses targets that are not multiples of 4 (a jump there would trap).
      if ((d.spec.kind === 'branch' || d.spec.kind === 'jal') && d.imm & 2) continue;
      n++;
      for (const options of [{}, { pseudo: false }, { abi: false }, { ioNames: false }]) {
        const address = 4 * rng.int(0, 0x3fff);
        const text = dis(w, address, options);
        const p = assemble(`.org ${address}\n${text}`);
        expect(p.diagnostics, `${text} @${address} (0x${w.toString(16)})`).toEqual([]);
        const got = (p.image[address]! | (p.image[address + 1]! << 8) | (p.image[address + 2]! << 16) | (p.image[address + 3]! << 24)) >>> 0;
        expect(got, `${text} @${address}`).toBe(w);
      }
    }
    expect(n).toBeGreaterThanOrEqual(1000);
  });

  test('round trip: toSource of a program reassembles to the same bytes', () => {
    for (const prog of RV32_PROGRAMS) {
      const p = assembleOrThrow(prog.source, prog.id);
      const isInstruction = (a: number) => p.instructionStart[a] === 1;
      const src = toSource(p.image, 0, p.image.length, { labels: p.labels, isInstruction });
      const again = assemble(src);
      expect(again.diagnostics, prog.id).toEqual([]);
      expect([...again.image.slice(0, p.image.length)], prog.id).toEqual([...p.image]);
    }
  });
});
