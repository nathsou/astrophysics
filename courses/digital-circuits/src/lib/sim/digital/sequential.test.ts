import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine, type DigitalEngineOptions } from './index';
import { LX } from '../netlist/types';
import type { Params } from '../netlist/types';

const NS = 1e-9;

/** A storage element with a toggle on each input, returning helpers. */
function bench(type: string, inputs: string[], params: Params = {}, options: DigitalEngineOptions = {}) {
  const b = new NetlistBuilder();
  const pins: Record<string, number> = {};
  for (const name of inputs) {
    pins[name] = b.net(name);
    b.add('toggle', name, { Y: pins[name]! });
  }
  const q = b.net('Q');
  const qn = b.net('Qn');
  b.add(type, 'U', { ...pins, Q: q, Qn: qn }, params);
  const e = createDigitalEngine(b.build(), options);
  const set = (name: string, on: boolean | number) => e.setParam(name, 'on', on === true || on === 1);
  const out = () => [e.logic(q), e.logic(qn)];
  return { e, q, qn, set, out, run: (ns: number) => e.advance(ns * NS) };
}

describe('SR latch', () => {
  test('sets, resets and holds', () => {
    const { set, out, run } = bench('srlatch', ['S', 'R']);
    expect(out()).toEqual([0, 1]);
    set('S', 1);
    run(0.9);
    expect(out()).toEqual([0, 1]);
    run(0.1);
    expect(out()).toEqual([1, 0]);
    set('S', 0);
    run(100);
    expect(out()).toEqual([1, 0]);
    set('R', 1);
    run(5);
    set('R', 0);
    run(100);
    expect(out()).toEqual([0, 1]);
  });

  test('S = R = 1 pulls both outputs to 0; releasing one at a time is fine', () => {
    const { set, out, run, e } = bench('srlatch', ['S', 'R']);
    set('S', 1);
    set('R', 1);
    run(5);
    expect(out()).toEqual([0, 0]);
    set('R', 0);
    run(5);
    set('S', 0);
    run(5);
    expect(out()).toEqual([1, 0]);
    expect(e.state('U').metastable).toBe(false);
  });

  test('releasing S and R together leaves it metastable, then it settles at random (seeded)', () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const { set, out, run, e } = bench('srlatch', ['S', 'R'], { tau: 2 }, { seed });
      set('S', 1);
      set('R', 1);
      run(5);
      set('S', 0);
      set('R', 0);
      run(1);
      expect(out()).toEqual([LX, LX]);
      expect(e.state('U')).toMatchObject({ metastable: true, value: undefined });
      expect(e.messages.some((m) => m.level === 'info' && m.element === 'U' && m.text.includes('metastable'))).toBe(true);
      run(200);
      const [q, qn] = out();
      expect(q === 0 || q === 1).toBe(true);
      expect(qn).toBe(1 - q!);
      expect(e.state('U').metastable).toBe(false);
      return q;
    });
    // Deterministic per seed, and not always the same way.
    expect(new Set(results).size).toBe(2);
    const again = bench('srlatch', ['S', 'R'], { tau: 2 }, { seed: 3 });
    again.set('S', 1);
    again.set('R', 1);
    again.run(5);
    again.set('S', 0);
    again.set('R', 0);
    again.run(200);
    expect(again.out()[0]).toBe(results[2]);
  });

  test('power-up value follows init', () => {
    expect(bench('srlatch', ['S', 'R'], { init: '1' }).out()).toEqual([1, 0]);
    expect(bench('srlatch', ['S', 'R'], { init: 'X' }).out()).toEqual([LX, LX]);
  });
});

describe('D latch', () => {
  test('transparent while EN = 1, holds when EN = 0', () => {
    const { set, out, run } = bench('dlatch', ['D', 'EN']);
    set('EN', 1);
    set('D', 1);
    run(2);
    expect(out()).toEqual([1, 0]);
    set('D', 0);
    run(2);
    expect(out()).toEqual([0, 1]);
    set('D', 1);
    run(2);
    set('EN', 0);
    run(1);
    set('D', 0);
    run(10);
    expect(out()).toEqual([1, 0]);
  });
});

describe('D flip-flop', () => {
  test('samples D on the rising edge only', () => {
    const { set, out, run, e } = bench('dff', ['D', 'CLK']);
    expect(out()).toEqual([0, 1]);
    set('D', 1);
    run(10);
    expect(out()).toEqual([0, 1]);
    set('CLK', 1);
    run(0.9);
    expect(out()).toEqual([0, 1]);
    run(0.1); // clock-to-Q 1 ns
    expect(out()).toEqual([1, 0]);
    set('D', 0);
    run(10);
    expect(out()).toEqual([1, 0]); // no edge, no change
    set('CLK', 0);
    run(10);
    expect(out()).toEqual([1, 0]); // falling edge ignored
    set('CLK', 1);
    run(10);
    expect(out()).toEqual([0, 1]);
    expect(e.state('U')).toEqual({ value: 0, q: 0, metastable: false });
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('a set-up violation makes Q metastable (X), then it resolves at random after a seeded time', () => {
    const trial = (seed: number) => {
      const { set, out, run, e, q } = bench('dff', ['D', 'CLK'], { setup: 0.5, hold: 0.2, tau: 1 }, { seed });
      run(10);
      const r = e.watch([q]);
      set('D', 1);
      run(0.2); // 0.2 ns before the edge: inside the 0.5 ns set-up window
      set('CLK', 1);
      run(1);
      expect(out()).toEqual([LX, LX]);
      expect(e.state('U').metastable).toBe(true);
      const warn = e.messages.find((m) => m.level === 'warning');
      expect(warn?.text).toMatch(/set-up time violated.*0\.2 ns before/);
      run(100);
      const final = e.logic(q);
      expect(final === 0 || final === 1).toBe(true);
      expect(e.state('U').metastable).toBe(false);
      expect(e.messages.some((m) => m.level === 'info' && m.text.includes('left the metastable state'))).toBe(true);
      // Time from the edge (10.2 ns) to resolution.
      const t = r.times();
      const settled = t[t.length - 1]! * 1e9 - 10.2;
      expect(settled).toBeGreaterThan(1);
      return { final, settled };
    };
    const a = trial(42);
    const b = trial(42);
    expect(b).toEqual(a);
    const finals = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => trial(s).final));
    expect(finals.size).toBe(2);
  });

  test('a hold violation also makes Q metastable', () => {
    const { set, out, run, e } = bench('dff', ['D', 'CLK']);
    run(10);
    set('CLK', 1);
    run(0.1);
    set('D', 1); // 0.1 ns after the edge: inside the 0.2 ns hold window
    run(0.95);
    expect(out()).toEqual([LX, LX]);
    expect(e.messages.find((m) => m.level === 'warning')?.text).toMatch(/hold time violated/);
  });

  test('D changing just outside the window is sampled normally', () => {
    const { set, out, run, e } = bench('dff', ['D', 'CLK']);
    run(10);
    set('D', 1);
    run(0.5);
    set('CLK', 1);
    run(0.2);
    set('D', 0);
    run(5);
    expect(out()).toEqual([1, 0]);
    expect(e.messages).toEqual([]);
  });

  test('init sets the power-up value and reset() restores it', () => {
    const { set, out, run, e } = bench('dff', ['D', 'CLK'], { init: '1' });
    expect(out()).toEqual([1, 0]);
    run(5);
    set('CLK', 1);
    run(5);
    expect(out()).toEqual([0, 1]);
    set('CLK', 0);
    e.reset();
    expect(out()).toEqual([1, 0]);
    expect(bench('dff', ['D', 'CLK'], { init: 'X' }).out()).toEqual([LX, LX]);
  });

  test('a clock that powers up from X is not an edge; 0 → X → 1 is', () => {
    const b = new NetlistBuilder();
    const d = b.net();
    const c = b.net();
    const cb = b.net();
    const q = b.net();
    b.add('const', 'D', { Y: d }, { value: 1 });
    b.add('const', 'C', { Y: c }, { value: 1 });
    // The clock comes through a buffer, so it is X for the first nanosecond, then 1.
    b.add('buffer', 'B', { A: c, Y: cb });
    b.add('dff', 'U', { D: d, CLK: cb, Q: q });
    const e = createDigitalEngine(b.build());
    e.advance(5 * NS);
    expect(e.logic(q)).toBe(0);
    e.setParam('C', 'value', 0);
    e.advance(5 * NS);
    e.setParam('C', 'value', LX);
    e.advance(5 * NS);
    expect(e.logic(q)).toBe(0);
    e.setParam('C', 'value', 1);
    e.advance(5 * NS);
    expect(e.logic(q)).toBe(1);
  });
});

describe('other flip-flops', () => {
  const clock = (h: ReturnType<typeof bench>) => {
    h.set('CLK', 1);
    h.run(5);
    h.set('CLK', 0);
    h.run(5);
  };

  test('dffr: CLR clears at once, whatever the clock', () => {
    const h = bench('dffr', ['D', 'CLK', 'CLR']);
    h.set('D', 1);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([1, 0]);
    h.set('CLR', 1);
    h.run(2);
    expect(h.out()).toEqual([0, 1]);
    clock(h);
    expect(h.out()).toEqual([0, 1]); // edges ignored while clearing
    h.set('CLR', 0);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([1, 0]);
  });

  test('dffe: loads only while EN = 1', () => {
    const h = bench('dffe', ['D', 'EN', 'CLK']);
    h.set('D', 1);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([0, 1]);
    h.set('EN', 1);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([1, 0]);
  });

  test('jkff: hold, reset, set, toggle', () => {
    const h = bench('jkff', ['J', 'CLK', 'K']);
    clock(h);
    expect(h.out()).toEqual([0, 1]);
    h.set('J', 1);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([1, 0]);
    h.set('K', 1);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([0, 1]);
    clock(h);
    expect(h.out()).toEqual([1, 0]);
    h.set('J', 0);
    h.run(5);
    clock(h);
    expect(h.out()).toEqual([0, 1]);
  });

  test('tff with a clock divides the frequency by two', () => {
    const b = new NetlistBuilder();
    const t = b.net();
    const c = b.net();
    const q = b.net();
    b.add('const', 'T', { Y: t }, { value: 1 });
    b.add('clock', 'CK', { Y: c }, { frequency: 1e7 });
    b.add('tff', 'U', { T: t, CLK: c, Q: q });
    const e = createDigitalEngine(b.build());
    const r = e.watch([q]);
    e.advance(1e-6);
    const times = Array.from(r.times()).slice(1).map((s) => Math.round(s * 1e10) / 10);
    // Rising clock edges at 50, 150, 250 … ns; Q toggles 1 ns later.
    expect(times.slice(0, 4)).toEqual([51, 151, 251, 351]);
    expect(times).toHaveLength(10);
  });
});
