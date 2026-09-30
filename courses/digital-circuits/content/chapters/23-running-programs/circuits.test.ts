import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { OCTET_CONDITIONS } from '$lib/sim/cpu/octet';

/**
 * Every live circuit of Chapter 23 must do what the text says. Each test loads the JSON as the page does, sets the logic
 * switches through `setParam` (as a click does), lets the gates settle and reads the lamp.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

describe('Figure 23.5: the jump condition unit', () => {
  const c = load('jump-unit');
  const flat = flatten(c);
  const e = createDigitalEngine(flat);
  const lamp = flat.elements.find((x) => x.id === 'out_TAKEN')!.pins[0]!;
  const set = (name: string, v: boolean) => e.setParam(`in_${name}`, 'on', v);

  test('it loads and runs without a message', () => {
    e.advance(200e-9);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('for all 16 conditions and all 16 settings of the flags, the lamp agrees with the specification’s table of conditions', () => {
    let checked = 0;
    for (let code = 0; code < 16; code++) {
      for (let f = 0; f < 16; f++) {
        const flags = { z: !!(f & 8), c: !!(f & 4), n: !!(f & 2), v: !!(f & 1) };
        set('Z', flags.z);
        set('C', flags.c);
        set('N', flags.n);
        set('V', flags.v);
        set('c3', !!(code & 8));
        set('c2', !!(code & 4));
        set('c1', !!(code & 2));
        set('c0', !!(code & 1));
        e.advance(200e-9);
        const want = OCTET_CONDITIONS[code]!.test(flags);
        expect(e.logic(lamp), `${OCTET_CONDITIONS[code]!.mnemonic} with Z=${+flags.z} C=${+flags.c} N=${+flags.n} V=${+flags.v}`).toBe(want ? 1 : 0);
        checked++;
      }
    }
    expect(checked).toBe(256);
  });

  test('it is a multiplexer, an XOR and three small gates: 3 conditions need a gate of their own', () => {
    const types = c.components.map((x) => x.type);
    expect(types.filter((t) => t === 'mux')).toHaveLength(1);
    expect(types.filter((t) => t === 'xor')).toHaveLength(2); // N xor V, and the inverting XOR
    expect(types.filter((t) => t === 'or')).toHaveLength(2);
    expect(c.components.filter((x) => x.type === 'toggle')).toHaveLength(8);
  });

  test('JNEVER (0001) never jumps and JMP (0000) always does, whatever the flags', () => {
    for (const [code, want] of [[1, 0], [0, 1]] as const) {
      for (let f = 0; f < 16; f++) {
        set('Z', !!(f & 8));
        set('C', !!(f & 4));
        set('N', !!(f & 2));
        set('V', !!(f & 1));
        set('c3', false);
        set('c2', false);
        set('c1', false);
        set('c0', !!(code & 1));
        e.advance(200e-9);
        expect(e.logic(lamp)).toBe(want);
      }
    }
  });
});
