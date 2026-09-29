/**
 * Voltage transfer curves (VTCs) measured on the course's own analog engine.
 *
 * A stage's VTC is the output voltage it settles to for every input voltage. The noise gauntlet and the
 * transfer-curve figure do not use formulas for it: they build a small netlist, sweep an ideal source
 * along the input and read the output off the engine, once, when the figure first appears. Every
 * stage of the gauntlet is then just a lookup in that table (`transfer`), so the curves show exactly
 * what Chapter 8's live circuits do.
 *
 * Each sweep circuit has TWO identical stages in a row and measures the first one's output. The second
 * stage is the load: an RTL inverter drives the base resistor of the next inverter, which pulls its
 * output high level down; a diode stage drives the next diode. That is what a stage in a real chain
 * sees, so the tables are "loaded" transfer curves (fan-out of one).
 */
import '$lib/sim/netlist/catalog';
import { getDef, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
import { createAnalogEngine } from '$lib/sim/analog';
import type { FlatElement, FlatNetlist, Params } from '$lib/sim/netlist/types';

/** Supply of every stage, in volts. */
export const VCC = 5;

/** The two switching regions of the BJT inverter, as the engine reports them for the first transistor. */
export type Region = 'cutoff' | 'active' | 'saturation';

export interface Vtc {
  /** What was swept. */
  kind: 'rtl' | 'diode';
  /** Input voltages, ascending (V). */
  vin: number[];
  /** Output voltages (V), aligned with `vin`. */
  vout: number[];
  /** The transistor's region at each point (RTL only). */
  region?: Region[];
}

/** Sweep range: a little beyond the rails, because noise can push a node past them. */
export const SWEEP_MIN = -0.5;
export const SWEEP_MAX = VCC + 0.5;
export const SWEEP_STEP = 0.02;

/** Build a flat netlist from named nets ('gnd' is ground), the way the engine wants it. */
class Builder {
  private names = new Map<string, number>([['gnd', 0]]);
  readonly elements: FlatElement[] = [];
  private net(n: string): number {
    let k = this.names.get(n);
    if (k === undefined) this.names.set(n, (k = this.names.size));
    return k;
  }
  add(id: string, type: string, pins: Record<string, string>, params?: Params): this {
    const def = getDef(type);
    if (!def) throw new Error(`unknown type ${type}`);
    const full = withDefaults(def, params);
    const defs = pinsOf(def, full);
    this.elements.push({ id, type, params: full, pins: defs.map((d, i) => this.net(pins[d.name] ?? `nc:${id}:${i}`)), pinNames: defs.map((d) => d.name) });
    return this;
  }
  build(): FlatNetlist {
    const netNames: (string | undefined)[] = [];
    for (const [k, v] of this.names) netNames[v] = k;
    return { netCount: this.names.size, netNames, elements: this.elements, ground: 0 };
  }
  index(n: string): number {
    return this.names.get(n)!;
  }
}

/** The values of Figures 8.6 and 8.7: 1 kΩ pull-up, 4.7 kΩ base resistor, β = 100. */
export const RTL = { rc: 1000, rb: 4700, beta: 100 } as const;

function sweep(b: Builder, out: string, stepBefore?: (e: ReturnType<typeof createAnalogEngine>) => void, probe?: (e: ReturnType<typeof createAnalogEngine>) => Region) {
  const e = createAnalogEngine(b.build());
  stepBefore?.(e);
  const vin: number[] = [];
  const vout: number[] = [];
  const region: Region[] = [];
  const n = Math.round((SWEEP_MAX - SWEEP_MIN) / SWEEP_STEP);
  const net = b.index(out);
  for (let i = 0; i <= n; i++) {
    const v = +(SWEEP_MIN + i * SWEEP_STEP).toFixed(6);
    e.setParam('VIN', 'voltage', v);
    e.settle();
    vin.push(v);
    vout.push(e.voltage(net));
    if (probe) region.push(probe(e));
  }
  return { vin, vout, region: probe ? region : undefined };
}

/**
 * An RTL inverter (resistor–transistor logic): a 2N3904-like NPN with a pull-up resistor `rc` to the
 * supply and a base resistor `rb` in front of it. Loaded by an identical inverter.
 */
export function sweepRtl(opts: { rc?: number; rb?: number; beta?: number } = {}): Vtc {
  const { rc, rb, beta } = { ...RTL, ...opts };
  const b = new Builder()
    .add('VIN', 'battery', { '-': 'gnd', '+': 'in' }, { voltage: 0, resistance: 0.001 })
    .add('VCC', 'rail', { v: 'vcc' }, { voltage: VCC })
    .add('RB1', 'resistor', { '1': 'in', '2': 'b1' }, { resistance: rb })
    .add('Q1', 'npn', { B: 'b1', C: 'out', E: 'gnd' }, { beta })
    .add('RC1', 'resistor', { '1': 'vcc', '2': 'out' }, { resistance: rc })
    // The load: the next stage of the chain.
    .add('RB2', 'resistor', { '1': 'out', '2': 'b2' }, { resistance: rb })
    .add('Q2', 'npn', { B: 'b2', C: 'out2', E: 'gnd' }, { beta })
    .add('RC2', 'resistor', { '1': 'vcc', '2': 'out2' }, { resistance: rc });
  const r = sweep(b, 'out', undefined, (e) => e.state('Q1').region as Region);
  return { kind: 'rtl', vin: r.vin, vout: r.vout, region: r.region };
}

/**
 * A diode stage, as in a diode OR gate whose other input is low: a diode from the input to the output
 * node, and a pull-down resistor from the output to ground. Loaded by an identical stage.
 */
export function sweepDiode(opts: { r?: number } = {}): Vtc {
  const r = opts.r ?? 1000;
  const b = new Builder()
    .add('VIN', 'battery', { '-': 'gnd', '+': 'in' }, { voltage: 0, resistance: 0.001 })
    .add('D1', 'diode', { A: 'in', K: 'out' })
    .add('R1', 'resistor', { '1': 'out', '2': 'gnd' }, { resistance: r })
    .add('D2', 'diode', { A: 'out', K: 'out2' })
    .add('R2', 'resistor', { '1': 'out2', '2': 'gnd' }, { resistance: r });
  const s = sweep(b, 'out');
  return { kind: 'diode', vin: s.vin, vout: s.vout };
}

let rtlCache: Vtc | undefined;
let diodeCache: Vtc | undefined;
/** The default RTL inverter's VTC, measured on first use and kept. */
export const rtlVtc = (): Vtc => (rtlCache ??= sweepRtl());
/** The default diode stage's VTC, measured on first use and kept. */
export const diodeVtc = (): Vtc => (diodeCache ??= sweepDiode());

/** Linear interpolation in a VTC (flat beyond its ends). */
export function transfer(v: Vtc, x: number): number {
  const { vin, vout } = v;
  if (x <= vin[0]!) return vout[0]!;
  const last = vin.length - 1;
  if (x >= vin[last]!) return vout[last]!;
  const f = (x - vin[0]!) / SWEEP_STEP;
  const i = Math.min(last - 1, Math.floor(f));
  const t = f - i;
  return vout[i]! + (vout[i + 1]! - vout[i]!) * t;
}

/** Small-signal gain dVout/dVin at x, by central difference over ±0.05 V. */
export function gainAt(v: Vtc, x: number): number {
  const h = 0.05;
  return (transfer(v, x + h) - transfer(v, x - h)) / (2 * h);
}

/** The steepest slope of the curve (the most negative for an inverter) and where it happens. */
export function steepest(v: Vtc): { gain: number; at: number } {
  let best = { gain: 0, at: 0 };
  for (let i = 0; i < v.vin.length; i++) {
    const g = gainAt(v, v.vin[i]!);
    if (Math.abs(g) > Math.abs(best.gain)) best = { gain: g, at: v.vin[i]! };
  }
  return best;
}

/** The input range where |gain| > 1: the region that regenerates. Undefined if the curve never gets that steep. */
export function gainBand(v: Vtc): { from: number; to: number } | undefined {
  let from: number | undefined;
  let to = 0;
  for (const x of v.vin) {
    if (Math.abs(gainAt(v, x)) > 1) {
      from ??= x;
      to = x;
    }
  }
  return from === undefined ? undefined : { from, to };
}

/**
 * Noise margins by the unity-gain definition: V_IL and V_IH are where the slope is −1 (below V_IL the
 * input is safely low, above V_IH safely high). V_OH and V_OL are the outputs for an input of 0 V and
 * of the full supply. NM_L = V_IL − V_OL and NM_H = V_OH − V_IH are how much noise a low and a high can
 * take before the next stage stops treating them as what they were. Undefined if the gain never
 * reaches −1. (Chapter 10 goes through this properly.)
 */
export function noiseMargins(v: Vtc): { vil: number; vih: number; voh: number; vol: number; nml: number; nmh: number } | undefined {
  let vil: number | undefined;
  let vih = 0;
  for (const x of v.vin) {
    if (x < 0 || x > VCC) continue;
    if (gainAt(v, x) <= -1) {
      vil ??= x;
      vih = x;
    }
  }
  if (vil === undefined) return undefined;
  const voh = transfer(v, 0);
  const vol = transfer(v, VCC);
  return { vil, vih, voh, vol, nml: vil - vol, nmh: voh - vih };
}

/** The input at which the output equals the input (the switching threshold of an inverter), if any. */
export function fixedPoint(v: Vtc): number | undefined {
  for (let i = 1; i < v.vin.length; i++) {
    const a = v.vout[i - 1]! - v.vin[i - 1]!;
    const b = v.vout[i]! - v.vin[i]!;
    if (a >= 0 && b < 0) return v.vin[i - 1]! + (SWEEP_STEP * a) / (a - b);
  }
  return undefined;
}
