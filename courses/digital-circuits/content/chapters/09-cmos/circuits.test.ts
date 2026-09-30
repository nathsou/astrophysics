import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import { createDigitalEngine } from '$lib/sim/digital';
import { createSwitchEngine, type SwitchEngine } from '$lib/sim/switch';
import { canExpand, expandToAnalog, expandToSwitch } from '$lib/sim/expand';
import { L0, L1, LZ, type Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 9 must show what the text says it shows. Each test loads the JSON exactly as the
 * page does, flips the switches through `setParam` (as a click does) and reads the engine.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const netOf = (flat: ReturnType<typeof flatten>, id: string, pin = 0): number => flat.elements.find((e) => e.id === id)!.pins[pin]!;

/** Advance in frame-sized pieces, as the page does. */
function run(e: AnalogEngine, seconds: number, frame = 1e-6): void {
  const end = e.time + seconds;
  while (e.time < end - 1e-15) e.advance(Math.min(frame, end - e.time));
}

const combos = (n: number): number[][] => Array.from({ length: 1 << n }, (_, i) => Array.from({ length: n }, (_, j) => (i >> (n - 1 - j)) & 1));

describe('two kinds of switch (switches.json)', () => {
  const flat = flatten(load('switches'));
  const nOut = netOf(flat, 'L1');
  const pOut = netOf(flat, 'L2');
  test('nothing drives an output at first: it is Z, not 0', () => {
    const e = createSwitchEngine(flat);
    e.settle();
    expect(e.logic(nOut)).toBe(LZ);
    expect(e.logic(pOut)).toBe(LZ);
  });
  test('an nMOS from +5 V is on when its gate is 1', () => {
    const e = createSwitchEngine(flat);
    e.setParam('G1', 'on', true);
    e.settle();
    expect(e.logic(nOut)).toBe(L1);
    expect(e.strengthKind(nOut)).toBe('driven');
    expect(e.state('MN').on).toBe(1);
  });
  test('a pMOS from +5 V is on when its gate is 0', () => {
    const e = createSwitchEngine(flat);
    e.setParam('G2', 'on', false);
    e.settle();
    expect(e.logic(pOut)).toBe(L1);
    expect(e.state('MP').on).toBe(1);
    e.setParam('G2', 'on', true);
    e.settle();
    expect(e.state('MP').on).toBe(0);
  });
  test('turn either off again and the output does not fall to 0: nothing drives it, so it keeps its charge', () => {
    const e = createSwitchEngine(flat);
    e.setParam('G1', 'on', true);
    e.settle();
    e.setParam('G1', 'on', false);
    e.settle();
    expect(e.logic(nOut)).toBe(L1);
    expect(e.strengthKind(nOut)).toBe('charged');
  });
});

/** The gates of the dial figures: logic level, then opened into transistors at switch level and at analog level. */
const gates: [string, (b: number[]) => number][] = [
  ['not', (b) => 1 - b[0]!],
  ['nand', (b) => 1 - (b[0]! & b[1]!)],
  ['nor', (b) => 1 - (b[0]! | b[1]!)],
];

describe.each(gates)('%s, at three levels of the abstraction dial', (name, f) => {
  const circuit = load(name);
  const inputs = circuit.components.filter((c) => c.type === 'toggle').map((c) => c.id);
  const rows = combos(inputs.length);

  test('it can be opened at both levels', () => {
    expect(canExpand(circuit, 'switch')).toBe(true);
    expect(canExpand(circuit, 'analog')).toBe(true);
  });

  test('logic level', () => {
    const flat = flatten(circuit);
    const e = createDigitalEngine(flat);
    const y = netOf(flat, 'Y');
    for (const r of rows) {
      inputs.forEach((id, i) => e.setParam(id, 'on', r[i] === 1));
      e.advance(1e-6);
      expect(e.logic(y), `${name} ${r}`).toBe(f(r) ? L1 : L0);
    }
  });

  test('switch level: the transistors agree, with a driven output', () => {
    const x = expandToSwitch(circuit);
    const flat = x.netlist();
    const e: SwitchEngine = createSwitchEngine(flat);
    const y = netOf(flat, 'Y');
    for (const r of rows) {
      inputs.forEach((id, i) => e.setParam(id, 'on', r[i] === 1));
      e.settle();
      expect(e.logic(y), `${name} ${r}`).toBe(f(r) ? L1 : L0);
      expect(e.strengthKind(y)).toBe('driven');
      expect(e.contended(y)).toBe(false);
    }
  });

  test('analog level: rail to rail', () => {
    const x = expandToAnalog(circuit);
    const flat = x.netlist();
    const e = createAnalogEngine(flat);
    const y = netOf(flat, 'Y');
    for (const r of rows) {
      inputs.forEach((id, i) => e.setParam(id, 'on', r[i] === 1));
      run(e, 20e-9);
      const v = e.voltage(y);
      if (f(r)) expect(v, `${name} ${r}`).toBeGreaterThan(4.9);
      else expect(v, `${name} ${r}`).toBeLessThan(0.1);
    }
  });

  test('transistor counts: 2, 4, 4', () => {
    expect(expandToSwitch(circuit).transistors).toBe(name === 'not' ? 2 : 4);
  });
});

describe('NAND and NOR: series and parallel', () => {
  test('in a NAND the nMOS transistors are in series and the pMOS ones in parallel; a NOR is the dual', () => {
    for (const [name, nSeries] of [['nand', true], ['nor', false]] as const) {
      const flat = expandToSwitch(load(name)).netlist();
      const out = netOf(flat, 'Y');
      const touching = (type: string) => flat.elements.filter((e) => e.type === type && e.pins.includes(out)).length;
      // Parallel transistors all touch the output; a series stack has only its top transistor there.
      expect(touching('nmos'), name).toBe(nSeries ? 1 : 2);
      expect(touching('pmos'), name).toBe(nSeries ? 2 : 1);
    }
  });
});

describe('passing a level through a transistor (pass-gates.json)', () => {
  const flat = flatten(load('pass-gates'));
  const out = netOf(flat, 'VO', 1);
  /** One engine, as on the page: the load capacitor remembers what it was given. */
  function bench() {
    const e = createAnalogEngine(flat);
    return (inV: boolean, gn: boolean, gp: boolean): number => {
      e.setParam('IN', 'on', inV);
      e.setParam('GN', 'on', gn);
      e.setParam('GP', 'on', gp);
      run(e, 0.3, 1e-3);
      return e.voltage(out);
    };
  }
  test('an nMOS alone passes a 0 completely and a 1 only up to Vgs = Vt: 4 V', () => {
    const set = bench();
    expect(set(true, true, true)).toBeGreaterThan(3.9);
    expect(set(true, true, true)).toBeLessThan(4.02);
    expect(set(false, true, true)).toBeLessThan(0.02);
  });
  test('a pMOS alone passes a 1 completely and a 0 only down to Vt: 1 V', () => {
    const set = bench();
    expect(set(true, false, false)).toBeGreaterThan(4.98);
    const v = set(false, false, false);
    expect(v).toBeGreaterThan(0.85);
    expect(v).toBeLessThan(1.15);
  });
  test('both together, a transmission gate, pass both levels in full', () => {
    const set = bench();
    expect(set(true, true, false)).toBeGreaterThan(4.98);
    expect(set(false, true, false)).toBeLessThan(0.02);
    expect(set(true, true, false)).toBeGreaterThan(4.98);
  });
  test('with both off the capacitor keeps what it had', () => {
    const set = bench();
    set(true, true, false);
    const v = set(false, false, true);
    expect(v).toBeGreaterThan(4.8);
  });
  test('at the start both transistors are off', () => {
    const e = createAnalogEngine(flat);
    run(e, 1e-3, 1e-4);
    expect(e.state('MN').region).toBe('off');
    expect(e.state('MP').region).toBe('off');
  });
});

describe('a transmission gate holds its value (sample-hold.json)', () => {
  const flat = flatten(load('sample-hold'));
  const out = netOf(flat, 'OUT');
  const set = (e: SwitchEngine, inV: boolean, en: boolean) => {
    e.setParam('IN', 'on', inV);
    e.setParam('EN', 'on', en);
    e.settle();
  };
  test('enabled, the output follows the input at full strength', () => {
    const e = createSwitchEngine(flat);
    set(e, true, true);
    expect(e.logic(out)).toBe(L1);
    expect(e.strengthKind(out)).toBe('driven');
    set(e, false, true);
    expect(e.logic(out)).toBe(L0);
  });
  test('disabled, the output keeps the last value, as stored charge', () => {
    const e = createSwitchEngine(flat);
    set(e, true, true);
    set(e, true, false);
    set(e, false, false);
    expect(e.logic(out)).toBe(L1);
    expect(e.strengthKind(out)).toBe('charged');
    set(e, false, true);
    expect(e.logic(out)).toBe(L0);
    set(e, false, false);
    set(e, true, false);
    expect(e.logic(out)).toBe(L0);
  });
  test('the inverter in the drawing makes ENb', () => {
    const e = createSwitchEngine(flat);
    const enb = netOf(flat, 'MP', 0);
    set(e, false, true);
    expect(e.logic(enb)).toBe(L0);
    set(e, false, false);
    expect(e.logic(enb)).toBe(L1);
  });
});

describe('Wanlass’s inverter with a capacitor load (wanlass.json)', () => {
  const flat = flatten(load('wanlass'));
  const out = netOf(flat, 'VO', 1);
  const supply = (e: AnalogEngine) => Math.abs(e.state('AM').value as number);
  test('in either steady state the supply gives next to nothing', () => {
    const e = createAnalogEngine(flat);
    run(e, 2e-3);
    expect(e.voltage(out)).toBeGreaterThan(4.99);
    expect(supply(e)).toBeLessThan(1e-6);
    e.setParam('IN', 'on', true);
    run(e, 2e-3);
    expect(e.voltage(out)).toBeLessThan(0.01);
    expect(supply(e)).toBeLessThan(1e-6);
  });
  test('all the current flows while the load charges: tens of milliamps for microseconds', () => {
    const e = createAnalogEngine(flat);
    run(e, 300e-6);
    e.setParam('IN', 'on', true);
    run(e, 300e-6);
    e.setParam('IN', 'on', false);
    let peak = 0;
    let charge = 0;
    for (let i = 0; i < 300; i++) {
      run(e, 1e-6);
      peak = Math.max(peak, supply(e));
      charge += supply(e) * 1e-6;
    }
    expect(peak).toBeGreaterThan(0.05);
    // The load takes C × V = 1 µF × 5 V = 5 µC from the supply.
    expect(charge).toBeGreaterThan(4.5e-6);
    expect(charge).toBeLessThan(5.5e-6);
  });
  test('runs without messages', () => {
    const e = createAnalogEngine(flat);
    for (const on of [true, false, true]) {
      e.setParam('IN', 'on', on);
      run(e, 200e-6);
    }
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('series stacks are slower: the dial’s analog level', () => {
  /** Time for the output to cross 2.5 V after the inputs change, in picoseconds. */
  function crossing(name: string, from: Record<string, boolean>, to: Record<string, boolean>): number {
    const flat = expandToAnalog(load(name)).netlist();
    const y = netOf(flat, 'Y');
    const e = createAnalogEngine(flat);
    for (const [k, v] of Object.entries(from)) e.setParam(k, 'on', v);
    run(e, 20e-9, 0.1e-9);
    const v0 = e.voltage(y);
    const t0 = e.time;
    for (const [k, v] of Object.entries(to)) e.setParam(k, 'on', v);
    for (let i = 0; i < 800; i++) {
      e.advance(10e-12);
      const v = e.voltage(y);
      if ((v0 > 2.5 && v < 2.5) || (v0 < 2.5 && v > 2.5)) return (e.time - t0) * 1e12;
    }
    return NaN;
  }
  const near = (x: number, target: number) => {
    expect(x).toBeGreaterThan(target * 0.9);
    expect(x).toBeLessThan(target * 1.1);
  };
  test('the inverter takes 0.19 ns each way', () => {
    near(crossing('not', { A: false }, { A: true }), 190);
    near(crossing('not', { A: true }, { A: false }), 190);
  });
  test('NAND with B = 1: rising through one pMOS 0.19 ns, falling through two nMOS 0.37 ns', () => {
    near(crossing('nand', { A: true, B: true }, { A: false, B: true }), 190);
    near(crossing('nand', { A: false, B: true }, { A: true, B: true }), 370);
  });
  test('NOR with B = 0 is the mirror image: 0.22 ns to fall, 0.43 ns to rise through two pMOS', () => {
    near(crossing('nor', { A: false, B: false }, { A: true, B: false }), 220);
    near(crossing('nor', { A: true, B: false }, { A: false, B: false }), 430);
  });
  test('the stack is about twice as slow as a single transistor', () => {
    const one = crossing('nand', { A: true, B: true }, { A: false, B: true });
    const two = crossing('nand', { A: false, B: true }, { A: true, B: true });
    expect(two / one).toBeGreaterThan(1.8);
    expect(two / one).toBeLessThan(2.2);
  });
});

describe('a multiplexer of two transmission gates (the challenge)', () => {
  test('six transistors select A or B, and the output is driven either way', async () => {
    const { SwitchBuilder } = await import('$lib/sim/switch');
    const b = new SwitchBuilder();
    const s = b.input('S');
    const a = b.input('A');
    const d = b.input('B');
    const sb = b.net('Sb');
    const y = b.net('Y');
    b.inv('I', s, sb);
    b.tgate('TA', a, y, sb, s); // passes A when S = 0: nMOS gate Sb, pMOS gate S
    b.tgate('TB', d, y, s, sb); // passes B when S = 1
    const flat = b.build();
    expect(flat.elements.filter((e) => e.type === 'nmos' || e.type === 'pmos')).toHaveLength(6);
    const e = createSwitchEngine(flat);
    for (const [sv, av, bv] of combos(3) as [number, number, number][]) {
      e.setParam('S', 'on', sv === 1);
      e.setParam('A', 'on', av === 1);
      e.setParam('B', 'on', bv === 1);
      e.settle();
      expect(e.logic(y), `S=${sv} A=${av} B=${bv}`).toBe((sv ? bv : av) ? L1 : L0);
      expect(e.strengthKind(y)).toBe('driven');
    }
  });
});
