import { describe, expect, test } from 'vitest';
import { createAnalogEngine, type AnalogEngine } from './engine';
import { conductance, currentSource } from './device';
import { registerAnalogModel } from './models';
import type { FlatNetlist } from '../netlist/types';
import { mulberry32 } from './rng';
import { circuit } from './test-helpers';

/**
 * Regressions reported by chapter writers: floating nodes that stalled Newton–Raphson, meters
 * reading picoamps on open circuits, the start step after a breakpoint, a lamp that stayed dark at
 * 85 % of its rated current.
 */

/** Advance in frame-sized pieces, as the page does. Returns the wall time in ms. */
function run(e: AnalogEngine, seconds: number, frame = 0.01): number {
  const t0 = performance.now();
  const end = e.time + seconds;
  // A stalled engine creeps forward a few microseconds per frame: give up after 3 s of wall time.
  while (e.time < end - 1e-9 && performance.now() - t0 < 3000) e.advance(Math.min(frame, end - e.time));
  return performance.now() - t0;
}
/**
 * Engine for the stall tests. `budgetMs` (a wall-clock cap per advance() call, 500 ms: a healthy call
 * takes well under 1 ms) only exists so that a regression fails in seconds instead of hanging the suite.
 */
const engineOf = (netlist: Parameters<typeof createAnalogEngine>[0]) => createAnalogEngine(netlist, { budgetMs: 500 });
const problems = (e: AnalogEngine) => e.messages.filter((m) => m.level !== 'info');

describe('floating nodes do not stall the solver', () => {
  test('chapter 4: an LED behind an open switch, a charged 1000 µF capacitor discharged through 100 Ω', () => {
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: 5 })
      .add('S1', 'switch', { '1': 'p', '2': 'a' }, { closed: true })
      .add('R1', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 470 })
      .add('D1', 'led', { A: 'b', K: 'n' }, { color: 'red' })
      .add('C1', 'capacitor', { '1': 'n', '2': 'gnd' }, { capacitance: 0.001, polarised: true })
      .add('S2', 'switch', { '1': 'n', '2': 'd' }, { closed: false })
      .add('R2', 'resistor', { '1': 'd', '2': 'gnd' }, { resistance: 100 });
    const e = engineOf(c.build());
    e.settle();
    run(e, 6);
    expect(e.voltage(c.net('n'))).toBeGreaterThan(3);
    e.setParam('S1', 'closed', false);
    e.setParam('S2', 'closed', true);
    const before = e.stats.iterations;
    const ms = run(e, 1);
    // τ = 0.1 s: after one second (10 τ) it is flat. It used to stall at 0.77 V.
    expect(e.voltage(c.net('n'))).toBeLessThan(0.01);
    expect(e.time).toBeCloseTo(7, 6);
    expect(ms).toBeLessThan(2000);
    expect(e.stats.iterations - before).toBeLessThan(20000);
    expect(e.stats.failures).toBe(0);
    expect(problems(e)).toEqual([]);
  });

  test('chapter 5: a relay whose two contacts feed LEDs through resistors, without bleeder resistors', () => {
    const c = circuit()
      .add('S', 'supply', { '-': 'gnd', '+': 'coil' }, { voltage: 0, limit: 1 })
      .add('K1', 'relay', { A: 'coil', B: 'gnd', COM: 'com', NO: 'no', NC: 'nc' }, { coilVoltage: 5, coilResistance: 70, coilInductance: 0.1, operateTime: 0.005 })
      .add('V', 'rail', { v: 'com' }, { voltage: 5 })
      .add('R1', 'resistor', { '1': 'no', '2': 'ledno' }, { resistance: 150 })
      .add('D1', 'led', { A: 'ledno', K: 'gnd' }, { color: 'green' })
      .add('R2', 'resistor', { '1': 'nc', '2': 'lednc' }, { resistance: 150 })
      .add('D2', 'led', { A: 'lednc', K: 'gnd' }, { color: 'red' });
    const e = engineOf(c.build());
    e.settle();
    let ms = run(e, 0.2);
    // Armature at rest on NC: only the red LED is lit; the green anode floats.
    expect(e.state('D2').lit).toBe(true);
    expect(e.state('D1').lit).toBe(false);
    e.setParam('S', 'voltage', 5);
    ms += run(e, 0.4);
    expect(e.state('K1').closed).toBe(true);
    expect(e.state('D1').lit).toBe(true);
    expect(e.state('D2').lit).toBe(false);
    e.setParam('S', 'voltage', 0);
    ms += run(e, 0.4);
    expect(e.state('D2').lit).toBe(true);
    expect(e.time).toBeCloseTo(1, 6);
    expect(ms).toBeLessThan(2000);
    expect(e.stats.failures).toBe(0);
    expect(problems(e)).toEqual([]);
  });

  test('chapter 8: an nMOS switching an LED, the drain floating when the transistor is off, without a leakage resistor', () => {
    for (const vg of [0, 0.5, 1, 1.5, 5]) {
      const c = circuit()
        .add('VG', 'battery', { '-': 'gnd', '+': 'g' }, { voltage: vg, resistance: 0.001 })
        .add('M1', 'nmos', { G: 'g', D: 'd', S: 'gnd' })
        .add('P1', 'rail', { v: 'vcc' }, { voltage: 5 })
        .add('R1', 'resistor', { '1': 'vcc', '2': 'a' }, { resistance: 330 })
        .add('D1', 'led', { A: 'a', K: 'k' }, { color: 'green' })
        .add('A2', 'ammeter', { '+': 'k', '-': 'd' });
      const e = engineOf(c.build());
      e.settle();
      const ms = run(e, 1);
      expect(e.time, `vg = ${vg}`).toBeCloseTo(1, 6);
      expect(ms, `vg = ${vg}`).toBeLessThan(2000);
      expect(e.stats.iterations, `vg = ${vg}`).toBeLessThan(5000);
      expect(problems(e), `vg = ${vg}`).toEqual([]);
    }
  });

  test('random floating LED / diode / contact / ammeter chains discharging capacitors never stall', () => {
    const rnd = mulberry32(2024);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    for (let k = 0; k < 40; k++) {
      const c = circuit().add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: pick([3, 5, 9]), resistance: 0.2 });
      // Source → open switch → resistor → junction → (ammeter | closed switch | nothing) → node n.
      c.add('S1', 'switch', { '1': 'p', '2': 'a' }, { closed: false });
      c.add('R1', 'resistor', { '1': 'a', '2': 'b' }, { resistance: pick([10, 470, 10000]) });
      if (rnd() < 0.5) c.add('D1', 'led', { A: 'b', K: 'j' }, { color: pick(['red', 'green', 'blue', 'white', 'infrared']) });
      else c.add('D1', 'diode', { A: 'b', K: 'j' });
      const mid = pick(['ammeter', 'switch', 'wire']);
      if (mid === 'ammeter') c.add('M', 'ammeter', { '+': 'j', '-': 'n' });
      else if (mid === 'switch') c.add('M', 'switch', { '1': 'j', '2': 'n' }, { closed: true });
      else c.add('M', 'resistor', { '1': 'j', '2': 'n' }, { resistance: 0.01 });
      c.add('C1', 'capacitor', { '1': 'n', '2': 'gnd' }, { capacitance: pick([1e-6, 1e-4, 1e-3]), initial: 5 * rnd() });
      c.add('S2', 'switch', { '1': 'n', '2': 'd' }, { closed: false });
      c.add('R2', 'resistor', { '1': 'd', '2': 'gnd' }, { resistance: pick([1, 100, 1000]) });
      const e = engineOf(c.build());
      e.settle();
      run(e, 0.05);
      e.setParam('S2', 'closed', true);
      const ms = run(e, 0.5);
      const label = `case ${k}`;
      expect(e.time, label).toBeCloseTo(0.55, 6);
      expect(e.stats.failures, label).toBe(0);
      expect(e.stats.iterations, label).toBeLessThan(30000);
      expect(ms, label).toBeLessThan(2000);
      expect(problems(e), label).toEqual([]);
    }
  });
});

describe('meters read exactly zero below their noise floor', () => {
  test('an ammeter in series with an open switch reads 0, not picoamps; a voltmeter on a floating node reads 0', () => {
    const c = circuit()
      .add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: 5 })
      .add('S', 'switch', { '1': 'p', '2': 'a' }, { closed: false })
      .add('A', 'ammeter', { '+': 'a', '-': 'b' })
      .add('R', 'resistor', { '1': 'b', '2': 'gnd' }, { resistance: 1000 })
      .add('V', 'voltmeter', { '-': 'gnd', '+': 'b' });
    const e = createAnalogEngine(c.build());
    e.advance(0.01);
    // The solver's own numbers are picoscale leakage ...
    expect(Math.abs(e.current('A', 0))).toBeGreaterThan(0);
    expect(Math.abs(e.current('A', 0))).toBeLessThan(1e-9);
    // ... the meters do not show them.
    expect(e.state('A').value).toBe(0);
    expect(e.state('V').value).toBe(0);
    e.setParam('S', 'closed', true);
    e.advance(0.01);
    expect(e.state('A').value as number).toBeCloseTo(5e-3, 4);
    expect(e.state('V').value as number).toBeCloseTo(5, 2);
  });

  test('the floors are 1 nA and 1 µV, and signs are kept above them', () => {
    const ammeterAt = (volts: number, R: number) => {
      const c = circuit().add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: volts, resistance: 1e-3 }).add('A', 'ammeter', { '+': 'p', '-': 'q' }).add('R', 'resistor', { '1': 'q', '2': 'gnd' }, { resistance: R });
      const e = createAnalogEngine(c.build());
      e.settle();
      return e.state('A').value as number;
    };
    expect(ammeterAt(0.5, 1e9)).toBe(0);
    expect(ammeterAt(-0.5, 1e9)).toBe(0);
    expect(ammeterAt(2, 1e9)).toBeCloseTo(2e-9, 11);
    expect(ammeterAt(-2, 1e9)).toBeCloseTo(-2e-9, 11);
    const voltmeterAt = (volts: number) => {
      const c = circuit().add('B', 'battery', { '-': 'gnd', '+': 'p' }, { voltage: volts, resistance: 1e-3 }).add('V', 'voltmeter', { '-': 'gnd', '+': 'p' });
      const e = createAnalogEngine(c.build());
      e.settle();
      return e.state('V').value as number;
    };
    expect(voltmeterAt(5e-7)).toBe(0);
    expect(voltmeterAt(-5e-7)).toBe(0);
    expect(voltmeterAt(2e-6)).toBeCloseTo(2e-6, 9);
    expect(voltmeterAt(-2e-6)).toBeCloseTo(-2e-6, 9);
    expect(voltmeterAt(3.3)).toBeCloseTo(3.3, 6);
  });
});

describe('the first step after a breakpoint follows the circuit', () => {
  test('a 50 Ω → 10 pF step (τ = 0.5 ns) has at least 20 points in the first τ and is accurate', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'src' }, { voltage: 1 })
      .add('S', 'switch', { '1': 'src', '2': 'a' }, { closed: false })
      .add('R', 'resistor', { '1': 'a', '2': 'n' }, { resistance: 50 })
      .add('C', 'capacitor', { '1': 'n', '2': 'gnd' }, { capacitance: 10e-12, initial: 0 });
    const e = createAnalogEngine(c.build());
    e.settle();
    e.advance(1e-6);
    const t0 = e.time;
    const rec = e.watch([c.net('n')]);
    e.setParam('S', 'closed', true);
    // A frame-sized interval, so the requested dt does not bound the first step by itself.
    e.advance(1e-6);
    const tau = 0.5e-9;
    const times = Array.from(rec.times()).filter((t) => t > t0 && t <= t0 + tau);
    expect(times.length).toBeGreaterThanOrEqual(20);
    // Voltage at τ, 2τ, 5τ against 1 − e^(−t/τ) (10 mΩ of contact resistance changes τ by 0.02 %).
    const ts = Array.from(rec.times());
    const vs = Array.from(rec.values()[0]!);
    const at = (t: number) => {
      let i = 1;
      while (i < ts.length - 1 && ts[i]! < t) i++;
      return vs[i - 1]! + ((vs[i]! - vs[i - 1]!) * (t - ts[i - 1]!)) / (ts[i]! - ts[i - 1]!);
    };
    expect(Math.abs(at(t0 + tau) - (1 - Math.exp(-1)))).toBeLessThan(0.01);
    for (const k of [2, 5]) expect(Math.abs(at(t0 + k * tau) - (1 - Math.exp(-k)))).toBeLessThan(0.03);
    expect(problems(e)).toEqual([]);
  });

  test('the restart step uses the circuit as it is when the breakpoint happens (a switch that has just closed)', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'src' }, { voltage: 1 })
      .add('S', 'switch', { '1': 'src', '2': 'a' }, { closed: false })
      .add('R', 'resistor', { '1': 'a', '2': 'n' }, { resistance: 1000 })
      .add('C', 'capacitor', { '1': 'n', '2': 'gnd' }, { capacitance: 1e-12 })
      .add('R0', 'resistor', { '1': 'a', '2': 'gnd' }, { resistance: 1e9 });
    const e = createAnalogEngine(c.build());
    e.settle();
    const rec = e.watch([c.net('n')]);
    e.setParam('S', 'closed', true);
    e.advance(1e-6);
    // τ = 1 ns: the first accepted step is at most 1e-3 τ.
    const t = Array.from(rec.times());
    expect(t[1]! - t[0]!).toBeLessThanOrEqual(1.0001e-12);
  });

  test('a circuit with no capacitors or inductors still restarts at 1 ns, and a 1 fs time constant does not hang', () => {
    const plain = circuit().add('V', 'rail', { v: 'a' }, { voltage: 5 }).add('R', 'resistor', { '1': 'a', '2': 'gnd' }, { resistance: 1000 });
    const e = createAnalogEngine(plain.build());
    const rec = e.watch([plain.net('a')]);
    e.advance(1e-3);
    const t = Array.from(rec.times());
    expect(t[1]! - t[0]!).toBeCloseTo(1e-9, 15);

    const fast = circuit().add('V', 'rail', { v: 'a' }, { voltage: 1 }).add('R', 'resistor', { '1': 'a', '2': 'n' }, { resistance: 1 }).add('C', 'capacitor', { '1': 'n', '2': 'gnd' }, { capacitance: 1e-15 });
    const f = createAnalogEngine(fast.build());
    f.advance(1e-9);
    expect(f.voltage(fast.net('n'))).toBeCloseTo(1, 3);
    expect(f.time).toBeGreaterThan(0);
  });

  test('a short requested interval bounds the first step (dt / 100)', () => {
    const c = circuit().add('V', 'rail', { v: 'a' }, { voltage: 5 }).add('R', 'resistor', { '1': 'a', '2': 'gnd' }, { resistance: 1000 });
    const e = createAnalogEngine(c.build());
    const rec = e.watch([c.net('a')]);
    e.advance(1e-10);
    const t = Array.from(rec.times());
    expect(t[1]! - t[0]!).toBeLessThanOrEqual(1.0001e-12);
  });
});

describe('lamp brightness', () => {
  /** Steady state of a 6 V, 0.3 W lamp on a rail of `volts`. */
  function lamp(volts: number) {
    const c = circuit().add('V', 'rail', { v: 'a' }, { voltage: volts }).add('L', 'lamp', { '1': 'a', '2': 'gnd' }, { ratedVoltage: 6, ratedPower: 0.3 });
    const e = createAnalogEngine(c.build());
    e.advance(1);
    const s = e.state('L');
    return { brightness: s.brightness as number, power: (s.power as number) / 0.3 };
  }

  test('at 72 % of its rated power (85 % of the rated current) the lamp is clearly lit', () => {
    // Find the rail voltage that gives 72 % of the rated power by bisection.
    let lo = 1;
    let hi = 6;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (lamp(mid).power < 0.72) lo = mid;
      else hi = mid;
    }
    const at = lamp((lo + hi) / 2);
    expect(at.power).toBeCloseTo(0.72, 2);
    expect(at.brightness).toBeGreaterThanOrEqual(0.5);
    expect(at.brightness).toBeLessThan(0.7);
    // 85 % of the rated voltage, too.
    expect(lamp(5.1).brightness).toBeGreaterThan(0.6);
  });

  test('a dull red glow at 30–40 % of the power, rising smoothly to full at the rated voltage, dark when cold', () => {
    const at = (f: number) => lamp(6 * f);
    // Voltage fractions whose steady power is about 35 % of the rated power.
    let lo = 0.1;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid).power < 0.35) lo = mid;
      else hi = mid;
    }
    const glow = at((lo + hi) / 2).brightness;
    expect(glow).toBeGreaterThan(0.02);
    expect(glow).toBeLessThan(0.2);
    expect(lamp(0.5).brightness).toBe(0);
    expect(lamp(6).brightness).toBeCloseTo(1, 3);
    const b = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((f) => at(f).brightness);
    for (let i = 1; i < b.length; i++) expect(b[i]!).toBeGreaterThan(b[i - 1]!);
    // Smooth: no step bigger than 0.25 between neighbours.
    for (let i = 1; i < b.length; i++) expect(b[i]! - b[i - 1]!).toBeLessThan(0.25);
  });
});

describe('the 555 astable from comparators, a NOR latch and a discharge transistor', () => {
  type Supply = 'battery' | 'rail' | 'supply';
  function astable(r1: number, r2: number, cap: number, supply: Supply) {
    const c = circuit();
    if (supply === 'battery') c.add('VCC', 'battery', { '-': 'gnd', '+': 'vcc' }, { voltage: 5 });
    else if (supply === 'rail') c.add('VCC', 'rail', { v: 'vcc' }, { voltage: 5 });
    else c.add('VCC', 'supply', { '-': 'gnd', '+': 'vcc' }, { voltage: 5, limit: 1 });
    c.add('RA', 'resistor', { '1': 'vcc', '2': 'n2' }, { resistance: 5000 })
      .add('RB', 'resistor', { '1': 'n2', '2': 'n1' }, { resistance: 5000 })
      .add('RC', 'resistor', { '1': 'n1', '2': 'gnd' }, { resistance: 5000 })
      .add('CT', 'comparator', { '+': 'cap', '-': 'n2', Y: 'rst' })
      .add('CB', 'comparator', { '+': 'n1', '-': 'cap', Y: 'set' })
      .add('N1', 'nor', { A: 'rst', B: 'qn', Y: 'q' }, { delay: 0 })
      .add('N2', 'nor', { A: 'set', B: 'q', Y: 'qn' }, { delay: 0 })
      .add('RD', 'resistor', { '1': 'qn', '2': 'base' }, { resistance: 4700 })
      .add('T1', 'npn', { B: 'base', C: 'dis', E: 'gnd' })
      .add('R1', 'resistor', { '1': 'vcc', '2': 'dis' }, { resistance: r1 })
      .add('R2', 'resistor', { '1': 'dis', '2': 'cap' }, { resistance: r2 })
      .add('C1', 'capacitor', { '1': 'cap', '2': 'gnd' }, { capacitance: cap });
    return c;
  }
  /** Runs 6.5 textbook periods in frames of `frame` periods; returns measured period / textbook period. */
  function measure(r1: number, r2: number, cap: number, supply: Supply, frame: number) {
    const c = astable(r1, r2, cap, supply);
    const e = createAnalogEngine(c.build());
    const period = 0.693 * (r1 + 2 * r2) * cap;
    const total = 6.5 * period;
    const rec = e.watch([c.net('q')]);
    const n = e.size;
    const perIteration = 4 * n * n + 16 * c.build().elements.length;
    const bound = Math.ceil(5e7 / perIteration) + 400;
    let worst = 0;
    let calls = 0;
    while (e.time < total * (1 - 1e-9) && calls++ < 2000) {
      const before = e.stats.iterations;
      e.advance(Math.min(frame * period, total - e.time));
      worst = Math.max(worst, e.stats.iterations - before);
    }
    const t = rec.times();
    const v = rec.values()[0]!;
    const rises: number[] = [];
    for (let i = 1; i < t.length; i++) if (v[i - 1]! < 2.5 && v[i]! >= 2.5) rises.push(t[i]!);
    const measured = rises.length >= 3 ? (rises[rises.length - 1]! - rises[1]!) / (rises.length - 2) : NaN;
    return { ratio: measured / period, time: e.time / total, worst, bound, calls, messages: problems(e) };
  }

  test('R1 = R2 = 100 kΩ, C = 100 nF, and the other reported values, on every kind of supply', () => {
    for (const supply of ['battery', 'rail', 'supply'] as const) {
      for (const [r1, r2, cap] of [
        [1000, 10000, 4.7e-6],
        [1e5, 1e5, 1e-7],
        [1e5, 1e4, 1e-7],
        [1e5, 1e3, 1e-7],
        [1e6, 100, 1e-6],
        [100, 1e6, 1e-7],
      ] as const) {
        for (const frame of [1 / 200, 1 / 40, 1 / 10]) {
          const m = measure(r1, r2, cap, supply, frame);
          const label = `${supply} R1=${r1} R2=${r2} C=${cap} frame=${frame}`;
          expect(m.time, label).toBeCloseTo(1, 6);
          expect(Math.abs(m.ratio - 1), label).toBeLessThan(0.08);
          expect(m.worst, label).toBeLessThan(m.bound);
          expect(m.messages, label).toEqual([]);
        }
      }
    }
  });

  test('fuzz over R1, R2 and C: it oscillates near the formula and every advance() stays within its caps', () => {
    const rnd = mulberry32(555);
    const decade = (lo: number, hi: number) => 10 ** (lo + (hi - lo) * rnd());
    for (let k = 0; k < 30; k++) {
      const r1 = decade(2, 6);
      const r2 = decade(2, 6);
      const cap = decade(-9, -5);
      const supply = (['battery', 'rail', 'supply'] as const)[k % 3]!;
      const m = measure(r1, r2, cap, supply, 1 / 40);
      const label = `${supply} R1=${r1.toPrecision(3)} R2=${r2.toPrecision(3)} C=${cap.toPrecision(3)}`;
      expect(m.time, label).toBeCloseTo(1, 6);
      expect(Math.abs(m.ratio - 1), label).toBeLessThan(0.08);
      expect(m.worst, label).toBeLessThan(m.bound);
    }
  });

  test('the comparator is a Schmitt trigger that never rests half-way: rail-to-rail on either side of the flip', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('S', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'triangle', frequency: 1, amplitude: 0.05, offset: 2.5 })
      .add('R', 'resistor', { '1': 'vcc', '2': 'ref' }, { resistance: 1000 })
      .add('R2', 'resistor', { '1': 'ref', '2': 'gnd' }, { resistance: 1000 })
      .add('K', 'comparator', { '+': 'in', '-': 'ref', Y: 'y' })
      .add('RL', 'resistor', { '1': 'y', '2': 'gnd' }, { resistance: 100000 });
    const e = createAnalogEngine(c.build());
    const rec = e.watch([c.net('y')]);
    e.advance(2);
    // Every sample is within 20 mV of a rail: the output never rests in between (one sample per step,
    // and the steps land on the flips).
    const mid = Array.from(rec.values()[0]!).filter((v) => v > 0.02 && v < 4.98);
    expect(mid.length).toBeLessThanOrEqual(4);
    expect(e.stats.failures).toBe(0);
  });
});

describe('advance() always returns within its caps, and lands on its target', () => {
  const types = ['resistor', 'led', 'diode', 'npn', 'nmos', 'pmos', 'comparator', 'nor', 'not', 'capacitor', 'switch', 'lamp', 'inductor'] as const;
  test('random circuits with tiny caps: iterations per call are bounded by the work cap, whatever happens inside', () => {
    const rnd = mulberry32(99);
    const nets = ['a', 'b', 'c', 'd', 'e', 'gnd'];
    const net = () => nets[Math.floor(rnd() * nets.length)]!;
    const decade = (lo: number, hi: number) => 10 ** (lo + (hi - lo) * rnd());
    for (let k = 0; k < 60; k++) {
      const c = circuit().add('V', 'rail', { v: 'a' }, { voltage: 5 });
      const count = 4 + Math.floor(rnd() * 8);
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(rnd() * types.length)]!;
        const id = `X${i}`;
        switch (type) {
          case 'resistor':
            c.add(id, type, { '1': net(), '2': net() }, { resistance: decade(-1, 7) });
            break;
          case 'capacitor':
            c.add(id, type, { '1': net(), '2': net() }, { capacitance: decade(-13, -4) });
            break;
          case 'inductor':
            c.add(id, type, { '1': net(), '2': net() }, { inductance: decade(-9, 0) });
            break;
          case 'led':
          case 'diode':
            c.add(id, type, { A: net(), K: net() });
            break;
          case 'npn':
            c.add(id, type, { B: net(), C: net(), E: net() });
            break;
          case 'nmos':
            c.add(id, type, { G: net(), D: net(), S: net() });
            break;
          case 'pmos':
            c.add(id, type, { G: net(), S: net(), D: net() });
            break;
          case 'comparator':
            c.add(id, type, { '+': net(), '-': net(), Y: net() });
            break;
          case 'nor':
            c.add(id, type, { A: net(), B: net(), Y: net() }, { delay: rnd() < 0.5 ? 0 : 1 });
            break;
          case 'not':
            c.add(id, type, { A: net(), Y: net() }, { delay: rnd() < 0.5 ? 0 : 1 });
            break;
          case 'switch':
            c.add(id, type, { '1': net(), '2': net() }, { closed: rnd() < 0.5 });
            break;
          case 'lamp':
            c.add(id, type, { '1': net(), '2': net() });
            break;
        }
      }
      const flat = c.build();
      const maxWork = 2e5;
      const e = createAnalogEngine(flat, { maxStepsPerAdvance: 60, maxWorkPerAdvance: maxWork });
      const perIteration = 4 * e.size * e.size + 16 * flat.elements.length;
      // After the cap is reached the solve in progress finishes (at most 200 iterations), and one retry chain of a step that started just below it.
      const bound = Math.ceil(maxWork / perIteration) + 3000;
      for (let call = 0; call < 12; call++) {
        const before = e.stats.iterations;
        const t0 = e.time;
        e.advance(1e-4);
        expect(e.stats.iterations - before, `circuit ${k} call ${call}`).toBeLessThan(bound);
        expect(e.time, `circuit ${k}`).toBeGreaterThanOrEqual(t0);
        expect(Number.isFinite(e.time)).toBe(true);
      }
    }
  });

  test('a device that only converges at tiny steps cannot keep a call running: the work allowance covers the retry loops', () => {
    // Its current flips sign at every evaluation when the step is above 1 ps, so every iterate differs
    // from the last and no larger step converges: Newton–Raphson retries, step rejection and (at the
    // smallest step) gmin stepping would all run, step after step, until the allowance is spent.
    registerAnalogModel(
      'test-tiny-steps-only',
      () => {
        let flip = 1;
        return {
          nonlinear: true,
          stamp(c) {
            conductance(c, 0, -1, 1);
            if (c.h > 1e-12) flip = -flip;
            currentSource(c, 0, -1, flip);
          },
          current: () => 0,
          state: () => ({}),
          setParam() {},
          reset() {},
        };
      },
      'regressions.test.ts',
    );
    const netlist: FlatNetlist = { netCount: 2, netNames: ['gnd', 'a'], elements: [{ id: 'X', type: 'test-tiny-steps-only', params: {}, pins: [1], pinNames: ['a'] }], ground: 0 };
    for (const [maxWork, maxSteps] of [
      [200, 1000],
      [1e3, 1000],
      [1e4, 1000],
      [1e5, 60],
      [5e7, 1000],
    ] as const) {
      const e = createAnalogEngine(netlist, { maxWorkPerAdvance: maxWork, maxStepsPerAdvance: maxSteps });
      const perIteration = 4 * e.size * e.size + 16;
      const before = e.stats.iterations;
      const t0 = performance.now();
      e.advance(1e-3);
      const ms = performance.now() - t0;
      // The allowance, plus the solve in progress when it ran out (at most 40 iterations here).
      expect(e.stats.iterations - before, `work ${maxWork}`).toBeLessThan(maxWork / perIteration + 60);
      expect(ms).toBeLessThan(2000);
      expect(Number.isFinite(e.time)).toBe(true);
    }
  });

  test('a call that is not lagging ends exactly on its target time', () => {
    const c = circuit().add('V', 'rail', { v: 'a' }, { voltage: 5 }).add('R', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 1000 }).add('C', 'capacitor', { '1': 'b', '2': 'gnd' }, { capacitance: 1e-6 });
    const e = createAnalogEngine(c.build());
    let want = 0;
    for (let i = 0; i < 300; i++) {
      const dt = 3.3e-4 * (1 + (i % 7));
      want += dt;
      e.advance(dt);
      expect(e.lagging).toBe(false);
      // A caller looping `while (e.time < end)` must not see a shortfall advance() itself ignores.
      expect(e.time).toBeGreaterThanOrEqual(want * (1 - 1e-12));
    }
    // The numbers that once made a caller spin: a total of 6.5 textbook periods, in frames of 1/40 period.
    const p = 0.693 * 21000 * 1e-5;
    const total = 6.5 * p;
    const rc = circuit().add('V', 'rail', { v: 'a' }, { voltage: 5 }).add('R', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 11000 }).add('C', 'capacitor', { '1': 'b', '2': 'gnd' }, { capacitance: 1e-5 });
    const f = createAnalogEngine(rc.build());
    let n = 0;
    while (f.time < total && n++ < 1000) f.advance(Math.min(p / 40, total - f.time));
    expect(n).toBeLessThan(400);
    const end = e.time + 0.0123456789;
    let spins = 0;
    while (e.time < end && spins++ < 1000) e.advance(Math.min(0.01, end - e.time));
    expect(spins).toBeLessThan(10);
  });
});

describe('Newton does not fall into a two-point cycle', () => {
  test('a device whose reported slope is half its true slope still converges (damped late iterations)', () => {
    // I = v − 1 into ground, but the stamp claims dI/dv = 0.5: an undamped Newton step overshoots by
    // exactly two, so the error flips sign forever (the cycle seen on Node 24 with a lamp behind relay
    // contacts, whose dI/dv is also an approximation). Halving the late updates lands on the root.
    registerAnalogModel(
      'test-half-slope',
      () => ({
        nonlinear: true,
        stamp(c) {
          const v = c.x[0]!;
          conductance(c, 0, -1, 0.5);
          currentSource(c, 0, -1, v - 1 - 0.5 * v);
        },
        current: () => 0,
        state: () => ({}),
        setParam() {},
        reset() {},
      }),
      'regressions.test.ts',
    );
    const netlist: FlatNetlist = { netCount: 2, netNames: ['gnd', 'a'], elements: [{ id: 'X', type: 'test-half-slope', params: {}, pins: [1], pinNames: ['a'] }], ground: 0 };
    const e = createAnalogEngine(netlist);
    e.advance(1e-3);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    expect(e.voltage(1)).toBeCloseTo(1, 6);
  });
});
