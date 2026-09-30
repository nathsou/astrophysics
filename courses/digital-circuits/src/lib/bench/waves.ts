/**
 * Pure helpers for timing diagrams: turning recorded samples into constant-value spans within a
 * time window, converting analog voltages to logic levels, and choosing time-axis ticks.
 */
import type { Logic } from '../sim/netlist/types';

export interface Span {
  t0: number;
  t1: number;
  v: Logic;
}

/** Logic level of a voltage with 5 V CMOS thresholds (below 1.5 V: 0, above 3.5 V: 1, NaN: Z, else X). */
export function voltageToLogic(v: number): Logic {
  if (Number.isNaN(v)) return 3;
  return v <= 1.5 ? 0 : v >= 3.5 ? 1 : 2;
}

/**
 * Spans of constant logic value between `from` and `to`, from samples (times ascending; each value
 * holds until the next sample; the last one until `to`). Time before the first sample is omitted.
 */
export function spans(times: ArrayLike<number>, values: ArrayLike<number>, from: number, to: number, analog = false): Span[] {
  const out: Span[] = [];
  const n = times.length;
  if (!n) return out;
  const level = (i: number): Logic => (analog ? voltageToLogic(values[i]!) : ((values[i]! | 0) as Logic));
  // First sample that still matters: the last one at or before `from`.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! <= from) lo = mid;
    else hi = mid - 1;
  }
  for (let i = lo; i < n; i++) {
    const a = Math.max(from, times[i]!);
    const b = Math.min(to, i + 1 < n ? times[i + 1]! : to);
    if (a > to) break;
    if (b < a) continue;
    const v = level(i);
    const last = out[out.length - 1];
    if (last && last.v === v && Math.abs(last.t1 - a) <= 1e-18) last.t1 = b;
    else out.push({ t0: a, t1: b, v });
  }
  return out;
}

/** "Nice" tick positions (1, 2, 5 × 10ⁿ) covering [t0, t1] with about `count` ticks. */
export function ticks(t0: number, t1: number, count = 6): number[] {
  const span = t1 - t0;
  if (!(span > 0)) return [];
  const raw = span / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1 + step * 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
}
