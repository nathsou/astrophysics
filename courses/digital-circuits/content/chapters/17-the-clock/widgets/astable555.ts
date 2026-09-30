/**
 * A 555 astable, built from what is inside a 555 and run on the analog engine: a divider of three equal
 * resistors, two comparators (threshold at 2/3 of the supply, trigger at 1/3), an SR latch of two NOR gates, and
 * an NPN transistor that discharges the timing capacitor. The capacitor charges through R1 + R2 and discharges
 * through R2, so the textbook frequency is 1.44 / ((R1 + 2·R2)·C).
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder } from '$lib/sim/digital';
import { createAnalogEngine } from '$lib/sim/analog';

export interface Astable {
  /** Ohms, ohms, farads. */
  r1: number;
  r2: number;
  c: number;
}

export const DEFAULT_ASTABLE: Astable = { r1: 1000, r2: 10000, c: 4.7e-6 };

/** The textbook numbers. */
export function predicted(a: Astable) {
  const th = 0.693 * (a.r1 + a.r2) * a.c;
  const tl = 0.693 * a.r2 * a.c;
  return { high: th, low: tl, period: th + tl, frequency: 1 / (th + tl), duty: th / (th + tl) };
}

export interface Waveforms {
  t: Float64Array;
  cap: Float64Array;
  out: Float64Array;
  /** Measured from the output's rising edges after the first cycle. */
  period: number;
  duty: number;
  frequency: number;
}

/**
 * Simulate and return the capacitor and output voltages. The analog model of the latch can, for some component
 * values and step sizes, stop half-way at the threshold (a real 555's latch snaps over; the engine's implicit
 * steps can land on the unstable middle); if no oscillation is measured, try again with other step sizes.
 */
export function simulate(a: Astable): Waveforms {
  let w = simulateWith(a, 1);
  for (const k of [0.61, 1.37, 0.37, 2.3]) {
    if (Number.isFinite(w.period)) break;
    w = simulateWith(a, k);
  }
  return w;
}

function simulateWith(a: Astable, stepFactor: number, seconds?: number): Waveforms {
  const b = new NetlistBuilder();
  const gnd = b.ground();
  const [vcc, n2, n1, cap, rst, set, q, qn, base, dis] = b.nets(10);
  const res = (id: string, x: number, y: number, r: number) => b.add('resistor', id, { '1': x, '2': y }, { resistance: r });
  b.add('battery', 'VCC', { '-': gnd, '+': vcc! }, { voltage: 5 });
  res('RA', vcc!, n2!, 5000);
  res('RB', n2!, n1!, 5000);
  res('RC', n1!, gnd, 5000);
  b.add('comparator', 'CT', { '+': cap!, '-': n2!, Y: rst! });
  b.add('comparator', 'CB', { '+': n1!, '-': cap!, Y: set! });
  b.add('nor', 'N1', { A: rst!, B: qn!, Y: q! }, { delay: 0 });
  b.add('nor', 'N2', { A: set!, B: q!, Y: qn! }, { delay: 0 });
  res('RD', qn!, base!, 4700);
  b.add('npn', 'T1', { B: base!, C: dis!, E: gnd });
  res('R1', vcc!, dis!, a.r1);
  res('R2', dis!, cap!, a.r2);
  b.add('capacitor', 'C1', { '1': cap!, '2': gnd }, { capacitance: a.c });
  const engine = createAnalogEngine(b.build());
  const p = predicted(a);
  const total = seconds ?? p.period * 4.5 + 0.35 * p.period;
  const rec = engine.watch([cap!, q!]);
  const frame = (Math.min(total / 200, p.period / 40)) * stepFactor;
  while (engine.time < total - 1e-12) engine.advance(Math.min(frame, total - engine.time));
  const t = rec.times();
  const v = rec.values();
  rec.close();
  // Rising edges of the output (through 2.5 V).
  const rises: number[] = [];
  const falls: number[] = [];
  for (let i = 1; i < t.length; i++) {
    if (v[1]![i - 1]! < 2.5 && v[1]![i]! >= 2.5) rises.push(t[i]!);
    if (v[1]![i - 1]! >= 2.5 && v[1]![i]! < 2.5) falls.push(t[i]!);
  }
  let period = NaN;
  let duty = NaN;
  if (rises.length >= 3) {
    period = (rises[rises.length - 1]! - rises[1]!) / (rises.length - 2);
    const f = falls.find((x) => x > rises[1]!);
    if (f !== undefined) duty = (f - rises[1]!) / period;
  }
  return { t, cap: v[0]!, out: v[1]!, period, duty, frequency: 1 / period };
}
