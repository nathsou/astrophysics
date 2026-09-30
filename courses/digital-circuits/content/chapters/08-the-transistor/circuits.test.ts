import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 8 must do what the text says it does. Each test loads the JSON exactly
 * as the page does (created, then settled, as the widget does), changes parameters through `setParam`
 * as a click or a slider does, lets the circuit settle and reads the engine.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const chapter7 = fileURLToPath(new URL('../07-diodes-and-leds/circuits/', import.meta.url));
const load = (name: string, from = dir): Circuit => JSON.parse(readFileSync(from + name + '.json', 'utf8')) as Circuit;
function engine(name: string, from = dir): AnalogEngine {
  const e = createAnalogEngine(flatten(load(name, from)));
  e.settle();
  return e;
}

/** Advance in frame-sized pieces, as the page does (one call of `advance` is capped). */
function run(e: AnalogEngine, seconds: number, frame = 0.01): void {
  const end = e.time + seconds;
  let guard = 0;
  while (e.time < end - 1e-9 && guard++ < 2000) e.advance(Math.min(frame, end - e.time));
}

const volts = (e: AnalogEngine, id: string) => e.state(id).value as number;

describe('the circuits load and run without messages, and never stall', () => {
  for (const name of ['npn-switch', 'nmos-led', 'rtl-inverter', 'rtl-nor']) {
    test(name, () => {
      const e = engine(name);
      run(e, 0.3);
      const t0 = e.time;
      for (const c of load(name).components) {
        if (c.type === 'toggle') for (const on of [true, false]) { e.setParam(c.id, 'on', on); run(e, 0.1); }
        if (c.type === 'switch') for (const closed of [false, true]) { e.setParam(c.id, 'closed', closed); e.settle(); run(e, 0.1); }
      }
      // (The NMOS figure has nothing to click: its gate is a slider.)
      expect(e.time).toBeGreaterThanOrEqual(t0);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
  test('the NMOS figure does not stall with the gate low: the LED’s node floats, and needs no bleeder resistor', () => {
    // (It once had a 10 MΩ resistor from the drain to ground to keep the solver from stalling; the engine no longer needs it.)
    expect(load('nmos-led').components.some((c) => c.type === 'resistor' && c.id !== 'R1')).toBe(false);
    for (const vg of [0, 0.5, 1]) {
      const e = engine('nmos-led');
      e.setParam('VG', 'voltage', vg);
      e.settle();
      const t0 = e.time;
      run(e, 0.3);
      expect(e.time - t0).toBeGreaterThan(0.29);
      expect(e.stats.failures).toBe(0);
      expect(e.stats.rejected).toBe(0);
      expect(e.stats.steps).toBeLessThan(200);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    }
  });
});

describe('the NPN switch (Figure 8.2)', () => {
  function point(rb: number, beta = 100) {
    const e = engine('npn-switch');
    e.setParam('RB', 'resistance', rb);
    e.setParam('Q1', 'beta', beta);
    e.settle();
    run(e, 0.2);
    const ib = e.current('A1', 0);
    const ic = e.current('A2', 0);
    return { ib, ic, ratio: ic / ib, region: e.state('Q1').region, led: e.state('D1').brightness as number };
  }
  test('with a 4.7 kΩ base resistor: 0.9 mA into the base saturates the transistor, and the LED gets the 9 mA that its own resistor allows', () => {
    const p = point(4700);
    expect(p.ib).toBeGreaterThan(0.85e-3);
    expect(p.ib).toBeLessThan(0.95e-3);
    expect(p.region).toBe('saturation');
    expect(p.ic).toBeGreaterThan(8.5e-3);
    expect(p.ic).toBeLessThan(9.5e-3);
    // The forced gain is only about 10: the circuit, not the transistor, decides the collector current.
    expect(p.ratio).toBeGreaterThan(8);
    expect(p.ratio).toBeLessThan(12);
  });
  test('with a big base resistor the collector current is exactly β times the base current', () => {
    for (const rb of [100e3, 470e3, 1e6]) {
      const p = point(rb);
      expect(p.region).toBe('active');
      expect(p.ratio).toBeGreaterThan(97);
      expect(p.ratio).toBeLessThan(103);
    }
    const q = point(100e3, 200);
    expect(q.ratio).toBeGreaterThan(195);
    expect(q.ratio).toBeLessThan(205);
    // 100 kΩ: 43 µA in, 4.3 mA out.
    const p = point(100e3);
    expect(p.ib).toBeGreaterThan(40e-6);
    expect(p.ib).toBeLessThan(46e-6);
    expect(p.ic).toBeGreaterThan(4e-3);
    expect(p.ic).toBeLessThan(4.6e-3);
  });
  test('the LED dims smoothly as the base resistor grows, through the active region', () => {
    const b = [4700, 47e3, 100e3, 470e3, 1e6].map((rb) => point(rb).led);
    for (let k = 1; k < b.length; k++) expect(b[k]!).toBeLessThan(b[k - 1]! + 1e-9);
    expect(b[0]!).toBeGreaterThan(0.25);
    expect(b[4]!).toBeLessThan(0.03);
  });
  test('open the switch and the transistor is cut off: no base current, no collector current, LED dark', () => {
    const e = engine('npn-switch');
    run(e, 0.2);
    e.setParam('SW', 'closed', false);
    e.settle();
    run(e, 0.2);
    expect(e.state('Q1').region).toBe('cutoff');
    expect(Math.abs(e.current('A2', 0))).toBeLessThan(1e-6);
    expect(e.state('D1').brightness as number).toBeLessThan(0.001);
  });
});

describe('the NMOS switch (Figure 8.3)', () => {
  function point(vg: number) {
    const e = engine('nmos-led');
    e.setParam('VG', 'voltage', vg);
    e.settle();
    run(e, 0.3);
    return { ig: e.current('A1', 0), id: e.current('A2', 0), region: e.state('M1').region, led: e.state('D1').brightness as number };
  }
  test('below the 1 V threshold nothing flows; above it the current climbs with the square of the overdrive', () => {
    expect(point(0).region).toBe('off');
    expect(point(0.9).id).toBeLessThan(1e-6);
    expect(point(1).id).toBeLessThan(1e-6);
    // Off means off: the drain ammeter reads exactly zero (the solver's picoamps are below its 1 nA floor).
    for (const vg of [0, 0.5, 1]) {
      const e = engine('nmos-led');
      e.setParam('VG', 'voltage', vg);
      e.settle();
      run(e, 0.3);
      expect(e.state('A2').value).toBe(0);
    }
    const a = point(1.2);
    const b = point(1.5);
    expect(a.region).toBe('saturation');
    expect(a.id).toBeGreaterThan(0.3e-3);
    expect(a.id).toBeLessThan(0.5e-3);
    expect(b.id).toBeGreaterThan(2.3e-3);
    expect(b.id).toBeLessThan(2.8e-3);
    // Overdrive 0.2 V → 0.5 V: (k/2)(Vgs − Vt)² grows by 6.25, less a little for the LED’s voltage.
    expect(b.id / a.id).toBeGreaterThan(5.5);
    expect(b.id / a.id).toBeLessThan(7);
  });
  test('with the gate high the LED lights at the 8–9 mA that its resistor allows', () => {
    const p = point(5);
    expect(p.id).toBeGreaterThan(8e-3);
    expect(p.id).toBeLessThan(9.2e-3);
    expect(p.led).toBeGreaterThan(0.25);
  });
  test('the gate takes no current at any voltage: picoamps at most (only the simulator’s leakage)', () => {
    for (const vg of [0, 1, 2.5, 5]) expect(Math.abs(point(vg).ig)).toBeLessThan(1e-10);
  });
});

describe('the RTL inverter (Figure 8.4)', () => {
  test('input low: output 5 V and no current. Input high: output about 0.05 V, 5 mA through the pull-up, 0.9 mA into the base', () => {
    const lo = engine('rtl-inverter');
    run(lo, 0.1);
    expect(volts(lo, 'V1')).toBeGreaterThan(4.99);
    expect(lo.state('Q1').region).toBe('cutoff');
    const hi = engine('rtl-inverter');
    hi.setParam('A', 'on', true);
    hi.settle();
    run(hi, 0.1);
    expect(volts(hi, 'V1')).toBeGreaterThan(0.02);
    expect(volts(hi, 'V1')).toBeLessThan(0.1);
    expect(hi.state('Q1').region).toBe('saturation');
    expect(hi.state('Q1').ic as number).toBeGreaterThan(4.8e-3);
    expect(hi.state('Q1').ic as number).toBeLessThan(5.1e-3);
    expect(hi.state('Q1').ib as number).toBeGreaterThan(0.85e-3);
    expect(hi.state('Q1').ib as number).toBeLessThan(0.95e-3);
  });
});

describe('the RTL NOR gate (Figure 8.7)', () => {
  test('the output is high only when both inputs are low', () => {
    const out: number[] = [];
    for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      const e = engine('rtl-nor');
      e.setParam('A', 'on', !!a);
      e.setParam('B', 'on', !!b);
      e.settle();
      run(e, 0.1);
      out.push(volts(e, 'V1'));
    }
    expect(out[0]!).toBeGreaterThan(4.99);
    for (const i of [1, 2, 3]) expect(out[i]!).toBeLessThan(0.1);
    // With both transistors on, the output is a little lower still: two transistors share the current.
    expect(out[3]!).toBeLessThan(out[1]!);
  });
});

describe('the diode chain of Chapter 7, again (Figure 8.1)', () => {
  test('it still loses about 0.65 V per stage: 4.29, 3.60, 2.94, 2.32 V', () => {
    const e = engine('diode-chain', chapter7);
    run(e, 0.1);
    const v = ['V1', 'V2', 'V3', 'V4'].map((id) => volts(e, id));
    [4.29, 3.6, 2.94, 2.32].forEach((w, i) => expect(Math.abs(v[i]! - w)).toBeLessThan(0.06));
  });
});

describe('Ebers–Moll and the level-1 MOSFET, as quoted in the "under the hood" box', () => {
  test('a BJT’s collector current is Is·e^(Vbe/Vt): tenfold for every 60 mV of base voltage', () => {
    // A bare transistor: the base is driven through 1 Ω from a voltage source, the collector held at 5 V.
    const ic = (vbe: number) => {
      const e = createAnalogEngine({
        netCount: 4,
        netNames: ['gnd', 'b', 'c', 'in'],
        ground: 0,
        elements: [
          { id: 'VB', type: 'battery', params: { voltage: vbe, resistance: 0.001 }, pins: [0, 3], pinNames: ['-', '+'] },
          { id: 'RB', type: 'resistor', params: { resistance: 1 }, pins: [3, 1], pinNames: ['1', '2'] },
          { id: 'VC', type: 'battery', params: { voltage: 5, resistance: 0.001 }, pins: [0, 2], pinNames: ['-', '+'] },
          { id: 'Q', type: 'npn', params: { beta: 100, saturation: 1e-14 }, pins: [1, 2, 0], pinNames: ['B', 'C', 'E'] },
        ],
      });
      e.settle();
      return e.state('Q').ic as number;
    };
    const ratio = ic(0.66) / ic(0.6);
    expect(ratio).toBeGreaterThan(9);
    expect(ratio).toBeLessThan(11);
    // Is = 10⁻¹⁴ A: 0.6 V gives 0.11 mA.
    expect(ic(0.6)).toBeGreaterThan(0.9e-4);
    expect(ic(0.6)).toBeLessThan(1.3e-4);
  });

  test('the MOSFET is off below Vt, quadratic just above it, and a resistor at small Vds', () => {
    const id = (vgs: number, vds: number, region?: string) => {
      const e = createAnalogEngine({
        netCount: 3,
        netNames: ['gnd', 'g', 'd'],
        ground: 0,
        elements: [
          { id: 'VG', type: 'battery', params: { voltage: vgs, resistance: 0.001 }, pins: [0, 1], pinNames: ['-', '+'] },
          { id: 'VD', type: 'battery', params: { voltage: vds, resistance: 0.001 }, pins: [0, 2], pinNames: ['-', '+'] },
          { id: 'M', type: 'nmos', params: { threshold: 1, k: 0.02, lambda: 0 }, pins: [1, 2, 0], pinNames: ['G', 'D', 'S'] },
        ],
      });
      e.settle();
      if (region) expect(e.state('M').region).toBe(region);
      return e.state('M').id as number;
    };
    expect(id(0.9, 5, 'off')).toBe(0);
    // Saturation: (k/2)(Vgs − Vt)² with k = 0.02 A/V²: 2 V gives 10 mA, 3 V gives 40 mA.
    expect(id(2, 5, 'saturation')).toBeCloseTo(0.01, 5);
    expect(id(3, 5, 'saturation')).toBeCloseTo(0.04, 5);
    // Linear: k(Vov·Vds − Vds²/2). At Vds = 0.1 V and Vgs = 3 V: 0.02 × (0.2 − 0.005) = 3.9 mA, i.e. a resistor of about 26 Ω.
    expect(id(3, 0.1, 'linear')).toBeCloseTo(0.0039, 5);
  });
});
