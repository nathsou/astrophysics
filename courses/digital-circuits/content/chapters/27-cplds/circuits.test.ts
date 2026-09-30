import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { L0, L1, type Circuit } from '$lib/sim/netlist/types';

/** Every live circuit of Chapter 27 must show what the text says it shows. */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const NS = 1e-9;

describe('a counter is one product term per bit (Figure 27.2)', () => {
  const flat = flatten(load('t-counter'));
  const netOf = (id: string) => flat.elements.find((e) => e.id === id)!.pins[0]!;
  const make = () => createDigitalEngine(flatten(load('t-counter')));
  type E = ReturnType<typeof make>;
  const q = (e: E) => [0, 1, 2].reduce((v, i) => v | ((e.logic(netOf(`I${i}`)) === L1 ? 1 : 0) << i), 0);
  const tick = (e: E) => {
    e.setParam('CK', 'pressed', true);
    e.advance(30 * NS);
    e.setParam('CK', 'pressed', false);
    e.advance(30 * NS);
  };
  const enable = (e: E, on: boolean) => {
    e.setParam('EN', 'on', on);
    e.advance(30 * NS);
  };

  test('all three bits start at 0', () => {
    const e = make();
    e.advance(30 * NS);
    expect(q(e)).toBe(0);
    expect([0, 1, 2].every((i) => e.logic(netOf(`I${i}`)) === L0)).toBe(true);
  });

  test('with EN high, every press adds one, modulo eight', () => {
    const e = make();
    enable(e, true);
    const seen: number[] = [];
    for (let i = 0; i < 9; i++) {
      tick(e);
      seen.push(q(e));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 1]);
  });

  test('with EN low, the count holds however often the clock is pressed', () => {
    const e = make();
    enable(e, true);
    for (let i = 0; i < 5; i++) tick(e);
    expect(q(e)).toBe(5);
    enable(e, false);
    for (let i = 0; i < 4; i++) tick(e);
    expect(q(e)).toBe(5);
    enable(e, true);
    tick(e);
    expect(q(e)).toBe(6);
  });
});
