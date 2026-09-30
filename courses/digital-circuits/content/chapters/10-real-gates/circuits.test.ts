import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import { createDigitalEngine } from '$lib/sim/digital';
import { L0, L1, LX, LZ, type Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 10 must show what the text says it shows. Each test loads the JSON exactly
 * as the page does, flips the switches through `setParam` (as a click does) and reads the engine.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const analog = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));
const netOf = (name: string, id: string, pin = 0): number => flatten(load(name)).elements.find((e) => e.id === id)!.pins[pin]!;

/** Advance in frame-sized pieces, as the page does (one call of `advance` is capped at 1000 internal steps). */
function run(e: AnalogEngine, seconds: number, frame = 0.01): void {
  const end = e.time + seconds;
  while (e.time < end - 1e-12) e.advance(Math.min(frame, end - e.time));
}

describe('the CMOS inverter', () => {
  const name = 'inverter';
  const out = () => netOf(name, 'VO', 1);

  test('the output is the opposite of the input, rail to rail', () => {
    const e = analog(name);
    run(e, 0.05);
    expect(e.voltage(out())).toBeGreaterThan(4.99);
    e.setParam('IN', 'on', true);
    run(e, 0.05);
    expect(e.voltage(out())).toBeLessThan(0.01);
    e.setParam('IN', 'on', false);
    run(e, 0.05);
    expect(e.voltage(out())).toBeGreaterThan(4.99);
  });

  test('in either steady state the supply gives next to nothing', () => {
    const e = analog(name);
    // Output low: only leakage, picoamps. Output high: the voltmeter's own 10 MΩ takes 0.5 µA through the pMOS.
    e.setParam('IN', 'on', true);
    run(e, 0.05);
    expect(Math.abs(e.state('AM').value as number)).toBeLessThan(1e-9);
    e.setParam('IN', 'on', false);
    run(e, 0.05);
    const i = Math.abs(e.state('AM').value as number);
    expect(i).toBeGreaterThan(4e-7);
    expect(i).toBeLessThan(6e-7);
  });

  test('runs without messages', () => {
    const e = analog(name);
    for (const on of [true, false, true]) {
      e.setParam('IN', 'on', on);
      run(e, 0.1);
    }
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('open-drain outputs with a pull-up: a wired-AND', () => {
  const name = 'wired-and';
  const line = () => netOf(name, 'RP', 1);

  test('the line is high only when both drivers let go, and the LED shows it', () => {
    for (const a of [false, true]) {
      for (const b of [false, true]) {
        const e = analog(name);
        e.setParam('A', 'on', a);
        e.setParam('B', 'on', b);
        run(e, 0.05);
        const and = a && b;
        const v = e.voltage(line());
        if (and) expect(v, `A=${a} B=${b}`).toBeGreaterThan(4.9);
        else expect(v, `A=${a} B=${b}`).toBeLessThan(0.1);
        expect(!!e.state('LD').lit, `A=${a} B=${b}: LED`).toBe(and);
      }
    }
  });

  test('a low costs a milliamp through the pull-up, a high nothing', () => {
    const e = analog(name);
    e.setParam('A', 'on', false);
    run(e, 0.05);
    // The pull-up's current is 5 V / 4.7 kΩ, about 1.06 mA, flowing down into the conducting transistor.
    expect(Math.abs(e.current('RP', 0))).toBeGreaterThan(1.0e-3);
    expect(Math.abs(e.current('RP', 0))).toBeLessThan(1.1e-3);
    e.setParam('A', 'on', true);
    e.setParam('B', 'on', true);
    run(e, 0.05);
    expect(Math.abs(e.current('RP', 0))).toBeLessThan(1e-5);
  });

  test('several drivers pulling low at once is fine', () => {
    const e = analog(name);
    run(e, 0.05);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('a tri-state bus (digital engine)', () => {
  const name = 'tristate-bus';
  const flat = flatten(load(name));
  const bus = netOf(name, 'P');
  const make = () => createDigitalEngine(flat);
  const NS = 1e-9;
  const set = (e: ReturnType<typeof make>, d1: boolean, e1: boolean, d2: boolean, e2: boolean) => {
    e.setParam('D1', 'on', d1);
    e.setParam('E1', 'on', e1);
    e.setParam('D2', 'on', d2);
    e.setParam('E2', 'on', e2);
    e.advance(10 * NS);
  };

  test('nobody driving is Z; one driver sets the bus; two that agree are fine', () => {
    const e = make();
    set(e, true, false, false, false);
    expect(e.logic(bus)).toBe(LZ);
    set(e, true, true, false, false);
    expect(e.logic(bus)).toBe(L1);
    set(e, true, false, false, true);
    expect(e.logic(bus)).toBe(L0);
    set(e, true, true, true, true);
    expect(e.logic(bus)).toBe(L1);
    expect(e.contended(bus)).toBe(false);
  });

  test('two drivers that disagree make X, and the engine says so', () => {
    const e = make();
    set(e, true, true, false, true);
    expect(e.logic(bus)).toBe(LX);
    expect(e.contended(bus)).toBe(true);
    expect(e.messages.some((m) => m.level === 'warning' && m.text.includes('Contention'))).toBe(true);
    // Letting go of one driver ends it.
    set(e, true, true, false, false);
    expect(e.logic(bus)).toBe(L1);
    expect(e.contended(bus)).toBe(false);
  });
});

describe('two totem-pole outputs fighting (analog engine)', () => {
  const name = 'contention';

  test('the same level on both: no current, nothing burns', () => {
    const e = analog(name);
    run(e, 0.5);
    expect(Math.abs(e.state('AM').value as number)).toBeLessThan(1e-6);
    e.setParam('T1', 'on', true);
    e.setParam('T2', 'on', true);
    run(e, 0.5);
    expect(Math.abs(e.state('AM').value as number)).toBeLessThan(1e-6);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('opposite levels: amperes flow, a bond wire burns out, and the current stops', () => {
    const e = analog(name);
    run(e, 0.05);
    e.setParam('T2', 'on', true);
    run(e, 0.005);
    const i0 = Math.abs(e.state('AM').value as number);
    expect(i0).toBeGreaterThan(1); // more than an ampere, against the 25 mA an HC pin may carry
    expect(i0).toBeLessThan(5);
    run(e, 1);
    expect(e.state('BW1').burned || e.state('BW2').burned).toBe(true);
    expect(Math.abs(e.state('AM').value as number)).toBeLessThan(1e-6);
    const warning = e.messages.find((m) => m.level === 'warning' && m.text.includes('burned out'));
    expect(warning).toBeDefined();
    // Reset brings the part back.
    e.reset();
    expect(e.state('BW1').burned).toBe(false);
  });

  test('in the first frames the fight is one ampere-scale current, in both directions', () => {
    for (const [t1, t2] of [[false, true], [true, false]] as const) {
      const e = analog(name);
      e.setParam('T1', 'on', t1);
      e.setParam('T2', 'on', t2);
      run(e, 0.005);
      expect(Math.abs(e.state('AM').value as number)).toBeGreaterThan(1);
    }
  });
});
