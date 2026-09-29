/**
 * Colour ramps for value encodings (heatmaps, tensors). Sequential = one hue light→dark;
 * diverging = blue ↔ red through a neutral grey. The low end recedes toward the surface in
 * each theme, so dark mode gets its own stops rather than an inverted light ramp.
 */

export type RampName = 'sequential' | 'diverging';
type Stops = string[];

const RAMPS: Record<RampName, { light: Stops; dark: Stops }> = {
  sequential: {
    light: ['#f5f9fe', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
    dark: ['#1c2129', '#16304f', '#184f95', '#2a78d6', '#6da7ec', '#cde2fb'],
  },
  diverging: {
    light: ['#104281', '#3987e5', '#9ec5f4', '#f0efec', '#f3a3a2', '#e34948', '#8f1f1f'],
    dark: ['#9ec5f4', '#3987e5', '#1c4a80', '#383835', '#8a3434', '#e66767', '#f6b5b5'],
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Interpolate in OKLab so the ramp is perceptually even.
function srgbToLinear(c: number) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c: number) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}
function toOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const cache = new Map<string, Uint8Array<ArrayBuffer>>();

/** 256-entry RGBA8 lookup table (cached). */
export function colormapLUT(name: RampName, theme: 'light' | 'dark', size = 256): Uint8Array<ArrayBuffer> {
  const key = `${name}:${theme}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const stops = RAMPS[name][theme].map((h) => toOklab(hexToRgb(h)));
  const out = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const t = (i / (size - 1)) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    const f = t - k;
    const a = stops[k]!, b = stops[k + 1]!;
    const rgb = fromOklab([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    out.set([...rgb, 255], i * 4);
  }
  cache.set(key, out);
  return out;
}

/** CSS colour for a normalised value t ∈ [0, 1] (for SVG/HTML marks and legends). */
export function colorAt(name: RampName, theme: 'light' | 'dark', t: number): string {
  const lut = colormapLUT(name, theme, 64);
  const i = Math.round(Math.min(1, Math.max(0, t)) * 63) * 4;
  return `rgb(${lut[i]}, ${lut[i + 1]}, ${lut[i + 2]})`;
}

/** Readable text colour (ink or white) on top of a LUT colour. */
export function inkOn(name: RampName, theme: 'light' | 'dark', t: number): string {
  const lut = colormapLUT(name, theme, 64);
  const i = Math.round(Math.min(1, Math.max(0, t)) * 63) * 4;
  const lum = (0.2126 * srgbToLinear(lut[i]!) + 0.7152 * srgbToLinear(lut[i + 1]!) + 0.0722 * srgbToLinear(lut[i + 2]!));
  return lum > 0.35 ? '#0b0b0b' : '#ffffff';
}
