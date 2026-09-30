/**
 * Momentum resolution of a tracker, from the formulae (Gluckstern) and from a small Monte Carlo that fits circles.
 *
 * The toy tracker of Chapter 5: a uniform field B along z, `n` measuring layers at equal steps of radius out to the
 * lever arm L (the first at L/n), a track from the origin, and optionally a thin scatterer at each layer. Lengths in
 * metres in the formulae (as in the 0.3 B R rule), millimetres in the Monte Carlo.
 */
import { rng as makeRng, normal, type Rng } from '../../hep/random/index.ts';
import { circleFit } from '../../hep/reco/fit.ts';
import { hook } from '../../hep/hooks.ts';

/** The constant of the 0.3 B R rule, in GeV per (tesla metre). */
export const K03 = 0.299792458;

export interface TrackerSetup {
  /** Field in tesla. */
  B: number;
  /** Lever arm (radius of the last layer) in metres. */
  L: number;
  /** Number of measuring layers. */
  n: number;
  /** Position resolution of each layer in metres (perpendicular to the track). */
  sigma: number;
  /** Total material in the tracker, in radiation lengths, spread evenly over the layers. */
  x0: number;
}

/** σ(pT)/pT from the position resolution alone: Gluckstern's σ pT/(0.3 B L²) √(720/(N+4)), for N ≳ 10 equally spaced points. */
export function glucksternMeasurement(pT: number, s: TrackerSetup): number {
  return ((s.sigma * pT) / (K03 * s.B * s.L * s.L)) * Math.sqrt(720 / (s.n + 4));
}

/**
 * σ(pT)/pT from multiple scattering alone, for a track with velocity β: 1.2 × 0.0136 GeV/(0.3 B L β) √(x/X0).
 * The coefficient 1.2 is what the Monte Carlo below gives for a free circle fit to tracks that scatter Gaussianly with
 * the angle 13.6 MeV/(βcp) √(x/X0) per layer (the test checks it to 10 %); it does not depend on the number of layers
 * for N ≳ 10, and Gluckstern's exact treatment of a continuous scatterer gives a constant of this size.
 */
export const MS_FACTOR = 1.2;
export function glucksternScattering(pT: number, s: TrackerSetup, beta = 1): number {
  void pT;
  if (s.x0 <= 0) return 0;
  return (MS_FACTOR * 0.0136 * Math.sqrt(s.x0)) / (K03 * s.B * s.L * beta);
}

/** Both terms added in quadrature. */
export function glucksternTotal(pT: number, s: TrackerSetup, beta = 1): number {
  return Math.hypot(glucksternMeasurement(pT, s), glucksternScattering(pT, s, beta));
}

/** The transverse momentum at which the two terms are equal (the crossover between scattering- and measurement-dominated resolution). */
export function crossoverPt(s: TrackerSetup, beta = 1): number {
  const meas = glucksternMeasurement(1, s);
  const ms = glucksternScattering(1, s, beta);
  return meas > 0 ? ms / meas : Infinity;
}

/** The sagitta (m) of a track of transverse momentum pT over a chord of length `chord` (m): s = 0.3 B chord²/(8 pT). */
export function sagittaOf(pT: number, B: number, chord: number): number {
  return (K03 * B * chord * chord) / (8 * pT);
}

export interface SimulatedTrack {
  /** The measured points in mm: x and y. */
  points: { x: number; y: number; sigma: number }[];
  /** True pT (GeV) and the radius (mm). */
  pT: number;
  R: number;
}

/**
 * One track of positive charge leaving the origin at azimuth 0 (it turns clockwise, towards negative y): the points
 * at each layer, with the layer's resolution and, if the setup has material, a Gaussian scattering kick at each layer
 * (the width 13.6 MeV/(βcp) √(x/X0) of each layer: Highland's formula without its small logarithmic correction, which is not meant for such thin layers).
 */
export function simulateTrack(s: TrackerSetup, pT: number, r: Rng, opts: { scatter?: boolean; mass?: number } = {}): SimulatedTrack {
  const R = (pT / (K03 * s.B)) * 1000; // mm
  const c = 1 / R;
  const mass = opts.mass ?? 0.10566;
  const beta = pT / Math.sqrt(pT * pT + mass * mass);
  const p = pT; // the track is in the transverse plane: p = pT
  const thetaLayer = opts.scatter === false || s.x0 <= 0 ? 0 : (0.0136 / (beta * p)) * Math.sqrt(s.x0 / s.n);
  let x = 0, y = 0, psi = 0;
  const pts: { x: number; y: number; sigma: number }[] = [];
  const sigmaMm = s.sigma * 1000;
  for (let i = 1; i <= s.n; i++) {
    const rt = (s.L * 1000 * i) / s.n;
    // find the arc length s at which the circle segment from (x, y, psi) reaches radius rt (bisection; |p(s)| is increasing here)
    const at = (a: number) => ({ x: x + (Math.sin(psi) - Math.sin(psi - c * a)) / c, y: y + (Math.cos(psi - c * a) - Math.cos(psi)) / c });
    let lo = 0, hi = Math.min(3 * rt, (Math.PI * R) / 1.0);
    for (let k = 0; k < 50; k++) {
      const mid = 0.5 * (lo + hi);
      const q = at(mid);
      if (Math.hypot(q.x, q.y) < rt) lo = mid;
      else hi = mid;
    }
    const a = 0.5 * (lo + hi);
    const q = at(a);
    psi -= c * a;
    x = q.x;
    y = q.y;
    // the measured point is displaced perpendicular to the track direction
    const dn = normal(r) * sigmaMm;
    pts.push({ x: x - Math.sin(psi) * dn, y: y + Math.cos(psi) * dn, sigma: sigmaMm });
    if (thetaLayer > 0) psi += normal(r) * thetaLayer;
  }
  return { points: pts, pT, R };
}

/** pT (GeV) from a fitted radius in mm. */
export const ptFromRadiusMm = (Rmm: number, B: number): number => (K03 * B * Rmm) / 1000;

export interface ResolutionResult {
  /** pT_true / pT_fit − 1 for each track (1/pT is the Gaussian quantity). */
  deviations: number[];
  /** Half the central 68 % interval of the deviations. */
  sigma68: number;
  /** Mean deviation (bias). */
  mean: number;
  /** The fitted pT of each track. */
  fitted: number[];
  /** The analytic prediction of the same setup. */
  predicted: number;
}

/**
 * Fit `nTracks` simulated tracks with the circle fit (the hook `reco.circleFit`, so the reader's fit is used when
 * installed) and return the spread of the fitted pT. Deterministic for a given seed.
 */
export function monteCarloResolution(s: TrackerSetup, pT: number, nTracks: number, seed = 1, opts: { scatter?: boolean } = {}): ResolutionResult {
  const r = makeRng(seed);
  const fit = hook('reco.circleFit', circleFit);
  const dev: number[] = [];
  const fitted: number[] = [];
  for (let i = 0; i < nTracks; i++) {
    const t = simulateTrack(s, pT, r, opts);
    const res = fit(t.points);
    const p = ptFromRadiusMm(res.R, s.B);
    fitted.push(p);
    dev.push(pT / p - 1);
  }
  const sorted = [...dev].sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))]!;
  const sigma68 = (q(0.8413) - q(0.1587)) / 2;
  const mean = dev.reduce((a, b) => a + b, 0) / Math.max(1, dev.length);
  return { deviations: dev, sigma68, mean, fitted, predicted: glucksternTotal(pT, s) };
}
