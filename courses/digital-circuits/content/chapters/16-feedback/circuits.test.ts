import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

/** Every live circuit of Chapter 16 does what the text says. */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(name: string, seed = 1) {
  const flat = flatten(load(name));
  const e: DigitalEngine = createDigitalEngine(flat, { seed });
  const net = (id: string, pin = 'Y') => {
    const el = flat.elements.find((x) => x.id === id)!;
    const k = el.pinNames.indexOf(pin);
    return el.pins[k < 0 ? 0 : k]!;
  };
  return {
    e,
    net,
    set(id: string, v: boolean) {
      e.setParam(id, 'on', v);
      e.advance(20e-9);
    },
    q: () => [e.logic(net('Q')), e.logic(net('Qn'))],
  };
}

describe('every circuit loads and runs without warnings', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    test(f, () => {
      const e = createDigitalEngine(flatten(JSON.parse(readFileSync(dir + f, 'utf8')) as Circuit));
      e.advance(100e-9);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('the NOR latch', () => {
  test('set, hold, reset, hold', () => {
    const b = bench('nor-latch');
    b.set('S', true);
    expect(b.q()).toEqual([1, 0]);
    b.set('S', false);
    expect(b.q()).toEqual([1, 0]);
    b.set('R', true);
    expect(b.q()).toEqual([0, 1]);
    b.set('R', false);
    expect(b.q()).toEqual([0, 1]);
  });
  test('it powers up in one of its two states, whatever the seed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const b = bench('nor-latch', seed);
      b.e.advance(20e-9);
      seen.add(b.q().join(''));
    }
    expect([...seen].sort()).toEqual(['01', '10']);
  });
  test('S = R = 1 forces both outputs to 0', () => {
    const b = bench('nor-latch');
    b.set('S', true);
    b.set('R', true);
    expect(b.q()).toEqual([0, 0]);
  });
  test('released one after the other, the last one held decides', () => {
    const b = bench('nor-latch');
    b.set('S', true);
    b.set('R', true);
    b.set('R', false);
    expect(b.q()).toEqual([1, 0]);
    b.set('R', true);
    b.set('S', false);
    expect(b.q()).toEqual([0, 1]);
  });
  test('released at the same instant, with gates of equal delay, the two outputs swing together for ever', () => {
    const b = bench('nor-latch');
    b.set('S', true);
    b.set('R', true);
    const rec = b.e.watch([b.net('Q'), b.net('Qn')]);
    b.e.setParam('S', 'on', false);
    b.e.setParam('R', 'on', false);
    b.e.advance(40e-9);
    const t = rec.times();
    const v = rec.values();
    // Look at the settled rows only (the last row of each instant): Q and Qn are always equal, and change every 1 ns.
    const last = new Map<number, [number, number]>();
    t.forEach((x, i) => last.set(Math.round(x * 1e12), [v[0]![i]!, v[1]![i]!]));
    const rows = [...last.entries()].filter(([ps]) => ps > b.e.time * 1e12 - 30e3);
    expect(rows.length).toBeGreaterThan(20);
    for (const [, [q, qn]] of rows) expect(q).toBe(qn);
    for (let i = 1; i < rows.length; i++) expect(rows[i]![1][0]).not.toBe(rows[i - 1]![1][0]);
    rec.close();
  });
});

describe('the NAND latch', () => {
  test('active low: S̄ = 0 sets, R̄ = 0 resets, both at 1 hold', () => {
    const b = bench('nand-latch');
    b.set('Sn', false);
    expect(b.q()).toEqual([1, 0]);
    b.set('Sn', true);
    expect(b.q()).toEqual([1, 0]);
    b.set('Rn', false);
    expect(b.q()).toEqual([0, 1]);
    b.set('Rn', true);
    expect(b.q()).toEqual([0, 1]);
  });
  test('both inputs at 0 force both outputs to 1', () => {
    const b = bench('nand-latch');
    b.set('Sn', false);
    b.set('Rn', false);
    expect(b.q()).toEqual([1, 1]);
  });
  test('a bouncing button does not disturb it: S̄ goes 0, 1, 0, 1, 0 and Q stays 1', () => {
    const b = bench('nand-latch');
    b.set('Rn', false);
    b.set('Rn', true);
    expect(b.q()).toEqual([0, 1]);
    let expected = 1;
    for (const v of [false, true, false, true, false]) {
      b.set('Sn', v);
      expect(b.q()[0]).toBe(expected);
    }
  });
});

describe('the behavioural SR latch of the double well', () => {
  const run = (seed: number, hold = 0) => {
    const b = bench('sr-behavioural', seed);
    b.set('S', true);
    b.set('R', true);
    b.e.setParam('S', 'on', false);
    b.e.setParam('R', 'on', false);
    b.e.advance((1.5 + hold) * 1e-9);
    return b;
  };
  test('let go together it goes metastable: both outputs X, and the state says so', () => {
    const b = run(1);
    expect(b.e.state('L1').metastable).toBe(true);
    expect(b.q()).toEqual([2, 2]);
  });
  test('it decides in the end, to either side, depending on the seed', () => {
    const sides = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const b = run(seed);
      b.e.advance(200e-9);
      expect(b.e.state('L1').metastable).toBe(false);
      const [q, qn] = b.q();
      expect(q).not.toBe(qn);
      sides.add(q!);
    }
    expect([...sides].sort()).toEqual([0, 1]);
  });
  test('released a gate delay apart, the first release decides and nothing is metastable', () => {
    const b = bench('sr-behavioural');
    b.set('S', true);
    b.set('R', true);
    b.e.setParam('R', 'on', false);
    b.e.advance(5e-9);
    b.e.setParam('S', 'on', false);
    b.e.advance(5e-9);
    expect(b.e.state('L1').metastable).toBe(false);
    expect(b.q()).toEqual([1, 0]);
  });
  test('while it hangs, a real set forces it', () => {
    const b = run(3);
    b.e.setParam('S', 'on', true);
    b.e.advance(5e-9);
    expect(b.e.state('L1').metastable).toBe(false);
    expect(b.q()).toEqual([1, 0]);
  });
});
