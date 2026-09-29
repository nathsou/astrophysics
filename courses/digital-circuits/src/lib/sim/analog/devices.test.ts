import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { VT } from './device';
import { circuit } from './test-helpers';

describe('diode', () => {
  test('operating point with a resistor matches a numerical solution of the Shockley equation', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'in' }, { voltage: 5 })
      .add('R', 'resistor', { '1': 'in', '2': 'a' }, { resistance: 1000 })
      .add('D', 'diode', { A: 'a', K: 'gnd' });
    const e = createAnalogEngine(c.build());
    // Defaults: Is = 2.5 nA, n = 1.75, Rs = 0.6 Ω. Solve 5 = 1000·I + nVt·ln(I/Is + 1) + Rs·I by bisection.
    const is = 2.5e-9;
    const nvt = 1.75 * VT;
    const f = (I: number) => 1000 * I + nvt * Math.log(I / is + 1) + 0.6 * I - 5;
    let lo = 0;
    let hi = 5e-3;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    const I = (lo + hi) / 2;
    expect(Math.abs(e.current('D', 0) - I) / I).toBeLessThan(1e-6);
    expect(e.voltage(c.net('a'))).toBeCloseTo(5 - 1000 * I, 6);
    expect(e.voltage(c.net('a'))).toBeGreaterThan(0.6);
    expect(e.voltage(c.net('a'))).toBeLessThan(0.8);
  });

  test('blocks in reverse (only the tiny leakage flows)', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'in' }, { voltage: 5 })
      .add('R', 'resistor', { '1': 'in', '2': 'k' }, { resistance: 1000 })
      .add('D', 'diode', { A: 'gnd', K: 'k' });
    const e = createAnalogEngine(c.build());
    expect(Math.abs(e.current('D', 0))).toBeLessThan(1e-8);
    expect(e.voltage(c.net('k'))).toBeCloseTo(5, 4);
  });
});

describe('LED', () => {
  // Forward voltage at 10 mA, forced by a bench supply in current limit.
  const ranges: Record<string, [number, number]> = {
    infrared: [1.1, 1.3],
    red: [1.8, 2.0],
    amber: [2.0, 2.1],
    yellow: [2.0, 2.1],
    green: [2.05, 2.2],
    blue: [3.0, 3.2],
    white: [3.0, 3.2],
  };
  for (const [color, [lo, hi]] of Object.entries(ranges)) {
    test(`${color}: forward voltage at 10 mA in [${lo}, ${hi}] V, and still below ${hi + 0.1} V at 20 mA`, () => {
      const c = circuit()
        .add('S', 'supply', { '-': 'gnd', '+': 'a' }, { voltage: 10, limit: 0.01 })
        .add('D', 'led', { A: 'a', K: 'gnd' }, { color });
      const e = createAnalogEngine(c.build());
      e.advance(1e-3);
      expect(e.state('S').cc).toBe(true);
      expect(e.current('D', 0)).toBeCloseTo(0.01, 9);
      const vf = e.voltage(c.net('a'));
      expect(vf).toBeGreaterThanOrEqual(lo);
      expect(vf).toBeLessThanOrEqual(hi);
      const s = e.state('D');
      expect(s.lit).toBe(true);
      expect(s.brightness).toBeCloseTo(1 / 3, 6);
      e.setParam('S', 'limit', 0.02);
      e.advance(1e-3);
      expect(e.voltage(c.net('a'))).toBeLessThan(hi + 0.1);
      expect(e.state('D').burned).toBe(false);
    });
  }

  test('an LED with a resistor lights; without one, on 9 V, it burns out and says why', () => {
    const ok = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: 9 })
      .add('R', 'resistor', { '1': 'p', '2': 'a' }, { resistance: 470 })
      .add('D', 'led', { A: 'a', K: 'gnd' });
    const e1 = createAnalogEngine(ok.build());
    e1.advance(1);
    expect(e1.state('D').lit).toBe(true);
    expect(e1.state('D').burned).toBe(false);
    expect(e1.current('D', 0)).toBeGreaterThan(0.013);
    expect(e1.current('D', 0)).toBeLessThan(0.016);

    const bad = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 9 })
      .add('D', 'led', { A: 'a', K: 'gnd' });
    const e2 = createAnalogEngine(bad.build());
    e2.advance(0.1);
    const s = e2.state('D');
    expect(s.burned).toBe(true);
    expect(s.lit).toBe(false);
    expect(Math.abs(e2.current('D', 0))).toBeLessThan(1e-9);
    const m = e2.messages.find((x) => x.element === 'D');
    expect(m?.text).toMatch(/D burned out: .*A through a 30 mA LED/);
    // It burned within a millisecond or so.
    expect(m!.time).toBeLessThan(2e-3);
  });
});

describe('transistors', () => {
  test('an NPN switch saturates with enough base current', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('RC', 'resistor', { '1': 'vcc', '2': 'c' }, { resistance: 1000 })
      .add('RB', 'resistor', { '1': 'in', '2': 'b' }, { resistance: 10000 })
      .add('S', 'spdt', { C: 'in', '0': 'gnd', '1': 'vcc' })
      .add('Q', 'npn', { B: 'b', C: 'c', E: 'gnd' });
    const e = createAnalogEngine(c.build());
    expect(e.state('Q').region).toBe('cutoff');
    expect(e.voltage(c.net('c'))).toBeCloseTo(5, 3);
    e.setParam('S', 'throw', 1);
    e.advance(1e-3);
    const s = e.state('Q');
    expect(s.region).toBe('saturation');
    expect(e.voltage(c.net('c'))).toBeLessThan(0.2);
    expect(s.ic as number).toBeGreaterThan(4.7e-3);
    expect(s.ib as number).toBeGreaterThan(4e-4);
    // Kirchhoff per element: ic + ib + ie = 0.
    expect(e.current('Q', 0) + e.current('Q', 1) + e.current('Q', 2)).toBeCloseTo(0, 15);
  });

  test('an NPN in the active region amplifies the base current by β', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 10 })
      .add('RC', 'resistor', { '1': 'vcc', '2': 'c' }, { resistance: 1000 })
      .add('RB', 'resistor', { '1': 'vcc', '2': 'b' }, { resistance: 2e6 })
      .add('Q', 'npn', { B: 'b', C: 'c', E: 'gnd' }, { beta: 150 });
    const e = createAnalogEngine(c.build());
    const s = e.state('Q');
    expect(s.region).toBe('active');
    expect((s.ic as number) / (s.ib as number)).toBeGreaterThan(145);
    expect((s.ic as number) / (s.ib as number)).toBeLessThan(155);
  });

  test('a PNP high-side switch', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('Q', 'pnp', { E: 'vcc', B: 'b', C: 'c' })
      .add('RB', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 10000 })
      .add('RL', 'resistor', { '1': 'c', '2': 'gnd' }, { resistance: 1000 });
    const e = createAnalogEngine(c.build());
    expect(e.state('Q').region).toBe('saturation');
    expect(e.voltage(c.net('c'))).toBeGreaterThan(4.8);
    expect(e.current('Q', 1)).toBeLessThan(0); // current comes out of the collector
  });

  test('an nMOS inverter: monotonic transfer curve, switching point between 1 and 4 V', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vdd' }, { voltage: 5 })
      .add('RD', 'resistor', { '1': 'vdd', '2': 'out' }, { resistance: 10000 })
      .add('IN', 'supply', { '-': 'gnd', '+': 'in' }, { voltage: 0, limit: 1 })
      .add('M', 'nmos', { G: 'in', D: 'out', S: 'gnd' });
    const e = createAnalogEngine(c.build());
    const curve: [number, number][] = [];
    for (let i = 0; i <= 50; i++) {
      const vin = i * 0.1;
      e.setParam('IN', 'voltage', vin);
      e.settle();
      curve.push([vin, e.voltage(c.net('out'))]);
    }
    expect(curve[0]![1]).toBeCloseTo(5, 6);
    expect(curve[50]![1]).toBeLessThan(0.1);
    for (let i = 1; i < curve.length; i++) expect(curve[i]![1]).toBeLessThanOrEqual(curve[i - 1]![1] + 1e-9);
    const sw = curve.find(([, v]) => v < 2.5)![0];
    expect(sw).toBeGreaterThan(1);
    expect(sw).toBeLessThan(4);
    e.setParam('IN', 'voltage', 0.5);
    e.settle();
    expect(e.state('M').region).toBe('off');
    e.setParam('IN', 'voltage', 5);
    e.settle();
    expect(e.state('M').region).toBe('linear');
    e.setParam('IN', 'voltage', 1.1);
    e.settle();
    expect(e.state('M').region).toBe('saturation');
  });

  test('a CMOS inverter (pMOS over nMOS)', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vdd' }, { voltage: 5 })
      .add('IN', 'supply', { '-': 'gnd', '+': 'in' }, { voltage: 0, limit: 1 })
      .add('P', 'pmos', { G: 'in', S: 'vdd', D: 'out' })
      .add('N', 'nmos', { G: 'in', D: 'out', S: 'gnd' })
      .add('RL', 'resistor', { '1': 'out', '2': 'gnd' }, { resistance: 1e5 });
    const e = createAnalogEngine(c.build());
    expect(e.voltage(c.net('out'))).toBeGreaterThan(4.9);
    expect(e.state('P').region).toBe('linear');
    e.setParam('IN', 'voltage', 5);
    e.settle();
    expect(e.voltage(c.net('out'))).toBeLessThan(0.01);
    expect(e.state('P').region).toBe('off');
  });
});

describe('sources', () => {
  test('the bench supply goes into current limit on a short and recovers', () => {
    const c = circuit()
      .add('S', 'supply', { '-': 'gnd', '+': 'p' }, { voltage: 5, limit: 0.5 })
      .add('R', 'resistor', { '1': 'p', '2': 'gnd' }, { resistance: 100 })
      .add('K', 'switch', { '1': 'p', '2': 'gnd' });
    const e = createAnalogEngine(c.build());
    expect(e.state('S').cc).toBe(false);
    expect(e.voltage(c.net('p'))).toBeCloseTo(5, 6);
    e.setParam('K', 'closed', true);
    e.advance(1e-3);
    expect(e.state('S').cc).toBe(true);
    expect(e.state('S').current).toBeCloseTo(0.5, 9);
    expect(e.voltage(c.net('p'))).toBeLessThan(0.01);
    e.setParam('K', 'closed', false);
    e.advance(1e-3);
    expect(e.state('S').cc).toBe(false);
    expect(e.voltage(c.net('p'))).toBeCloseTo(5, 6);
  });

  test('a supply whose terminals are wired together is in current limit', () => {
    const c = circuit().add('S', 'supply', { '-': 'gnd', '+': 'gnd' });
    const e = createAnalogEngine(c.build());
    expect(e.state('S').cc).toBe(true);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('ratings', () => {
  test('an overloaded resistor burns out after a while and opens', () => {
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 9, resistance: 0.01 })
      .add('R2', 'resistor', { '1': 'a', '2': 'gnd' }, { resistance: 100, power: 0.25 });
    const e = createAnalogEngine(c.build());
    e.advance(0.2);
    expect(e.state('R2').burned).toBe(false);
    expect(e.state('R2').heat as number).toBeGreaterThan(0.5);
    e.advance(0.5);
    expect(e.state('R2').burned).toBe(true);
    expect(Math.abs(e.current('R2', 0))).toBeLessThan(1e-9);
    expect(e.messages.map((m) => m.text)).toContain('R2 burned out: 0.81 W in a 0.25 W resistor.');
  });

  test('a reversed electrolytic capacitor fails short', () => {
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 9 })
      .add('R', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 10, power: 100 })
      .add('C', 'capacitor', { '1': 'gnd', '2': 'b' }, { capacitance: 1e-5, polarised: true });
    const e = createAnalogEngine(c.build());
    e.advance(0.05);
    expect(e.state('C').burned).toBe(true);
    expect(e.messages.some((m) => m.element === 'C' && /reversed/.test(m.text))).toBe(true);
    expect(Math.abs(e.voltage(c.net('b')))).toBeLessThan(0.1);
  });
});

describe('lamp', () => {
  test('brightness rises over tens of milliseconds, with an inrush current', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 6 })
      .add('L', 'lamp', { '1': 'a', '2': 'gnd' }, { ratedVoltage: 6, ratedPower: 0.3 });
    const e = createAnalogEngine(c.build());
    // Cold filament: 12 Ω, a tenth of the hot 120 Ω.
    expect(e.current('L', 0)).toBeCloseTo(0.5, 3);
    const b: number[] = [];
    let t = 0;
    for (const at of [0.005, 0.02, 0.05, 0.1, 0.3]) {
      e.advance(at - t);
      t = at;
      b.push(e.state('L').brightness as number);
    }
    for (let i = 1; i < b.length; i++) expect(b[i]!).toBeGreaterThan(b[i - 1]!);
    expect(b[0]!).toBeLessThan(0.3);
    expect(b[4]!).toBeGreaterThan(0.95);
    expect(e.current('L', 0)).toBeCloseTo(0.05, 3);
    expect(e.state('L').burned).toBe(false);
  });

  test('burns out at 1.5 × its rated voltage', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 9 })
      .add('L', 'lamp', { '1': 'a', '2': 'gnd' }, { ratedVoltage: 6, ratedPower: 0.3 });
    const e = createAnalogEngine(c.build());
    e.advance(0.5);
    expect(e.state('L').burned).toBe(true);
    expect(e.state('L').brightness).toBe(0);
    expect(e.messages.some((m) => m.element === 'L' && /9 V across a 6 V lamp/.test(m.text))).toBe(true);
  });
});

describe('pushbutton', () => {
  function bouncy(seed: number) {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 5 })
      .add('P', 'pushbutton', { '1': 'a', '2': 'b' }, { bounce: true })
      .add('R', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 10000 });
    const e = createAnalogEngine(c.build(), { seed });
    const rec = e.watch([c.net('b')]);
    e.advance(1e-3);
    e.setParam('P', 'pressed', true);
    e.advance(0.01);
    const v = Array.from(rec.values()[0]!);
    let edges = 0;
    for (let i = 1; i < v.length; i++) if (v[i]! > 2.5 !== v[i - 1]! > 2.5) edges++;
    return { e, v, t: Array.from(rec.times()), edges };
  }

  test('bounces for a few milliseconds when pressed, then stays closed; seeded', () => {
    const a = bouncy(1);
    expect(a.edges).toBeGreaterThanOrEqual(5);
    expect(a.e.state('P').closed).toBe(true);
    // The last edge is within 5 ms of the press.
    let last = 0;
    for (let i = 1; i < a.v.length; i++) if (a.v[i]! > 2.5 !== a.v[i - 1]! > 2.5) last = a.t[i]!;
    expect(last).toBeLessThan(1e-3 + 5e-3 + 1e-6);
    const b = bouncy(1);
    expect(b.v).toEqual(a.v);
    const c = bouncy(99);
    expect(c.t).not.toEqual(a.t);
  });

  test('without bounce it is a clean switch', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'a' }, { voltage: 5 })
      .add('P', 'pushbutton', { '1': 'a', '2': 'b' })
      .add('R', 'resistor', { '1': 'b', '2': 'gnd' });
    const e = createAnalogEngine(c.build());
    e.setParam('P', 'pressed', true);
    e.advance(1e-6);
    expect(e.voltage(c.net('b'))).toBeCloseTo(5, 3);
    expect(e.state('P')).toEqual({ pressed: true, closed: true });
  });
});
