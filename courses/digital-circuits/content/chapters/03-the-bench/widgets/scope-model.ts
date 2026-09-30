/**
 * The maths of the simulated oscilloscope, without any drawing.
 *
 * A real digital scope samples a voltage at a fixed rate into memory, then shows a window of that
 * memory. Ours is fed by `engine.watch()`, which records every internal step of the analog engine
 * (irregular in time, dense where the circuit changes fast), so three things happen here:
 *
 *  1. **Resampling.** The recorded points are turned into one min/max pair per pixel column (500
 *     columns across the ten divisions), so a narrow glitch is never lost between two columns.
 *  2. **Triggering.** A sweep starts when the chosen channel crosses the trigger level in the chosen
 *     direction (the crossing time is interpolated between recorded points). With the trigger off
 *     the sweep starts wherever the previous one ended, so each sweep meets the signal at a
 *     different phase and the display smears.
 *  3. **Persistence.** The last few finished sweeps are kept and drawn faintly under the newest, like
 *     the afterglow of a phosphor screen.
 */

export const DIVS_X = 10;
export const DIVS_Y = 8;
/** Pixel columns per sweep (independent of the size on screen). */
export const COLS = 500;

export type TriggerMode = 'off' | 'auto' | 'single';
export type Slope = 'rise' | 'fall';

export interface TriggerSettings {
  mode: TriggerMode;
  /** Index of the channel to trigger on. */
  channel: number;
  slope: Slope;
  /** Volts. */
  level: number;
  /** Where the trigger point sits along the screen, 0 (left edge) to 1 (right edge). */
  position: number;
}

/** One finished sweep: a min/max envelope per channel, and the raw points it was made from. */
export interface Sweep {
  /** Time of the left edge of the screen. */
  t0: number;
  /** True when the sweep was started by the trigger (rather than free-running). */
  triggered: boolean;
  min: Float32Array[];
  max: Float32Array[];
  raw?: { t: Float64Array; v: Float64Array[] };
}

/** The 1–2–5 sequence between 10^lo and 10^hi (inclusive of 1×10^hi). */
export function seq125(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) for (const m of [1, 2, 5]) out.push(Number((m * 10 ** e).toPrecision(12)));
  return out.filter((x) => x <= 10 ** hi * 1.0000001);
}

/** Index of the entry of `list` closest (in log terms) to `x`. */
export function nearestIndex(list: number[], x: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(Math.log(list[i]! / x));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** First index with `times[i] > t` (binary search). */
export function upperBound(times: ArrayLike<number>, t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid]! <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Linear interpolation of a piecewise-linear signal; NaN outside the recorded range. */
export function valueAt(times: ArrayLike<number>, values: ArrayLike<number>, t: number): number {
  const n = times.length;
  if (!n || t < times[0]! || t > times[n - 1]!) return NaN;
  const j = upperBound(times, t);
  if (j >= n) return values[n - 1]!;
  const a = times[j - 1]!;
  const b = times[j]!;
  if (!(b > a)) return values[j]!;
  return values[j - 1]! + ((values[j]! - values[j - 1]!) * (t - a)) / (b - a);
}

export interface Envelope {
  min: Float32Array;
  max: Float32Array;
}

/**
 * The signal between `t0` and `t0 + span` as a min/max envelope of `cols` columns. A column holds the
 * smallest and largest value the signal takes inside it (recorded points and the interpolated values
 * at its two ends). Columns outside the recorded range are NaN.
 */
export function resample(times: ArrayLike<number>, values: ArrayLike<number>, t0: number, span: number, cols: number = COLS): Envelope {
  const min = new Float32Array(cols).fill(NaN);
  const max = new Float32Array(cols).fill(NaN);
  const n = times.length;
  if (n === 0 || !(span > 0)) return { min, max };
  const dt = span / cols;
  const tFirst = times[0]!;
  const tLast = times[n - 1]!;
  let j = upperBound(times, t0);
  for (let c = 0; c < cols; c++) {
    const a = t0 + c * dt;
    const b = a + dt;
    if (b < tFirst) {
      j = upperBound(times, b);
      continue;
    }
    if (a > tLast) break;
    const lo0 = Math.max(a, tFirst);
    const hi0 = Math.min(b, tLast);
    let lo = valueAt(times, values, lo0);
    let hi = lo;
    while (j < n && times[j]! <= b) {
      if (times[j]! > a) {
        const v = values[j]!;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      j++;
    }
    const vb = valueAt(times, values, hi0);
    if (vb < lo) lo = vb;
    if (vb > hi) hi = vb;
    min[c] = lo;
    max[c] = hi;
  }
  return { min, max };
}

/**
 * First time at or after `from` when the signal crosses `level` in the given direction, or null. The
 * signal is piecewise linear between recorded points, so the crossing is interpolated exactly.
 */
export function findCrossing(times: ArrayLike<number>, values: ArrayLike<number>, from: number, level: number, slope: Slope): number | null {
  const n = times.length;
  if (n < 2) return null;
  let i = Math.max(1, upperBound(times, from));
  // Step back one: the crossing may lie in the segment that contains `from`.
  if (i > 1) i--;
  for (; i < n; i++) {
    const a = values[i - 1]!;
    const b = values[i]!;
    const crosses = slope === 'rise' ? a < level && b >= level : a > level && b <= level;
    if (!crosses) continue;
    const ta = times[i - 1]!;
    const tb = times[i]!;
    const t = b === a ? tb : ta + ((level - a) / (b - a)) * (tb - ta);
    if (t >= from) return t;
  }
  return null;
}

/** Raw points inside [t0, t1], with one neighbour on each side so lines reach the edges. */
export function sliceWindow(times: ArrayLike<number>, values: ArrayLike<number>[], t0: number, t1: number): { t: Float64Array; v: Float64Array[] } {
  const lo = Math.max(0, upperBound(times, t0) - 1);
  const hi = Math.min(times.length, upperBound(times, t1) + 1);
  const t = new Float64Array(hi - lo);
  for (let i = lo; i < hi; i++) t[i - lo] = times[i]!;
  const v = values.map((arr) => {
    const out = new Float64Array(hi - lo);
    for (let i = lo; i < hi; i++) out[i - lo] = arr[i]!;
    return out;
  });
  return { t, v };
}

export interface PartialSweep {
  t0: number;
  min: Float32Array[];
  max: Float32Array[];
}

/** The scope's brain: decides where each sweep starts and keeps the finished ones. */
export class ScopeModel {
  readonly nChannels: number;
  timebase: number;
  trigger: TriggerSettings;
  /** Finished sweeps, oldest first. */
  sweeps: Sweep[] = [];
  /** Number of sweeps kept for the afterglow. */
  persistence = 8;
  /** Single-shot: waiting for a trigger (true) or holding a captured sweep (false). */
  armed = true;
  /** Fraction of a sweep the beam needs to fly back when free-running. */
  retrace = 0.05;
  /** Raw points are kept with a sweep only when there are fewer than this many. */
  rawLimit = 40000;

  private windowFloor = 0;
  private count = 0;
  private current: { t0: number; triggered: boolean } | null = null;
  private stale = false;

  constructor(nChannels: number, timebase: number, trigger: Partial<TriggerSettings> = {}) {
    this.nChannels = nChannels;
    this.timebase = timebase;
    this.trigger = { mode: 'auto', channel: 0, slope: 'rise', level: 2.5, position: 0.1, ...trigger };
  }

  get span(): number {
    return this.timebase * DIVS_X;
  }

  /** The newest finished sweep. */
  get last(): Sweep | undefined {
    return this.sweeps[this.sweeps.length - 1];
  }

  /** Start again from time `now`. With `keep` the old sweeps stay on screen until a new one finishes. */
  restart(now: number, keep = false): void {
    this.windowFloor = now;
    this.current = null;
    if (keep) this.stale = this.sweeps.length > 0;
    else {
      this.sweeps = [];
      this.stale = false;
    }
  }

  /** Single-shot: wait for the next trigger. */
  arm(now: number, slope?: Slope): void {
    if (slope) this.trigger.slope = slope;
    this.armed = true;
    // The trigger may fire at once, so the pre-trigger part of the screen shows what happened just before.
    this.windowFloor = now - this.trigger.position * this.span;
    this.current = null;
    this.sweeps = [];
    this.stale = false;
  }

  /** The earliest time whose data may still be needed (so a recorder can be trimmed). */
  needFrom(): number {
    return Math.min(this.current ? this.current.t0 : Infinity, this.windowFloor);
  }

  /**
   * Feed all recorded points (times ascending; `values[c]` for channel c). Completes as many sweeps as
   * the data allows and returns how many. `now` is the time of the newest point.
   */
  process(times: Float64Array, values: Float64Array[], now: number, maxSweeps = 60): number {
    if (times.length < 2) return 0;
    const first = times[0]!;
    const span = this.span;
    const pre = this.trigger.position * span;
    const tr = this.trigger;
    let done = 0;
    // Do not chase a long backlog: jump ahead so at most `maxSweeps` remain.
    const backlog = (now - Math.max(this.windowFloor, first)) / (span * (1 + this.retrace));
    if (backlog > maxSweeps) this.windowFloor = now - maxSweeps * span * (1 + this.retrace);
    for (let guard = 0; guard < maxSweeps + 4; guard++) {
      if (tr.mode === 'single' && !this.armed) {
        this.current = null;
        break;
      }
      if (!this.current) {
        const floor = Math.max(this.windowFloor, first);
        if (tr.mode === 'off') this.current = { t0: floor, triggered: false };
        else {
          const ch = values[Math.min(tr.channel, values.length - 1)]!;
          const tc = findCrossing(times, ch, floor + pre, tr.level, tr.slope);
          if (tc !== null) this.current = { t0: tc - pre, triggered: true };
          else if (tr.mode === 'auto' && now - floor > 1.5 * span) this.current = { t0: floor, triggered: false };
          else {
            // Waiting for a trigger: forget history older than a sweep and a half, so memory stays bounded.
            if (tr.mode === 'single') this.windowFloor = Math.max(this.windowFloor, now - 1.5 * span);
            break;
          }
        }
      }
      const cur = this.current;
      const end = cur.t0 + span;
      if (end > now) break;
      const min: Float32Array[] = [];
      const max: Float32Array[] = [];
      for (let c = 0; c < this.nChannels; c++) {
        const env = resample(times, values[c]!, cur.t0, span);
        min.push(env.min);
        max.push(env.max);
      }
      const sw: Sweep = { t0: cur.t0, triggered: cur.triggered, min, max };
      const raw = sliceWindow(times, values, cur.t0, end);
      if (raw.t.length <= this.rawLimit) sw.raw = raw;
      if (this.stale) {
        this.sweeps = [];
        this.stale = false;
      }
      this.sweeps.push(sw);
      if (this.sweeps.length > this.persistence) this.sweeps.shift();
      done++;
      // Free-running, the beam flies back in a time that varies a little from sweep to sweep (a golden-ratio
      // sequence stands in for the wander of a real time base), so successive sweeps meet the signal at
      // scattered phases rather than a repeating few.
      this.count++;
      const wander = 0.5 + ((this.count * 0.6180339887) % 1);
      this.windowFloor = cur.triggered ? end : end + this.retrace * span * wander;
      this.current = null;
      if (tr.mode === 'single') this.armed = false;
    }
    return done;
  }

  /** The sweep in progress, drawn as far as the data reaches (null when none has started). */
  partial(times: Float64Array, values: Float64Array[]): PartialSweep | null {
    const cur = this.current;
    if (!cur || times.length < 2) return null;
    const min: Float32Array[] = [];
    const max: Float32Array[] = [];
    for (let c = 0; c < this.nChannels; c++) {
      const env = resample(times, values[c]!, cur.t0, this.span);
      min.push(env.min);
      max.push(env.max);
    }
    return { t0: cur.t0, min, max };
  }

  /** What the status line should say. */
  status(): 'Stop' | 'Free run' | "Trig'd" | 'Auto' | 'Armed' | 'Held' {
    const tr = this.trigger;
    if (tr.mode === 'off') return 'Free run';
    if (tr.mode === 'single') return this.armed ? 'Armed' : 'Held';
    const l = this.last;
    if (!l) return 'Auto';
    return l.triggered ? "Trig'd" : 'Auto';
  }
}

// ---------------------------------------------------------------------------------------------
// Cursors and measurements.

export interface Cursors {
  on: boolean;
  /** Time cursors, in divisions from the left edge of the screen (0–10). */
  t1: number;
  t2: number;
  /** Voltage cursors, in volts. */
  v1: number;
  v2: number;
}

export interface CursorReadout {
  dt: number;
  /** 1/Δt, or NaN when the cursors coincide. */
  freq: number;
  dv: number;
  /** Signal values at each time cursor, one per channel (NaN if there is no sweep). */
  at1: number[];
  at2: number[];
}

/** Value of channel `c` of a sweep at `div` divisions from the left edge (mean of the column). */
export function sweepValueAt(s: Sweep, c: number, div: number): number {
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((div / DIVS_X) * COLS)));
  const lo = s.min[c]![col]!;
  const hi = s.max[c]![col]!;
  return (lo + hi) / 2;
}

/** Value of channel `c` at `div` divisions into a sweep, interpolated from its raw points when it has them. */
export function sweepValueExact(s: Sweep, c: number, div: number, timebase: number): number {
  if (s.raw) {
    const v = valueAt(s.raw.t, s.raw.v[c]!, s.t0 + div * timebase);
    if (!Number.isNaN(v)) return v;
  }
  return sweepValueAt(s, c, div);
}

export function readCursors(cur: Cursors, timebase: number, sweep: Sweep | undefined, nChannels: number): CursorReadout {
  const dt = Math.abs(cur.t2 - cur.t1) * timebase;
  const at = (div: number) => Array.from({ length: nChannels }, (_, c) => (sweep ? sweepValueExact(sweep, c, div, timebase) : NaN));
  return { dt, freq: dt > 0 ? 1 / dt : NaN, dv: Math.abs(cur.v2 - cur.v1), at1: at(cur.t1), at2: at(cur.t2) };
}

/**
 * Times at which a rising signal crosses `lo` and then `hi`, in a sweep's raw points, starting at the
 * first rising crossing of `lo` at or after `from`. Used for 10–90 % and 30–70 % rise times.
 */
export function riseTime(raw: { t: Float64Array; v: Float64Array[] } | undefined, channel: number, lo: number, hi: number, from = -Infinity): number | null {
  if (!raw) return null;
  const v = raw.v[channel];
  if (!v) return null;
  const a = findCrossing(raw.t, v, from, lo, 'rise');
  if (a === null) return null;
  const b = findCrossing(raw.t, v, a, hi, 'rise');
  return b === null ? null : b - a;
}

/** Number of times a signal crosses between two thresholds (Schmitt-trigger counting), inside a window. */
export function countEdges(raw: { t: Float64Array; v: Float64Array[] } | undefined, channel: number, low: number, high: number): number {
  if (!raw) return 0;
  const v = raw.v[channel];
  if (!v || v.length === 0) return 0;
  let state: 0 | 1 = v[0]! > (low + high) / 2 ? 1 : 0;
  let edges = 0;
  for (let i = 1; i < v.length; i++) {
    if (state === 0 && v[i]! >= high) {
      state = 1;
      edges++;
    } else if (state === 1 && v[i]! <= low) {
      state = 0;
      edges++;
    }
  }
  return edges;
}
