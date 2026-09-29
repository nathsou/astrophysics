import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { Prom, PromError, wordsOf } from './prom';

// Seven-segment patterns (common cathode, segments a..g = bits 6..0) for the digits 0–9.
const SEVEN_SEGMENT = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b];

describe('vPROM', () => {
  test('a virgin part reads zero and has 256 fuses', () => {
    const p = new Prom();
    expect(p.words).toBe(32);
    expect(p.width).toBe(8);
    expect(p.fuseCount).toBe(256);
    expect(p.contents().every((w) => w === 0)).toBe(true);
  });

  test('blowing a fuse sets exactly one bit, once', () => {
    const p = new Prom();
    expect(p.blow(5, 0)).toBe(true); // column 0 is the most significant bit
    expect(p.read(5)).toBe(0x80);
    expect(p.blow(5, 0)).toBe(false);
    expect(p.blowBit(5, 0)).toBe(true); // D0
    expect(p.read(5)).toBe(0x81);
    expect(p.read(4)).toBe(0);
    expect(() => p.blow(32, 0)).toThrow(PromError);
    expect(() => p.blow(0, 8)).toThrow(PromError);
  });

  test('programming from words round-trips and plans one pulse per one-bit', () => {
    const p = new Prom();
    const words = Array.from({ length: 32 }, (_, i) => (i * 37 + 11) & 0xff);
    const ops = p.program(words);
    const ones = words.reduce((s, w) => s + w.toString(2).replace(/0/g, '').length, 0);
    expect(ops.length).toBe(ones);
    expect(p.contents()).toEqual(words);
    expect(p.verify(words)).toEqual([]);
    expect(p.toFuseMap().blown).toBe(ones);
  });

  test('a fuse cannot be restored: reprogramming a bit back to 0 is refused', () => {
    const p = new Prom();
    p.program([0xff]);
    expect(() => p.program([0x0f])).toThrow(/already blown/);
    // Adding bits is fine.
    const q = new Prom();
    q.program([0x0f]);
    q.program([0xff]);
    expect(q.read(0)).toBe(0xff);
  });

  test('from a truth table', () => {
    const p = new Prom({ addressBits: 3, width: 2 });
    const ops = p.programTruthTable(`
      A2 A1 A0 | S CO
      0  0  0  | 0 0
      0  0  1  | 1 0
      0  1  0  | 1 0
      0  1  1  | 0 1
      1  0  0  | 1 0
      1  0  1  | 0 1
      1  1  0  | 0 1
      1  1  1  | 1 1
    `);
    expect(p.contents()).toEqual([0b00, 0b10, 0b10, 0b01, 0b10, 0b01, 0b01, 0b11]);
    expect(ops.length).toBe(8);
  });

  test('from equations: a 7-segment decoder for a BCD digit', () => {
    // 4 address lines used (A3..A0) on a 5-line part: the function repeats in the low half only if
    // the high line is included, so use all five inputs and ignore A4.
    const p = new Prom();
    const segs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const eq = segs
      .map((name, s) => {
        const bit = 6 - s;
        const terms = SEVEN_SEGMENT.map((pattern, digit) =>
          (pattern >> bit) & 1
            ? `(${[3, 2, 1, 0].map((i) => ((digit >> i) & 1 ? `A${i}` : `!A${i}`)).join(' & ')} & !A4)`
            : null,
        ).filter(Boolean);
        return `D${bit} = ${terms.join(' | ')}`;
      })
      .join('\n');
    p.programEquations(eq);
    for (let digit = 0; digit < 10; digit++) expect(p.read(digit)).toBe(SEVEN_SEGMENT[digit]);
    for (let a = 10; a < 32; a++) expect(p.read(a)).toBe(0);
  });

  test('a function with fewer inputs repeats across the unused high address lines', () => {
    const p = new Prom();
    p.programTruthTable('A B | Y\n0 0 | 1\n0 1 | 0\n1 0 | 0\n1 1 | 1');
    // Y is the last output → D0; A, B are the low address lines A1, A0.
    for (let a = 0; a < 32; a++) expect(p.read(a)).toBe([1, 0, 0, 1][a & 3]);
  });

  test('inverted polarity (blown fuse reads 0)', () => {
    const p = new Prom({ addressBits: 2, width: 4, blownReads: 0 });
    expect(p.read(0)).toBe(0xf);
    p.program([0x5, 0xa, 0x0, 0xf]);
    expect(p.contents()).toEqual([0x5, 0xa, 0x0, 0xf]);
    expect(p.toFuseMap().blown).toBe(2 + 2 + 4 + 0);
  });

  test('fuse map JSON round trip', () => {
    const rng = mulberry32(3);
    const p = new Prom();
    p.program(Array.from({ length: 32 }, () => rng.int(256)));
    const json = JSON.stringify(p.toFuseMap());
    const q = Prom.fromFuseMap(JSON.parse(json));
    expect(q.contents()).toEqual(p.contents());
    expect(q.fuses).toEqual(p.fuses);
    expect(JSON.parse(json).fuses[3]).toMatch(/^[01]{8}$/);
  });

  test('evaluate from address levels, most significant first', () => {
    const p = new Prom({ addressBits: 3, width: 4 });
    p.program([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(p.evaluate([1, 0, 1])).toEqual([0, 1, 0, 1]);
  });

  test('truth table print-out and wordsOf size checks', () => {
    const p = new Prom({ addressBits: 2, width: 2 });
    p.program([0, 1, 2, 3]);
    expect(p.toTruthTable().split('\n')[4]).toBe('1 1 | 1 1');
    expect(() => wordsOf({ inputs: ['a', 'b', 'c'], outputs: ['y'], on: [], dc: [] }, { addressBits: 2, width: 2, blownReads: 1 })).toThrow(PromError);
  });
});
