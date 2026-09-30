import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * The live circuit of Chapter 31 does what the text says: a memory read at once (as in Chapter 22) and the same memory
 * behind an address register (a block RAM), which shows the word only after the clock edge.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const circuit = JSON.parse(readFileSync(dir + 'memory-read.json', 'utf8')) as Circuit;

function bench() {
  const flat = flatten(circuit);
  const e = createDigitalEngine(flat);
  const pin = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  const word = (prefix: string) => [0, 1, 2, 3].reduce((v, i) => v | (e.logic(pin(prefix + i)) === 1 ? 1 << i : 0), 0);
  return {
    e,
    address(a: number) {
      e.setParam('in_A0', 'on', !!(a & 1));
      e.setParam('in_A1', 'on', !!(a & 2));
      e.advance(200e-9);
    },
    clock() {
      e.setParam('in_CLK', 'pressed', true);
      e.advance(50e-9);
      e.setParam('in_CLK', 'pressed', false);
      e.advance(50e-9);
    },
    now: () => word('oa'),
    later: () => word('ob'),
  };
}

describe('Figure 31.2: two ways to read a memory', () => {
  test('runs without messages', () => {
    const b = bench();
    b.e.advance(1e-6);
    expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('the asynchronous read follows the address at once', () => {
    const b = bench();
    for (const [a, w] of [[0, 1], [1, 2], [2, 4], [3, 8], [1, 2]] as const) {
      b.address(a);
      expect(b.now()).toBe(w);
    }
  });

  test('the synchronous read shows the word of the address the last clock edge saw', () => {
    const b = bench();
    b.clock();
    b.address(2);
    expect(b.now()).toBe(4);
    expect(b.later()).toBe(1); // still the word of address 0
    b.clock();
    expect(b.later()).toBe(4);
    b.address(3);
    expect(b.later()).toBe(4); // not yet
    b.clock();
    expect(b.later()).toBe(8);
  });
});
