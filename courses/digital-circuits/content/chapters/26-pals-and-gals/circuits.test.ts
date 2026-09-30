import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { L0, L1, LZ, type Circuit } from '$lib/sim/netlist/types';

/** Every live circuit of Chapter 26 must show what the text says it shows. */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const NS = 1e-9;

describe('the output macrocell (Figure 26.1)', () => {
  // Each engine gets its own flattened netlist: setParam edits the element parameters in place.
  const net = (id: string, pin = 0) => flatten(load('macrocell')).elements.find((e) => e.id === id)!.pins[pin]!;
  const make = () => createDigitalEngine(flatten(load('macrocell')));
  const pin = net('PIN');
  const fb = net('FB');
  type E = ReturnType<typeof make>;
  const set = (e: E, v: Partial<Record<'T1' | 'T2' | 'POL' | 'RG' | 'OE', boolean>>) => {
    for (const [k, on] of Object.entries(v)) e.setParam(k, 'on', on);
    e.advance(20 * NS);
  };
  const tick = (e: E) => {
    e.setParam('CK', 'pressed', true);
    e.advance(20 * NS);
    e.setParam('CK', 'pressed', false);
    e.advance(20 * NS);
  };

  test('combinational and active high: the pin is the OR of the terms', () => {
    const e = make();
    const seen: number[] = [];
    for (const [a, b] of [[false, false], [true, false], [false, true], [true, true]] as const) {
      set(e, { T1: a, T2: b });
      seen.push(e.logic(pin));
    }
    expect(seen).toEqual([L0, L1, L1, L1]);
  });

  test('the polarity fuse inverts it, and a combinational output feeds back the pin itself', () => {
    const e = make();
    set(e, { POL: true, T1: false, T2: false });
    expect(e.logic(pin)).toBe(L1);
    expect(e.logic(fb)).toBe(L1);
    set(e, { T1: true });
    expect(e.logic(pin)).toBe(L0);
    expect(e.logic(fb)).toBe(L0);
  });

  test('with the output enable off the pin is Z, whatever the logic says', () => {
    const e = make();
    set(e, { T1: true, OE: false });
    expect(e.logic(pin)).toBe(LZ);
    set(e, { OE: true });
    expect(e.logic(pin)).toBe(L1);
  });

  test('registered: the pin changes only on a clock edge', () => {
    const e = make();
    set(e, { RG: true });
    set(e, { T1: true });
    expect(e.logic(pin)).toBe(L0);
    tick(e);
    expect(e.logic(pin)).toBe(L1);
    set(e, { T1: false });
    expect(e.logic(pin)).toBe(L1);
    tick(e);
    expect(e.logic(pin)).toBe(L0);
  });

  test('registered, the feedback is the flip-flop’s inverting output: the opposite of an active-high pin', () => {
    const e = make();
    set(e, { RG: true, T1: true });
    tick(e);
    expect(e.logic(pin)).toBe(L1);
    expect(e.logic(fb)).toBe(L0);
    set(e, { T1: false });
    tick(e);
    expect(e.logic(pin)).toBe(L0);
    expect(e.logic(fb)).toBe(L1);
  });

  test('registered and inverted: the register holds the OR and the polarity fuse inverts it on the way out', () => {
    const e = make();
    set(e, { RG: true, POL: true, T1: true });
    tick(e);
    expect(e.logic(pin)).toBe(L0); // Q = 1, the pin shows its inverse
    // The feedback is Q̄ whatever the polarity, so here it equals the pin.
    expect(e.logic(fb)).toBe(L0);
    set(e, { T1: false });
    tick(e);
    expect(e.logic(pin)).toBe(L1);
    expect(e.logic(fb)).toBe(L1);
  });

  test('at power-up the register is 0, so an active-low registered output starts high', () => {
    const e = make();
    set(e, { RG: true, POL: true });
    expect(e.logic(pin)).toBe(L1);
    const f = make();
    set(f, { RG: true });
    expect(f.logic(pin)).toBe(L0);
  });

  test('runs without messages', () => {
    const e = make();
    set(e, { T1: true, RG: true });
    tick(e);
    set(e, { OE: false });
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});
