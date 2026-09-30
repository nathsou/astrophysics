import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { createSwitchEngine } from '$lib/sim/switch';
import { L0, L1, type Circuit } from '$lib/sim/netlist/types';

/** Every live circuit of Chapter 28 must show what the text says it shows. */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const NS = 1e-9;
const netOf = (flat: ReturnType<typeof flatten>, id: string, pin = 0): number => flat.elements.find((e) => e.id === id)!.pins[pin]!;

describe('a logic cell in miniature (Figure 28.2)', () => {
  const make = () => {
    const flat = flatten(load('logic-cell'));
    const e = createDigitalEngine(flat);
    const out = netOf(flat, 'OUT');
    const set = (v: Record<string, boolean>) => {
      for (const [k, on] of Object.entries(v)) e.setParam(k, 'on', on);
      e.advance(20 * NS);
    };
    const tick = () => {
      e.setParam('CK', 'pressed', true);
      e.advance(20 * NS);
      e.setParam('CK', 'pressed', false);
      e.advance(20 * NS);
    };
    const bits = (m: number) => set({ M0: !!(m & 1), M1: !!(m & 2), M2: !!(m & 4), M3: !!(m & 8) });
    return { e, out, set, tick, bits };
  };

  test('as drawn it is an XOR: bits 1 and 2 are set', () => {
    const { e, out, set } = make();
    const seen: number[] = [];
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      set({ A: !!a, B: !!b });
      seen.push(e.logic(out));
    }
    expect(seen).toEqual([L0, L1, L1, L0]);
  });

  test('the four stored bits are the truth table, in the order A + 2B: 0b1000 is AND, 0b1110 is OR', () => {
    const { e, out, set, bits } = make();
    for (const [table, want] of [[0b1000, [0, 0, 0, 1]], [0b1110, [0, 1, 1, 1]], [0b0001, [1, 0, 0, 0]], [0b0110, [0, 1, 1, 0]]] as const) {
      bits(table);
      const got: number[] = [];
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        set({ A: !!a, B: !!b });
        got.push(e.logic(out));
      }
      expect(got).toEqual(want);
    }
  });

  test('with the flip-flop in the path the output changes only when the clock is pressed', () => {
    const { e, out, set, tick } = make();
    set({ REG: true, A: false, B: false });
    tick(); // load the LUT output for A = B = 0, which is 0
    expect(e.logic(out)).toBe(L0);
    set({ A: true });
    expect(e.logic(out)).toBe(L0); // the LUT now says 1, the flip-flop has not been told
    tick();
    expect(e.logic(out)).toBe(L1);
    set({ A: false });
    expect(e.logic(out)).toBe(L1);
    tick();
    expect(e.logic(out)).toBe(L0);
  });

  test('bypassing the flip-flop again gives the LUT output at once', () => {
    const { e, out, set, tick } = make();
    set({ REG: true, A: true, B: false });
    tick();
    expect(e.logic(out)).toBe(L1);
    set({ A: false, REG: false });
    expect(e.logic(out)).toBe(L0);
  });
});

describe('a configuration bit is a switch (Figure 28.4)', () => {
  const make = () => {
    const flat = flatten(load('config-bit'));
    const e = createSwitchEngine(flat);
    const out = netOf(flat, 'OUT');
    const q = netOf(flat, 'PT', 0); // the pass transistor's gate is the cell's Q
    const write = (v: 0 | 1) => {
      e.setParam('BL', 'on', v === 1);
      e.setParam('BLB', 'on', v === 0);
      e.setParam('WL', 'on', true);
      e.settle();
      e.setParam('WL', 'on', false);
      e.settle();
    };
    return { e, out, q, write };
  };

  test('after writing a 1 the transistor conducts and the signal passes, both ways round', () => {
    const { e, out, q, write } = make();
    write(1);
    expect(e.logic(q)).toBe(L1);
    e.setParam('IN', 'on', true);
    e.settle();
    expect(e.logic(out)).toBe(L1);
    e.setParam('IN', 'on', false);
    e.settle();
    expect(e.logic(out)).toBe(L0);
  });

  test('after writing a 0 the transistor is off and the pull-down wins: the output is 0, whatever the input does', () => {
    const { e, out, q, write } = make();
    write(0);
    expect(e.logic(q)).toBe(L0);
    for (const v of [true, false]) {
      e.setParam('IN', 'on', v);
      e.settle();
      expect(e.logic(out)).toBe(L0);
    }
  });

  test('the cell holds its bit while the bit lines and the input do anything, as long as the word line is low', () => {
    const { e, out, q, write } = make();
    write(1);
    for (const [bl, blb] of [[false, true], [true, false], [false, false], [true, true]] as const) {
      e.setParam('BL', 'on', bl);
      e.setParam('BLB', 'on', blb);
      e.settle();
      expect(e.logic(q)).toBe(L1);
    }
    e.setParam('IN', 'on', true);
    e.settle();
    expect(e.logic(out)).toBe(L1);
    write(0);
    expect(e.logic(q)).toBe(L0);
  });

  test('the pass transistor’s gate is fed only by the cell: no switch or bit line is attached to it', () => {
    const flat = flatten(load('config-bit'));
    const gate = netOf(flat, 'PT', 0);
    const onIt = flat.elements.filter((el) => el.pins.includes(gate));
    expect(onIt.map((el) => el.id).sort()).toEqual(['AX1', 'NA', 'NB', 'PA', 'PB', 'PT']);
    expect(onIt.some((el) => el.type === 'toggle')).toBe(false);
  });

  test('six transistors make the cell and a seventh is the switch it controls', () => {
    const flat = flatten(load('config-bit'));
    expect(flat.elements.filter((el) => el.type === 'nmos' || el.type === 'pmos')).toHaveLength(7);
    expect(flat.elements.filter((el) => el.id !== 'PT' && (el.type === 'nmos' || el.type === 'pmos'))).toHaveLength(6);
  });
});
