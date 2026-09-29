/**
 * Reducing a recorded waveform to what fits on a scope screen without losing the spike: for each
 * pixel column keep the minimum and maximum of the samples that fall in it, as a real digital scope's
 * "peak detect" mode does.
 */

export interface Column {
  min: number;
  max: number;
}

/**
 * Min/max envelope of samples over [t0, t1] in `n` columns. Each sample holds its value until the
 * next one (the recorder logs every change), so a column also includes the value carried in from
 * before it. Columns before the first sample are `undefined`.
 */
export function envelope(times: ArrayLike<number>, values: ArrayLike<number>, t0: number, t1: number, n: number): (Column | undefined)[] {
  const out: (Column | undefined)[] = new Array(n).fill(undefined);
  const count = times.length;
  if (!count || n < 1 || !(t1 > t0)) return out;
  const w = (t1 - t0) / n;
  let i = 0;
  // Value in force at t0: the last sample at or before it.
  let carried: number | undefined;
  while (i < count && times[i]! <= t0) carried = values[i++];
  for (let c = 0; c < n; c++) {
    const end = t0 + (c + 1) * w;
    let lo = Infinity;
    let hi = -Infinity;
    if (carried !== undefined) lo = hi = carried;
    while (i < count && times[i]! < end) {
      const v = values[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      carried = v;
      i++;
    }
    if (hi >= lo) out[c] = { min: lo, max: hi };
  }
  return out;
}

/** The smallest of 1, 2, 5, 10 × 10ⁿ that is at least `v` (for a scale that shows a peak). */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].map((m) => m * p).find((x) => x >= v * (1 - 1e-12)) ?? 10 * p);
}

/** Largest sample in [t0, t1]. */
export function peakBetween(times: ArrayLike<number>, values: ArrayLike<number>, t0: number, t1: number): number {
  let peak = -Infinity;
  for (let i = 0; i < times.length; i++) if (times[i]! >= t0 && times[i]! <= t1 && values[i]! > peak) peak = values[i]!;
  return peak;
}
