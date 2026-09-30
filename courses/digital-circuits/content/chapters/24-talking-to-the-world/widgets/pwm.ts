/**
 * Pulse-width modulation through an RC filter, simulated by the analogue engine: a 0/5 V pulse train of a given duty cycle
 * and frequency drives a resistor into a capacitor, and the capacitor's voltage is the average of the pulses (a first-order
 * low-pass filter) with a ripple that shrinks as the frequency and the capacitor grow.
 */
import '$lib/sim/netlist/catalog';
import { createAnalogEngine } from '$lib/sim/analog';
import { NetlistBuilder } from '$lib/sim/digital';

export interface PwmConfig {
  /** Fraction of each period the pulse is high, 0 to 1. */
  duty: number;
  frequency: number;
  /** The filter capacitor, in farads (the resistor is 1 kΩ). */
  capacitance: number;
  /** Show the settled output, or start from power-on (the capacitor empty). */
  from?: 'settled' | 'start';
  /** How many periods to show (default 5). */
  periods?: number;
}

export const FILTER_R = 1000;

export interface PwmRun {
  t: number[];
  /** The pulse train, as levels 0 and 1. */
  pwm: number[];
  /** The filtered voltage. */
  out: number[];
  /** Window shown, in seconds after the start of the recording. */
  window: number;
  /** Mean of the filtered voltage over the last period, and its peak-to-peak ripple there. */
  mean: number;
  ripple: number;
  tau: number;
}

const advance = (e: { time: number; advance(dt: number): void }, seconds: number) => {
  const end = e.time + seconds;
  while (e.time < end - 1e-12) e.advance(end - e.time);
};

export function runPwm(cfg: PwmConfig): PwmRun {
  const b = new NetlistBuilder();
  const gnd = b.ground();
  const pwm = b.net('PWM');
  const out = b.net('OUT');
  b.add('clock', 'SRC', { Y: pwm }, { frequency: cfg.frequency, duty: Math.min(0.99, Math.max(0.01, cfg.duty)) });
  b.add('resistor', 'R1', { '1': pwm, '2': out }, { resistance: FILTER_R });
  b.add('capacitor', 'C1', { '1': out, '2': gnd }, { capacitance: cfg.capacitance });
  const e = createAnalogEngine(b.build());
  const tau = FILTER_R * cfg.capacitance;
  const period = 1 / cfg.frequency;
  const periods = cfg.periods ?? 5;
  const start = cfg.from === 'start';
  // Settle: eight time constants, in whole periods.
  if (!start) advance(e, Math.ceil((8 * tau) / period) * period);
  const shown = start ? Math.max(periods * period, Math.min(6 * tau, 800 * period)) : periods * period;
  const t0 = e.time;
  const rec = e.watch([pwm, out]);
  advance(e, shown);
  const t = Array.from(rec.times(), (x) => x - t0);
  const [vp, vo] = rec.values() as [Float64Array, Float64Array];
  rec.close();
  // Statistics over the last period.
  let lo = Infinity;
  let hi = -Infinity;
  let area = 0;
  const from = shown - period;
  for (let i = 0; i < t.length; i++) {
    if (t[i]! < from) continue;
    lo = Math.min(lo, vo[i]!);
    hi = Math.max(hi, vo[i]!);
    const next = i + 1 < t.length ? t[i + 1]! : shown;
    area += vo[i]! * (next - Math.max(t[i]!, from));
  }
  return { t, pwm: Array.from(vp, (v) => (v > 2.5 ? 1 : 0)), out: Array.from(vo), window: shown, mean: area / period, ripple: hi - lo, tau };
}

/** The textbook estimate of the ripple of a first-order filter, for τ much longer than the period: 5 V · D(1 − D) / (f τ). */
export const rippleEstimate = (duty: number, frequency: number, tau: number) => (5 * duty * (1 - duty)) / (frequency * tau);
