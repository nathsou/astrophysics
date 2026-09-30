import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 2 must do what the text says: the divider divides, two lamps in series share
 * the battery and two in parallel do not, Kirchhoff's current law holds at the junction, a pull-up reads 5 V
 * until the button is pressed, and an LED with no resistor burns while one with 390 Ω lights.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const engine = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));
const pin = (e: AnalogEngine, id: string, name: string) => {
  const el = e.netlist.elements.find((x) => x.id === id)!;
  return e.voltage(el.pins[el.pinNames.indexOf(name)]!);
};
const across = (e: AnalogEngine, id: string) => pin(e, id, '+') - pin(e, id, '-');

describe('the circuits load and run without messages (those that should not burn anything)', () => {
  for (const name of ['divider', 'series-parallel', 'kcl', 'pull-up', 'led-resistor', 'landscape']) {
    test(name, () => {
      const e = engine(name);
      e.advance(1);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('the voltage divider', () => {
  test('9 V across 2 kΩ and 1 kΩ: 6 V across R1, 3 V at the output, 3 mA', () => {
    const e = engine('divider');
    e.settle();
    expect(across(e, 'V1')).toBeCloseTo(3, 2);
    expect(across(e, 'V2')).toBeCloseTo(6, 2);
    expect(e.current('A1', 0)).toBeCloseTo(0.003, 5);
  });
  test('Vout = Vin·R2/(R1+R2) for other values', () => {
    for (const [vin, r1, r2] of [[12, 100, 10000], [5, 4700, 4700], [1, 10000, 100], [9, 330, 680]] as const) {
      const e = engine('divider');
      e.setParam('B1', 'voltage', vin);
      e.setParam('R1', 'resistance', r1);
      e.setParam('R2', 'resistance', r2);
      e.settle();
      expect(across(e, 'V1')).toBeCloseTo((vin * r2) / (r1 + r2), 1);
    }
  });
  test('equal resistors halve the voltage, and the two drops add up to the battery', () => {
    const e = engine('divider');
    e.setParam('R1', 'resistance', 1000);
    e.settle();
    expect(across(e, 'V1')).toBeCloseTo(4.5, 2);
    expect(across(e, 'V1') + across(e, 'V2')).toBeCloseTo(9, 2);
  });
});

describe('two lamps on one battery', () => {
  const lit = (e: AnalogEngine, id: string) => e.state(id).brightness as number;
  test('in series each lamp gets half the voltage and glows dimly; the battery supplies about 47 mA (a cooler filament has less resistance)', () => {
    const e = engine('series-parallel');
    e.advance(1);
    expect(e.current('A1', 0)).toBeGreaterThan(0.044);
    expect(e.current('A1', 0)).toBeLessThan(0.05);
    const v1 = pin(e, 'L1', '1') - pin(e, 'L1', '2');
    expect(v1).toBeCloseTo(3, 1);
    expect(lit(e, 'L1')).toBeLessThan(0.2);
    expect(lit(e, 'L1')).toBeCloseTo(lit(e, 'L2'), 3);
  });
  test('in parallel each lamp is at full voltage and bright; the battery supplies twice a lamp’s current, 100 mA', () => {
    const e = engine('series-parallel');
    e.advance(1);
    expect(lit(e, 'L3')).toBeGreaterThan(0.85);
    expect(lit(e, 'L4')).toBeGreaterThan(0.85);
    expect(e.current('A2', 0)).toBeGreaterThan(0.095);
    expect(e.current('A2', 0)).toBeLessThan(0.102);
    expect(e.current('L3', 0) + e.current('L4', 0)).toBeCloseTo(e.current('A2', 0), 5);
  });
  test('the series pair is dimmer than the parallel pair', () => {
    const e = engine('series-parallel');
    e.advance(1);
    expect(lit(e, 'L1')).toBeLessThan(lit(e, 'L3') / 3);
  });
});

describe('Kirchhoff’s current law', () => {
  test('the current that arrives is the sum of the branch currents, for any resistors', () => {
    for (const [r2, r3] of [[2000, 2000], [220, 10000], [4700, 330], [1000, 1000]] as const) {
      const e = engine('kcl');
      e.setParam('R2', 'resistance', r2);
      e.setParam('R3', 'resistance', r3);
      e.settle();
      const i1 = e.current('A1', 0);
      expect(i1).toBeCloseTo(e.current('A2', 0) + e.current('A3', 0), 9);
      expect(i1).toBeGreaterThan(0);
    }
  });
  test('equal branches share the current equally: 9 V, 1 kΩ then two 2 kΩ in parallel (1 kΩ) is 4.5 mA = 2.25 + 2.25', () => {
    const e = engine('kcl');
    e.settle();
    expect(e.current('A1', 0) * 1000).toBeCloseTo(4.5, 2);
    expect(e.current('A2', 0) * 1000).toBeCloseTo(2.25, 2);
    expect(e.current('A3', 0) * 1000).toBeCloseTo(2.25, 2);
  });
});

describe('the pull-up resistor', () => {
  test('released, the input is pulled up to 5 V and no current flows', () => {
    const e = engine('pull-up');
    e.settle();
    expect(across(e, 'V1')).toBeGreaterThan(4.99);
    expect(Math.abs(e.current('R1', 0))).toBeLessThan(1e-6);
  });
  test('pressed, the input is at 0 V and 0.5 mA flows through the resistor', () => {
    const e = engine('pull-up');
    e.setParam('SW', 'pressed', true);
    e.settle();
    expect(across(e, 'V1')).toBeLessThan(0.01);
    expect(e.current('R1', 0) * 1000).toBeCloseTo(0.5, 2);
  });
});

describe('an LED on 9 V', () => {
  test('with no resistor it burns out within a fraction of a second and says why', () => {
    const e = engine('led-no-resistor');
    e.advance(0.3);
    expect(e.state('D1').burned).toBeFalsy();
    e.setParam('S1', 'closed', true);
    e.advance(0.5);
    expect(e.state('D1').burned).toBe(true);
    const msg = e.messages.find((m) => m.text.includes('D1 burned out'));
    expect(msg?.text).toContain('needs a series resistor');
  });
  test('the current before it burns is amperes, and 9 V − 1.85 V over the LED’s own resistance explains it', () => {
    const e = engine('led-no-resistor');
    e.setParam('S1', 'closed', true);
    e.advance(1e-5);
    expect(e.current('A1', 0)).toBeGreaterThan(1);
  });
  test('the design calculation: (9 − 1.85 V) / 20 mA = 357 Ω, so 390 Ω from the E12 series', () => {
    expect((9 - 1.85) / 0.02).toBeCloseTo(357.5, 1);
    const e = engine('led-resistor');
    e.advance(1);
    expect(e.current('A1', 0) * 1000).toBeGreaterThan(17);
    expect(e.current('A1', 0) * 1000).toBeLessThan(19);
    expect(e.state('D1').burned).toBeFalsy();
    expect(e.state('D1').brightness as number).toBeGreaterThan(0.5);
    // The resistor dissipates I²R ≈ 0.13 W, within its ¼ W rating.
    expect(e.state('R1').power as number).toBeGreaterThan(0.11);
    expect(e.state('R1').power as number).toBeLessThan(0.15);
  });
  test('the stops of the exercise: 330 Ω is over 20 mA but the LED lives; 47 Ω kills it; 1 kΩ is dim but safe', () => {
    const run = (r: number) => {
      const e = engine('led-resistor');
      e.setParam('R1', 'resistance', r);
      e.advance(1);
      return e;
    };
    expect(run(330).current('A1', 0)).toBeGreaterThan(0.02);
    expect(run(330).state('D1').burned).toBeFalsy();
    expect(run(47).state('D1').burned).toBe(true);
    const dim = run(1000);
    expect(dim.state('D1').burned).toBeFalsy();
    expect(dim.current('A1', 0)).toBeLessThan(0.008);
    expect(dim.current('A1', 0)).toBeGreaterThan(0.005);
  });
});
