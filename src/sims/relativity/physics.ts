// Shared special-relativity helpers for Chapter 17 sims (CPU, f64).
//
// Convention: an observer moves with speed β (units of c) along the unit vector v̂ relative to the
// frame S in which the sources are at rest. A source seen in direction n̂ in S (cos θ = n̂·v̂) is seen by
// the moving observer in direction n̂′ with
//     cos θ′ = (cos θ + β) / (1 + β cos θ)            (aberration: everything crowds forward)
//     δ     = γ (1 + β cos θ) = 1 / (γ (1 − β cos θ′))  (Doppler factor: ν_obs = δ ν_emit)

import { planckLambda, cieXYZ, xyzToLinearRGB } from '../../lib/physics/blackbody';

export const gammaOf = (beta: number) => 1 / Math.sqrt((1 - beta) * (1 + beta));
export const betaOfRapidity = (phi: number) => Math.tanh(phi);
export const gammaOfRapidity = (phi: number) => Math.cosh(phi);
/** 1 − β computed without cancellation from the rapidity: 1 − tanh φ = 2 / (e^{2φ} + 1). */
export const oneMinusBetaOfRapidity = (phi: number) => 2 / (Math.exp(2 * phi) + 1);

/** Observed angle θ′ (rad) of a source at rest-frame angle θ from the direction of motion. */
export function aberrate(theta: number, beta: number): number {
  const g = gammaOf(beta);
  const c = Math.cos(theta), s = Math.sin(theta);
  // Use the (sin, cos) pair so θ near 0 and π stay accurate.
  return Math.atan2(s / (g * (1 + beta * c)), (c + beta) / (1 + beta * c));
}

/** Doppler factor as a function of the OBSERVED angle θ′ from the direction of motion. */
export const dopplerObs = (thetaObs: number, beta: number) => 1 / (gammaOf(beta) * (1 - beta * Math.cos(thetaObs)));

/** Format β so that 0.9999995 doesn't read as "1". */
export function fmtBeta(beta: number): string {
  if (beta < 0.99) return beta.toFixed(beta < 0.1 ? 3 : 3);
  const omb = 1 - beta;
  const digits = Math.min(9, Math.max(3, Math.ceil(-Math.log10(omb)) + 1));
  return beta.toFixed(digits);
}

// ---------- Visible-band colour of a blackbody, per unit bolometric flux ----------
//
// frac(T) = ∫ B_λ(T) · cmf(λ) dλ / (σT⁴/π), converted to linear sRGB and normalised so that the
// luminance at T = 5800 K is 1. A source of bolometric flux F and temperature T then contributes
// F · frac(T) to the linear RGB image. Doppler-shifting a blackbody gives another blackbody at δT,
// so the colour of a shifted star is just a lookup at δT. The table spans 1 K … 10⁹ K in log T.

export const LUT_N = 512;
export const LOGT_MIN = 0;
export const LOGT_MAX = 9;
const SIGMA_OVER_PI = 5.670374419e-8 / Math.PI;

function bandRGB(T: number): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let nm = 360; nm <= 830; nm += 5) {
    const B = planckLambda(nm * 1e-9, T) * 5e-9;
    const [x, y, z] = cieXYZ(nm);
    X += B * x; Y += B * y; Z += B * z;
  }
  const bol = SIGMA_OVER_PI * T ** 4;
  let [r, g, b] = xyzToLinearRGB(X / bol, Y / bol, Z / bol);
  // Out-of-gamut (very red / very blue) → desaturate toward white, preserving luminance roughly.
  const w = -Math.min(0, r, g, b);
  r += w; g += w; b += w;
  return [r, g, b];
}

let lutCache: Float32Array | null = null;
/** LUT_N × vec4 (linear RGB, luminance) of the visible fraction, normalised at 5800 K. */
export function bandLUT(): Float32Array {
  if (lutCache) return lutCache;
  const out = new Float32Array(LUT_N * 4);
  const ref = bandRGB(5800);
  const norm = 1 / (0.2126 * ref[0] + 0.7152 * ref[1] + 0.0722 * ref[2]);
  for (let i = 0; i < LUT_N; i++) {
    const T = 10 ** (LOGT_MIN + ((LOGT_MAX - LOGT_MIN) * i) / (LUT_N - 1));
    const [r, g, b] = bandRGB(T);
    out[4 * i] = r * norm; out[4 * i + 1] = g * norm; out[4 * i + 2] = b * norm;
    out[4 * i + 3] = (0.2126 * r + 0.7152 * g + 0.0722 * b) * norm;
  }
  lutCache = out;
  return out;
}

/** Deterministic PRNG (mulberry32), so the starfield is the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
