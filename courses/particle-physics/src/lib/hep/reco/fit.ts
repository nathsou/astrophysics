/**
 * Track fitting without a Kalman filter: a circle in the transverse plane plus a straight line in the s–z plane.
 *
 * Reference implementations of `reco.circleFit`. The algebraic fit is the **Taubin fit** (Newton solution of its
 * characteristic polynomial, after Chernov & Lesort): like the Kåsa fit it is one closed-form computation with no
 * starting guess, but unlike Kåsa it is not biased towards small circles when the hits cover only a short arc, which
 * is exactly the case for high-pT tracks. `kasaFit` is the simpler one, kept for comparison and for the exercise.
 */
import { hook } from '../hooks.ts';
import { GEV_PER_TESLA_M, type Helix } from './helix.ts';

export interface CirclePoint {
  x: number;
  y: number;
  /** Uncertainty of the point perpendicular to the circle (same unit as x). Default 1. */
  sigma?: number;
}

export interface CircleResult {
  xc: number;
  yc: number;
  R: number;
  /** Σ ((distance to centre − R)/σ)². With the default σ = 1 it is the sum of squared residuals in mm². */
  chi2: number;
}

/** Radii above this (mm) are reported as this: the track is a straight line for all practical purposes. */
export const R_MAX = 1e9;

function weights(points: readonly CirclePoint[]): { w: Float64Array; sum: number } {
  const w = new Float64Array(points.length);
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const s = points[i]!.sigma ?? 1;
    w[i] = 1 / (s * s);
    sum += w[i]!;
  }
  return { w, sum };
}

/** χ² of a circle: Σ ((|p − c| − R)/σ)², evaluated without the large cancellation R − R for straight tracks. */
export function circleChi2(points: readonly CirclePoint[], xc: number, yc: number, R: number): number {
  let chi2 = 0;
  for (const p of points) {
    const dx = p.x - xc;
    const dy = p.y - yc;
    const d = Math.sqrt(dx * dx + dy * dy);
    // d − R = (d² − R²)/(d + R); d² − R² written in terms of the point and the centre to keep it exact
    const g = p.x * p.x + p.y * p.y - 2 * (xc * p.x + yc * p.y) + (xc * xc + yc * yc - R * R);
    const res = Math.abs(R) > 1e5 ? g / (d + R) : d - R;
    const s = p.sigma ?? 1;
    chi2 += (res / s) * (res / s);
  }
  return chi2;
}

/**
 * Fit a circle to points with the Taubin algebraic method (see the file header). Reference for the hook
 * `reco.circleFit`. Points may carry a `sigma` that weights them.
 *
 * Returns the centre, the radius and χ². For (nearly) collinear points R is very large (capped at `R_MAX`).
 */
export function circleFit(points: readonly CirclePoint[]): CircleResult {
  const n = points.length;
  if (n < 3) throw new Error('circleFit needs at least 3 points');
  const { w, sum } = weights(points);
  let xm = 0, ym = 0;
  for (let i = 0; i < n; i++) {
    xm += w[i]! * points[i]!.x;
    ym += w[i]! * points[i]!.y;
  }
  xm /= sum;
  ym /= sum;
  let Mxx = 0, Myy = 0, Mxy = 0, Mxz = 0, Myz = 0, Mzz = 0;
  for (let i = 0; i < n; i++) {
    const X = points[i]!.x - xm;
    const Y = points[i]!.y - ym;
    const Z = X * X + Y * Y;
    const wi = w[i]!;
    Mxy += wi * X * Y;
    Mxx += wi * X * X;
    Myy += wi * Y * Y;
    Mxz += wi * X * Z;
    Myz += wi * Y * Z;
    Mzz += wi * Z * Z;
  }
  Mxx /= sum; Myy /= sum; Mxy /= sum; Mxz /= sum; Myz /= sum; Mzz /= sum;
  const Mz = Mxx + Myy;
  const covXY = Mxx * Myy - Mxy * Mxy;
  const varZ = Mzz - Mz * Mz;
  const A3 = 4 * Mz;
  const A2 = -3 * Mz * Mz - Mzz;
  const A1 = varZ * Mz + 4 * covXY * Mz - Mxz * Mxz - Myz * Myz;
  const A0 = Mxz * (Mxz * Myy - Myz * Mxy) + Myz * (Myz * Mxx - Mxz * Mxy) - varZ * covXY;
  const A22 = A2 + A2;
  const A33 = A3 + A3 + A3;
  // Newton iterations for the smallest non-negative root of the characteristic polynomial, started at 0
  let x = 0;
  let y = A0;
  for (let it = 0; it < 99; it++) {
    const Dy = A1 + x * (A22 + A33 * x);
    const xNew = x - y / Dy;
    if (xNew === x || !Number.isFinite(xNew)) break;
    const yNew = A0 + xNew * (A1 + xNew * (A2 + xNew * A3));
    if (Math.abs(yNew) >= Math.abs(y)) break;
    x = xNew;
    y = yNew;
  }
  const det = x * x - x * Mz + covXY;
  let Xc = (Mxz * (Myy - x) - Myz * Mxy) / det / 2;
  let Yc = (Myz * (Mxx - x) - Mxz * Mxy) / det / 2;
  let R = Math.sqrt(Xc * Xc + Yc * Yc + Mz - 2 * x);
  if (!Number.isFinite(R) || R > R_MAX) {
    // collinear within rounding: a line through the centroid along the principal axis, with a huge circle
    const theta = 0.5 * Math.atan2(2 * Mxy, Mxx - Myy);
    const nx = -Math.sin(theta);
    const ny = Math.cos(theta);
    R = R_MAX;
    Xc = nx * R;
    Yc = ny * R;
  }
  const xc = Xc + xm;
  const yc = Yc + ym;
  return { xc, yc, R, chi2: circleChi2(points, xc, yc, R) };
}

/**
 * The Kåsa fit: minimise Σ (x² + y² + D x + E y + F)², a linear least-squares problem. Fast and simple, but biased
 * towards circles that are too small when the points cover a short arc.
 */
export function kasaFit(points: readonly CirclePoint[]): CircleResult {
  const n = points.length;
  if (n < 3) throw new Error('kasaFit needs at least 3 points');
  const { w, sum } = weights(points);
  let xm = 0, ym = 0;
  for (let i = 0; i < n; i++) {
    xm += w[i]! * points[i]!.x;
    ym += w[i]! * points[i]!.y;
  }
  xm /= sum;
  ym /= sum;
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (let i = 0; i < n; i++) {
    const u = points[i]!.x - xm;
    const v = points[i]!.y - ym;
    const wi = w[i]!;
    Suu += wi * u * u;
    Svv += wi * v * v;
    Suv += wi * u * v;
    Suuu += wi * u * u * u;
    Svvv += wi * v * v * v;
    Suvv += wi * u * v * v;
    Svuu += wi * v * u * u;
  }
  // normal equations: Suu uc + Suv vc = (Suuu + Suvv)/2 ; Suv uc + Svv vc = (Svvv + Svuu)/2
  const det = Suu * Svv - Suv * Suv;
  const b1 = (Suuu + Suvv) / 2;
  const b2 = (Svvv + Svuu) / 2;
  const uc = (b1 * Svv - b2 * Suv) / det;
  const vc = (b2 * Suu - b1 * Suv) / det;
  let R = Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / sum);
  let xc = uc + xm;
  let yc = vc + ym;
  if (!Number.isFinite(R) || R > R_MAX) {
    R = R_MAX;
    xc = xm;
    yc = ym + R_MAX;
  }
  return { xc, yc, R, chi2: circleChi2(points, xc, yc, R) };
}

export { ptFromRadius, radiusFromPt } from './helix.ts';

// ── 3D fit ──────────────────────────────────────────────────────────────────────────────────

/** A space point with its uncertainties: sxy across the track in the transverse plane, sz along z. */
export interface FitPoint {
  x: number;
  y: number;
  z: number;
  sxy?: number;
  sz?: number;
}

export interface HelixFit extends Helix {
  pt: number;
  eta: number;
  /** Direction at the perigee (same as `phi0`). */
  phi: number;
  charge: number;
  chi2: number;
  ndof: number;
  chi2xy: number;
  chi2z: number;
  /** Circle of the transverse projection. */
  circle: { xc: number; yc: number; R: number };
  /** Uncertainties of z0 and tanλ from the line fit (hit resolution only) and their correlation term. */
  sigmaZ0: number;
  sigmaTanLambda: number;
  covZ0TanLambda: number;
  /** Residuals per point (input order): signed distance from the circle (mm) and z − z_fit (mm). */
  resT: number[];
  resZ: number[];
}

/**
 * A three-dimensional track fit: a circle in the transverse plane (through the hook `reco.circleFit`) and a
 * least-squares line z = z0 + tanλ·s in the plane of arc length s versus z. `points` are hits, ordered or not;
 * the innermost and outermost hits fix the sense of rotation and hence the charge (for tracks that start near the
 * beam line). The field `bTesla` is along +z.
 *
 * The transverse radius of the circle gives pT = 0.2998 B R; the charge follows from the sense of rotation (a
 * positive particle turns clockwise seen from +z); d0 and φ0 from the point of closest approach to the origin; z0 and
 * tanλ from the line. Requires at least 3 points.
 */
export function fitTrack3D(points: readonly FitPoint[], bTesla: number): HelixFit {
  const n = points.length;
  if (n < 3) throw new Error('fitTrack3D needs at least 3 points');
  const fit = hook('reco.circleFit', circleFit);
  const cpts: CirclePoint[] = points.map((p) => ({ x: p.x, y: p.y, sigma: p.sxy ?? 1 }));
  const circ = fit(cpts);
  const { xc, yc } = circ;
  const Rr = circ.R;
  // innermost and outermost hit
  let iMin = 0, iMax = 0, rMin = Infinity, rMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const r2 = points[i]!.x ** 2 + points[i]!.y ** 2;
    if (r2 < rMin) { rMin = r2; iMin = i; }
    if (r2 > rMax) { rMax = r2; iMax = i; }
  }
  const p1 = points[iMin]!;
  const p2 = points[iMax]!;
  const cross = (p1.x - xc) * (p2.y - yc) - (p1.y - yc) * (p2.x - xc);
  // counter-clockwise (cross > 0) means a negative particle for B > 0
  const sense = cross > 0 ? -1 : 1; // sign of the signed curvature c
  const charge = sense * Math.sign(bTesla || 1);
  const cSigned = sense / Rr;
  // point of closest approach: on the ray from the centre through the origin
  const dC = Math.hypot(xc, yc);
  const ux = dC > 0 ? xc / dC : 1;
  const uy = dC > 0 ? yc / dC : 0;
  const px = xc - Rr * ux;
  const py = yc - Rr * uy;
  const rx = -Rr * ux;
  const ry = -Rr * uy;
  const dirx = sense > 0 ? ry / Rr : -ry / Rr;
  const diry = sense > 0 ? -rx / Rr : rx / Rr;
  const phi0 = Math.atan2(diry, dirx);
  const d0 = dirx * py - diry * px;
  // arc length of each hit from the perigee, from the chord
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dx = points[i]!.x - px;
    const dy = points[i]!.y - py;
    const chord = Math.hypot(dx, dy);
    const half = Math.min(1, chord / (2 * Rr));
    const arc = 2 * Rr * Math.asin(half);
    s[i] = dx * dirx + dy * diry < 0 ? -arc : arc;
  }
  // line fit z = z0 + t s
  let Sw = 0, Ss = 0, Sss = 0, Sz = 0, Ssz = 0;
  for (let i = 0; i < n; i++) {
    const sz = points[i]!.sz ?? 1;
    const wi = 1 / (sz * sz);
    Sw += wi;
    Ss += wi * s[i]!;
    Sss += wi * s[i]! * s[i]!;
    Sz += wi * points[i]!.z;
    Ssz += wi * s[i]! * points[i]!.z;
  }
  const D = Sw * Sss - Ss * Ss;
  const tanL = (Sw * Ssz - Ss * Sz) / D;
  const z0 = (Sss * Sz - Ss * Ssz) / D;
  let chi2z = 0;
  const resZ: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = points[i]!.z - (z0 + tanL * s[i]!);
    resZ[i] = r;
    const sz = points[i]!.sz ?? 1;
    chi2z += (r / sz) ** 2;
  }
  const resT: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const dx = points[i]!.x - xc;
    const dy = points[i]!.y - yc;
    const d = Math.sqrt(dx * dx + dy * dy);
    const g = points[i]!.x ** 2 + points[i]!.y ** 2 - 2 * (xc * points[i]!.x + yc * points[i]!.y) + (xc * xc + yc * yc - Rr * Rr);
    resT[i] = Rr > 1e5 ? g / (d + Rr) : d - Rr;
  }
  const ndof = 2 * n - 5;
  return {
    d0,
    z0,
    phi0,
    tanLambda: tanL,
    c: cSigned,
    pt: (GEV_PER_TESLA_M * Math.abs(bTesla) * Rr) / 1000,
    eta: Math.asinh(tanL),
    phi: phi0,
    charge,
    chi2: circ.chi2 + chi2z,
    ndof,
    chi2xy: circ.chi2,
    chi2z,
    circle: { xc, yc, R: Rr },
    sigmaZ0: Math.sqrt(Sss / D),
    sigmaTanLambda: Math.sqrt(Sw / D),
    covZ0TanLambda: -Ss / D,
    resT,
    resZ,
  };
}
