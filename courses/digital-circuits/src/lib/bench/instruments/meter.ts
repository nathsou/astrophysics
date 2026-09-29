/**
 * Multimeter arithmetic: auto-ranging into a four-digit readout, and resistance measured by
 * simulating a small test source across the two probed nets.
 */
import type { Engine } from '../../sim/engine';
import type { FlatElement, FlatNetlist } from '../../sim/netlist/types';

const PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

export interface Readout {
  /** The digits, with sign and decimal point: "-1.234", "12.34", "123.4"; "OL" or "----" when there is no number. */
  text: string;
  /** SI prefix of the range ("m" for milli), and the unit. */
  prefix: string;
  unit: string;
  overload: boolean;
  /** Number of decimals shown (the resolution of the range). */
  decimals: number;
}

/**
 * Auto-range a value into a `digits`-digit display (default 4, so 1.234 / 12.34 / 123.4 in the range),
 * choosing the SI prefix so the mantissa is between 1 and 1000. NaN shows dashes; beyond 1000 T is OL.
 */
export function autorange(value: number, unit: string, digits = 4): Readout {
  if (Number.isNaN(value)) return { text: '----', prefix: '', unit, overload: false, decimals: 0 };
  if (!Number.isFinite(value)) return { text: 'OL', prefix: '', unit, overload: true, decimals: 0 };
  const a = Math.abs(value);
  if (a >= 999.95e12) return { text: 'OL', prefix: 'T', unit, overload: true, decimals: 0 };
  // Smallest range shown is pico; below half a unit of its last digit the value reads as zero.
  const floor = 0.5 * 10 ** (-12 - (digits - 1));
  if (a < floor) return { text: (0).toFixed(digits - 1), prefix: '', unit, overload: false, decimals: digits - 1 };
  let idx = PREFIXES.findIndex(([s]) => a >= s * 0.99995);
  if (idx < 0) idx = PREFIXES.length - 1;
  for (let attempt = 0; attempt < 2; attempt++) {
    const [scale, prefix] = PREFIXES[idx]!;
    const m = a / scale;
    const intDigits = m >= 100 ? 3 : m >= 10 ? 2 : 1;
    const decimals = Math.max(0, digits - intDigits);
    const fixed = m.toFixed(decimals);
    // Rounding can carry into the next range: 999.96 → "1000.0" is 1.000 of the next prefix.
    if (Number(fixed) >= 1000 && idx > 0) {
      idx--;
      continue;
    }
    const neg = value < 0 && Number(fixed) !== 0;
    return { text: (neg ? '-' : '') + fixed, prefix, unit, overload: false, decimals };
  }
  return { text: 'OL', prefix: '', unit, overload: true, decimals: 0 };
}

/** A readout as plain text, e.g. "-1.234 mA" (for screen readers). */
export const readoutText = (r: Readout): string => (r.overload ? 'overload' : r.text === '----' ? 'no reading' : `${r.text.replace('-', '−')} ${r.prefix}${r.unit}`);

// ── Resistance ───────────────────────────────────────────────────────────────

const SOURCES_TO_ZERO: Record<string, Record<string, number | boolean>> = {
  battery: { voltage: 0 },
  supply: { voltage: 0 },
  rail: { voltage: 0 },
  siggen: { amplitude: 0, offset: 0 },
  toggle: { on: false },
  button: { pressed: false },
  const: { value: 0 },
};

/** Internal resistance of the test source (Ω): small, so the reading stays accurate down to milliohms. */
export const TEST_SOURCE_R = 1e-3;
export const TEST_ID = '__ohm';

/**
 * A copy of the netlist for measuring the resistance between nets `a` and `b`: every source set to
 * zero (they keep their internal resistance, as on a bench), and a 1 V test battery from b to a.
 */
export function resistanceNetlist(flat: FlatNetlist, a: number, b: number, volts = 1): FlatNetlist {
  const elements: FlatElement[] = flat.elements.map((e) => {
    const zero = SOURCES_TO_ZERO[e.type];
    return zero ? { ...e, params: { ...e.params, ...zero } } : e;
  });
  const test: FlatElement = { id: TEST_ID, type: 'battery', params: { voltage: volts, resistance: TEST_SOURCE_R }, pins: [b, a], pinNames: ['-', '+'] };
  return { ...flat, elements: [test, ...elements] };
}

export interface ResistanceResult {
  /** Ohms; Infinity when nothing connects the probes. */
  ohms: number;
  /** Set when the circuit contains parts whose resistance depends on the test voltage. */
  nonlinear: boolean;
}

/** Beyond this the probes are not connected (the engine adds a tiny leakage to every net). */
export const OPEN_OHMS = 1e9;

const NONLINEAR = new Set(['diode', 'led', 'npn', 'pnp', 'nmos', 'pmos', 'comparator', 'lamp']);

/**
 * Measure the resistance between two nets (top-level numbers, aliased through the netlist) with a
 * test source on a fresh analog engine, letting capacitors charge and inductors settle first.
 */
export async function measureResistance(flat: FlatNetlist, a: number, b: number, make: (netlist: FlatNetlist) => Engine | Promise<Engine>): Promise<ResistanceResult> {
  const na = flat.alias?.[a] ?? a;
  const nb = flat.alias?.[b] ?? b;
  const nonlinear = flat.elements.some((e) => NONLINEAR.has(e.type));
  if (na === nb) return { ohms: 0, nonlinear };
  const engine: Engine = await make(resistanceNetlist(flat, na, nb));
  const read = (): number => {
    const v = engine.voltage(na) - engine.voltage(nb);
    // Current delivered by the test battery: into its + pin is negative when it is supplying.
    const i = -engine.current(TEST_ID, 1);
    return i === 0 ? Infinity : v / i;
  };
  let last = NaN;
  let dt = 1e-6;
  for (let k = 0; k < 40; k++) {
    engine.advance(dt);
    const r = read();
    if (Number.isFinite(r) && Number.isFinite(last) && Math.abs(r - last) <= 1e-4 * Math.abs(r) + 1e-9) return { ohms: r >= OPEN_OHMS ? Infinity : Math.max(0, r), nonlinear };
    last = r;
    dt *= 3;
  }
  // Never settled to a finite value: nothing carries current (open circuit) or it keeps changing.
  return { ohms: Number.isFinite(last) && Math.abs(last) < OPEN_OHMS ? Math.max(0, last) : Infinity, nonlinear };
}

/** Below this, continuity reads as connected (Ω). */
export const CONTINUITY_OHMS = 50;
