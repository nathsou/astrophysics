import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { Circuit } from '$lib/sim/netlist/types';
import { createAnalogEngine } from '$lib/sim/analog';
import chargeLed from './circuits/charge-led.json';

const make = () => createAnalogEngine(flatten(chargeLed as Circuit));

describe('charge-led', () => {
  test('closing Charge lights the LED brightly, and the light fades as the capacitor fills', () => {
    const e = make();
    expect(Number(e.state('D1').brightness)).toBeLessThan(0.001);
    e.setParam('S1', 'closed', true);
    e.advance(0.05);
    const early = Number(e.state('D1').brightness);
    expect(early).toBeGreaterThan(0.15);
    e.advance(0.5);
    const mid = Number(e.state('D1').brightness);
    expect(mid).toBeLessThan(early);
    e.advance(3);
    // Dark by three seconds (six time constants of the resistor), though the capacitor is still creeping up:
    // an LED conducts almost nothing below about 1.7 V, so the last volt or so of charging is very slow.
    expect(Number(e.state('D1').brightness)).toBeLessThan(0.02);
    const v = Number(e.state('C1').value);
    expect(v).toBeGreaterThan(3);
    expect(v).toBeLessThan(4);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('the capacitor voltage follows an exponential with τ near R × C = 0.47 s towards about 5 − 1.9 V', () => {
    const e = make();
    e.setParam('S1', 'closed', true);
    e.advance(0.2);
    const v = Number(e.state('C1').value);
    const model = 3.1 * (1 - Math.exp(-0.2 / 0.5));
    expect(Math.abs(v - model)).toBeLessThan(0.15);
  });

  test('opening Charge mid-way holds the voltage (nothing to discharge it)', () => {
    const e = make();
    e.setParam('S1', 'closed', true);
    e.advance(0.3);
    e.setParam('S1', 'closed', false);
    const v0 = Number(e.state('C1').value);
    e.advance(2);
    expect(Number(e.state('C1').value)).toBeCloseTo(v0, 2);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});
