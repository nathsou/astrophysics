/**
 * Number formatting for schematics, tooltips and instruments: SI prefixes ("4.7 kΩ", "100 nF",
 * "9 V"), a proper minus sign, and a non-breaking space between the number and the unit.
 */
import type { Logic, Params } from '../sim/netlist/types';

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
  [1e-15, 'f'],
];

export const NBSP = ' ';
export const MINUS = '−';

/** Round to `digits` significant digits and drop trailing zeros ("4.70" → "4.7"). */
function sig(x: number, digits: number): string {
  if (x === 0) return '0';
  let s = x.toPrecision(digits);
  if (s.includes('e')) s = String(Number(s));
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/**
 * Format a value with an SI prefix: formatSI(4700, 'Ω') → "4.7 kΩ", formatSI(1e-7, 'F') → "100 nF".
 * `digits` is the number of significant digits (trailing zeros are dropped). NaN gives "–".
 */
export function formatSI(value: number, unit = '', digits = 3): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? '–' : `${value < 0 ? MINUS : ''}∞${unit ? NBSP + unit : ''}`;
  const neg = value < 0;
  const a = Math.abs(value);
  let text: string;
  if (a === 0) text = `0${unit ? NBSP + unit : ''}`;
  else {
    let [scale, prefix] = PREFIXES[PREFIXES.length - 1]!;
    for (const [s, p] of PREFIXES) {
      if (a >= s * 0.9995) {
        scale = s;
        prefix = p;
        break;
      }
    }
    let m = sig(a / scale, digits);
    // Rounding can carry into the next prefix (999.96 → "1000").
    if (Number(m) >= 1000 && scale < 1e12) {
      const i = PREFIXES.findIndex(([s]) => s === scale);
      [scale, prefix] = PREFIXES[i - 1]!;
      m = sig(a / scale, digits);
    }
    text = `${m}${unit || prefix ? NBSP : ''}${prefix}${unit}`;
  }
  return neg ? MINUS + text : text;
}

/** Format with a fixed number of decimals in the chosen prefix (steady meter readouts: "3.21 V"). */
export function formatReadout(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `–${NBSP}${unit}`;
  const a = Math.abs(value);
  let [scale, prefix] = [1, ''];
  if (a >= 1e-15) {
    for (const [s, p] of PREFIXES) {
      if (a >= s * 0.9995) {
        [scale, prefix] = [s, p];
        break;
      }
    }
  }
  const m = a / scale;
  const decimals = Math.max(0, digits - (m >= 100 ? 3 : m >= 10 ? 2 : 1));
  const text = `${m.toFixed(decimals)}${NBSP}${prefix}${unit}`;
  return value < 0 && Number(m.toFixed(decimals)) !== 0 ? MINUS + text : text;
}

/** Logic value as a character. */
export function logicChar(v: Logic | number): string {
  return v === 0 ? '0' : v === 1 ? '1' : v === 3 ? 'Z' : 'X';
}

const num = (p: Params, k: string) => Number(p[k]);

/** The value shown next to a part in its default label (undefined: the id alone). */
export function mainValue(type: string, p: Params): string | undefined {
  switch (type) {
    case 'resistor':
    case 'potentiometer':
      return formatSI(num(p, 'resistance'), 'Ω');
    case 'capacitor':
      return formatSI(num(p, 'capacitance'), 'F');
    case 'inductor':
      return formatSI(num(p, 'inductance'), 'H');
    case 'battery':
    case 'supply':
      return formatSI(num(p, 'voltage'), 'V');
    case 'siggen':
      return formatSI(num(p, 'frequency'), 'Hz');
    case 'lamp':
      return `${formatSI(num(p, 'ratedVoltage'), 'V')} ${formatSI(num(p, 'ratedPower'), 'W')}`;
    case 'relay':
      return formatSI(num(p, 'coilVoltage'), 'V');
    case 'led':
      return String(p.color ?? '');
    case 'clock':
      return formatSI(num(p, 'frequency'), 'Hz');
    default:
      return undefined;
  }
}

/** Simulation speed as "sim time per real second": 1 → "1 s/s", 1e-6 → "1 µs/s". */
export function formatSpeed(speed: number): string {
  return `${formatSI(speed, 's', 2)}/s`;
}
