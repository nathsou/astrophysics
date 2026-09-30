import { describe, expect, test } from 'vitest';
import { artifactOf, checkDecode, dclTemplate, deviceTruth, truthTable, type DecodeInput } from './model';

const pla: DecodeInput = {
  id: 't/pla',
  device: 'pla',
  source: '# @polarity Y=low\nX = !A & B | A & !B & C\nY = A & B | B & C\n',
  inputs: ['A', 'B', 'C'],
  outputs: ['X', 'Y'],
};
const gal: DecodeInput = {
  id: 't/gal',
  device: 'gal22v10',
  source: '# @pins A=2 B=3 C=4 D=5 Y=19 Z=18\n# @polarity Z=low\nY = A & !B | C & D\nZ = !(A & B & C)\n',
  inputs: ['A', 'B', 'C', 'D'],
  outputs: ['Y', 'Z'],
};
const prom: DecodeInput = {
  id: 't/prom',
  device: 'prom',
  source: 'A1 A0 B1 B0 | P3 P2 P1 P0\n' + Array.from({ length: 16 }, (_, m) => `${[...(m >> 2).toString(2).padStart(2, '0')].join(' ')} ${[...(m & 3).toString(2).padStart(2, '0')].join(' ')} | ${[...((m >> 2) * (m & 3)).toString(2).padStart(4, '0')].join(' ')}`).join('\n') + '\n',
  inputs: ['A1', 'A0', 'B1', 'B0'],
  outputs: ['P3', 'P2', 'P1', 'P0'],
};
const fpga: DecodeInput = {
  id: 't/fpga',
  device: 'fpga',
  inputs: ['P0', 'P1', 'P2'],
  outputs: ['P8', 'P9'],
  bitstream: {
    pads: { P0: 'in', P1: 'in', P2: 'in', P8: 'out', P9: 'out' },
    cells: [
      { at: [1, 2, 0], lut: 'I0 ^ I1' },
      { at: [1, 2, 1], lut: 'I0 ^ I1' },
      { at: [2, 2, 0], lut: 'I0 & I1 | I0 & I2 | I1 & I2' },
    ],
    routes: [['P0', 'LC(1,2,0).I0'], ['P1', 'LC(1,2,0).I1'], ['LC(1,2,0)', 'LC(1,2,1).I0'], ['P2', 'LC(1,2,1).I1'], ['LC(1,2,1)', 'P8'], ['P0', 'LC(2,2,0).I0'], ['P1', 'LC(2,2,0).I1'], ['P2', 'LC(2,2,0).I2'], ['LC(2,2,0)', 'P9']],
  },
};

describe('what the reader sees', () => {
  test('a PROM: one row per word, 1 is a blown fuse', () => {
    const a = artifactOf(prom);
    expect(a.grids[0]!.rows).toHaveLength(16);
    expect(a.grids[0]!.rows[0b1011]).toMatchObject({ label: '1011', bits: '0110' });
  });
  test('a PLA: the planes of the terms in use, and the polarity row', () => {
    const g = artifactOf(pla).grids[0]!;
    expect(g.heads.map((h) => h.label).join(' ')).toBe('A !A B !B C !C X Y');
    expect(g.rows.map((r) => r.label)).toEqual(['T0', 'T1', 'T2', 'T3', 'inverts']);
    expect(g.rows[4]!.bits.trim()).toBe('01');
    // T1 = !A & B: the complement fuse of A and the true fuse of B intact, both fuses of C blown.
    expect(g.rows[1]!.bits.split(' ')[0]).toBe('100111');
  });
  test('a GAL: the rows of each output, empty rows left out, the macrocell bits, and the pins', () => {
    const a = artifactOf(gal);
    expect(a.grids[0]!.heads).toHaveLength(22);
    expect(a.grids[0]!.rows.map((r) => r.note)).toEqual(['pin 19 output enable', 'pin 19, term 1', 'pin 19, term 2', 'pin 18 output enable', 'pin 18, term 1']);
    expect(a.grids[0]!.rows.every((r) => r.bits.length === 44)).toBe(true);
    expect(a.listings.find((l) => l.title.startsWith('Macrocell'))!.rows).toEqual([['19', '1', '1', 'active high, combinational'], ['18', '0', '1', 'active low, combinational']]);
    expect(a.listings[0]!.rows).toContainEqual(['19', 'Y', 'output']);
  });
  test('a bitstream: the cells in use, their LUTs, and what drives them', () => {
    const a = artifactOf(fpga);
    const cells = a.listings.find((l) => l.title === 'Logic cells in use')!;
    expect(cells.rows.map((r) => [r[0], r[2]])).toEqual([['LC(1,2,0)', '0x6666'], ['LC(1,2,1)', '0x6666'], ['LC(2,2,0)', '0xe8e8']]);
    const routing = a.listings.find((l) => l.title.startsWith('Routing'))!;
    expect(routing.rows).toContainEqual(['LC(1,2,1).I0', 'LC(1,2,0)']);
  });
});

describe('the device, not the source, is the truth', () => {
  test('truth tables come from running the configured device', () => {
    expect(deviceTruth(pla)).toEqual([[0, 0], [0, 0], [1, 0], [1, 1], [0, 0], [1, 0], [0, 1], [0, 1]]);
    expect(truthTable(fpga)).toEqual({ P8: [0, 1, 1, 0, 1, 0, 0, 1], P9: [0, 0, 0, 1, 0, 1, 1, 1] });
  });
});

describe('checking an answer', () => {
  test('an equivalent expression passes, however it is written', () => {
    expect(checkDecode(pla, { mode: 'expression', text: 'X = !A & B | A & !B & C\nY = B & (A | C)' }).pass).toBe(true);
    expect(checkDecode(pla, { mode: 'expression', text: 'Y = !(!B | !A & !C) // by De Morgan\nX = B & !A | C & A & !B' }).pass).toBe(true);
  });
  test('a wrong one comes back as rows of input, expected and got', () => {
    const r = checkDecode(pla, { mode: 'expression', text: 'X = !A & B\nY = B & (A | C)' });
    expect(r.pass).toBe(false);
    expect(r.rows).toEqual([{ inputs: { A: '1', B: '0', C: '1' }, expected: { X: '1', Y: '0' }, got: { X: '0', Y: '0' }, differ: ['X'] }]);
  });
  test('the answer must be about these pins', () => {
    expect(checkDecode(pla, { mode: 'expression', text: 'X = A\n' }).problems).toEqual(['There is no equation for Y. Write Y = …']);
    expect(checkDecode(pla, { mode: 'expression', text: 'X = A & Q\nY = B' }).problems).toEqual(['Q is not one of the inputs (A, B, C).']);
    expect(checkDecode(pla, { mode: 'expression', text: '' }).pass).toBe(false);
  });
  test('a table must be filled in, and is compared cell by cell', () => {
    const t = truthTable(pla);
    expect(checkDecode(pla, { mode: 'table', table: { X: t.X!, Y: t.Y!.map((v, i) => (i === 3 ? null : v)) } }).problems).toEqual(['Fill in every cell of the table first.']);
    expect(checkDecode(pla, { mode: 'table', table: t }).pass).toBe(true);
    expect(checkDecode(pla, { mode: 'table', table: { ...t, X: t.X!.map((v) => (1 - v) as 0 | 1) } }).pass).toBe(false);
  });
  test('a DCL module named Decoded, with lower-case bit ports, is run against the device', () => {
    expect(dclTemplate(pla)).toBe('module Decoded(a: bit, b: bit, c: bit) -> (x: bit, y: bit) {\n  x = 0\n  y = 0\n}\n');
    const good = 'module Decoded(a: bit, b: bit, c: bit) -> (x: bit, y: bit) {\n  x = !a & b | a & !b & c\n  y = b & (a | c)\n}\n';
    expect(checkDecode(pla, { mode: 'dcl', text: good }).pass).toBe(true);
    expect(checkDecode(pla, { mode: 'dcl', text: dclTemplate(pla) }).pass).toBe(false);
    expect(checkDecode(pla, { mode: 'dcl', text: good.replace('Decoded', 'Other') }).problems[0]).toMatch(/Name the module `Decoded`/);
    expect(checkDecode(pla, { mode: 'dcl', text: good.replace('c: bit', 'c: bits<2>') }).pass).toBe(false);
  });
  test('the same holds for the GAL and the bitstream', () => {
    expect(checkDecode(gal, { mode: 'expression', text: 'Y = A & !B | C & D\nZ = !(A & B & C)' }).pass).toBe(true);
    expect(checkDecode(gal, { mode: 'expression', text: 'Y = A & !B | C & D\nZ = A & B & C' }).pass).toBe(false);
    expect(checkDecode(fpga, { mode: 'expression', text: 'P8 = P0 ^ P1 ^ P2\nP9 = P0 & P1 | P0 & P2 | P1 & P2' }).pass).toBe(true);
    expect(checkDecode(fpga, { mode: 'expression', text: 'P8 = P0 ^ P1\nP9 = P0 & P1' }).pass).toBe(false);
  });
});
