/** Colour helpers for the display: the transverse-momentum ramp. The particle colours come from `$lib/theme/particles`. */

export type RGB = [number, number, number];

/** A ramp for dark backgrounds: violet, blue, cyan-green, yellow-green, amber, red, pale. */
const RAMP: RGB[] = [
  [0.36, 0.42, 1.0],
  [0.2, 0.75, 1.0],
  [0.25, 0.95, 0.7],
  [0.75, 0.95, 0.3],
  [1.0, 0.75, 0.25],
  [1.0, 0.4, 0.3],
  [1.0, 0.88, 0.92],
];

export const PT_RAMP_LO = 0.5;
export const PT_RAMP_HI = 200;

/** Position of `pt` (GeV) on the logarithmic ramp, 0…1. */
export function ptFraction(pt: number, lo = PT_RAMP_LO, hi = PT_RAMP_HI): number {
  if (!(pt > lo)) return 0;
  return Math.min(1, Math.log(pt / lo) / Math.log(hi / lo));
}

/** The ramp colour for a transverse momentum. */
export function ptColour(pt: number, out: RGB = [0, 0, 0]): RGB {
  const t = ptFraction(pt) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = RAMP[i]!, b = RAMP[i + 1]!;
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}

/** CSS gradient of the ramp, for the legend. */
export function ptGradientCss(): string {
  const stops = RAMP.map((c, i) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)}) ${Math.round((i / (RAMP.length - 1)) * 100)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Mix a colour towards white (t = 0 leaves it, 1 gives white). */
export function lighten(c: RGB, t: number, out: RGB = [0, 0, 0]): RGB {
  out[0] = c[0] + (1 - c[0]) * t;
  out[1] = c[1] + (1 - c[1]) * t;
  out[2] = c[2] + (1 - c[2]) * t;
  return out;
}
