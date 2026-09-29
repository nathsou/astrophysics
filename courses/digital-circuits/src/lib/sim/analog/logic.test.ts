import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { LOGIC_FUNCTIONS } from './models/behavioural';
import { circuit } from './test-helpers';

const truth: Record<string, (a: number, b: number) => number> = {
  and: (a, b) => a & b,
  or: (a, b) => a | b,
  nand: (a, b) => 1 - (a & b),
  nor: (a, b) => 1 - (a | b),
  xor: (a, b) => a ^ b,
  xnor: (a, b) => 1 - (a ^ b),
};

function twoInput(type: string) {
  const c = circuit()
    .add('A', 'toggle', { Y: 'a' })
    .add('B', 'toggle', { Y: 'b' })
    .add('U', type, { A: 'a', B: 'b', Y: 'y' })
    .add('P', 'probe', { A: 'y' });
  return { c, e: createAnalogEngine(c.build()) };
}

describe('behavioural logic in the analog engine', () => {
  test('NAND truth table', () => {
    const { c, e } = twoInput('nand');
    for (const [a, b, y] of [
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ] as const) {
      e.setParam('A', 'on', a === 1);
      e.setParam('B', 'on', b === 1);
      e.advance(1e-6);
      expect(e.logic(c.net('y'))).toBe(y);
      expect(e.state('P').value).toBe(y);
      expect(e.state('P').level).toBe(String(y));
      expect(e.voltage(c.net('y'))).toBeCloseTo(y * 5, 2);
    }
  });

  for (const [type, f] of Object.entries(truth)) {
    test(`${type} truth table`, () => {
      const { c, e } = twoInput(type);
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          e.setParam('A', 'on', a === 1);
          e.setParam('B', 'on', b === 1);
          e.advance(1e-6);
          expect(e.logic(c.net('y'))).toBe(f(a, b));
        }
      }
    });
  }

  test('the smooth logic functions agree with Boolean logic at 0 and 1, and their derivatives are consistent', () => {
    const df = [0, 0, 0];
    for (const [name, fn] of Object.entries(LOGIC_FUNCTIONS)) {
      const n = name === 'not' || name === 'buffer' ? 1 : 3;
      for (let m = 0; m < 1 << n; m++) {
        const s = Array.from({ length: n }, (_, i) => (m >> i) & 1);
        const ones = s.reduce((x, y) => x + y, 0);
        const expected: Record<string, number> = {
          buffer: s[0]!,
          not: 1 - s[0]!,
          and: ones === n ? 1 : 0,
          nand: ones === n ? 0 : 1,
          or: ones > 0 ? 1 : 0,
          nor: ones > 0 ? 0 : 1,
          xor: ones % 2,
          xnor: 1 - (ones % 2),
        };
        expect(fn(s, df)).toBeCloseTo(expected[name]!, 12);
      }
      // Finite-difference check of the derivatives at an interior point.
      const s = [0.3, 0.6, 0.8].slice(0, n);
      const f0 = fn(s, df);
      const d = [...df];
      for (let i = 0; i < n; i++) {
        const s2 = [...s];
        s2[i]! += 1e-6;
        expect((fn(s2, [0, 0, 0]) - f0) / 1e-6).toBeCloseTo(d[i]!, 5);
      }
    }
  });

  test('a 3-input XOR is parity', () => {
    const c = circuit()
      .add('A', 'toggle', { Y: 'a' })
      .add('B', 'toggle', { Y: 'b' })
      .add('C', 'toggle', { Y: 'c' })
      .add('U', 'xor', { A: 'a', B: 'b', C: 'c', Y: 'y' }, { inputs: 3 });
    const e = createAnalogEngine(c.build());
    for (let m = 0; m < 8; m++) {
      ['A', 'B', 'C'].forEach((id, i) => e.setParam(id, 'on', ((m >> i) & 1) === 1));
      e.advance(1e-6);
      expect(e.logic(c.net('y'))).toBe((m & 1) ^ ((m >> 1) & 1) ^ ((m >> 2) & 1));
    }
  });

  test('the output crosses 50 % one gate delay after the input changes', () => {
    const c = circuit()
      .add('A', 'toggle', { Y: 'a' })
      .add('U', 'not', { A: 'a', Y: 'y' }, { delay: 10 });
    const e = createAnalogEngine(c.build());
    e.advance(1e-6);
    expect(e.logic(c.net('y'))).toBe(1);
    const rec = e.watch([c.net('y')]);
    const t0 = e.time;
    e.setParam('A', 'on', true);
    e.advance(100e-9);
    const t = rec.times();
    const v = rec.values()[0]!;
    let cross = NaN;
    for (let i = 1; i < t.length; i++) {
      if (v[i - 1]! >= 2.5 && v[i]! < 2.5) {
        cross = t[i - 1]! + ((t[i]! - t[i - 1]!) * (v[i - 1]! - 2.5)) / (v[i - 1]! - v[i]!);
        break;
      }
    }
    expect(cross - t0).toBeGreaterThan(9e-9);
    expect(cross - t0).toBeLessThan(11e-9);
  });

  test('gates mix with analog parts: an inverter lights an LED through a resistor', () => {
    const c = circuit()
      .add('A', 'toggle', { Y: 'a' })
      .add('U', 'not', { A: 'a', Y: 'y' })
      .add('R', 'resistor', { '1': 'y', '2': 'l' }, { resistance: 220 })
      .add('D', 'led', { A: 'l', K: 'gnd' })
      .add('I', 'indicator', { A: 'y' });
    const e = createAnalogEngine(c.build());
    e.advance(1e-3);
    expect(e.state('D').lit).toBe(true);
    // (5 − 1.9)/(220 + 50) ≈ 11 mA; the 50 Ω output resistance shows.
    expect(e.current('D', 0)).toBeGreaterThan(0.01);
    expect(e.current('D', 0)).toBeLessThan(0.013);
    expect(e.state('I').lit).toBe(true);
    e.setParam('A', 'on', true);
    e.advance(1e-3);
    expect(e.state('D').lit).toBe(false);
    expect(e.state('I')).toMatchObject({ lit: false, brightness: 0 });
  });

  test('an SR latch from two NANDs holds its state', () => {
    const c = circuit()
      .add('S', 'toggle', { Y: 's' }, { on: true })
      .add('R', 'toggle', { Y: 'r' }, { on: true })
      .add('U1', 'nand', { A: 's', B: 'qb', Y: 'q' })
      .add('U2', 'nand', { A: 'r', B: 'q', Y: 'qb' });
    const e = createAnalogEngine(c.build());
    e.advance(1e-6);
    // Power-on: it settles to one state or the other, never in between.
    expect(e.logic(c.net('q')) + e.logic(c.net('qb'))).toBe(1);
    e.setParam('S', 'on', false);
    e.advance(1e-6);
    e.setParam('S', 'on', true);
    e.advance(1e-6);
    expect(e.logic(c.net('q'))).toBe(1);
    expect(e.logic(c.net('qb'))).toBe(0);
    e.setParam('R', 'on', false);
    e.advance(1e-6);
    e.setParam('R', 'on', true);
    e.advance(1e-6);
    expect(e.logic(c.net('q'))).toBe(0);
    expect(e.logic(c.net('qb'))).toBe(1);
  });

  for (const method of ['euler', 'trapezoidal'] as const) {
    test(`a ring of three inverters oscillates (${method})`, () => {
      const c = circuit()
        .add('U1', 'not', { A: 'c', Y: 'a' }, { delay: 10 })
        .add('U2', 'not', { A: 'a', Y: 'b' }, { delay: 10 })
        .add('U3', 'not', { A: 'b', Y: 'c' }, { delay: 10 });
      const e = createAnalogEngine(c.build(), { method, maxStepsPerAdvance: 1e5 });
      const rec = e.watch([c.net('a')]);
      e.advance(1e-6);
      expect(e.lagging).toBe(false);
      const t = rec.times();
      const v = rec.values()[0]!;
      const rises: number[] = [];
      for (let i = 1; i < t.length; i++) if (v[i - 1]! < 2.5 && v[i]! >= 2.5) rises.push(t[i]!);
      expect(rises.length).toBeGreaterThan(10);
      // Each stage's delay is 10 ns for a sharp input edge; the ring's slow edges make it faster.
      const period = (rises[rises.length - 1]! - rises[3]!) / (rises.length - 4);
      expect(period).toBeGreaterThan(30e-9);
      expect(period).toBeLessThan(80e-9);
    });
  }

  test('comparator switches when + passes −', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('P', 'potentiometer', { A: 'gnd', B: 'vcc', W: 'plus' }, { position: 0.3 })
      .add('R1', 'resistor', { '1': 'vcc', '2': 'minus' })
      .add('R2', 'resistor', { '1': 'minus', '2': 'gnd' })
      .add('K', 'comparator', { '+': 'plus', '-': 'minus', Y: 'y' })
      .add('RL', 'resistor', { '1': 'y', '2': 'gnd' }, { resistance: 10000 });
    const e = createAnalogEngine(c.build());
    e.advance(1e-6);
    expect(e.voltage(c.net('y'))).toBeLessThan(0.01);
    expect(e.state('K').value).toBe(0);
    e.setParam('P', 'position', 0.7);
    e.advance(1e-6);
    expect(e.voltage(c.net('y'))).toBeGreaterThan(4.99);
    expect(e.state('K').value).toBe(1);
  });

  test('logic sources: const, button and clock', () => {
    const c = circuit()
      .add('K', 'const', { Y: 'k' }, { value: 1 })
      .add('B', 'button', { Y: 'b' })
      .add('CLK', 'clock', { Y: 'c' }, { frequency: 1000 });
    const e = createAnalogEngine(c.build());
    e.advance(0.25e-3);
    expect(e.logic(c.net('k'))).toBe(1);
    expect(e.logic(c.net('b'))).toBe(0);
    expect(e.logic(c.net('c'))).toBe(1);
    e.advance(0.5e-3);
    expect(e.logic(c.net('c'))).toBe(0);
    e.setParam('B', 'pressed', true);
    e.advance(1e-6);
    expect(e.logic(c.net('b'))).toBe(1);
  });
});
