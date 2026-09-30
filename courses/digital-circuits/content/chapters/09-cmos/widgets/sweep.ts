/**
 * The voltage transfer curve of a CMOS inverter, measured on the analog engine: an n-channel and a p-channel
 * transistor with their gates tied together, the input a voltage source stepped from 0 V to the supply. At
 * every step `settle()` solves the circuit's DC operating point, so each point is a full solution of the
 * two transistors' equations, not a formula. Also records what each transistor is doing and what the supply
 * gives, which is the point of the chapter: in no steady state do both transistors conduct fully, so the
 * supply gives next to nothing.
 */
import '$lib/sim/netlist/catalog';
import { createAnalogEngine } from '$lib/sim/analog';
import { SwitchBuilder } from '$lib/sim/switch';

export type Region = 'off' | 'linear' | 'saturation';

export interface Sweep {
  vdd: number;
  vin: number[];
  vout: number[];
  /** Current from the supply through the pMOS, A. */
  idd: number[];
  mp: Region[];
  mn: Region[];
}

/** Catalog defaults: an n-channel transistor has k = 0.02 A/V², a p-channel one of the same size only 0.01 (holes are slower than electrons). */
export const K_N = 0.02;
export const K_P = 0.01;

/** `pWidth` is the width of the pMOS relative to the nMOS: 2 makes the two equally strong. */
export function sweep(pWidth = 1, n = 201, vdd = 5): Sweep {
  const b = new SwitchBuilder();
  const gnd = b.gnd();
  const vddNet = b.net('VDD');
  b.add('rail', 'VDD', { v: vddNet }, { voltage: vdd });
  const vin = b.net('in');
  const out = b.net('out');
  b.add('battery', 'VIN', { '-': gnd, '+': vin }, { voltage: 0, resistance: 0.001 });
  b.add('pmos', 'MP', { G: vin, S: vddNet, D: out }, { k: K_P * pWidth });
  b.add('nmos', 'MN', { G: vin, D: out, S: gnd }, { k: K_N });
  const e = createAnalogEngine(b.build());
  const s: Sweep = { vdd, vin: [], vout: [], idd: [], mp: [], mn: [] };
  for (let i = 0; i < n; i++) {
    const v = (vdd * i) / (n - 1);
    e.setParam('VIN', 'voltage', v);
    e.settle();
    s.vin.push(v);
    s.vout.push(e.voltage(out));
    s.idd.push(Math.abs(Number(e.state('MP').id) || 0));
    s.mp.push(e.state('MP').region as Region);
    s.mn.push(e.state('MN').region as Region);
  }
  return s;
}

/** Linear interpolation of a swept quantity at input `x`. */
export function at(s: Sweep, arr: number[], x: number): number {
  const t = (Math.max(0, Math.min(s.vdd, x)) / s.vdd) * (arr.length - 1);
  const i = Math.max(0, Math.min(arr.length - 2, Math.floor(t)));
  const f = t - i;
  return arr[i]! * (1 - f) + arr[i + 1]! * f;
}

/** The switching threshold: where the output equals the input. */
export function switchingPoint(s: Sweep): number {
  for (let i = 0; i < s.vin.length - 1; i++) {
    const d0 = s.vout[i]! - s.vin[i]!;
    const d1 = s.vout[i + 1]! - s.vin[i + 1]!;
    if (d0 >= 0 && d1 < 0) return s.vin[i]! + ((s.vin[i + 1]! - s.vin[i]!) * d0) / (d0 - d1);
  }
  return s.vdd / 2;
}

export type Regime = 'pull-up' | 'both' | 'pull-down' | 'neither';

/** Which transistors conduct at sweep point `i`. */
export function regime(s: Sweep, i: number): Regime {
  const p = s.mp[i] !== 'off';
  const n = s.mn[i] !== 'off';
  return p && n ? 'both' : p ? 'pull-up' : n ? 'pull-down' : 'neither';
}

/** Input ranges of each regime as [from, to] pairs, for shading. */
export function bands(s: Sweep): { regime: Regime; from: number; to: number }[] {
  const out: { regime: Regime; from: number; to: number }[] = [];
  for (let i = 0; i < s.vin.length; i++) {
    const r = regime(s, i);
    const last = out[out.length - 1];
    if (last && last.regime === r) last.to = s.vin[i]!;
    else out.push({ regime: r, from: last ? last.to : s.vin[i]!, to: s.vin[i]! });
  }
  return out;
}
