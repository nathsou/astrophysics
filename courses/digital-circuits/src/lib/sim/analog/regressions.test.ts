import { describe, expect, test } from 'vitest';
import { createAnalogEngine, type AnalogEngine } from './engine';
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
