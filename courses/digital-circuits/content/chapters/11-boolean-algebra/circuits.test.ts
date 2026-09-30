import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 11 must compute what the text says it computes. Each test loads the JSON exactly as
 * the page does, sets the logic switches through `setParam` (as a click does), lets the gates settle and reads the
 * indicators.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(name: string) {
  const flat = flatten(load(name));
  const e: DigitalEngine = createDigitalEngine(flat);
  const net = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  return {
    e,
    flat,
    /** Set A and B, settle, and read the named indicators. */
    row(a: number, b: number, outs: string[]): number[] {
      e.setParam('in_A', 'on', !!a);
      e.setParam('in_B', 'on', !!b);
      e.advance(100e-9);
      return outs.map((o) => e.logic(net(`out_${o}`)));
    },
  };
}

const ROWS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];

describe('the circuits load and run without messages', () => {
  for (const name of ['de-morgan', 'nand-only', 'xor-nand']) {
    test(name, () => {
      const b = bench(name);
      for (const [x, y] of ROWS) b.row(x, y, []);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('De Morgan’s twins', () => {
  test('the NAND and the OR of the inverses agree on every row, and are the NAND', () => {
    const b = bench('de-morgan');
    for (const [x, y] of ROWS) {
      const [nand, or] = b.row(x, y, ['NAND', 'OR of the inverses']);
      expect(nand).toBe(x && y ? 0 : 1);
      expect(or).toBe(nand);
    }
  });
});

describe('everything from NAND', () => {
  test('the three constructions are NOT, AND and OR', () => {
    const b = bench('nand-only');
    for (const [x, y] of ROWS) {
      expect(b.row(x, y, ['NOT A', 'A AND B', 'A OR B'])).toEqual([x ? 0 : 1, x & y, x | y]);
    }
  });
  test('they use one, two and three NAND gates, and nothing else', () => {
    const c = load('nand-only');
    const gates = c.components.filter((x) => x.type !== 'toggle' && x.type !== 'indicator');
    expect(gates.every((g) => g.type === 'nand')).toBe(true);
    expect(gates).toHaveLength(6);
  });
});

describe('XOR from four NANDs', () => {
  test('it is an XOR on every row, like the XOR gate beside it', () => {
    const b = bench('xor-nand');
    for (const [x, y] of ROWS) {
      const [four, gate] = b.row(x, y, ['four NANDs', 'XOR gate']);
      expect(four).toBe(x ^ y);
      expect(gate).toBe(x ^ y);
    }
  });
  test('the first NAND is shared: its output feeds two gates', () => {
    const b = bench('xor-nand');
    const flat = b.flat;
    const nand1 = flat.elements.filter((x) => x.type === 'nand')[0]!;
    const out = nand1.pins[nand1.pinNames.indexOf('Y')]!;
    const readers = flat.elements.filter((x) => x.type === 'nand' && x !== nand1 && x.pins.slice(0, 2).includes(out));
    expect(readers).toHaveLength(2);
  });
});
