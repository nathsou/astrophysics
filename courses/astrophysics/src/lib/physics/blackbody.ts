import { h, c, kB } from './constants';

/** Planck spectral radiance B_λ(T) in W sr⁻¹ m⁻³ (λ in metres). */
export function planckLambda(lambda: number, T: number): number {
  const x = (h * c) / (lambda * kB * T);
  if (x > 700) return 0;
  return (2 * h * c * c) / lambda ** 5 / Math.expm1(x);
}

/** Wien peak wavelength (m). */
export const wienPeak = (T: number) => 2.897771955e-3 / T;

// CIE 1931 colour-matching functions, multi-lobe Gaussian fit (Wyman, Sloan & Shirley 2013). λ in nm.
function g(x: number, mu: number, s1: number, s2: number) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}
export function cieXYZ(nm: number): [number, number, number] {
  const x = 1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2);
  const y = 0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1);
  const z = 1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8);
  return [x, y, z];
}

const toSRGB = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);

/** Linear sRGB from XYZ. */
export function xyzToLinearRGB(X: number, Y: number, Z: number): [number, number, number] {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ];
}

const cache = new Map<number, [number, number, number]>();

/**
 * Perceived colour of a blackbody at temperature T (K), as gamma-encoded sRGB in [0,1],
 * normalised so the brightest channel is 1 (i.e. chromaticity only, not brightness).
 */
export function blackbodyRGB(T: number): [number, number, number] {
  const key = Math.round(T / 10) * 10;
  const hit = cache.get(key);
  if (hit) return hit;
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const B = planckLambda(nm * 1e-9, key);
    const [x, y, z] = cieXYZ(nm);
    X += B * x; Y += B * y; Z += B * z;
  }
  let [r, gg, b] = xyzToLinearRGB(X, Y, Z);
  r = Math.max(r, 0); gg = Math.max(gg, 0); b = Math.max(b, 0);
  const m = Math.max(r, gg, b) || 1;
  const out: [number, number, number] = [toSRGB(r / m), toSRGB(gg / m), toSRGB(b / m)];
  cache.set(key, out);
  return out;
}

export function blackbodyCSS(T: number, alpha = 1): string {
  const [r, g2, b] = blackbodyRGB(T);
  return `rgba(${(r * 255) | 0},${(g2 * 255) | 0},${(b * 255) | 0},${alpha})`;
}

/** Approximate sRGB colour of a monochromatic wavelength (nm), for drawing spectra. */
export function wavelengthRGB(nm: number): [number, number, number] {
  const [X, Y, Z] = cieXYZ(nm);
  let [r, g2, b] = xyzToLinearRGB(X, Y, Z);
  // desaturate out-of-gamut by adding white
  const w = -Math.min(0, r, g2, b);
  r += w; g2 += w; b += w;
  const m = Math.max(r, g2, b) || 1;
  if (nm < 380 || nm > 780) return [0, 0, 0];
  const fade = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [toSRGB(r / m) * fade, toSRGB(g2 / m) * fade, toSRGB(b / m) * fade];
}
