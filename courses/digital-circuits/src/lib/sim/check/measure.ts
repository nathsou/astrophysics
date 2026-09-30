/** Checking a number a reader read off an instrument, with units and a tolerance. */
import { parseSI } from '../../bench/editor/units';

export type Tolerance = number | { rel?: number; abs?: number };

export interface MeasureResult {
  pass: boolean;
  /** The reader's value in base units (undefined when it could not be read as a number). */
  value?: number;
  expected: number;
  /** |value − expected| / |expected|. */
  error?: number;
  /** Why it failed, in words the reader can act on. */
  reason?: 'not a number' | 'too high' | 'too low' | 'wrong magnitude' | 'wrong sign';
  message: string;
}

/** Allowed deviation for an expected value. A bare number is a relative tolerance (0.05 = 5 %). */
export function allowed(expected: number, tol: Tolerance): number {
  if (typeof tol === 'number') return Math.abs(expected) * tol;
  return Math.max(Math.abs(expected) * (tol.rel ?? 0), tol.abs ?? 0);
}

/** `value` is a number in base units or the text the reader typed ("4.7 k", "2.2 mA"). */
export function checkMeasurement(value: number | string, expected: number, tolerance: Tolerance = 0.05): MeasureResult {
  const v = typeof value === 'number' ? value : parseSI(value);
  if (v === undefined || !Number.isFinite(v)) return { pass: false, expected, reason: 'not a number', message: 'That is not a number. Write it like 4.7 k or 2.2 mA.' };
  const err = expected === 0 ? Math.abs(v) : Math.abs(v - expected) / Math.abs(expected);
  if (Math.abs(v - expected) <= allowed(expected, tolerance)) return { pass: true, value: v, expected, error: err, message: 'Within tolerance.' };
  if (expected !== 0 && Math.sign(v) !== Math.sign(expected) && v !== 0) return { pass: false, value: v, expected, error: err, reason: 'wrong sign', message: 'The sign is wrong: check which way round the meter probes are.' };
  const ratio = expected !== 0 && v !== 0 ? Math.abs(v / expected) : NaN;
  const decades = Math.log10(ratio);
  if (Number.isFinite(decades) && Math.abs(decades) >= 0.9 && Math.abs(decades - Math.round(decades)) < 0.15) {
    return { pass: false, value: v, expected, error: err, reason: 'wrong magnitude', message: `Right digits, wrong power of ten (out by a factor of ${10 ** Math.abs(Math.round(decades))}): check the unit prefix (m, k, µ).` };
  }
  return { pass: false, value: v, expected, error: err, reason: v > expected ? 'too high' : 'too low', message: v > expected ? 'Too high.' : 'Too low.' };
}
