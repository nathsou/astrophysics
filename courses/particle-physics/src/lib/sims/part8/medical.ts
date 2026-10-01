/**
 * Toy models for the medical-physics figures of Chapter 33 (proton depth–dose and PET). Not clinical tools.
 *
 *  - Proton depth–dose: the mean stopping power of protons in water from the course's Bethe–Bloch (hep/detector), integrated to give the range,
 *    and the dose along the beam as the stopping power at the residual energy (the continuous-slowing-down approximation), smoothed by a Gaussian range
 *    straggling of a fixed fraction of the range. No nuclear interactions, no lateral spread, no secondary particles.
 *  - Photons: an idealised exponential attenuation. Real megavoltage photon beams have a build-up region and a dose maximum a few centimetres deep;
 *    the curve is there to show the contrast, not to predict a treatment.
 *  - PET in two dimensions: decays sampled from an activity map, two back-to-back photons in a random direction in the plane, detected on a ring with a small angular
 *    blur; the image is the back-projection of the lines of response. No attenuation, scatter, random coincidences, time of flight or depth of interaction.
 */
import { bethe, materials } from '$lib/hep/detector';
import type { Rng } from '$lib/hep/random';

const M_P = 0.9382720813; // GeV

/** The proton's mean mass stopping power in water at kinetic energy T (MeV), MeV cm²/g, from Bethe–Bloch (valid above about 1 MeV). */
export function protonStoppingPower(T: number): number {
  const E = T * 1e-3 + M_P;
  const p = Math.sqrt(E * E - M_P * M_P);
  return bethe({ material: materials.H2O, betaGamma: p / M_P, mass: M_P });
}

const cache = new Map<number, number>();
/** CSDA range (cm of water, density 1) of a proton of kinetic energy T (MeV): the integral of dT/S from 1 MeV up, plus the range at 1 MeV (about 25 µm, taken as 0.0025 cm). */
export function protonRange(T: number): number {
  const key = Math.round(T * 1000);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (T <= 1) return 0.0025 * Math.pow(Math.max(T, 0.01), 1.75);
  const n = 400;
  const lo = Math.log(1), hi = Math.log(T);
  let g = 0, prev = 0;
  for (let i = 0; i <= n; i++) {
    const t = Math.exp(lo + ((hi - lo) * i) / n);
    const f = t / protonStoppingPower(t);
    if (i > 0) g += 0.5 * (f + prev) * ((hi - lo) / n);
    prev = f;
  }
  const r = g + 0.0025;
  cache.set(key, r);
  return r;
}

/** The kinetic energy (MeV) that gives a range R (cm): the inverse of `protonRange`, by bisection. */
export function energyForRange(R: number): number {
  let lo = 1, hi = 400;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (protonRange(mid) < R) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** Relative depth dose at depth z (cm) for a monoenergetic proton beam of energy T (MeV): S at the residual energy, normalised to the entrance value. */
export function protonDose(T: number, z: number): number {
  const R = protonRange(T);
  const left = R - z;
  if (left <= 0) return 0;
  const Tres = energyForRange(left);
  return protonStoppingPower(Tres) / protonStoppingPower(T);
}

/** The same, averaged over a Gaussian spread of the range (σ = `straggle` × R), by a 15-point quadrature. */
export function protonDoseSmeared(T: number, z: number, straggle = 0.012): number {
  const R = protonRange(T);
  const sigma = straggle * R;
  let num = 0, den = 0;
  for (let k = -7; k <= 7; k++) {
    const u = k / 2.2;
    const w = Math.exp(-0.5 * u * u);
    const dz = u * sigma;
    // dose at depth z with the range shifted by dz: equivalent to evaluating at z − dz
    const zz = z - dz;
    num += w * (zz < 0 ? protonDose(T, 0) : protonDose(T, zz));
    den += w;
  }
  return num / den;
}

/** Idealised photon beam: exponential attenuation with the given attenuation length (cm). */
export const photonDose = (z: number, attenuationLength = 25): number => Math.exp(-z / attenuationLength);

/**
 * A spread-out Bragg peak: weights for beams with ranges spread over [zA, zB] (cm) such that the summed dose is as flat as possible in the target.
 * Deepest beam first; each shallower beam adds what is still missing at its own range. Returns the energies, weights, and a function for the total dose.
 */
export function spreadOutPeak(zA: number, zB: number, nBeams = 20): { energies: number[]; weights: number[]; dose: (z: number) => number } {
  const ranges = Array.from({ length: nBeams }, (_, i) => zB - ((zB - zA) * i) / (nBeams - 1)); // deepest first
  const energies = ranges.map((R) => energyForRange(R));
  const weights: number[] = [];
  for (let i = 0; i < nBeams; i++) {
    let have = 0;
    for (let j = 0; j < i; j++) have += weights[j]! * protonDoseSmeared(energies[j]!, ranges[i]! * 0.995);
    const peak = protonDoseSmeared(energies[i]!, ranges[i]! * 0.995);
    weights.push(Math.max(0, (1 - have) / peak));
  }
  const dose = (z: number) => {
    let d = 0;
    for (let i = 0; i < nBeams; i++) d += weights[i]! * protonDoseSmeared(energies[i]!, z);
    return d;
  };
  return { energies, weights, dose };
}

// ── PET ─────────────────────────────────────────────────────────────────────────────────────────

export interface Blob {
  x: number;
  y: number;
  sigma: number;
  /** Relative activity. */
  weight: number;
}

/** Sample a decay position (in units of the ring radius, inside the unit disc) from a sum of Gaussian blobs of activity, rejecting points outside radius 0.9. */
export function sampleDecay(blobs: readonly Blob[], r: Rng): { x: number; y: number } {
  const total = blobs.reduce((a, b) => a + b.weight, 0);
  for (;;) {
    let u = r() * total;
    let k = 0;
    while (k < blobs.length - 1 && u > blobs[k]!.weight) {
      u -= blobs[k]!.weight;
      k++;
    }
    const b = blobs[k]!;
    const g1 = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const g2 = Math.sqrt(-2 * Math.log(1 - r())) * Math.sin(2 * Math.PI * r());
    const x = b.x + b.sigma * g1, y = b.y + b.sigma * g2;
    if (x * x + y * y < 0.81) return { x, y };
  }
}

export interface Lor {
  /** The two detector positions as angles on the ring (radians). */
  a1: number;
  a2: number;
  /** The true decay position. */
  x: number;
  y: number;
}

/** One coincidence: the decay at (x, y), two back-to-back photons in a random direction, each landing on the unit ring, blurred by `blur` radians of detector position error. */
export function simulateLor(blobs: readonly Blob[], r: Rng, blur = 0.004): Lor {
  const { x, y } = sampleDecay(blobs, r);
  const phi = Math.PI * r();
  const dx = Math.cos(phi), dy = Math.sin(phi);
  // solve |(x,y) + t (dx,dy)| = 1
  const b = x * dx + y * dy;
  const c = x * x + y * y - 1;
  const s = Math.sqrt(b * b - c);
  const t1 = -b + s, t2 = -b - s;
  const g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const a1 = Math.atan2(y + t1 * dy, x + t1 * dx) + blur * g();
  const a2 = Math.atan2(y + t2 * dy, x + t2 * dx) + blur * g();
  return { a1, a2, x, y };
}

/** Back-project lines of response onto an n × n grid covering [−1, 1]²: every cell a line passes through gets +1 (a line is sampled every half cell). */
export function backproject(lors: readonly Lor[], n: number): Float64Array {
  const img = new Float64Array(n * n);
  const step = 1 / n; // half a cell in [−1, 1] units (cell = 2/n)
  for (const l of lors) {
    const x1 = Math.cos(l.a1), y1 = Math.sin(l.a1), x2 = Math.cos(l.a2), y2 = Math.sin(l.a2);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = Math.max(2, Math.ceil(len / step));
    let last = -1;
    for (let k = 0; k <= m; k++) {
      const t = k / m;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      const i = Math.floor(((x + 1) / 2) * n), j = Math.floor(((y + 1) / 2) * n);
      if (i < 0 || i >= n || j < 0 || j >= n) continue;
      const idx = j * n + i;
      if (idx !== last) {
        img[idx]! += 1;
        last = idx;
      }
    }
  }
  return img;
}

/** An unsharp mask (image minus a box-blurred copy, clipped at 0): a cheap stand-in for the ramp filter of filtered back-projection. */
export function sharpen(img: Float64Array, n: number, radius = 4, amount = 1): Float64Array {
  const out = new Float64Array(n * n);
  const blur = new Float64Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let dj = -radius; dj <= radius; dj++)
        for (let di = -radius; di <= radius; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || ii >= n || jj < 0 || jj >= n) continue;
          s += img[jj * n + ii]!;
          c++;
        }
      blur[j * n + i] = s / c;
    }
  for (let k = 0; k < n * n; k++) out[k] = Math.max(0, img[k]! - amount * blur[k]!);
  return out;
}
