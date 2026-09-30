/**
 * The digital abstraction in numbers: for a 5 V CMOS logic family, "above 3.5 V is a 1, below 1.5 V is a 0,
 * and in between nobody promises anything". Used by the Thresholds figure.
 */

export const V_IH = 3.5;
export const V_IL = 1.5;
/** How close to the rails a healthy gate drives its output (a 74HC gate at 5 V is within about 0.1 V). */
export const V_OL = 0.1;
export const V_OH = 4.9;

export type Reading = 0 | 1 | 'undefined';

/** What a receiving gate makes of a voltage. */
export function read(v: number): Reading {
  if (v >= V_IH) return 1;
  if (v <= V_IL) return 0;
  return 'undefined';
}

/** The largest noise (V) a healthy 1 or 0 can pick up on the wire and still be read correctly: the noise margin. */
export const NOISE_MARGIN_HIGH = V_OH - V_IH;
export const NOISE_MARGIN_LOW = V_IL - V_OL;
export const noiseMargin = Math.min(NOISE_MARGIN_HIGH, NOISE_MARGIN_LOW);

/** A fixed message, so that the figure is the same every time. */
export const MESSAGE = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1] as const;

/** A fixed noise pattern in [−1, 1] (one value per bit; a real wire would give a different one every time). */
export const NOISE = [0.6, -0.9, 0.3, 1, -0.5, 0.8, -1, 0.4, -0.2, 0.95, -0.7, 0.1, -0.85, 1, -0.3, 0.7] as const;

/** The voltage on the wire for bit `i` when noise of peak amplitude `amp` volts is added to a healthy signal. */
export function wireVoltage(i: number, amp: number): number {
  const clean = MESSAGE[i]! === 1 ? V_OH : V_OL;
  return Math.max(0, Math.min(5, clean + NOISE[i]! * amp));
}

/** The message the receiver reads, with 'undefined' where the wire was between the thresholds. */
export function received(amp: number): Reading[] {
  return MESSAGE.map((_, i) => read(wireVoltage(i, amp)));
}

/** How many bits are read wrongly (or not at all). */
export function errors(amp: number): number {
  return received(amp).filter((r, i) => r !== MESSAGE[i]).length;
}
