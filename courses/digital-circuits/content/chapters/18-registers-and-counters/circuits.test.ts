import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 18 must do what the text says. Each test loads the JSON exactly as the page does,
 * sets the switches and presses the buttons through `setParam` (as a click does), and reads the engine.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const ns = 1e-9;

function bench(name: string) {
  const flat = flatten(load(name));
  const e = createDigitalEngine(flat);
  const netOf = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  const bitsOf = () => [0, 1, 2, 3].reduce((v, i) => v | (e.logic(netOf(`Q${i}`)) << i), 0);
  /** Press and release the button CLK, with time to settle either side. */
  const press = () => {
    e.advance(50 * ns);
    e.setParam('CLK', 'pressed', true);
    e.advance(50 * ns);
    e.setParam('CLK', 'pressed', false);
    e.advance(50 * ns);
  };
  return { e, flat, netOf, bitsOf, press };
}

describe('the circuits load and run without messages', () => {
  for (const name of ['register4', 'ripple4', 'sync4', 'shift4']) {
    test(name, () => {
      const b = bench(name);
      b.e.advance(300 * ns);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('the register (Figure 18.1)', () => {
  test('keeps its value while EN is 0, and loads D when EN is 1', () => {
    const { e, bitsOf, press } = bench('register4');
    const setD = (v: number) => [0, 1, 2, 3].forEach((i) => e.setParam(`D${i}`, 'on', !!((v >> i) & 1)));
    e.setParam('EN', 'on', false);
    setD(0b1010);
    press();
    expect(bitsOf()).toBe(0);
    e.setParam('EN', 'on', true);
    press();
    expect(bitsOf()).toBe(0b1010);
    e.setParam('EN', 'on', false);
    setD(0b0101);
    press();
    press();
    expect(bitsOf()).toBe(0b1010);
    e.setParam('EN', 'on', true);
    press();
    expect(bitsOf()).toBe(0b0101);
  });
});

describe('the ripple counter (Figure 18.3)', () => {
  test('counts up in binary with the clock at the default speed, and each output halves the frequency', () => {
    const { e, netOf, flat } = bench('ripple4');
    const clk = netOf('CLK');
    const q = [0, 1, 2, 3].map((i) => netOf(`Q${i}`));
    const rec = e.watch([clk, ...q]);
    e.advance(1620 * ns); // 16 clock periods of 100 ns, starting with the first edge at 50 ns
    const t = rec.times();
    const v = rec.values();
    const rises = (row: Float64Array) => {
      let n = 0;
      for (let i = 1; i < t.length; i++) if (row[i] === 1 && row[i - 1] === 0) n++;
      return n;
    };
    expect(rises(v[0]!)).toBe(16);
    expect(rises(v[1]!)).toBe(8);
    expect(rises(v[2]!)).toBe(4);
    expect(rises(v[3]!)).toBe(2);
    expect(rises(v[4]!)).toBe(1);
    // After 16 edges the count has wrapped to 0000.
    expect(q.map((n) => e.logic(n))).toEqual([0, 0, 0, 0]);
    expect(flat.elements.filter((x) => x.type === 'dff')).toHaveLength(4);
    rec.close();
  });
  test('the stages change one after another: the second flips a clock-to-Q after the first', () => {
    const { e, netOf } = bench('ripple4');
    const q0 = netOf('Q0');
    const q1 = netOf('Q1');
    const rec = e.watch([q0, q1]);
    e.advance(300 * ns);
    const t = rec.times();
    const [v0, v1] = rec.values() as [Float64Array, Float64Array];
    const changes = (row: Float64Array) => {
      const out: number[] = [];
      for (let i = 1; i < t.length; i++) if (row[i] !== row[i - 1] && row[i]! <= 1 && row[i - 1]! <= 1) out.push(t[i]! / ns);
      return out;
    };
    const c0 = changes(v0);
    const c1 = changes(v1);
    // Q1 first falls with Q0's second change (a falling Q0), 1 ns (the default clock-to-Q) later.
    const firstFall = c0[1]!;
    expect(c1.some((x) => Math.abs(x - firstFall - 1) < 0.01)).toBe(true);
    rec.close();
  });
});

describe('the synchronous counter (Figure 18.4)', () => {
  test('counts 0 to 15 and wraps, with all changing bits changing at the same instant', () => {
    const { e, netOf } = bench('sync4');
    const q = [0, 1, 2, 3].map((i) => netOf(`Q${i}`));
    const rec = e.watch(q);
    e.advance(1720 * ns);
    const t = rec.times();
    const v = rec.values();
    // Steady value just before each edge (edges at 50, 150, …): 0, 1, 2, … and wraps.
    const at = (time: number) => q.reduce((w, _, i) => w | (valueAt(v[i]!, t, time) << i), 0);
    for (let k = 0; k < 17; k++) expect(at((50 + 100 * k - 5) * ns), `before edge ${k}`).toBe(k % 16);
    // No wrong intermediate values: every span of positive length between edge k and edge k + 1 shows the count
    // before the edge or the count after it.
    const word = (i: number) => q.reduce((w, _, b) => w | (v[b]![i]! << b), 0);
    for (let i = 0; i + 1 < t.length; i++) {
      const from = t[i]! / ns;
      if (t[i + 1] === t[i] || from < 50) continue;
      const k = Math.floor((from - 50) / 100);
      expect([k % 16, (k + 1) % 16], `word ${word(i)} at ${from} ns`).toContain(word(i));
    }
    rec.close();
  });
});

describe('the shift register (Figure 18.8)', () => {
  test('four presses put four bits in, the first one at the far end', () => {
    const { e, bitsOf, press } = bench('shift4');
    for (const bit of [1, 0, 1, 1]) {
      e.setParam('SI', 'on', !!bit);
      press();
    }
    // The bits sent were 1, 0, 1, 1: the first sent is in Q3, the last in Q0.
    expect([0, 1, 2, 3].map((i) => (bitsOf() >> i) & 1)).toEqual([1, 1, 0, 1]);
  });
  test('a single bit takes four presses to reach the far end', () => {
    const { e, bitsOf, press } = bench('shift4');
    e.setParam('SI', 'on', true);
    press();
    e.setParam('SI', 'on', false);
    const seen: number[] = [bitsOf()];
    for (let i = 0; i < 4; i++) {
      press();
      seen.push(bitsOf());
    }
    expect(seen).toEqual([0b0001, 0b0010, 0b0100, 0b1000, 0]);
  });
});

function valueAt(row: Float64Array, t: Float64Array, time: number): number {
  let val = row[0]!;
  for (let i = 0; i < t.length; i++) if (t[i]! <= time) val = row[i]!;
  return val;
}
