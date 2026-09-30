import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { OCTET_CONDITIONS } from '$lib/sim/cpu/octet';
import { referenceLines } from '../21-datapath/hardware/control-word';

/**
 * The live circuits of Chapter 22 do what the text and the captions say: the jump condition unit agrees with the ISA's
 * sixteen conditions for every flag combination, the PC_LD equation is the hardwired unit's, and the tiny microcoded
 * sequencer walks through the fetch.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(c: Circuit) {
  const flat = flatten(c);
  const e: DigitalEngine = createDigitalEngine(flat);
  const pin = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  return {
    e,
    set(v: Record<string, number>) {
      for (const [k, x] of Object.entries(v)) e.setParam(`in_${k}`, 'on', !!x);
      e.advance(200e-9);
    },
    press(id: string) {
      e.setParam(`in_${id}`, 'pressed', true);
      e.advance(50e-9);
      e.setParam(`in_${id}`, 'pressed', false);
      e.advance(50e-9);
    },
    at: (id: string) => e.logic(pin(id)),
  };
}
const problems = (b: ReturnType<typeof bench>) => b.e.messages.filter((m) => m.level !== 'info');

describe('the circuits load and run', () => {
  for (const name of ['condition', 'pc-load', 'sequencer']) {
    test(name, () => {
      const b = bench(load(name));
      b.e.advance(1e-6);
      expect(problems(b)).toEqual([]);
    });
  }
});

describe('Figure 22.1: the jump condition', () => {
  test('all 16 conditions with all 16 flag combinations give what the ISA says', () => {
    const b = bench(load('condition'));
    for (const cond of OCTET_CONDITIONS)
      for (let f = 0; f < 16; f++) {
        const flags = { z: !!(f & 8), c: !!(f & 4), n: !!(f & 2), v: !!(f & 1) };
        b.set({ Z: +flags.z, C: +flags.c, N: +flags.n, V: +flags.v, K3: (cond.code >> 3) & 1, K2: (cond.code >> 2) & 1, K1: (cond.code >> 1) & 1, K0: cond.code & 1 });
        expect(b.at('out'), `${cond.mnemonic} with ${JSON.stringify(flags)}`).toBe(+cond.test(flags));
      }
  });
});

describe('Figure 22.2: one control line', () => {
  test('PC_LD is Jcc·STEP4·TAKEN + RET·STEP4 + CALL·STEP7, and that is what the microprogram says', () => {
    const b = bench(load('pc-load'));
    const names = ['JCC', 'CALL', 'RET', 'STEP4', 'STEP7', 'TAKEN'];
    for (let m = 0; m < 64; m++) {
      const x: Record<string, number> = {};
      names.forEach((n, i) => (x[n] = (m >> (5 - i)) & 1));
      b.set(x);
      const want = (x.JCC! && x.STEP4! && x.TAKEN!) || (x.RET! && x.STEP4!) || (x.CALL! && x.STEP7!) ? 1 : 0;
      expect(b.at('out'), names.map((n) => x[n]).join('')).toBe(want);
    }
    // The equation is the microprogram's, for the real instructions (step 4 is the second execute step, step 7 the fifth).
    expect(referenceLines(4, 0x70 | 3, false).PC_LD).toBe(1); // RET
    expect(referenceLines(7, 0x70 | 2, false).PC_LD).toBe(1); // CALL
    expect(referenceLines(4, 0xf3, true).PC_LD).toBe(1); // JNZ, taken
    expect(referenceLines(4, 0xf3, false).PC_LD).toBe(0); // JNZ, not taken
  });
});

describe('Figure 22.3: a control store and a counter', () => {
  test('each press of the clock reads the next word: fetch, fetch, decode, and back to the start', () => {
    const b = bench(load('sequencer'));
    b.set({ RST: 1 });
    b.press('CLK');
    b.set({ RST: 0 });
    const lit = () => ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'].map((id) => b.at(id)).join('');
    const seen: string[] = [lit()];
    for (let i = 0; i < 3; i++) {
      b.press('CLK');
      seen.push(lit());
    }
    // OE_PC LD_MAR OE_MEM LD_IR PC_INC END
    expect(seen).toEqual(['110000', '001110', '000001', '110000']);
  });
});
