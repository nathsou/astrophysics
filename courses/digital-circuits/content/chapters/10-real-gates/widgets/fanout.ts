/**
 * Fan-out: one inverter driving N gate inputs, each of which is (to the driver) a small capacitor.
 * The inverter is a real nMOS/pMOS pair on the analog engine, the loads are capacitors, and the numbers
 * measured on the output edge (10–90 % rise and fall time, propagation delay) are compared with the RC
 * estimate of Chapter 4. Pure logic for the FanOut widget.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from '../../03-the-bench/widgets/flat';

/** One gate input: about 3.5 pF for a 74HC input, plus a few centimetres of wire (about 1.5 pF). */
export const C_INPUT = 5e-12;
/** The driver's own output capacitance (drain junctions and wiring). */
export const C_SELF = 5e-12;
export const VDD = 5;
export const VT = 1;
/** Transconductance of the driver's transistors: an on-resistance of 1 / (k · (VDD − Vt)) = 100 Ω. */
export const K = 0.0025;
export const R_ON = 1 / (K * (VDD - VT));

/** Period of the input square wave. Long enough for the slowest edge (20 loads) to settle. */
export const PERIOD = 200e-9;

export interface Trace {
  /** Seconds, from the start of one period of the input. */
  t: number[];
  vin: number[];
  vout: number[];
}

export interface Edges {
  /** 10–90 % rise time of the output, s. */
  rise: number;
  /** 90–10 % fall time of the output, s. */
  fall: number;
  /** From the input crossing 50 % (falling) to the output crossing 50 % (rising), s. */
  tpLH: number;
  /** From the input crossing 50 % (rising) to the output crossing 50 % (falling), s. */
  tpHL: number;
}

export const loadCapacitance = (n: number) => C_SELF + n * C_INPUT;
/** The Chapter 4 estimate of a 10–90 % edge: 2.2 R C. */
export const riseEstimate = (n: number) => 2.2 * R_ON * loadCapacitance(n);
/** …and of the 50 % delay: ln 2 · R C. */
export const delayEstimate = (n: number) => Math.LN2 * R_ON * loadCapacitance(n);

export function simulate(n: number): Trace {
  const c = netlist();
  c.add('VDD', 'rail', { v: 'vdd' }, { voltage: VDD });
  c.add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 1 / PERIOD, amplitude: VDD / 2, offset: VDD / 2, rise: 0.5e-9 });
  c.add('MP', 'pmos', { G: 'in', S: 'vdd', D: 'out' }, { k: K, threshold: VT, lambda: 0.05 });
  c.add('MN', 'nmos', { G: 'in', D: 'out', S: 'gnd' }, { k: K, threshold: VT, lambda: 0.05 });
  c.add('CL', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: loadCapacitance(n) });
  const flat = c.build();
  const e = createAnalogEngine(flat, { step: 0.5e-9 });
  const rec = e.watch([c.net('in'), c.net('out')]);
  // Run one period to get past the power-up transient, then record the next one.
  const frame = 2e-9;
  while (e.time < 2 * PERIOD - 1e-15) e.advance(Math.min(frame, 2 * PERIOD - e.time));
  const times = rec.times();
  const [vin, vout] = rec.values() as [Float64Array, Float64Array];
  rec.close();
  const t: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < times.length; i++) {
    if (times[i]! < PERIOD) continue;
    t.push(times[i]! - PERIOD);
    a.push(vin[i]!);
    b.push(vout[i]!);
  }
  return { t, vin: a, vout: b };
}

/** First time after `from` at which `v` crosses `level` in the given direction, interpolated; NaN if it never does. */
export function crossing(t: number[], v: number[], level: number, dir: 'rise' | 'fall', from = 0): number {
  for (let i = 1; i < t.length; i++) {
    if (t[i]! <= from) continue;
    const a = v[i - 1]!;
    const b = v[i]!;
    if (dir === 'rise' ? a < level && b >= level : a > level && b <= level) return t[i - 1]! + ((t[i]! - t[i - 1]!) * (level - a)) / (b - a);
  }
  return NaN;
}

export function edges(tr: Trace): Edges {
  const { t, vin, vout } = tr;
  const half = VDD / 2;
  // The input falls at PERIOD/2 (we recorded from the input's rising edge): the output then rises.
  const inFall = crossing(t, vin, half, 'fall');
  const inRise = crossing(t, vin, half, 'rise');
  const outRise = crossing(t, vout, half, 'rise', inFall - 1e-12);
  const outFall = crossing(t, vout, half, 'fall', inRise - 1e-12);
  const r10 = crossing(t, vout, 0.1 * VDD, 'rise', inFall - 1e-12);
  const r90 = crossing(t, vout, 0.9 * VDD, 'rise', inFall - 1e-12);
  const f90 = crossing(t, vout, 0.9 * VDD, 'fall', inRise - 1e-12);
  const f10 = crossing(t, vout, 0.1 * VDD, 'fall', inRise - 1e-12);
  return { rise: r90 - r10, fall: f10 - f90, tpLH: outRise - inFall, tpHL: outFall - inRise };
}

/**
 * The fastest clock this edge allows, if each half period must be five time constants (the output
 * settles to 99 %): f = 1 / (10 τ), with τ from the measured 10–90 % rise time (τ = rise / 2.2).
 */
export function fmax(rise: number): number {
  return 1 / (10 * (rise / 2.2));
}
