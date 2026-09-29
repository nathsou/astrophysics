/**
 * Reading and showing parameter values with SI prefixes: "4.7k" → 4700, 1e-7 → "100 nF". Also the E24
 * series that resistor, capacitor and inductor sliders snap to.
 */
import { formatSI, NBSP } from '../format';

/** Base units whose values are shown with SI prefixes. Others (ns, A/V², 1/V) are shown as plain numbers. */
export const SI_UNITS = new Set(['Ω', 'F', 'H', 'V', 'A', 'Hz', 's', 'W']);

const PREFIX: Record<string, number> = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
const UNIT_WORDS = new Set(['ω', 'ohm', 'ohms', 'f', 'h', 'v', 'a', 'hz', 's', 'w', 'r']);

/**
 * Parse a number typed by a person: "4700", "4.7k", "4.7 kΩ", "100n", "10uF", "1meg", "2.2e-6", "1,5".
 * Returns undefined when it is not a number. `M` is mega and `m` is milli.
 */
export function parseSI(text: string): number | undefined {
  const t = text.trim().replace(/,/g, '.').replace(/−/g, '-');
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/i.exec(t);
  if (!m) return undefined;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return undefined;
  const rest = m[2]!;
  if (!rest) return base;
  if (/^meg/i.test(rest) && (rest.length === 3 || UNIT_WORDS.has(rest.slice(3).toLowerCase()))) return base * 1e6;
  const first = rest[0]!;
  const tail = rest.slice(1).toLowerCase();
  if (first in PREFIX && (tail === '' || UNIT_WORDS.has(tail))) return base * PREFIX[first]!;
  if (UNIT_WORDS.has(rest.toLowerCase())) return base;
  return undefined;
}

/** A parameter value as text for a field: with SI prefix and unit for base units, else the plain number and its unit. */
export function formatParam(value: number, unit?: string): string {
  if (!Number.isFinite(value)) return String(value);
  if (unit && SI_UNITS.has(unit)) return formatSI(value, unit, 4);
  const text = String(Number(value.toPrecision(6)));
  return unit ? `${text}${NBSP}${unit}` : text;
}

const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1, 10];

/** The nearest E24 value (in log terms): 4.63k → 4.7k. */
export function snapE24(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) return value;
  const decade = Math.floor(Math.log10(value));
  const m = value / 10 ** decade;
  let best = E24[0]!;
  for (const e of E24) if (Math.abs(Math.log(e / m)) < Math.abs(Math.log(best / m))) best = e;
  return Number((best * 10 ** decade).toPrecision(3));
}

/** Round to 3 significant digits (log sliders that are not component values: frequencies, times). */
export const round3 = (v: number): number => (v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(3)));

export const clamp = (v: number, min?: number, max?: number): number => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v));
