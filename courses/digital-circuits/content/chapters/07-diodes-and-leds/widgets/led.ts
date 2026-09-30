/**
 * Bandgap, photon energy and colour, for the LED explorer of Chapter 7.
 *
 * A photon of energy E has wavelength λ = hc / E, and hc = 1239.84 eV·nm. An LED's photons carry roughly
 * the bandgap energy of the semiconductor it is made of, so the gap sets the colour. The catalogue
 * below lists real materials with their approximate gaps; the colour names and ranges are the usual
 * ones (red 620–750 nm, green 495–570 nm, blue 450–495 nm).
 */

/** Planck's constant times the speed of light, in eV·nm. */
export const HC = 1239.84198;

export const wavelengthNm = (ev: number): number => HC / ev;
export const energyEv = (nm: number): number => HC / nm;

/** The visible range in nanometres (the eye's sensitivity fades out beyond these). */
export const VISIBLE_MIN = 380;
export const VISIBLE_MAX = 780;

/**
 * An approximate sRGB colour (0–255) for a wavelength in the visible range, or null outside it
 * (Dan Bruton's piecewise-linear approximation, with the dimming towards both ends of the spectrum).
 */
export function spectrumRgb(nm: number): [number, number, number] | null {
  if (nm < VISIBLE_MIN || nm > VISIBLE_MAX) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - VISIBLE_MIN)) / 40 : nm > 700 ? 0.3 + (0.7 * (VISIBLE_MAX - nm)) / 80 : 1;
  const gamma = 0.8;
  const c = (x: number) => Math.round(255 * Math.pow(Math.max(0, x) * f, gamma));
  return [c(r), c(g), c(b)];
}

/** Colour names by wavelength, with the LED type of the analog engine that stands for each. */
export interface ColourBand {
  name: string;
  /** Upper edge of the band in nm. */
  upTo: number;
  /** `color` parameter of the `led` component. */
  led: 'infrared' | 'red' | 'amber' | 'yellow' | 'green' | 'blue';
}

export const BANDS: ColourBand[] = [
  { name: 'ultraviolet', upTo: VISIBLE_MIN, led: 'blue' },
  { name: 'violet', upTo: 450, led: 'blue' },
  { name: 'blue', upTo: 495, led: 'blue' },
  { name: 'green', upTo: 570, led: 'green' },
  { name: 'yellow', upTo: 590, led: 'yellow' },
  { name: 'amber', upTo: 620, led: 'amber' },
  { name: 'red', upTo: 750, led: 'red' },
  { name: 'deep red', upTo: VISIBLE_MAX, led: 'red' },
  { name: 'infrared', upTo: Infinity, led: 'infrared' },
];

export function colourBand(ev: number): ColourBand {
  const nm = wavelengthNm(ev);
  return BANDS.find((b) => nm <= b.upTo) ?? BANDS[BANDS.length - 1]!;
}

/** Real LED materials: bandgap (eV) and what they emit. */
export interface Material {
  name: string;
  formula: string;
  gap: number;
  emits: string;
}

export const MATERIALS: Material[] = [
  { name: 'Gallium arsenide', formula: 'GaAs', gap: 1.42, emits: 'infrared, about 870 nm (remote controls)' },
  { name: 'Gallium arsenide phosphide', formula: 'GaAsP', gap: 1.9, emits: 'red, about 650 nm (the first visible LEDs)' },
  { name: 'Nitrogen-doped gallium phosphide', formula: 'GaP:N', gap: 2.2, emits: 'green, about 565 nm' },
  { name: 'Indium gallium nitride', formula: 'InGaN', gap: 2.7, emits: 'blue, about 460 nm (and, with a phosphor, white)' },
];

/** The material whose gap is closest to `ev`. */
export function nearestMaterial(ev: number): Material {
  return MATERIALS.reduce((best, m) => (Math.abs(m.gap - ev) < Math.abs(best.gap - ev) ? m : best));
}

/** Position (0–1) of a wavelength along a spectrum bar that runs from `from` to `to` nm. */
export const spectrumPosition = (nm: number, from = 350, to = 900): number => Math.min(1, Math.max(0, (nm - from) / (to - from)));

/** CSS gradient for the spectrum bar from `from` to `to` nm (the invisible ends are dark). */
export function spectrumStops(from = 350, to = 900, n = 56): string {
  const stops: string[] = [];
  for (let i = 0; i <= n; i++) {
    const nm = from + ((to - from) * i) / n;
    const rgb = spectrumRgb(nm);
    stops.push(`${rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : 'rgb(38, 38, 46)'} ${((i / n) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
