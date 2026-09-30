import { describe, expect, test } from 'vitest';
import { DECODE_TABLE, OCTET_CONDITIONS, OCTET_INSTRUCTIONS, OCTET_MEMORY, encodingPattern, referenceCard } from '$lib/sim/cpu/octet/spec';
import { assembleSource, hexDump, runProgram } from './run';
import { BROKEN_SOURCE, IDIOMS, SUM_SOURCE } from './example';
import { GROUPS, REGISTERS, canonicalByte, conditionsTaken, cyclePlan, firstByteCells, memoryBlocks, rowsByGroup, secondByteCells } from './card';

const bitsToByte = (cells: { text: string }[]) => parseInt(cells.map((c) => (c.text === '0' || c.text === '1' ? c.text : '0')).join(''), 2);

describe('encoding boxes', () => {
  test('agree with spec.encodingPattern for every non-jump instruction', () => {
    for (const i of OCTET_INSTRUCTIONS.filter((x) => x.group !== 'jump')) {
      const shown = firstByteCells(i).map((c) => c.text).join('');
      const pattern = encodingPattern(i).replace(/\s+/g, '').slice(0, 8);
      expect(shown, i.mnemonic).toBe(pattern);
    }
  });
  test('cells rebuild the canonical byte, for every instruction and condition', () => {
    expect(OCTET_INSTRUCTIONS.length).toBe(21 + 16);
    for (const i of OCTET_INSTRUCTIONS) expect(bitsToByte(firstByteCells(i)), i.mnemonic).toBe(canonicalByte(i));
  });
  test('the canonical byte decodes back to the same instruction', () => {
    for (const i of OCTET_INSTRUCTIONS) expect(DECODE_TABLE[canonicalByte(i)]!.mnemonic, i.mnemonic).toBe(i.mnemonic);
  });
  test('known encodings', () => {
    const by = (m: string) => OCTET_INSTRUCTIONS.find((i) => i.mnemonic === m)!;
    expect(canonicalByte(by('HLT'))).toBe(0x00);
    expect(canonicalByte(by('RET'))).toBe(0x73);
    expect(canonicalByte(by('CALL'))).toBe(0x72);
    expect(canonicalByte(by('PUSH'))).toBe(0x70);
    expect(canonicalByte(by('POP'))).toBe(0x71);
    expect(canonicalByte(by('ADD'))).toBe(0x80);
    expect(canonicalByte(by('JNZ'))).toBe(0xf3);
    expect(firstByteCells(by('ADD')).map((c) => c.kind)).toEqual(['op', 'op', 'op', 'op', 'dd', 'dd', 'ss', 'ss']);
    expect(firstByteCells(by('LDI')).map((c) => c.kind).slice(4)).toEqual(['dd', 'dd', 'ignored', 'ignored']);
    expect(firstByteCells(by('JZ'), true).map((c) => c.text).join('')).toBe('1111cccc');
  });
  test('second byte only for immediates and addresses', () => {
    const by = (m: string) => OCTET_INSTRUCTIONS.find((i) => i.mnemonic === m)!;
    expect(secondByteCells(by('LDI'))!.every((c) => c.text === 'i')).toBe(true);
    expect(secondByteCells(by('LD'))!.every((c) => c.text === 'a')).toBe(true);
    expect(secondByteCells(by('CALL'))!.every((c) => c.text === 'a')).toBe(true);
    expect(secondByteCells(by('ADD'))).toBeUndefined();
    expect(secondByteCells(by('HLT'))).toBeUndefined();
  });
});

describe('the card as a whole', () => {
  test('one row per instruction, jumps collapsed', () => {
    const groups = rowsByGroup();
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length).toBe(OCTET_INSTRUCTIONS.filter((i) => i.group !== 'jump' || i.fixed === 0).length);
    expect(rows.filter((r) => r.generic).length).toBe(1);
    expect(groups.map((g) => g.group.id)).toEqual(GROUPS.map((g) => g.id));
    const jcc = rows.find((r) => r.generic)!;
    expect(jcc.syntax).toBe('Jcc addr');
  });
  test('rows match the generated reference card of spec.ts', () => {
    const card = referenceCard();
    const table = card.sections.find((s) => s.id === 'instructions')!.table!;
    const ours = rowsByGroup().flatMap((g) => g.rows);
    expect(ours.map((r) => r.syntax).sort()).toEqual(table.rows.map((r) => r[0]!).sort());
    for (const r of ours) {
      const row = table.rows.find((x) => x[0] === r.syntax)!;
      expect(row[2], r.syntax).toBe(String(r.ins.bytes));
      expect(row[3], r.syntax).toBe(String(r.ins.cycles));
    }
  });
  test('cycle plans have 2 fetch, 1 decode and the execute steps, and add up to the cycle count', () => {
    for (const i of OCTET_INSTRUCTIONS) {
      const plan = cyclePlan(i);
      expect(plan.length, i.mnemonic).toBe(i.cycles);
      expect(plan.filter((p) => p.phase === 'fetch').length).toBe(2);
      expect(plan.filter((p) => p.phase === 'decode').length).toBe(1);
    }
    expect(Math.max(...OCTET_INSTRUCTIONS.map((i) => i.cycles))).toBe(8);
    expect(Math.min(...OCTET_INSTRUCTIONS.map((i) => i.cycles))).toBe(4);
  });
  test('registers and memory blocks', () => {
    expect(REGISTERS.filter((r) => r.visible).map((r) => r.name)).toEqual(['R0', 'R1', 'R2', 'R3', 'PC', 'SP']);
    expect(REGISTERS.find((r) => r.name === 'SP')!.reset).toBe('0xF0');
    const blocks = memoryBlocks();
    expect(blocks[0]).toMatchObject({ from: 0, to: 0xef });
    expect(blocks[1]).toMatchObject({ from: 0xf0, to: 0xf7 });
    expect(blocks[2]).toMatchObject({ from: 0xf8, to: 0xff });
    expect(blocks[0]!.to + 1).toBe(OCTET_MEMORY.ioBase);
    for (let k = 1; k < blocks.length; k++) expect(blocks[k]!.from).toBe(blocks[k - 1]!.to + 1);
  });
  test('conditions taken for a set of flags', () => {
    const t = conditionsTaken({ z: true, c: false, n: false, v: false });
    const taken = (m: string) => t.find((x) => x.mnemonic === m)!.taken;
    expect(taken('JMP')).toBe(true);
    expect(taken('JZ')).toBe(true);
    expect(taken('JC')).toBe(false);
    expect(taken('JLS')).toBe(true); // C or Z
    expect(taken('JLE')).toBe(true);
    expect(t.length).toBe(OCTET_CONDITIONS.length);
  });
});

describe('the example program', () => {
  test('assembles to 13 bytes at the addresses the prose quotes', () => {
    const a = assembleSource(SUM_SOURCE);
    expect(a.ok).toBe(true);
    expect(a.errors).toEqual([]);
    expect(a.size).toBe(13);
    expect([...a.program.image.slice(0, 13)]).toEqual([0x20, 0x00, 0x24, 0x05, 0x28, 0x01, 0x81, 0x96, 0xf3, 0x06, 0x40, 0xf8, 0x00]);
    expect(a.program.symbols.loop).toBe(6);
  });
  test('adds up to 15 on the LEDs and halts', () => {
    const r = runProgram(assembleSource(SUM_SOURCE).program);
    expect(r.reason).toBe('halted');
    expect(r.leds).toBe(15);
    expect(r.r).toEqual([15, 0, 1, 0]);
    expect(r.flags.z).toBe(true);
    // 3 LDI (5) + 5 × (ADD 6 + SUB 6 + JNZ 5) + ST 6 + HLT 4
    expect(r.cycles).toBe(3 * 5 + 5 * 17 + 6 + 4);
    expect(r.steps).toBe(3 + 5 * 3 + 1 + 1);
  });
  test('the broken program reports every mistake with a line number', () => {
    const a = assembleSource(BROKEN_SOURCE);
    expect(a.ok).toBe(false);
    expect(a.errors.map((e) => e.line)).toEqual([2, 3, 4]);
    for (const e of a.errors) expect(e.message.length).toBeGreaterThan(5);
    expect(a.errors[0]!.message).toMatch(/DEC/);
  });
  test('hex dump covers the emitted range', () => {
    const d = hexDump(assembleSource(SUM_SOURCE).program);
    expect(d.length).toBe(2);
    expect(d[0]!.address).toBe(0);
    expect(d[0]!.bytes).toEqual([0x20, 0x00, 0x24, 0x05, 0x28, 0x01, 0x81, 0x96]);
    expect(d[1]!.bytes.slice(0, 6)).toEqual([0xf3, 0x06, 0x40, 0xf8, 0x00, undefined]);
    expect(hexDump(assembleSource('').program)).toEqual([]);
  });
  test('an endless program is stopped', () => {
    const a = assembleSource('loop: JMP loop');
    const r = runProgram(a.program, 1000);
    expect(r.reason).toBe('max-steps');
    expect(r.steps).toBe(1000);
  });
  test('console output is collected', () => {
    const a = assembleSource('LDI R0, 72\nST [CONSOLE], R0\nLDI R0, 105\nST [CONSOLE], R0\nHLT');
    expect(runProgram(a.program).console).toBe('Hi');
  });
});

describe('idioms', () => {
  test.each(IDIOMS.map((i) => [i.task, i] as const))('%s assembles', (_t, idiom) => {
    const a = assembleSource(`${idiom.code}\n${idiom.support ?? ''}\n`);
    expect(a.errors).toEqual([]);
    expect(a.ok).toBe(true);
  });
  test('NOP is 0x10', () => {
    expect(assembleSource('NOP').program.image[0]).toBe(0x10);
  });
  test('negate really negates, and decrement decrements', () => {
    const neg = assembleSource('LDI R0, 5\nNOT R0\nINC R0\nHLT');
    expect(runProgram(neg.program).r[0]).toBe(0xfb);
    const dec = assembleSource('LDI R0, 5\nLDI R3, 1\nSUB R0, R3\nHLT');
    expect(runProgram(dec.program).r[0]).toBe(4);
  });
  test('CMP then JC means less than, unsigned', () => {
    const src = (x: number) => `LDI R0, ${x}\nLDI R3, 10\nCMP R0, R3\nJC less\nLDI R1, 0\nHLT\nless: LDI R1, 1\nHLT`;
    expect(runProgram(assembleSource(src(9)).program).r[1]).toBe(1);
    expect(runProgram(assembleSource(src(10)).program).r[1]).toBe(0);
    expect(runProgram(assembleSource(src(200)).program).r[1]).toBe(0);
  });
  test('the doubled register and its carry', () => {
    const a = assembleSource('LDI R0, 200\nSHL R0\nHLT');
    const r = runProgram(a.program);
    expect(r.r[0]).toBe(144);
    expect(r.flags.c).toBe(true);
  });
});
