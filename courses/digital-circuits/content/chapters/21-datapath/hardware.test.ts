import { describe, expect, test } from 'vitest';
import { DECODE_TABLE, OCTET_INSTRUCTIONS } from '$lib/sim/cpu/octet';
import {
  CONTROL_LINES,
  DATAPATH_LINES,
  ROM_SIZE,
  ROM_WORDS,
  ROUTINES,
  WORD_BITS,
  WORD_FIELDS,
  dispatchTable,
  pack,
  referenceLines,
  routineOfByte,
  unpack,
  linesOf,
  romWords,
  ZERO_FIELDS,
} from './hardware/control-word';
import { describe as rtl, fieldsOfLines } from './hardware/describe';
import { Hw } from './hardware/hw';
import { addDatapath } from './hardware/datapath';
import { built, Rig } from './hardware/rig';

/**
 * The control word and the microprogram are derived from the ISA specification, and the datapath is generated
 * from the parts bin. These tests pin down the numbers that the chapters quote.
 */
describe('the control word', () => {
  test('there are 24 lines into the datapath, plus HALT, and the micro-instruction word is 24 bits', () => {
    expect(DATAPATH_LINES).toHaveLength(24);
    expect(CONTROL_LINES).toHaveLength(25);
    expect(WORD_FIELDS.reduce((n, f) => n + ('width' in f ? f.width : 1), 0)).toBe(WORD_BITS);
    expect(WORD_BITS).toBe(24);
  });

  test('pack and unpack are inverses', () => {
    for (const w of romWords()) expect(pack(unpack(w))).toBe(w);
    expect(() => pack({ drive: 8 })).toThrow(/does not fit/);
  });
});

describe('the microprogram', () => {
  test('every instruction has exactly as many micro-steps as the ISA spec lists, so its cycles are 3 + steps', () => {
    for (const i of OCTET_INSTRUCTIONS) {
      const r = ROUTINES.find((x) => x.name === (i.group === 'jump' ? 'Jcc' : i.mnemonic))!;
      expect(r.steps.length, i.mnemonic).toBe(i.steps.length);
      expect(3 + r.steps.length, i.mnemonic).toBe(i.cycles);
    }
  });

  test('57 micro-instructions fit the 64-word ROM; every one of the 256 bytes has a routine', () => {
    expect(ROM_WORDS).toBe(57);
    expect(ROM_WORDS).toBeLessThanOrEqual(ROM_SIZE);
    const table = dispatchTable();
    expect(table).toHaveLength(256);
    for (let b = 0; b < 256; b++) {
      const r = ROUTINES.find((x) => x.name === routineOfByte(b))!;
      expect(table[b]).toBe(r.start);
      expect(DECODE_TABLE[b]).toBeDefined();
    }
  });

  test('each routine ends exactly once, on its last step (HLT never ends)', () => {
    for (const r of ROUTINES) {
      if (r.name === 'FETCH' || r.name === 'DECODE') continue;
      const ends = r.steps.map((s) => s.fields.end);
      if (r.name === 'HLT') expect(ends).toEqual([0]);
      else expect(ends, r.name).toEqual([...Array(r.steps.length - 1).fill(0), 1]);
    }
  });

  test('a driver code names at most one driver, so two drivers can never be asked for', () => {
    for (const r of ROUTINES) for (const s of r.steps) expect(Object.values(linesOf(s.fields)).length).toBe(25);
    for (const r of ROUTINES)
      for (const s of r.steps) {
        const l = linesOf(s.fields);
        expect(l.OE_RD + l.OE_RS + l.OE_PC + l.OE_SP + l.OE_ALU + l.OE_MEM + l.OE_T).toBeLessThanOrEqual(1);
      }
  });

  test('reference lines: fetch is the same for every IR, decode asks for nothing', () => {
    for (const ir of [0, 0x86, 0xff]) {
      expect(referenceLines(0, ir, false).OE_PC).toBe(1);
      expect(referenceLines(1, ir, false).LD_IR).toBe(1);
      expect(Object.values(referenceLines(2, ir, true)).every((v) => v === 0)).toBe(true);
    }
  });

  test('a conditional jump loads the PC if the condition holds, and otherwise steps over the address', () => {
    expect(referenceLines(4, 0xf3, true)).toMatchObject({ PC_LD: 1, PC_INC: 0, OE_MEM: 1 });
    expect(referenceLines(4, 0xf3, false)).toMatchObject({ PC_LD: 0, PC_INC: 1, OE_MEM: 1 });
  });

  test('register transfers read like the spec’s: describe() and fieldsOfLines()', () => {
    const add = ROUTINES.find((r) => r.name === 'ADD')!;
    expect(add.steps.map((s) => rtl(s.fields))).toEqual(['A ← Rd', 'B ← Rs', 'Rd ← A + B; flags']);
    const on = new Set(['OE_PC', 'LD_MAR']);
    const { fields, drivers } = fieldsOfLines((n) => on.has(n));
    expect(rtl(fields)).toBe('MAR ← PC');
    expect(drivers).toEqual(['PC']);
    expect(fieldsOfLines((n) => n === 'OE_PC' || n === 'OE_ALU').drivers).toEqual(['PC', 'ALU']);
    expect(rtl(ZERO_FIELDS)).toBe('no operation');
  });
});

describe('the datapath circuit', () => {
  test('about 3,100 gates and 56 tri-state buffers from the parts bin, reset to PC = 0 and SP = 0xF0', () => {
    const hw = new Hw('Octet datapath', 'parts');
    addDatapath(hw, { memory: 'ram', declareInputs: true });
    const rig = new Rig(built(hw));
    const gates = rig.flat.elements.filter((e) => ['not', 'nand', 'nor', 'and', 'or', 'xor', 'xnor', 'buffer'].includes(e.type));
    expect(gates.length).toBeGreaterThan(3000);
    expect(gates.length).toBeLessThan(3300);
    expect(rig.flat.elements.filter((e) => e.type === 'tristate')).toHaveLength(56);
    expect(rig.flat.elements.filter((e) => e.type === 'ram')).toHaveLength(1);
  });

  test('the blocks level has the same nets and about ten times fewer elements', () => {
    const make = (level: 'parts' | 'blocks') => {
      const hw = new Hw('Octet datapath', level);
      addDatapath(hw, { memory: 'ram', declareInputs: true });
      return new Rig(built(hw));
    };
    const a = make('parts');
    const b = make('blocks');
    expect(b.flat.elements.length).toBeLessThan(a.flat.elements.length / 8);
    for (const n of ['PC0', 'SP7', 'BUS3', 'R2_5', 'IR0', 'FL0', 'MAR7', 'ALU_Y4']) expect(b.has(n) && a.has(n), n).toBe(true);
  });
});
