import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import type { Method } from './device';
import { circuit } from './test-helpers';

/** 5 V through 1 kΩ into 1 µF (τ = 1 ms), from power-on with the capacitor empty. */
function rc() {
  return circuit()
    .add('V', 'rail', { v: 'in' }, { voltage: 5 })
    .add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: 1000 })
    .add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: 1e-6 });
}

describe('RC charging', () => {
  for (const method of ['euler', 'trapezoidal'] as Method[]) {
    test(`matches V(1 − e^(−t/RC)) within 1 % at τ, 2τ and 5τ (${method})`, () => {
      const c = rc();
      const e = createAnalogEngine(c.build(), { method });
      const out = c.net('out');
      let t = 0;
      for (const k of [1, 2, 5]) {
        e.advance(k * 1e-3 - t);
        t = k * 1e-3;
        expect(e.time).toBeCloseTo(t, 12);
        const exact = 5 * (1 - Math.exp(-k));
        expect(Math.abs(e.voltage(out) - exact) / exact).toBeLessThan(0.01);
      }
      // The capacitor's current is C·dv/dt = (5 − v)/R, and Kirchhoff holds at the output node.
      expect(e.current('C', 0)).toBeCloseTo((5 - e.voltage(out)) / 1000, 6);
      expect(e.current('R', 1) + e.current('C', 0)).toBeCloseTo(0, 11);
      // Adaptive steps: a few hundred at most for five time constants.
      expect(e.stats.steps).toBeLessThan(600);
    });
  }

  for (const method of ['euler', 'trapezoidal'] as Method[]) {
    test(`energy balance: a source charging a capacitor through a resistor delivers C·V², half stored, half heat (${method})`, () => {
      const c = rc();
      const e = createAnalogEngine(c.build(), { method });
      const rec = e.watch([c.net('in'), c.net('out')]);
      e.advance(12e-3);
      const t = rec.times();
      const [vin, vout] = rec.values() as [Float64Array, Float64Array];
      let delivered = 0;
      let heat = 0;
      for (let i = 1; i < t.length; i++) {
        const dt = t[i]! - t[i - 1]!;
        const i0 = (vin[i - 1]! - vout[i - 1]!) / 1000;
        const i1 = (vin[i]! - vout[i]!) / 1000;
        delivered += 0.5 * (5 * i0 + 5 * i1) * dt;
        heat += 0.5 * (i0 * i0 * 1000 + i1 * i1 * 1000) * dt;
      }
      const stored = 0.5 * 1e-6 * vout[vout.length - 1]! ** 2;
      expect(Math.abs(delivered - 1e-6 * 25) / (1e-6 * 25)).toBeLessThan(0.01);
      expect(Math.abs(delivered - (stored + heat)) / delivered).toBeLessThan(0.01);
      expect(Math.abs(stored - 0.5 * 1e-6 * 25) / stored).toBeLessThan(0.01);
    });
  }

  test('a capacitor starts at its initial voltage and discharges', () => {
    const c = circuit()
      .add('R', 'resistor', { '1': 'a', '2': 'gnd' }, { resistance: 10000 })
      .add('C', 'capacitor', { '1': 'a', '2': 'gnd' }, { capacitance: 1e-5, initial: 9 });
    const e = createAnalogEngine(c.build());
    expect(e.voltage(c.net('a'))).toBeCloseTo(9, 6);
    e.advance(0.1);
    expect(Math.abs(e.voltage(c.net('a')) / (9 * Math.exp(-1)) - 1)).toBeLessThan(0.01);
  });

  test('is efficient on slow circuits: one second of a 1 s time constant takes few steps', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'in' }, { voltage: 5 })
      .add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: 1e6 })
      .add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: 1e-6 });
    const e = createAnalogEngine(c.build());
    for (let f = 0; f < 60; f++) e.advance(1 / 60);
    expect(Math.abs(e.voltage(c.net('out')) - 5 * (1 - Math.exp(-1)))).toBeLessThan(0.02);
    expect(e.stats.steps).toBeLessThan(400);
  });
});

describe('integration methods', () => {
  /**
   * A stiff step: 5 V switched onto 1 kΩ + 1 nF (τ ≈ 1 µs) with a fixed 10 µs step, ten times τ.
   * Backward Euler damps: v(n+1) − 5 = (v(n) − 5)/(1 + h/τ), monotonic, never above 5 V. The
   * trapezoidal rule is A-stable but not L-stable: the error is multiplied by
   * (1 − h/2τ)/(1 + h/2τ) ≈ −2/3 each step, so the voltage overshoots and rings around 5 V.
   */
  function stiff(method: Method) {
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'in' }, { voltage: 5, resistance: 0.2 })
      .add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: 1000 })
      .add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: 1e-9 });
    const e = createAnalogEngine(c.build(), { method, fixedStep: true, step: 1e-5 });
    const rec = e.watch([c.net('out')]);
    e.advance(1e-4);
    expect(e.stats.steps).toBe(10);
    return Array.from(rec.values()[0]!);
  }

  test('trapezoidal rings on a stiff step where backward Euler does not', () => {
    const be = stiff('euler');
    const tr = stiff('trapezoidal');
    for (let i = 1; i < be.length; i++) {
      expect(be[i]!).toBeGreaterThanOrEqual(be[i - 1]! - 1e-12);
      expect(be[i]!).toBeLessThanOrEqual(5 + 1e-9);
    }
    expect(Math.max(...tr)).toBeGreaterThan(5.1);
    // The error changes sign at every step.
    let flips = 0;
    for (let i = 2; i < tr.length; i++) if (Math.sign(tr[i]! - 5) !== Math.sign(tr[i - 1]! - 5)) flips++;
    expect(flips).toBeGreaterThanOrEqual(6);
  });
});

describe('RL circuit', () => {
  test('current rises as (V/R)(1 − e^(−tR/L))', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'in' }, { voltage: 10 })
      .add('R', 'resistor', { '1': 'in', '2': 'a' }, { resistance: 100, power: 10 })
      .add('L', 'inductor', { '1': 'a', '2': 'gnd' }, { inductance: 0.01, resistance: 1 });
    for (const method of ['euler', 'trapezoidal'] as Method[]) {
      const e = createAnalogEngine(c.build(), { method });
      const tau = 0.01 / 101;
      let t = 0;
      for (const k of [1, 2, 5]) {
        e.advance(k * tau - t);
        t = k * tau;
        const exact = (10 / 101) * (1 - Math.exp(-k));
        expect(Math.abs((e.state('L').current as number) - exact) / exact).toBeLessThan(0.01);
      }
    }
  });
});

describe('sources and recorders', () => {
  test('a square wave into an RC network: breakpoints at the edges', () => {
    const c = circuit()
      .add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 100, amplitude: 2.5, offset: 2.5, rise: 1e-6 })
      .add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: 1000 })
      .add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: 1e-6 });
    const e = createAnalogEngine(c.build());
    const rec = e.watch([c.net('in'), c.net('out')]);
    e.advance(0.005);
    expect(e.voltage(c.net('in'))).toBeCloseTo(5, 6);
    expect(e.voltage(c.net('out'))).toBeCloseTo(5 * (1 - Math.exp(-5)), 2);
    e.advance(0.005);
    expect(e.voltage(c.net('in'))).toBeCloseTo(0, 6);
    expect(e.voltage(c.net('out'))).toBeLessThan(0.05);
    const times = rec.times();
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
    // The recorder has the corners of the edges.
    for (const corner of [1e-6, 0.005, 0.005 + 1e-6]) expect(times.some((t) => Math.abs(t - corner) < 1e-12)).toBe(true);
    rec.trim(0.002);
    expect(rec.times()[0]!).toBeGreaterThanOrEqual(0.008 - 1e-12);
    expect(rec.values()[1]!.length).toBe(rec.times().length);
    rec.close();
  });

  test('sine, triangle and pulse waveforms', () => {
    const c = circuit()
      .add('G1', 'siggen', { '-': 'gnd', '+': 'a' }, { waveform: 'sine', frequency: 50, amplitude: 1, offset: 0 })
      .add('G2', 'siggen', { '-': 'gnd', '+': 'b' }, { waveform: 'triangle', frequency: 50, amplitude: 1, offset: 0 })
      .add('G3', 'siggen', { '-': 'gnd', '+': 'c' }, { waveform: 'pulse', frequency: 50, amplitude: 5, offset: 0, duty: 0.25 });
    const e = createAnalogEngine(c.build());
    e.advance(0.005); // a quarter period
    expect(e.voltage(c.net('a'))).toBeCloseTo(1, 6);
    expect(e.voltage(c.net('b'))).toBeCloseTo(0, 6);
    expect(e.voltage(c.net('c'))).toBeCloseTo(5, 6); // the pulse is high for 25 % of the period (5 ms)
    e.advance(0.005);
    expect(e.voltage(c.net('c'))).toBeCloseTo(0, 6);
    expect(e.voltage(c.net('a'))).toBeCloseTo(0, 6);
    expect(e.voltage(c.net('b'))).toBeCloseTo(1, 6);
    e.advance(0.0105);
    expect(e.voltage(c.net('c'))).toBeCloseTo(5, 6);
  });

  test('advance() caps its work and reports when it cannot keep up', () => {
    const c = circuit()
      .add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 1e6 })
      .add('R', 'resistor', { '1': 'in', '2': 'out' })
      .add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: 1e-10 });
    const e = createAnalogEngine(c.build(), { maxStepsPerAdvance: 200 });
    e.advance(1 / 60);
    expect(e.lagging).toBe(true);
    expect(e.speed).toBeLessThan(1);
    expect(e.stats.steps).toBe(200);
    expect(e.messages.some((m) => m.level === 'info' && /slower/.test(m.text))).toBe(true);
  });

  test('reset returns to the initial state and is deterministic', () => {
    const c = rc();
    const e = createAnalogEngine(c.build());
    e.advance(1e-3);
    const v1 = e.voltage(c.net('out'));
    e.reset();
    expect(e.time).toBe(0);
    expect(e.voltage(c.net('out'))).toBeCloseTo(0, 6);
    e.advance(1e-3);
    expect(e.voltage(c.net('out'))).toBe(v1);
  });
});
