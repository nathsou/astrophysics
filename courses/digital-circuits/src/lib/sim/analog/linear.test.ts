import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { DenseLU } from './lu';
import { mulberry32 } from './rng';
import { circuit } from './test-helpers';

describe('DenseLU', () => {
  test('solves a random well-conditioned system', () => {
    const rnd = mulberry32(7);
    const n = 12;
    const A = new Float64Array(n * n);
    for (let i = 0; i < n * n; i++) A[i] = rnd() - 0.5;
    for (let i = 0; i < n; i++) A[i * n + i] = A[i * n + i]! + n;
    const xTrue = Float64Array.from({ length: n }, () => rnd() * 10 - 5);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b[i] = b[i]! + A[i * n + j]! * xTrue[j]!;
    const lu = new DenseLU(n);
    lu.factor(A);
    const x = new Float64Array(n);
    expect(lu.solve(b, x)).toBe(true);
    for (let i = 0; i < n; i++) expect(x[i]).toBeCloseTo(xTrue[i]!, 10);
  });

  test('needs pivoting: a zero on the diagonal', () => {
    const A = Float64Array.from([0, 1, 1, 0]);
    const lu = new DenseLU(2);
    lu.factor(A);
    const x = new Float64Array(2);
    lu.solve(Float64Array.from([3, 4]), x);
    expect([...x]).toEqual([4, 3]);
  });

  test('flags a singular, inconsistent system and accepts a singular, consistent one', () => {
    const A = Float64Array.from([1, 1, 1, 1]);
    const lu = new DenseLU(2);
    lu.factor(A);
    expect(lu.singularColumns.length).toBe(1);
    const x = new Float64Array(2);
    expect(lu.solve(Float64Array.from([1, 2]), x)).toBe(false);
    expect(lu.solve(Float64Array.from([2, 2]), x)).toBe(true);
  });
});

describe('resistive circuits', () => {
  test('voltage divider', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'in' }, { voltage: 10 })
      .add('R1', 'resistor', { '1': 'in', '2': 'mid' }, { resistance: 3000 })
      .add('R2', 'resistor', { '1': 'mid', '2': 'gnd' }, { resistance: 1000 });
    const e = createAnalogEngine(c.build());
    // Exact up to the 1 pS gmin every node has to ground.
    expect(e.voltage(c.net('mid'))).toBeCloseTo(2.5, 7);
    expect(e.current('R1', 0)).toBeCloseTo(2.5e-3, 11);
    expect(e.current('R1', 1)).toBeCloseTo(-2.5e-3, 11);
    // The rail delivers the current: current into its pin is negative.
    expect(e.current('V', 0)).toBeCloseTo(-2.5e-3, 10);
    expect(e.logic(c.net('in'))).toBe(1);
    expect(e.logic(c.net('mid'))).toBe(2);
  });

  test('series and parallel resistors', () => {
    // 9 V battery (0.2 Ω) → 100 Ω → (220 Ω ∥ 330 Ω) → ground: 100 + 132 + 0.2 = 232.2 Ω.
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 9, resistance: 0.2 })
      .add('R1', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 100 })
      .add('R2', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 220 })
      .add('R3', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 330 });
    const e = createAnalogEngine(c.build());
    const I = 9 / 232.2;
    expect(e.current('R1', 0)).toBeCloseTo(I, 10);
    expect(e.voltage(c.net('b'))).toBeCloseTo(I * 132, 8);
    expect(e.current('R2', 0) + e.current('R3', 0)).toBeCloseTo(I, 10);
    expect(e.current('R2', 0) / e.current('R3', 0)).toBeCloseTo(1.5, 9);
    expect(e.state('B').value).toBeCloseTo(9 - 0.2 * I, 9);
  });

  test("Kirchhoff's current law holds at every node of random resistor networks", () => {
    const rnd = mulberry32(2024);
    for (let trial = 0; trial < 25; trial++) {
      const nodes = 3 + Math.floor(rnd() * 12);
      const c = circuit();
      const name = (i: number) => (i === 0 ? 'gnd' : `n${i}`);
      // A spanning chain keeps the network connected; then random extra resistors and sources.
      for (let i = 1; i < nodes; i++) c.add(`Rc${i}`, 'resistor', { '1': name(i - 1), '2': name(i) }, { resistance: 10 ** (1 + 4 * rnd()) });
      const extra = Math.floor(rnd() * 2 * nodes);
      for (let k = 0; k < extra; k++) {
        const a = Math.floor(rnd() * nodes);
        const b = Math.floor(rnd() * nodes);
        if (a !== b) c.add(`Rx${k}`, 'resistor', { '1': name(a), '2': name(b) }, { resistance: 10 ** (1 + 4 * rnd()) });
      }
      const sources = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < sources; k++) {
        const a = Math.floor(rnd() * nodes);
        const b = (a + 1 + Math.floor(rnd() * (nodes - 1))) % nodes;
        c.add(`B${k}`, 'battery', { '-': name(a), '+': name(b) }, { voltage: 1 + 20 * rnd(), resistance: 0.1 + rnd() });
      }
      const flat = c.build();
      const e = createAnalogEngine(flat);
      const sum = new Float64Array(flat.netCount);
      const scale = new Float64Array(flat.netCount);
      for (const el of flat.elements) {
        el.pins.forEach((net, i) => {
          const I = e.current(el.id, i);
          sum[net] = sum[net]! + I;
          scale[net] = Math.max(scale[net]!, Math.abs(I));
        });
        // Per element, too.
        expect(Math.abs(e.current(el.id, 0) + e.current(el.id, 1))).toBeLessThan(1e-12);
      }
      // Up to the gmin currents (1 pS from every node to ground, which land on the ground net).
      const gminCurrents = flat.netNames.reduce((s, _n, i) => s + 1e-12 * Math.abs(e.voltage(i)), 0);
      for (let n = 0; n < flat.netCount; n++) expect(Math.abs(sum[n]!)).toBeLessThan(1e-10 * scale[n]! + 1.01 * gminCurrents + 1e-15);
    }
  });

  test('energy balance: the power the sources deliver is the power the resistors dissipate', () => {
    const c = circuit()
      .add('B1', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 12, resistance: 0.5 })
      .add('B2', 'battery', { '-': 'gnd', '+': 'd' }, { voltage: 5, resistance: 0.1 })
      .add('R1', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 47 })
      .add('R2', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 100 })
      .add('R3', 'resistor', { '1': 'b', '2': 'c' }, { resistance: 68 })
      .add('R4', 'resistor', { '1': 'c', '2': 'gnd' }, { resistance: 150 })
      .add('R5', 'resistor', { '1': 'c', '2': 'd' }, { resistance: 33 })
      .add('R6', 'resistor', { '1': 'a', '2': 'c' }, { resistance: 220 });
    const flat = c.build();
    const e = createAnalogEngine(flat);
    const pinPower = (id: string) => {
      const el = flat.elements.find((x) => x.id === id)!;
      return el.pins.reduce((s, net, i) => s + e.voltage(net) * e.current(id, i), 0);
    };
    // A battery's pin power is what it absorbs: minus what it delivers (net of its internal loss).
    const delivered = -pinPower('B1') - pinPower('B2');
    let dissipated = 0;
    for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
      dissipated += e.state(r).power as number;
      expect(pinPower(r)).toBeCloseTo(e.state(r).power as number, 12);
    }
    expect(delivered).toBeGreaterThan(0.5);
    expect(Math.abs(delivered - dissipated) / dissipated).toBeLessThan(1e-9);
  });

  test('potentiometer divides by its position', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'top' }, { voltage: 5 })
      .add('P', 'potentiometer', { A: 'gnd', B: 'top', W: 'w' }, { resistance: 10000, position: 0.25 })
      .add('M', 'voltmeter', { '-': 'gnd', '+': 'w' });
    const e = createAnalogEngine(c.build());
    // The wiper is 25 % of the way from A (ground) to B; the voltmeter loads it slightly (10 MΩ).
    expect(e.voltage(c.net('w'))).toBeCloseTo(1.25, 3);
    expect(e.state('M').value).toBeCloseTo(e.voltage(c.net('w')), 12);
    e.setParam('P', 'position', 0.8);
    e.settle();
    // Loaded by the voltmeter: 4 V × 1.6 kΩ / 10 MΩ low.
    expect(e.voltage(c.net('w'))).toBeCloseTo(4 - (4 * 1600) / 1e7, 5);
  });

  test('ammeter reads the series current', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 5 })
      .add('M', 'ammeter', { '+': 'a', '-': 'b' })
      .add('R', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 1000 });
    const e = createAnalogEngine(c.build());
    expect(e.state('M').value).toBeCloseTo(5 / 1000.1, 10);
  });

  test('switches open and close', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 5 })
      .add('S', 'switch', { '1': 'a', '2': 'b' })
      .add('X', 'spdt', { C: 'b', '0': 'p', '1': 'q' })
      .add('R1', 'resistor', { '1': 'p', '2': 'gnd' })
      .add('R2', 'resistor', { '1': 'q', '2': 'gnd' });
    const e = createAnalogEngine(c.build());
    expect(e.voltage(c.net('p'))).toBeLessThan(1e-6);
    e.setParam('S', 'closed', true);
    e.advance(1e-3);
    expect(e.state('S').closed).toBe(true);
    expect(e.voltage(c.net('p'))).toBeCloseTo(5, 3);
    expect(e.voltage(c.net('q'))).toBeLessThan(1e-6);
    e.setParam('X', 'throw', 1);
    e.advance(1e-3);
    expect(e.state('X').throw).toBe(1);
    expect(e.voltage(c.net('q'))).toBeCloseTo(5, 3);
  });
});

describe('robustness', () => {
  test('floating nets do not break the solve', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 5 })
      .add('R', 'resistor', { '1': 'a', '2': 'gnd' })
      // A battery and resistor loop not connected to anything else.
      .add('B', 'battery', { '-': 'x', '+': 'y' }, { voltage: 9 })
      .add('R2', 'resistor', { '1': 'x', '2': 'y' }, { resistance: 100 });
    const e = createAnalogEngine(c.build());
    expect(e.voltage(c.net('a'))).toBeCloseTo(5, 9);
    expect(e.voltage(c.net('y')) - e.voltage(c.net('x'))).toBeCloseTo((9 * 100) / 100.2, 6);
    expect(e.messages.filter((m) => m.level === 'error')).toEqual([]);
  });

  test('two ideal sources in parallel with different voltages are reported', () => {
    const c = circuit()
      .add('T1', 'toggle', { Y: 'a' }, { on: true })
      .add('T2', 'toggle', { Y: 'a' }, { on: false })
      .add('R', 'resistor', { '1': 'a', '2': 'gnd' });
    const e = createAnalogEngine(c.build());
    e.advance(1e-6);
    expect(e.messages.some((m) => m.level === 'error' && /parallel/.test(m.text))).toBe(true);
  });

  test('rails of the same voltage share a net without a conflict; different ones are reported', () => {
    const c = circuit()
      .add('V1', 'rail', { v: 'a' }, { voltage: 5 })
      .add('V2', 'rail', { v: 'a' }, { voltage: 5 })
      .add('R', 'resistor', { '1': 'a', '2': 'gnd' });
    const e = createAnalogEngine(c.build());
    e.advance(1e-6);
    expect(e.voltage(c.net('a'))).toBeCloseTo(5, 9);
    expect(e.messages).toEqual([]);
    const d = circuit()
      .add('V1', 'rail', { v: 'a' }, { voltage: 5 })
      .add('V2', 'rail', { v: 'a' }, { voltage: 3.3 });
    expect(createAnalogEngine(d.build()).messages.some((m) => m.level === 'error')).toBe(true);
  });

  test('without a ground, a source − terminal becomes the reference', () => {
    const c = circuit()
      .add('B', 'battery', { '-': 'm', '+': 'p' }, { voltage: 6, resistance: 1 })
      .add('R', 'resistor', { '1': 'p', '2': 'm' }, { resistance: 5 });
    const flat = c.build(false);
    const e = createAnalogEngine(flat);
    expect(e.voltage(c.net('m'))).toBe(0);
    expect(e.voltage(c.net('p'))).toBeCloseTo(5, 9);
    expect(e.messages.some((m) => m.level === 'info' && /B/.test(m.text))).toBe(true);
  });

  test('unsupported parts are reported and left out', () => {
    const c = circuit().add('D', 'hex-display', { D0: 'a' }).add('V', 'rail', { v: 'a' });
    const e = createAnalogEngine(c.build());
    expect(e.messages.some((m) => m.element === 'D')).toBe(true);
    expect(e.voltage(c.net('a'))).toBeCloseTo(5, 9);
  });
});
