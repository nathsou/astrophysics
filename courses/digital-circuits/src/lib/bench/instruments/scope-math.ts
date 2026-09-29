/**
 * The oscilloscope's arithmetic, kept apart from the canvas: trigger search over recorded samples,
 * choosing which stretch of time to show, and reducing samples to the few hundred points a screen can
 * draw. Samples are (times, values) arrays as an engine's recorder gives them; analog values are volts,
 * digital ones are turned into volts first (logicToVolts) and hold their value until the next sample.
 */
import { speedAt, speedIndex } from '../editor/sim';

/** A logic value as a voltage: 0 → 0 V, 1 → 5 V, unknown → 2.5 V, floating → NaN (not drawn). */
export function logicToVolts(v: number): number {
  return v === 0 ? 0 : v === 1 ? 5 : v === 3 ? NaN : 2.5;
}

export type Slope = 'rise' | 'fall';

/** Index of the last sample at or before t (−1 if there is none). */
export function indexAtOrBefore(times: ArrayLike<number>, t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** The value of a signal at time t: linear between samples, or held (digital). NaN before the first sample. */
export function valueAt(times: ArrayLike<number>, values: ArrayLike<number>, t: number, hold = false): number {
  const i = indexAtOrBefore(times, t);
  if (i < 0) return NaN;
  if (hold || i === times.length - 1) return values[i]!;
  const t0 = times[i]!;
  const t1 = times[i + 1]!;
  if (t1 <= t0) return values[i]!;
  return values[i]! + ((values[i + 1]! - values[i]!) * (t - t0)) / (t1 - t0);
}

/**
 * Times at which the signal crosses `level` in the given direction, between `from` and `to`, in
 * ascending order. The crossing between two samples is interpolated (digital: taken at the later sample).
 */
export function crossings(times: ArrayLike<number>, values: ArrayLike<number>, level: number, slope: Slope, from: number, to: number, hold = false): number[] {
  const out: number[] = [];
  let i = Math.max(1, indexAtOrBefore(times, from));
  for (; i < times.length; i++) {
    const t1 = times[i]!;
    if (t1 > to) break;
    const a = values[i - 1]!;
    const b = values[i]!;
    const hit = slope === 'rise' ? a < level && b >= level : a > level && b <= level;
    if (!hit) continue;
    const t0 = times[i - 1]!;
    const t = hold || b === a ? t1 : t0 + ((level - a) / (b - a)) * (t1 - t0);
    if (t >= from && t <= to) out.push(t);
  }
  return out;
}

export interface Trigger {
  level: number;
  slope: Slope;
  mode: 'auto' | 'normal';
}

/** Where the screen starts, and whether it is locked to a trigger. */
export interface Capture {
  t0: number;
  triggered: boolean;
}

/** Fraction of the screen before the trigger point. */
export const PRE_TRIGGER = 0.1;

/**
 * Which stretch of time the screen shows. A trigger locks the picture to a crossing of the level, with
 * the trigger point 10 % in from the left. Like a real scope the display completes a sweep before it
 * re-arms: the newest crossing whose sweep is complete is shown; while no sweep is complete yet the first
 * crossing's partial sweep is drawn as it happens. With no crossing at all, auto mode free-runs (the
 * window ends now, and starts at time 0 until a whole window has elapsed) and normal mode holds `last`.
 */
export function chooseCapture(times: ArrayLike<number>, values: ArrayLike<number>, now: number, window: number, trig: Trigger, hold: boolean, last?: Capture): Capture | undefined {
  const pre = PRE_TRIGGER * window;
  const post = window - pre;
  // Look back a few windows: enough to find a complete sweep of a slow signal, bounded for speed.
  const found = crossings(times, values, trig.level, trig.slope, Math.max(0, now - 6 * window), now, hold);
  let complete: number | undefined;
  for (let i = found.length - 1; i >= 0; i--) {
    if (found[i]! + post <= now) {
      complete = found[i];
      break;
    }
  }
  if (complete !== undefined) return { t0: complete - pre, triggered: true };
  if (found.length) return { t0: found[0]! - pre, triggered: true };
  if (trig.mode === 'normal') return last;
  return { t0: Math.max(0, now - window), triggered: false };
}

export interface Polyline {
  t: number[];
  v: number[];
}

/**
 * Reduce samples to a polyline for drawing between t0 and t1 on a screen `width` pixels wide. Few
 * samples are joined as they are (linearly, or as steps when `hold`); many are reduced to the minimum
 * and maximum in each pixel column, so a narrow spike is never lost. Held (digital) signals continue at
 * their last value up to `until` (the time the recording is good for; default: its last sample).
 */
export function decimate(times: ArrayLike<number>, values: ArrayLike<number>, t0: number, t1: number, width: number, hold = false, until?: number): Polyline {
  const out: Polyline = { t: [], v: [] };
  const n = times.length;
  if (!n || !(t1 > t0)) return out;
  const i0 = Math.max(0, indexAtOrBefore(times, t0));
  const iEnd = indexAtOrBefore(times, t1); // last sample inside
  const last = Math.min(n - 1, iEnd + 1);
  const inside = iEnd - i0 + 1;
  const push = (t: number, v: number) => {
    out.t.push(t);
    out.v.push(v);
  };

  if (inside <= width * 2) {
    // Enter at t0 (interpolated), follow every sample, leave at t1.
    const start = valueAt(times, values, Math.max(t0, times[i0]!), hold);
    if (times[i0]! <= t0 || i0 === 0) push(Math.max(t0, times[i0]!), start);
    for (let i = times[i0]! <= t0 ? i0 + 1 : i0 === 0 ? i0 + 1 : i0; i <= Math.min(iEnd, n - 1); i++) {
      if (hold) push(times[i]!, values[i - 1]!);
      push(times[i]!, values[i]!);
    }
    if (last > iEnd && times[last]! > t1) push(t1, valueAt(times, values, t1, hold));
    else if (hold && iEnd === n - 1) {
      const end = Math.min(t1, until ?? times[n - 1]!);
      if (end > times[iEnd]!) push(end, values[iEnd]!);
    }
    return out;
  }

  const w = Math.max(1, Math.floor(width));
  const colW = (t1 - t0) / w;
  const lo = new Float64Array(w).fill(Infinity);
  const hi = new Float64Array(w).fill(-Infinity);
  const put = (c: number, v: number) => {
    if (Number.isNaN(v)) return;
    if (c < 0) c = 0;
    if (c >= w) c = w - 1;
    if (v < lo[c]!) lo[c] = v;
    if (v > hi[c]!) hi[c] = v;
  };
  // The value carried into the first column.
  put(0, valueAt(times, values, t0, hold));
  for (let i = Math.max(i0, 0); i <= iEnd; i++) {
    if (times[i]! < t0) continue;
    put(Math.floor((times[i]! - t0) / colW), values[i]!);
  }
  let prev = NaN;
  for (let c = 0; c < w; c++) {
    if (lo[c] === Infinity) continue;
    const t = t0 + (c + 0.5) * colW;
    // Order the pair so the path from the previous column is shortest.
    const first = Number.isNaN(prev) || Math.abs(prev - lo[c]!) <= Math.abs(prev - hi[c]!) ? lo[c]! : hi[c]!;
    const second = first === lo[c] ? hi[c]! : lo[c]!;
    push(t, first);
    if (second !== first) push(t, second);
    prev = second;
  }
  return out;
}

/** The 1–2–5 ladder, for time and voltage divisions. */
export const stepLadder = (value: number, direction: 1 | -1, min: number, max: number): number => {
  const next = speedAt(speedIndex(value) + direction);
  return Math.max(min, Math.min(max, next));
};

export const TIMEBASE_MIN = 1e-9;
export const TIMEBASE_MAX = 100;
export const VDIV_MIN = 1e-3;
export const VDIV_MAX = 100;

/** Measurements between two cursor readings. */
export function cursorDelta(a: number, b: number): { delta: number; inverse: number } {
  const delta = b - a;
  return { delta, inverse: delta === 0 ? Infinity : 1 / Math.abs(delta) };
}

/** Minimum, maximum, peak-to-peak and mean of a channel over a window (for the readout under the screen). */
export function statistics(times: ArrayLike<number>, values: ArrayLike<number>, t0: number, t1: number): { min: number; max: number; pkpk: number; mean: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  let area = 0;
  let span = 0;
  for (let i = Math.max(0, indexAtOrBefore(times, t0)); i < times.length && times[i]! <= t1; i++) {
    const v = values[i]!;
    if (Number.isNaN(v) || times[i]! < t0) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    if (i + 1 < times.length) {
      const dt = Math.min(times[i + 1]!, t1) - times[i]!;
      if (dt > 0) {
        area += v * dt;
        span += dt;
      }
    }
  }
  if (min === Infinity) return undefined;
  return { min, max, pkpk: max - min, mean: span > 0 ? area / span : (min + max) / 2 };
}
