import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

describe('segment a of a 7-segment display', () => {
  const flat = flatten(load('seg-a'));
  const e = createDigitalEngine(flat);
  const out = flat.elements.find((x) => x.id === 'out_a')!.pins[0]!;
  const read = (digit: number) => {
    'ABCD'.split('').forEach((nm, v) => e.setParam(`in_${nm}`, 'on', !!((digit >> (3 - v)) & 1)));
    e.advance(200e-9);
    return e.logic(out);
  };

  test('lit for 0, 2, 3, 5, 6, 7, 8, 9 and dark for 1 and 4', () => {
    const lit = [0, 2, 3, 5, 6, 7, 8, 9];
    for (let d = 0; d < 10; d++) expect(read(d), `digit ${d}`).toBe(lit.includes(d) ? 1 : 0);
  });

  test('the six unused codes give a definite 0 or 1 (never X), whichever it is', () => {
    for (let d = 10; d < 16; d++) expect([0, 1]).toContain(read(d));
  });

  test('it is the four-term circuit: two inverters, two ANDs and a four-input OR', () => {
    const types = load('seg-a').components.map((c) => c.type).filter((t) => !['toggle', 'indicator'].includes(t));
    expect(types.sort()).toEqual(['and', 'and', 'not', 'not', 'or']);
  });

  test('it runs without messages', () => {
    for (let d = 0; d < 16; d++) read(d);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});
