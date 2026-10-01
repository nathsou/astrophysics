/**
 * A toy positron emission tomograph (Chapter 9), in two dimensions.
 *
 * A phantom of water (radius 10 cm) holds a radioactive tracer in a few hot regions on a uniform background. Each decay emits a positron
 * that annihilates after a short random walk (positron range, Gaussian) into two photons of 511 keV, back to back up to a small angular
 * blur (non-collinearity, Gaussian, 0.25° rms: "about half a degree FWHM" in the chapter). The photons cross water (attenuation length from
 * μ = 0.0959 cm⁻¹ at 511 keV) and are detected by a ring of crystals (radius 40 cm). A coincidence between two crystals defines a line of
 * response along which the decay lay. The image is a back-projection of those lines, or a few iterations of the expectation-maximisation
 * (ML-EM) algorithm that real scanners use. Everything is 2D: photons that leave the plane are not simulated.
 * It is a toy: no depth of interaction, no scatter, no random coincidences, no dead time.
 */
import type { Rng } from '../../hep/random/index.ts';
import { normal } from '../../hep/random/index.ts';

export const RING_R = 40; // cm
export const PHANTOM_R = 10; // cm
export const MU_WATER = 0.0959; // 1/cm at 511 keV
export const GRID = 40; // pixels per side over [−12, 12] cm
export const HALF = 12;

export interface Hot { x: number; y: number; r: number; w: number }
/** Uptake: background 1, three hot regions. */
export const PHANTOM_DEFAULT: Hot[] = [
  { x: -3.5, y: 2.5, r: 1.6, w: 6 },
  { x: 3.8, y: -2.0, r: 1.0, w: 6 },
  { x: 0.5, y: -6.0, r: 0.6, w: 6 },
];

export function activityAt(x: number, y: number, hot: readonly Hot[]): number {
  if (x * x + y * y > PHANTOM_R * PHANTOM_R) return 0;
  let a = 1;
  for (const h of hot) if ((x - h.x) ** 2 + (y - h.y) ** 2 < h.r * h.r) a = Math.max(a, h.w);
  return a;
}

export interface Lor { a: number; b: number }
export interface PetResult {
  nCrystals: number;
  emitted: number;
  coincidences: Lor[];
  /** The truth decay points of the detected coincidences (for comparison). */
  truth: [number, number][];
}

/** Path length of a ray from (x, y) in direction (ux, uy) inside the phantom circle. */
function pathInPhantom(x: number, y: number, ux: number, uy: number): number {
  const b = x * ux + y * uy;
  const c = x * x + y * y - PHANTOM_R * PHANTOM_R;
  const disc = b * b - c;
  return disc <= 0 ? 0 : -b + Math.sqrt(disc);
}

export function simulatePet(opts: { emitted: number; nCrystals?: number; rangeSigma?: number; nonCollinearityDeg?: number; hot?: Hot[]; attenuation?: boolean }, r: Rng): PetResult {
  const nC = opts.nCrystals ?? 180;
  const hot = opts.hot ?? PHANTOM_DEFAULT;
  const rangeSigma = opts.rangeSigma ?? 0.1;
  const dth = ((opts.nonCollinearityDeg ?? 0.25) * Math.PI) / 180;
  const wMax = Math.max(...hot.map((h) => h.w), 1);
  const out: PetResult = { nCrystals: nC, emitted: opts.emitted, coincidences: [], truth: [] };
  const crystal = (ang: number) => Math.floor((((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / nC));
  for (let n = 0; n < opts.emitted; n++) {
    // decay point: accept–reject against the activity map
    let x = 0, y = 0;
    do {
      x = (2 * r() - 1) * PHANTOM_R;
      y = (2 * r() - 1) * PHANTOM_R;
    } while (x * x + y * y > PHANTOM_R * PHANTOM_R || r() * wMax > activityAt(x, y, hot));
    // annihilation point
    const ax = x + normal(r, 0, rangeSigma);
    const ay = y + normal(r, 0, rangeSigma);
    const phi = 2 * Math.PI * r();
    const phi2 = phi + Math.PI + normal(r, 0, dth);
    const u1: [number, number] = [Math.cos(phi), Math.sin(phi)];
    const u2: [number, number] = [Math.cos(phi2), Math.sin(phi2)];
    if (opts.attenuation !== false) {
      const p1 = Math.exp(-MU_WATER * pathInPhantom(ax, ay, u1[0], u1[1]));
      const p2 = Math.exp(-MU_WATER * pathInPhantom(ax, ay, u2[0], u2[1]));
      if (r() > p1 * p2) continue;
    }
    // where each photon meets the ring
    const hit = (u: [number, number]): number => {
      const b = ax * u[0] + ay * u[1];
      const c = ax * ax + ay * ay - RING_R * RING_R;
      const t = -b + Math.sqrt(b * b - c);
      return crystal(Math.atan2(ay + t * u[1], ax + t * u[0]));
    };
    const ca = hit(u1), cb = hit(u2);
    if (ca === cb) continue;
    out.coincidences.push({ a: ca, b: cb });
    out.truth.push([x, y]);
  }
  return out;
}

/** The crystal centre (cm). */
export const crystalPos = (i: number, nC: number): [number, number] => {
  const a = ((i + 0.5) * 2 * Math.PI) / nC;
  return [RING_R * Math.cos(a), RING_R * Math.sin(a)];
};

/** Pixels (index, weight = path length in cm) crossed by the line between two crystals. */
export function lineOfResponse(l: Lor, nC: number): { idx: number; len: number }[] {
  const [x0, y0] = crystalPos(l.a, nC);
  const [x1, y1] = crystalPos(l.b, nC);
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const step = 0.25;
  const n = Math.ceil(L / step);
  const cells = new Map<number, number>();
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = x0 + t * dx, y = y0 + t * dy;
    if (x < -HALF || x >= HALF || y < -HALF || y >= HALF) continue;
    const ix = Math.floor(((x + HALF) / (2 * HALF)) * GRID);
    const iy = Math.floor(((y + HALF) / (2 * HALF)) * GRID);
    const idx = iy * GRID + ix;
    cells.set(idx, (cells.get(idx) ?? 0) + L / n);
  }
  return [...cells].map(([idx, len]) => ({ idx, len }));
}

/** Image from the lines of response: `iterations` = 0 is plain back-projection; more is list-mode ML-EM. Returns GRID×GRID values. */
export function reconstruct(res: PetResult, iterations: number): Float64Array {
  const lines = res.coincidences.map((l) => lineOfResponse(l, res.nCrystals));
  const img = new Float64Array(GRID * GRID).fill(1);
  const inside = new Uint8Array(GRID * GRID);
  const pix = (2 * HALF) / GRID;
  for (let iy = 0; iy < GRID; iy++) for (let ix = 0; ix < GRID; ix++) {
    const x = -HALF + (ix + 0.5) * pix, y = -HALF + (iy + 0.5) * pix;
    inside[iy * GRID + ix] = x * x + y * y <= (PHANTOM_R + 1) ** 2 ? 1 : 0;
  }
  const back = new Float64Array(GRID * GRID);
  for (const ln of lines) for (const c of ln) back[c.idx]! += c.len;
  if (iterations <= 0) return back;
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(GRID * GRID);
    for (const ln of lines) {
      let proj = 0;
      for (const c of ln) proj += c.len * img[c.idx]!;
      if (proj <= 0) continue;
      for (const c of ln) next[c.idx]! += c.len / proj;
    }
    for (let k = 0; k < img.length; k++) img[k] = inside[k] ? img[k]! * next[k]! : 0;
    // keep the total constant so that the scale is comparable across iterations
    const s = img.reduce((a, b) => a + b, 0) || 1;
    const t = lines.length;
    for (let k = 0; k < img.length; k++) img[k] = (img[k]! * t) / s;
  }
  return img;
}

/** The truth image on the same grid. */
export function truthImage(hot: readonly Hot[] = PHANTOM_DEFAULT): Float64Array {
  const img = new Float64Array(GRID * GRID);
  const pix = (2 * HALF) / GRID;
  for (let iy = 0; iy < GRID; iy++) for (let ix = 0; ix < GRID; ix++) img[iy * GRID + ix] = activityAt(-HALF + (ix + 0.5) * pix, -HALF + (iy + 0.5) * pix, hot);
  return img;
}
