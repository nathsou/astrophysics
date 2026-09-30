import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { add, subtract } from './widgets/wheel';

/**
 * Every live circuit of Chapter 14 must compute what the text says it computes. Each test loads the JSON exactly as the
 * page does, sets the logic switches through `setParam` (as a click does), lets the gates settle and reads the
 * indicators.
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
      e.advance(300e-9);
    },
    read: (names: string[]): number[] => names.map((n) => e.logic(net(`out_${n}`))),
  };
}
const bitsOf = (prefix: string, v: number, n = 4) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, (v >> i) & 1]));
const gates = (c: Circuit) => c.components.filter((x) => !['toggle', 'indicator', 'hex-display'].includes(x.type));

describe('the circuits load and run without messages', () => {
  for (const name of ['full-adder', 'ripple4', 'addsub', 'lookahead4']) {
    test(name, () => {
      const b = bench(load(name));
      b.e.advance(1e-6);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
  test('none of them needs the parts bin: no part: components', () => {
    for (const name of ['full-adder', 'ripple4', 'addsub', 'lookahead4']) expect(load(name).components.filter((c) => c.type.startsWith('part:'))).toEqual([]);
  });
});

describe('Figure 14.2: the full adder', () => {
  test('S and COUT are the number of 1s among the inputs, written in binary', () => {
    const b = bench(load('full-adder'));
    for (let m = 0; m < 8; m++) {
      const [a, bb, c] = [(m >> 2) & 1, (m >> 1) & 1, m & 1];
      b.set({ A: a, B: bb, CIN: c });
      const [s, co] = b.read(['S', 'COUT']) as [number, number];
      expect(co * 2 + s, `${a}${bb}${c}`).toBe(a + bb + c);
    }
  });
  test('five gates: two XORs, two ANDs and an OR', () => {
    expect(gates(load('full-adder')).map((g) => g.type).sort()).toEqual(['and', 'and', 'or', 'xor', 'xor']);
  });
});

describe('Figure 14.3: the 4-bit ripple-carry adder', () => {
  test('all 512 additions (with carry in) are right', () => {
    const b = bench(load('ripple4'));
    for (let a = 0; a < 16; a++)
      for (let bb = 0; bb < 16; bb++)
        for (const c of [0, 1]) {
          b.set({ ...bitsOf('A', a), ...bitsOf('B', bb), CIN: c });
          const out = b.read(['S0', 'S1', 'S2', 'S3', 'COUT']);
          expect(out.reduce((v, x, i) => v + x * 2 ** i, 0), `${a}+${bb}+${c}`).toBe(a + bb + c);
        }
  });
  test('it is four copies of one full adder', () => {
    const c = load('ripple4');
    expect(c.components.filter((x) => x.type === 'sub:fa')).toHaveLength(4);
    expect(Object.keys(c.subcircuits ?? {})).toEqual(['fa']);
    expect(c.subcircuits!.fa!.components.filter((x) => ['xor', 'and', 'or'].includes(x.type))).toHaveLength(5);
  });
});

describe('Figure 14.4: the carry unit of a 4-bit lookahead adder', () => {
  test('every carry obeys c(k+1) = g(k) + p(k)·c(k), for all 512 settings of the inputs', () => {
    const b = bench(load('lookahead4'));
    for (let m = 0; m < 512; m++) {
      const v = { g0: m & 1, p0: (m >> 1) & 1, g1: (m >> 2) & 1, p1: (m >> 3) & 1, g2: (m >> 4) & 1, p2: (m >> 5) & 1, g3: (m >> 6) & 1, p3: (m >> 7) & 1, C0: (m >> 8) & 1 };
      b.set(v);
      let c = v.C0;
      const want = [0, 1, 2, 3].map((i) => (c = v[`g${i}` as 'g0'] | (v[`p${i}` as 'p0'] & c)));
      expect(b.read(['C1', 'C2', 'C3', 'C4']), `setting ${m}`).toEqual(want);
    }
  });
  test('with the p and g of real operands, the carries and the sums p ⊕ carry are right for all 512 additions', () => {
    const b = bench(load('lookahead4'));
    for (let a = 0; a < 16; a++)
      for (let bb = 0; bb < 16; bb++)
        for (const cin of [0, 1]) {
          const v: Record<string, number> = { C0: cin };
          for (let i = 0; i < 4; i++) {
            v[`g${i}`] = (a >> i) & (bb >> i) & 1;
            v[`p${i}`] = ((a >> i) ^ (bb >> i)) & 1;
          }
          b.set(v);
          const c = [cin, ...b.read(['C1', 'C2', 'C3', 'C4'])];
          const sum = [0, 1, 2, 3].reduce((t, i) => t + ((v[`p${i}`]! ^ c[i]!) << i), 0) + (c[4]! << 4);
          expect(sum, `${a}+${bb}+${cin}`).toBe(a + bb + cin);
        }
  });
  test('14 gates: ten ANDs and four ORs, the widest AND with five inputs; a whole adder is 8 + 14 + 4 = 26 gates against 20', () => {
    const c = load('lookahead4');
    const g = gates(c);
    expect(g).toHaveLength(14);
    expect(g.filter((x) => x.type === 'and')).toHaveLength(10);
    expect(g.filter((x) => x.type === 'or')).toHaveLength(4);
    expect(Math.max(...g.map((x) => Number(x.params?.inputs ?? 2)))).toBe(5);
    expect(8 + g.length + 4).toBe(26);
    expect(load('ripple4').subcircuits!.fa!.components.filter((x) => ['xor', 'and', 'or'].includes(x.type)).length * 4).toBe(20);
  });
});

describe('Figure 14.6: the adder/subtractor', () => {
  test('S is A + B or A − B modulo 16, with C and V as a processor would report them, for every pair', () => {
    const b = bench(load('addsub'));
    for (let a = 0; a < 16; a++)
      for (let bb = 0; bb < 16; bb++)
        for (const sub of [0, 1]) {
          b.set({ ...bitsOf('A', a), ...bitsOf('B', bb), SUB: sub });
          const want = sub ? subtract(a, bb, 4) : add(a, bb, 4);
          const [c, v] = b.read(['C', 'V']);
          expect(b.e.state('out_hexS').value, `${a} ${sub ? '−' : '+'} ${bb}`).toBe(want.result);
          expect(c).toBe(+want.carry);
          expect(v).toBe(+want.overflow);
        }
  });
  test('5 − 3 = 2, 3 − 5 = 14 (that is −2) and 7 + 1 sets V, as the text says', () => {
    const b = bench(load('addsub'));
    b.set({ ...bitsOf('A', 5), ...bitsOf('B', 3), SUB: 1 });
    expect(b.e.state('out_hexS').value).toBe(2);
    b.set({ ...bitsOf('A', 3), ...bitsOf('B', 5), SUB: 1 });
    expect(b.e.state('out_hexS').value).toBe(14);
    b.set({ ...bitsOf('A', 7), ...bitsOf('B', 1), SUB: 0 });
    expect(b.read(['V'])).toEqual([1]);
  });
});
