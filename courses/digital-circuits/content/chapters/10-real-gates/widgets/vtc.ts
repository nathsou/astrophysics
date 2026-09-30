/**
 * The voltage transfer curve (VTC) of a CMOS inverter, measured on the analog engine: a pMOS above an
 * nMOS, gates tied together, the input a voltage source that we step from 0 V to the supply. At every
 * step `settle()` solves the circuit's DC operating point, exactly as a bench supply and a voltmeter
 * would give it. Pure logic for the TransferCurve widget (kept out of the component so it can be tested).
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from '../../03-the-bench/widgets/flat';

export interface InverterParams {
  /** Supply voltage, V. */
  vdd: number;
  /** nMOS transconductance k = μCox·W/L, A/V². */
  kn: number;
  /** pMOS transconductance, A/V². */
  kp: number;
  /** Threshold voltage magnitude of both transistors, V. */
  vt: number;
  /** Channel-length modulation λ, 1/V: how much the current still grows with Vds in saturation (it limits the gain). */
  lambda: number;
}

export const DEFAULTS: InverterParams = { vdd: 5, kn: 0.004, kp: 0.004, vt: 1, lambda: 0.1 };

export interface Vtc {
  vin: number[];
  vout: number[];
  /** Current from the supply through the pMOS, A: zero at the rails, a spike in the middle. */
  idd: number[];
}

/** Sweep the input from 0 to VDD in `n` points and read the output and the supply current. */
export function sweep(p: InverterParams, n = 201): Vtc {
  const c = netlist();
  c.add('VDD', 'rail', { v: 'vdd' }, { voltage: p.vdd });
  c.add('VIN', 'battery', { '-': 'gnd', '+': 'in' }, { voltage: 0, resistance: 0.001 });
  c.add('MP', 'pmos', { G: 'in', S: 'vdd', D: 'out' }, { k: p.kp, threshold: p.vt, lambda: p.lambda });
  c.add('MN', 'nmos', { G: 'in', D: 'out', S: 'gnd' }, { k: p.kn, threshold: p.vt, lambda: p.lambda });
  const flat = c.build();
  const e = createAnalogEngine(flat);
  const out = c.net('out');
  const vin: number[] = [];
  const vout: number[] = [];
  const idd: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = (p.vdd * i) / (n - 1);
    e.setParam('VIN', 'voltage', v);
    e.settle();
    vin.push(v);
    vout.push(e.voltage(out));
    idd.push(Math.max(0, (e.state('MP').id as number) ?? 0));
  }
  return { vin, vout, idd };
}

export interface Levels {
  vdd: number;
  /** Output high and low with no load: the curve at Vin = 0 and Vin = VDD. */
  voh: number;
  vol: number;
  /** The inputs at which the slope of the curve is −1 (null when the inverter has no gain above 1). */
  vil: number | null;
  vih: number | null;
  /** The switching threshold: where the output equals the input. */
  vm: number;
  /** Peak gain, |dVout/dVin|. */
  gain: number;
  /** Noise margins, NMH = VOH − VIH and NML = VIL − VOL (null without valid levels). */
  nmh: number | null;
  nml: number | null;
  /** The curve's height at VIL and at VIH. */
  voutAtVil: number | null;
  voutAtVih: number | null;
}

function lerp(x0: number, y0: number, x1: number, y1: number, y: number): number {
  return y1 === y0 ? x0 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
}

export function levels(v: Vtc, vdd: number): Levels {
  const n = v.vin.length;
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) slope.push((v.vout[i + 1]! - v.vout[i]!) / (v.vin[i + 1]! - v.vin[i]!));
  // Slope at the midpoint between samples i and i + 1 is slope[i], at x = (vin[i] + vin[i+1]) / 2.
  const mid = (i: number) => (v.vin[i]! + v.vin[i + 1]!) / 2;
  let gain = 0;
  for (const s of slope) gain = Math.max(gain, Math.abs(s));

  let vil: number | null = null;
  let vih: number | null = null;
  if (gain > 1) {
    for (let i = 1; i < slope.length; i++) {
      if (slope[i - 1]! > -1 && slope[i]! <= -1) {
        vil = lerp(mid(i - 1), slope[i - 1]!, mid(i), slope[i]!, -1);
        break;
      }
    }
    for (let i = slope.length - 1; i > 0; i--) {
      if (slope[i]! <= -1 && slope[i - 1]! > -1) continue;
      if (slope[i]! > -1 && slope[i - 1]! <= -1) {
        vih = lerp(mid(i - 1), slope[i - 1]!, mid(i), slope[i]!, -1);
        break;
      }
    }
  }

  const at = (x: number): number => {
    const t = (x / vdd) * (n - 1);
    const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
    const f = t - i;
    return v.vout[i]! * (1 - f) + v.vout[i + 1]! * f;
  };
  // Vm: first crossing of the diagonal.
  let vm = vdd / 2;
  for (let i = 0; i < n - 1; i++) {
    const d0 = v.vout[i]! - v.vin[i]!;
    const d1 = v.vout[i + 1]! - v.vin[i + 1]!;
    if (d0 >= 0 && d1 < 0) {
      vm = lerp(v.vin[i]!, d0, v.vin[i + 1]!, d1, 0);
      break;
    }
  }
  const voh = v.vout[0]!;
  const vol = v.vout[n - 1]!;
  const ok = vil !== null && vih !== null && vil < vih;
  return {
    vdd,
    voh,
    vol,
    vil: ok ? vil : null,
    vih: ok ? vih : null,
    vm,
    gain,
    nmh: ok ? voh - vih! : null,
    nml: ok ? vil! - vol : null,
    voutAtVil: ok ? at(vil!) : null,
    voutAtVih: ok ? at(vih!) : null,
  };
}

/** Closed form for the switching threshold of the level-1 model without channel-length modulation. */
export function vmFormula(p: InverterParams): number {
  const r = Math.sqrt(p.kn / p.kp);
  return (p.vdd - p.vt + p.vt * r) / (1 + r);
}

export type Reading = '0' | '1' | 'wrong' | 'forbidden';

export interface NoiseVerdict {
  /** The level the receiver sees for a sent 0 with the worst-case noise added, and for a sent 1 with it subtracted. */
  lowIn: number;
  highIn: number;
  /** What the receiver makes of them. */
  low: Reading;
  high: Reading;
  /** The receiver's output for each (read off the curve): clean again, or not. */
  lowOut: number;
  highOut: number;
}

/** What a receiving inverter (this curve) makes of a 0 and a 1 sent by an identical gate through `noise` volts of interference. */
export function judge(v: Vtc, l: Levels, noise: number): NoiseVerdict {
  const n = v.vin.length;
  const at = (x: number): number => {
    const c = Math.max(0, Math.min(l.vdd, x));
    const t = (c / l.vdd) * (n - 1);
    const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
    const f = t - i;
    return v.vout[i]! * (1 - f) + v.vout[i + 1]! * f;
  };
  const lowIn = l.vol + noise;
  const highIn = l.voh - noise;
  const read = (x: number, sent: 0 | 1): Reading => {
    if (l.vil === null || l.vih === null) return 'forbidden';
    if (x <= l.vil) return sent === 0 ? '0' : 'wrong';
    if (x >= l.vih) return sent === 1 ? '1' : 'wrong';
    return 'forbidden';
  };
  return { lowIn, highIn, low: read(lowIn, 0), high: read(highIn, 1), lowOut: at(lowIn), highOut: at(highIn) };
}
