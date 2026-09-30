import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { circuit } from './test-helpers';

/** Circuits that are hard for Newton–Raphson or for the step control: they must run, deterministically, without failures. */

/** Number of times a recorded waveform crosses `level` upwards. */
function risingCrossings(times: Float64Array, v: Float64Array, level: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1]! < level && v[i]! >= level) out.push(times[i - 1]! + ((level - v[i - 1]!) / (v[i]! - v[i - 1]!)) * (times[i]! - times[i - 1]!));
  }
  return out;
}

describe('oscillators and hard switching', () => {
  test('a transistor astable multivibrator oscillates at about 1 / (1.38 R C)', () => {
    const C = 10e-9;
    const R = 47e3;
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('RC1', 'resistor', { '1': 'vcc', '2': 'c1' }, { resistance: 1000 })
      .add('RC2', 'resistor', { '1': 'vcc', '2': 'c2' }, { resistance: 1000 })
      .add('RB1', 'resistor', { '1': 'vcc', '2': 'b1' }, { resistance: R })
      .add('RB2', 'resistor', { '1': 'vcc', '2': 'b2' }, { resistance: R })
      .add('C1', 'capacitor', { '1': 'c1', '2': 'b2' }, { capacitance: C, initial: 0 })
      .add('C2', 'capacitor', { '1': 'c2', '2': 'b1' }, { capacitance: C, initial: 3 })
      .add('Q1', 'npn', { B: 'b1', C: 'c1', E: 'gnd' })
      .add('Q2', 'npn', { B: 'b2', C: 'c2', E: 'gnd' });
    const e = createAnalogEngine(c.build(), { maxStepsPerAdvance: 100000 });
    const rec = e.watch([c.net('c1')]);
    e.advance(0.02);
    const edges = risingCrossings(rec.times(), rec.values()[0]!, 2.5);
    expect(edges.length).toBeGreaterThan(20);
    const periods = edges.slice(2).map((t, i) => t - edges[i + 1]!);
    const mean = periods.reduce((a, b) => a + b, 0) / periods.length;
    expect(mean).toBeGreaterThan(0.8 * 1.38 * R * C);
    expect(mean).toBeLessThan(1.2 * 1.38 * R * C);
    expect(e.stats.failures).toBe(0);
  });

  test('a relay buzzer (its own contact interrupts its coil) keeps buzzing', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('K', 'relay', { A: 'vcc', B: 'x', NC: 'x', COM: 'gnd' })
      .add('D', 'diode', { A: 'x', K: 'vcc' });
    const e = createAnalogEngine(c.build());
    let made = 0;
    let was = e.state('K').nc as boolean;
    for (let i = 0; i < 2000; i++) {
      e.advance(1e-4);
      const nc = e.state('K').nc as boolean;
      if (nc && !was) made++;
      was = nc;
    }
    expect(made).toBeGreaterThan(5);
    expect(e.stats.failures).toBe(0);
    expect(e.messages.filter((m) => m.level === 'error')).toEqual([]);
  });

  test('a chain of MOSFET inverters follows a slow ramp through its very steep transition', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('G', 'siggen', { '-': 'gnd', '+': 'g' }, { waveform: 'triangle', frequency: 50, amplitude: 2.5, offset: 2.5 })
      .add('R', 'resistor', { '1': 'g', '2': 'in' }, { resistance: 10000 })
      .add('C', 'capacitor', { '1': 'in', '2': 'gnd' }, { capacitance: 1e-8 });
    for (let i = 1; i <= 4; i++) {
      const inp = i === 1 ? 'in' : `inv${i - 1}`;
      c.add(`MP${i}`, 'pmos', { G: inp, S: 'vcc', D: `inv${i}` });
      c.add(`MN${i}`, 'nmos', { G: inp, D: `inv${i}`, S: 'gnd' });
    }
    const e = createAnalogEngine(c.build(), { maxStepsPerAdvance: 100000 });
    const rec = e.watch([c.net('inv4')]);
    e.advance(0.04);
    expect(e.stats.failures).toBe(0);
    // Two ramps: inv4 follows `in` (four inversions), so it goes high and low twice.
    const v = rec.values()[0]!;
    expect(risingCrossings(rec.times(), v, 2.5).length).toBe(2);
    expect(Math.max(...v)).toBeGreaterThan(4.9);
    expect(Math.min(...v)).toBeLessThan(0.1);
  });

  test('a ring of three CMOS inverters with load capacitors oscillates', () => {
    const c = circuit().add('V', 'rail', { v: 'vcc' }, { voltage: 5 });
    for (let i = 0; i < 3; i++) {
      const inp = `o${i}`;
      const out = `o${(i + 1) % 3}`;
      c.add(`MP${i}`, 'pmos', { G: inp, S: 'vcc', D: out });
      c.add(`MN${i}`, 'nmos', { G: inp, D: out, S: 'gnd' });
      c.add(`C${i}`, 'capacitor', { '1': out, '2': 'gnd' }, { capacitance: 1e-11, initial: i === 0 ? 5 : 0 });
    }
    const e = createAnalogEngine(c.build(), { maxStepsPerAdvance: 100000 });
    const rec = e.watch([c.net('o0')]);
    e.advance(2e-8);
    expect(e.stats.failures).toBe(0);
    const edges = risingCrossings(rec.times(), rec.values()[0]!, 2.5);
    expect(edges.length).toBeGreaterThan(5);
  });

  test('a battery shorted by a wire delivers its short-circuit current without failing', () => {
    const c = circuit().add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: 9, resistance: 0.2 }).add('S', 'switch', { '1': 'p', '2': 'gnd' }, { closed: true });
    const e = createAnalogEngine(c.build());
    e.advance(0.01);
    // 9 V / (0.2 Ω + 10 mΩ contact).
    expect(-e.current('B', 1)).toBeGreaterThan(40);
    expect(e.stats.failures).toBe(0);
  });
});
