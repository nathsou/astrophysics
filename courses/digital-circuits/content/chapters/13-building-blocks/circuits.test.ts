import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { NetlistBuilder, createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { SEG7 } from '$lib/partsbin/refs';
import { layoutDag } from '../11-boolean-algebra/widgets/layout';
import { INPUTS, SEG_NAMES, allEquations, sharedCost, sharedDag, sharedNetwork, segmentDag } from './widgets/seg';

/**
 * Every live circuit of Chapter 13 must compute what the text says it computes. Each test loads the JSON exactly as the
 * page does, sets the logic switches through `setParam` (as a click does), lets the gates settle and reads the
 * indicators. The other tests check the numbers that the text quotes.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(c: Circuit) {
  const flat = flatten(c);
  const e: DigitalEngine = createDigitalEngine(flat);
  const net = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  return {
    e,
    flat,
    set(values: Record<string, number>) {
      for (const [k, v] of Object.entries(values)) e.setParam(`in_${k}`, 'on', !!v);
      e.advance(200e-9);
    },
    read(names: string[]): number[] {
      return names.map((n) => e.logic(net(`out_${n}`)));
    },
  };
}

describe('the circuits load and run without messages', () => {
  for (const name of ['mux2', 'decoder', 'decoder-or', 'comparator', 'parity']) {
    test(name, () => {
      const b = bench(load(name));
      b.e.advance(1e-6);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
  test('none of them needs the parts bin: no part: components', () => {
    for (const name of ['mux2', 'decoder', 'decoder-or', 'comparator', 'parity']) expect(load(name).components.filter((c) => c.type.startsWith('part:'))).toEqual([]);
  });
});

describe('Figure 13.1: the 2:1 multiplexer', () => {
  test('Y follows D0 when S = 0 and D1 when S = 1, on all eight rows', () => {
    const b = bench(load('mux2'));
    for (let m = 0; m < 8; m++) {
      const [d0, d1, s] = [(m >> 2) & 1, (m >> 1) & 1, m & 1];
      b.set({ D0: d0, D1: d1, S: s });
      expect(b.read(['Y'])).toEqual([s ? d1 : d0]);
    }
  });
  test('it has four gates: one inverter, two ANDs, one OR', () => {
    const types = load('mux2').components.map((c) => c.type).filter((t) => !['toggle', 'indicator'].includes(t));
    expect(types.sort()).toEqual(['and', 'and', 'not', 'or']);
  });
});

describe('Figure 13.4: the 2-to-4 decoder', () => {
  test('exactly the addressed output is 1 while EN = 1, and none while EN = 0', () => {
    const b = bench(load('decoder'));
    for (let a = 0; a < 4; a++) {
      b.set({ A1: a >> 1, A0: a & 1, EN: 1 });
      expect(b.read(['Y0', 'Y1', 'Y2', 'Y3'])).toEqual([0, 1, 2, 3].map((i) => +(i === a)));
      b.set({ EN: 0 });
      expect(b.read(['Y0', 'Y1', 'Y2', 'Y3'])).toEqual([0, 0, 0, 0]);
    }
  });
});

describe('Figure 13.5: a decoder and OR gates', () => {
  test('sum and carry are those of a full adder on all eight rows', () => {
    const b = bench(load('decoder-or'));
    for (let m = 0; m < 8; m++) {
      const [a, bb, c] = [(m >> 2) & 1, (m >> 1) & 1, m & 1];
      b.set({ A: a, B: bb, C: c });
      const total = a + bb + c;
      expect(b.read(['sum', 'carry'])).toEqual([total & 1, total >> 1]);
    }
  });
  test('the decoder inside is the 3-to-8 one: eight AND outputs of the three inputs and the enable', () => {
    const c = load('decoder-or');
    expect(Object.keys(c.subcircuits ?? {})).toEqual(['dec3to8']);
    expect(c.subcircuits!.dec3to8!.components.filter((x) => x.type === 'and')).toHaveLength(8);
  });
});

describe('Figure 13.7: the 4-bit comparator', () => {
  test('EQ, LT and GT are right for all 256 pairs, and exactly one is on', () => {
    const b = bench(load('comparator'));
    for (let a = 0; a < 16; a++)
      for (let bb = 0; bb < 16; bb++) {
        b.set({ A3: (a >> 3) & 1, A2: (a >> 2) & 1, A1: (a >> 1) & 1, A0: a & 1, B3: (bb >> 3) & 1, B2: (bb >> 2) & 1, B1: (bb >> 1) & 1, B0: bb & 1 });
        const got = b.read(['EQ', 'LT', 'GT']);
        expect(got, `${a} vs ${bb}`).toEqual([+(a === bb), +(a < bb), +(a > bb)]);
      }
  });
  test('it takes fifteen gates', () => {
    expect(load('comparator').components.filter((c) => !['toggle', 'indicator'].includes(c.type))).toHaveLength(15);
  });
});

describe('Figure 13.8: parity across a noisy wire', () => {
  test('P makes the number of 1s even; one flipped bit lights ERR, two flipped bits do not', () => {
    const b = bench(load('parity'));
    for (let d = 0; d < 16; d++) {
      const bits = { D0: d & 1, D1: (d >> 1) & 1, D2: (d >> 2) & 1, D3: (d >> 3) & 1 };
      const ones = bits.D0 + bits.D1 + bits.D2 + bits.D3;
      for (const [e1, e2] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        b.set({ ...bits, E1: e1, E2: e2 });
        const [p, err] = b.read(['P', 'ERR']);
        expect(p, `data ${d}`).toBe(ones % 2);
        expect(err, `data ${d}, errors ${e1}${e2}`).toBe((e1 + e2) % 2);
      }
    }
  });
});

describe('the mux block and unknown selects (the hood box)', () => {
  function rig(d0: number, d1: number) {
    const b = new NetlistBuilder();
    const [n0, n1, s, y] = [b.net('D0'), b.net('D1'), b.net('S'), b.net('Y')];
    b.add('const', 'K0', { Y: n0 }, { value: d0 });
    b.add('const', 'K1', { Y: n1 }, { value: d1 });
    b.add('mux', 'M', { D0: n0, D1: n1, S0: s, Y: y }, { select: 1 });
    const e = createDigitalEngine(b.build());
    e.advance(20e-9);
    return e.logic(y);
  }
  test('with the select unknown, equal data give a definite output and different data give X', () => {
    expect(rig(1, 1)).toBe(1);
    expect(rig(0, 0)).toBe(0);
    expect(rig(0, 1)).toBe(2);
    expect(rig(1, 0)).toBe(2);
  });
});

describe('the seven-segment decoder', () => {
  const run = (c: Circuit, outs: string[]) => {
    const b = bench(c);
    return (digit: number) => {
      b.set(Object.fromEntries(INPUTS.map((nm, v) => [nm, (digit >> (3 - v)) & 1])));
      return b.read(outs);
    };
  };
  test('the shared network lights the right segments for every hex digit, on the engine', () => {
    const read = run(layoutDag(sharedDag('hex'), { title: 'seg7' }), SEG_NAMES);
    for (let d = 0; d < 16; d++) expect(read(d), `digit ${d}`).toEqual(SEG_NAMES.map((_, s) => (SEG7[d]! >> s) & 1));
  });
  test('the decimal network is right for 0–9 (and is something, not X, for 10–15)', () => {
    const read = run(layoutDag(sharedDag('bcd'), { title: 'seg7' }), SEG_NAMES);
    for (let d = 0; d < 10; d++) expect(read(d), `digit ${d}`).toEqual(SEG_NAMES.map((_, s) => (SEG7[d]! >> s) & 1));
    for (let d = 10; d < 16; d++) expect(read(d).every((v) => v === 0 || v === 1)).toBe(true);
  });
  test('each segment’s own circuit (as the flagship draws it) is right, in both modes', () => {
    for (const mode of ['hex', 'bcd'] as const)
      for (let s = 0; s < 7; s++) {
        const read = run(layoutDag(segmentDag(s, mode), { title: 'seg' }), [SEG_NAMES[s]!]);
        for (let d = 0; d < (mode === 'hex' ? 16 : 10); d++) expect(read(d)[0], `${mode} ${SEG_NAMES[s]} ${d}`).toBe((SEG7[d]! >> s) & 1);
      }
  });
  test('the numbers in the text: literals, terms and gates', () => {
    expect(allEquations('hex').map((e) => e.literals)).toEqual([14, 13, 10, 14, 8, 11, 11]);
    expect(allEquations('hex').reduce((a, e) => a + e.literals, 0)).toBe(81);
    expect(allEquations('bcd').reduce((a, e) => a + e.literals, 0)).toBe(42);
    expect(sharedCost('hex').terms).toBe(28);
    const hex = sharedNetwork('hex');
    expect([hex.terms.length, hex.gates, hex.inverters, hex.ands, hex.ors]).toEqual([14, 30, 4, 14, 12]);
    const bcd = sharedNetwork('bcd');
    expect([bcd.terms.length, bcd.gates]).toEqual([9, 18]);
  });
  test('the quoted formulas of segments c and e', () => {
    expect(allEquations('bcd')[2]!.text).toMatch(/^(¬D1 \+ D0 \+ D2|D0 \+ ¬D1 \+ D2|D2 \+ ¬D1 \+ D0|¬D1 \+ D2 \+ D0|D0 \+ D2 \+ ¬D1|D2 \+ D0 \+ ¬D1)$/);
    expect(allEquations('hex')[2]!.terms).toHaveLength(5);
    expect(allEquations('hex')[4]!.literals).toBe(8);
    expect(allEquations('bcd')[4]!.literals).toBe(4);
  });
  test('the real-lab circuit: segment e is NOR(D0, D2·¬D1) for the decimal digits', () => {
    for (let d = 0; d < 10; d++) {
      const [d0, d1, d2] = [d & 1, (d >> 1) & 1, (d >> 2) & 1];
      const e = +!(d0 || (d2 && !d1));
      expect(e, `digit ${d}`).toBe((SEG7[d]! >> 4) & 1);
    }
  });
});
