/**
 * Checking recorded waveforms against timing expectations (a clock that divides by two, a debounced
 * edge, a PWM duty cycle, a signal that must settle by a deadline).
 */

/** A recorded signal: sample times (s, ascending) and values. Between samples a digital signal holds its value. */
export interface Wave {
  t: ArrayLike<number>;
  v: ArrayLike<number>;
}

export type Expectation =
  /** The value at time `at` (s) is `value` ± tol. */
  | { at: number; value: number; tol?: number }
  /** The value stays within `value` ± tol from `from` to `to`. */
  | { from: number; to: number; value: number; tol?: number }
  /** A rising or falling edge (crossing `level`, default 0.5) happens within `window` seconds of `edgeAt`. */
  | { edgeAt: number; dir: 'rise' | 'fall'; window: number; level?: number };

export interface WaveFailure {
  expectation: Expectation;
  message: string;
}

export interface WaveResult {
  pass: boolean;
  failures: WaveFailure[];
}

/** Value of a wave at time t (the last sample at or before t; the first sample before the start). */
export function valueAt(w: Wave, t: number): number {
  const n = w.t.length;
  if (!n) return NaN;
  let lo = 0;
  let hi = n - 1;
  if (t < w.t[0]!) return w.v[0]!;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (w.t[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  return w.v[lo]!;
}

/** Times at which a wave crosses `level` upwards or downwards. */
export function edges(w: Wave, dir: 'rise' | 'fall', level = 0.5): number[] {
  const out: number[] = [];
  for (let i = 1; i < w.t.length; i++) {
    const a = w.v[i - 1]!;
    const b = w.v[i]!;
    if (dir === 'rise' ? a < level && b >= level : a >= level && b < level) out.push(w.t[i]!);
  }
  return out;
}

/** Fraction of [from, to] a wave spends at or above `level` (a duty cycle). */
export function dutyCycle(w: Wave, from: number, to: number, level = 0.5): number {
  let high = 0;
  let t = from;
  const marks = [...Array.from(w.t).filter((x) => x > from && x < to), to];
  for (const m of marks) {
    if (valueAt(w, t) >= level) high += m - t;
    t = m;
  }
  return to > from ? high / (to - from) : 0;
}

const fmtT = (s: number) => (Math.abs(s) >= 1 ? `${+s.toFixed(3)} s` : Math.abs(s) >= 1e-3 ? `${+(s * 1e3).toFixed(3)} ms` : Math.abs(s) >= 1e-6 ? `${+(s * 1e6).toFixed(3)} µs` : `${+(s * 1e9).toFixed(3)} ns`);

/** Check a wave against expectations; `tolerance` is the default ± on values (0.1 by default, for logic levels). */
export function checkWaveform(recorded: Wave, expected: Expectation[], tolerance = 0.1): WaveResult {
  const failures: WaveFailure[] = [];
  for (const e of expected) {
    if ('edgeAt' in e) {
      const found = edges(recorded, e.dir, e.level).find((t) => Math.abs(t - e.edgeAt) <= e.window);
      if (found === undefined) failures.push({ expectation: e, message: `expected a ${e.dir}ing edge within ${fmtT(e.window)} of ${fmtT(e.edgeAt)}, found none` });
    } else if ('at' in e) {
      const tol = e.tol ?? tolerance;
      const v = valueAt(recorded, e.at);
      if (!(Math.abs(v - e.value) <= tol)) failures.push({ expectation: e, message: `at ${fmtT(e.at)} expected ${e.value}, got ${+v.toFixed(3)}` });
    } else {
      const tol = e.tol ?? tolerance;
      const times = [e.from, ...Array.from(recorded.t).filter((t) => t > e.from && t < e.to), e.to];
      const bad = times.find((t) => !(Math.abs(valueAt(recorded, t) - e.value) <= tol));
      if (bad !== undefined) failures.push({ expectation: e, message: `between ${fmtT(e.from)} and ${fmtT(e.to)} expected ${e.value}, but at ${fmtT(bad)} it is ${+valueAt(recorded, bad).toFixed(3)}` });
    }
  }
  return { pass: failures.length === 0, failures };
}
