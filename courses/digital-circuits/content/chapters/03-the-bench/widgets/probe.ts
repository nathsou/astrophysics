/**
 * A logic probe has three lamps: HIGH, LOW and PULSE. It looks at the voltage on its tip against two thresholds
 * (here those of 5 V CMOS: above 70 % of the supply is high, below 30 % is low) and shows nothing at all in
 * between, or when the tip touches nothing. A pulse stretcher keeps the PULSE lamp lit for 100 ms after any
 * edge, so pulses far too short to see still show up.
 */
export const VCC = 5;
export const HIGH_ABOVE = 0.7 * VCC;
export const LOW_BELOW = 0.3 * VCC;
export const STRETCH = 0.1;
/** Above this frequency the eye cannot follow the lamps: they show the fraction of time spent high and low. */
export const FLICKER_HZ = 6;

export type Level = 'high' | 'low' | 'between';

export function classify(v: number): Level {
  if (v >= HIGH_ABOVE) return 'high';
  if (v <= LOW_BELOW) return 'low';
  return 'between';
}

export type Source =
  | { kind: 'level'; volts: number }
  | { kind: 'floating' }
  | { kind: 'clock'; hz: number; duty: number };

export interface Lamps {
  high: number;
  low: number;
  pulse: number;
}

/** Brightness (0–1) of the three lamps at time t (seconds) for a source. */
export function lamps(src: Source, t: number): Lamps {
  if (src.kind === 'floating') return { high: 0, low: 0, pulse: 0 };
  if (src.kind === 'level') {
    const c = classify(src.volts);
    return { high: c === 'high' ? 1 : 0, low: c === 'low' ? 1 : 0, pulse: 0 };
  }
  const T = 1 / src.hz;
  if (src.hz >= FLICKER_HZ) return { high: src.duty, low: 1 - src.duty, pulse: 1 };
  const ph = t - Math.floor(t / T) * T;
  const high = ph < src.duty * T;
  // Time since the most recent edge (rising edge at 0, falling at duty·T).
  const sinceRise = ph;
  const sinceFall = ph >= src.duty * T ? ph - src.duty * T : ph + (1 - src.duty) * T;
  const recent = Math.min(sinceRise, sinceFall) < STRETCH;
  return { high: high ? 1 : 0, low: high ? 0 : 1, pulse: recent ? 1 : 0 };
}
