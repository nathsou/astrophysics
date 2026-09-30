import { describe, expect, test } from 'vitest';
import { DRAM, swing } from './dram';
import { Mem, SRAM_DIFF, type CellKind } from './array';

const rand = (seed: number) => {
  let a = seed;
  return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) & 0xffff;
};

describe('the address decoder', () => {
  test('exactly one word line for each address', () => {
    const m = new Mem('sram');
    for (let a = 0; a < 8; a++) {
      const wl = m.decode(a);
      expect(wl.filter(Boolean)).toHaveLength(1);
      expect(wl[a]).toBe(true);
    }
  });
  test('a 3-bit decoder is 8 AND gates of 3 inputs and 3 inverters', () => {
    expect(new Mem('sram').facts().decoderGates).toEqual({ and: 8, not: 3, fanIn: 3 });
    expect(new Mem('sram', 10, 8).facts().decoderGates).toEqual({ and: 1024, not: 10, fanIn: 10 });
  });
});

describe('cost of the cells', () => {
  test('6 transistors per SRAM bit, one transistor and one capacitor per DRAM bit, a transistor at each 1 of a ROM', () => {
    expect(new Mem('sram').facts()).toMatchObject({ cellTransistors: 6 * 32, capacitors: 0 });
    expect(new Mem('dram').facts()).toMatchObject({ cellTransistors: 32, capacitors: 32 });
    expect(new Mem('rom', 3, 4, [0xf, 0, 0x5, 0, 0, 0, 0, 0]).facts()).toMatchObject({ cellTransistors: 6, capacitors: 0 });
  });
});

describe.each<CellKind>(['sram', 'dram'])('%s: writing and reading', (kind) => {
  test('every word reads back what was written, over a random sequence', () => {
    const m = new Mem(kind);
    const model = Array<number>(8).fill(0);
    const r = rand(5);
    for (let i = 0; i < 300; i++) {
      const a = r() % 8;
      if (r() % 2) {
        const w = r() % 16;
        m.write(a, w);
        model[a] = w;
      } else {
        const frames = m.read(a);
        expect(frames.at(-1)!.q).toEqual([...model[a]!.toString(2).padStart(4, '0')].map(Number));
        expect(m.peek(a)).toBe(model[a]);
      }
    }
    for (let a = 0; a < 8; a++) expect(m.peek(a)).toBe(model[a]);
  });
  test('a write drives the lines, raises one word line, and ends with the drivers off and the array unchanged elsewhere', () => {
    const m = new Mem(kind, 3, 4, [1, 2, 3, 4, 5, 6, 7, 8]);
    const f = m.write(5, 0b1010);
    expect(f.map((x) => x.label)).toEqual(['Drivers', 'Word line', 'Done']);
    expect(f[0]!.wl.some(Boolean)).toBe(false);
    expect(f[1]!.wl.filter(Boolean)).toHaveLength(1);
    expect(f[1]!.drivers).toBe(true);
    expect(f[2]!.drivers).toBe(false);
    expect(f[2]!.wl.some(Boolean)).toBe(false);
    for (let a = 0; a < 8; a++) expect(m.peek(a)).toBe(a === 5 ? 0b1010 : a + 1);
  });
});

describe('an SRAM read', () => {
  test('precharge, word line, sense: the cell pulls one line down by about 100 mV and the cell is not disturbed', () => {
    const m = new Mem('sram', 3, 4, [0, 0, 0, 0b1010, 0, 0, 0, 0]);
    const before = JSON.stringify(m.cells);
    const f = m.read(3);
    expect(f.map((x) => x.label)).toEqual(['Precharge', 'Word line', 'Sense', 'Done']);
    expect(f[0]!.bl).toEqual([1.2, 1.2, 1.2, 1.2]);
    expect(f[0]!.blb).toEqual([1.2, 1.2, 1.2, 1.2]);
    expect(f[1]!.bl.map((v) => +v.toFixed(2))).toEqual([1.2, 1.1, 1.2, 1.1]);
    expect(f[1]!.blb.map((v) => +v.toFixed(2))).toEqual([1.1, 1.2, 1.1, 1.2]);
    expect(SRAM_DIFF).toBe(0.1);
    expect(f[2]!.bl).toEqual([1.2, 0, 1.2, 0]);
    expect(f[2]!.q).toEqual([1, 0, 1, 0]);
    expect(JSON.stringify(m.cells)).toBe(before);
    // Frame cells (what the widget draws) never change during a read.
    for (const x of f) expect(x.cells).toEqual(m.cells);
  });
});

describe('a DRAM read', () => {
  test('the cell shares its charge with the bit line, which moves by 67 mV, and the read destroys the bit until it is written back', () => {
    const m = new Mem('dram', 3, 4, [0, 0, 0, 0b1010, 0, 0, 0, 0]);
    const f = m.read(3);
    expect(f.map((x) => x.label)).toEqual(['Precharge', 'Word line', 'Sense', 'Restore', 'Done']);
    expect(f[0]!.bl).toEqual([0.6, 0.6, 0.6, 0.6]);
    const shared = f[1]!.bl;
    expect(shared[0]! - 0.6).toBeCloseTo(swing(DRAM.vdd), 9);
    expect(shared[1]! - 0.6).toBeCloseTo(-swing(DRAM.vdd), 9);
    // The cell is left at the bit line's in-between voltage: the value is gone.
    expect(f[1]!.cellV[3]).toEqual(shared);
    expect(f[1]!.cellV[3]!.every((v) => v > 0.5 && v < 0.7)).toBe(true);
    // The sense amplifier decides, the restore writes the full level back.
    expect(f[2]!.q).toEqual([1, 0, 1, 0]);
    expect(f[3]!.bl).toEqual([1.2, 0, 1.2, 0]);
    expect(f[4]!.cellV[3]).toEqual([1.2, 0, 1.2, 0]);
    // Other rows are not touched by the read.
    expect(f[1]!.cellV[2]).toEqual([0, 0, 0, 0]);
  });
});

describe('a ROM', () => {
  const rom = () => new Mem('rom', 3, 4, [0x1, 0x2, 0x4, 0x8, 0xf, 0x0, 0xa, 0x5]);
  test('a stored 1 is a transistor that pulls the bit line low', () => {
    const f = rom().read(6);
    expect(f[1]!.bl).toEqual([0, 1.2, 0, 1.2]);
    expect(f[2]!.q).toEqual([1, 0, 1, 0]);
    expect(f[1]!.blb).toEqual([]);
  });
  test('it can be read but not written', () => {
    const m = rom();
    expect(m.write(2, 0xf)).toEqual([]);
    expect(m.peek(2)).toBe(4);
    expect(m.commit(2, 0xf)).toBe(false);
  });
  test('every address reads its word', () => {
    const m = rom();
    for (let a = 0; a < 8; a++) expect(m.wordOf(m.read(a).at(-1)!.q as number[])).toBe(m.peek(a));
  });
});

test('idle: no word line is high and nothing is driven', () => {
  const f = new Mem('sram').idle();
  expect(f.wl.some(Boolean)).toBe(false);
  expect(f.lines.every((l) => l === 'released')).toBe(true);
});
