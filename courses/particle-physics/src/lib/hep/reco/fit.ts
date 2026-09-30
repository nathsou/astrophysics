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
import { highland } from './material.ts';

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
 * The Taubin fit on flat arrays: points (xs[i], ys[i]) with weights ws[i] (1/σ²), i < n. Writes (xc, yc, R) into `out`.
 * No allocation: used inside the track finder's loops; `circleFit` is the same computation with objects in and out.
 */
export function taubinFlat(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number> | null, n: number, out: Float64Array | number[]): void {
  let sum = 0, xm = 0, ym = 0;
  for (let i = 0; i < n; i++) {
    const w = ws ? ws[i]! : 1;
    sum += w;
    xm += w * xs[i]!;
    ym += w * ys[i]!;
  }
  xm /= sum;
  ym /= sum;
  let Mxx = 0, Myy = 0, Mxy = 0, Mxz = 0, Myz = 0, Mzz = 0;
  for (let i = 0; i < n; i++) {
    const X = xs[i]! - xm;
    const Y = ys[i]! - ym;
    const Z = X * X + Y * Y;
    const wi = ws ? ws[i]! : 1;
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
    R = R_MAX;
    Xc = -Math.sin(theta) * R;
    Yc = Math.cos(theta) * R;
  }
  out[0] = Xc + xm;
  out[1] = Yc + ym;
  out[2] = R;
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
  const xs = new Float64Array(n), ys = new Float64Array(n), ws = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    xs[i] = p.x;
    ys[i] = p.y;
    const s = p.sigma ?? 1;
    ws[i] = 1 / (s * s);
  }
  const out = new Float64Array(3);
  taubinFlat(xs, ys, ws, n, out);
  const [xc, yc, R] = out as unknown as [number, number, number];
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
  /** Material the track crosses at this point, in radiation lengths at normal incidence (used when `scattering` is on). */
  x0?: number;
}

export interface FitOptions {
  /**
   * Include multiple scattering: the hits' uncertainties become a full covariance matrix (hit resolution plus the
   * correlated displacements that scattering in the layers inside produces), and the parameters are the generalised
   * least-squares (best linear unbiased) estimate. The scattering uses Highland's formula at the pT of a first fit.
   */
  scattering?: boolean;
  /** Mass (GeV) for the scattering's β (default: pion). */
  mass?: number;
  /** Number of passes of the scattering fit; the scattering is evaluated at the pT of the previous pass (default 1). */
  passes?: number;
  /** Also compute the parameter covariance without scattering (hit resolution only). Default false (saves time). */
  covariance?: boolean;
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
  /** Covariance of (d0, φ0, c) and of (z0, tanλ) from the fit (only with `scattering`; otherwise from hit resolution alone). */
  covT: number[][];
  covZ: number[][];
}

/** Reusable work arrays for the fits (single-threaded, not re-entrant). */
let scrN = 0;
let scrC = new Float64Array(0);
let scrY = new Float64Array(0);
function ensureScratch(n: number): void {
  if (n > scrN) {
    scrN = Math.max(n, 16);
    scrC = new Float64Array(scrN * scrN);
    scrY = new Float64Array(scrN * 4);
  }
}

/**
 * Generalised least squares for a small linear model e ≈ H δ with data covariance C (n × n, row-major, overwritten by its
 * Cholesky factor), by whitening: C = L Lᵀ, y = L⁻¹ e, G = L⁻¹ H, δ = (GᵀG)⁻¹ Gᵀ y, χ² = yᵀy − Gᵀy·δ, cov(δ) = (GᵀG)⁻¹.
 * H is n × m (row-major), m ≤ 3. `fitted` is H δ.
 */
export function generalisedLeastSquares(n: number, m: number, C: Float64Array, H: Float64Array, e: Float64Array): { delta: number[]; cov: number[][]; chi2: number; fitted: Float64Array } {
  const L = C;
  for (let j = 0; j < n; j++) {
    const rj = j * n;
    let d = L[rj + j]!;
    for (let k = 0; k < j; k++) d -= L[rj + k]! * L[rj + k]!;
    const dj = Math.sqrt(d > 1e-300 ? d : 1e-300);
    L[rj + j] = dj;
    const inv = 1 / dj;
    for (let i = j + 1; i < n; i++) {
      const ri = i * n;
      let v = L[ri + j]!;
      for (let k = 0; k < j; k++) v -= L[ri + k]! * L[rj + k]!;
      L[ri + j] = v * inv;
    }
  }
  const cols = m + 1;
  const Y = n * cols <= scrY.length ? scrY : new Float64Array(n * cols);
  for (let i = 0; i < n; i++) {
    const ri = i * n;
    const inv = 1 / L[ri + i]!;
    for (let c = 0; c < cols; c++) {
      let v = c < m ? H[i * m + c]! : e[i]!;
      for (let k = 0; k < i; k++) v -= L[ri + k]! * Y[k * cols + c]!;
      Y[i * cols + c] = v * inv;
    }
  }
  const N: number[][] = m === 2 ? [[0, 0], [0, 0]] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const b = m === 2 ? [0, 0] : [0, 0, 0];
  let yy = 0;
  for (let i = 0; i < n; i++) {
    const yi = Y[i * cols + m]!;
    for (let a = 0; a < m; a++) {
      const ya = Y[i * cols + a]!;
      for (let c = a; c < m; c++) N[a]![c]! += ya * Y[i * cols + c]!;
      b[a]! += ya * yi;
    }
    yy += yi * yi;
  }
  for (let a = 0; a < m; a++) for (let c = 0; c < a; c++) N[a]![c] = N[c]![a]!;
  const cov = inverseSmall(N, m);
  const delta = cov.map((row) => {
    let v = 0;
    for (let k = 0; k < m; k++) v += row[k]! * b[k]!;
    return v;
  });
  let chi2 = yy;
  for (let a = 0; a < m; a++) chi2 -= b[a]! * delta[a]!;
  const fitted = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let a = 0; a < m; a++) v += H[i * m + a]! * delta[a]!;
    fitted[i] = v;
  }
  return { delta, cov, chi2: chi2 > 0 ? chi2 : 0, fitted };
}

/** Inverse of a symmetric 2×2 or 3×3 matrix by cofactors. */
function inverseSmall(N: number[][], m: number): number[][] {
  if (m === 2) {
    const d = N[0]![0]! * N[1]![1]! - N[0]![1]! * N[1]![0]!;
    return [
      [N[1]![1]! / d, -N[0]![1]! / d],
      [-N[1]![0]! / d, N[0]![0]! / d],
    ];
  }
  const a = N[0]![0]!, b = N[0]![1]!, c = N[0]![2]!, d = N[1]![1]!, e = N[1]![2]!, f = N[2]![2]!;
  const c00 = d * f - e * e, c01 = c * e - b * f, c02 = b * e - c * d;
  const c11 = a * f - c * c, c12 = b * c - a * e, c22 = a * d - b * b;
  const det = a * c00 + b * c01 + c * c02;
  return [
    [c00 / det, c01 / det, c02 / det],
    [c01 / det, c11 / det, c12 / det],
    [c02 / det, c12 / det, c22 / det],
  ];
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
 *
 * With `scattering` the circle is then corrected by a generalised least-squares step on the hits' residuals, with the
 * covariance of hit resolution and multiple scattering (see `FitOptions`); the returned χ², covariance and residuals
 * are those of that step.
 */
export function fitTrack3D(points: readonly FitPoint[], bTesla: number, opts: FitOptions = {}): HelixFit {
  const n = points.length;
  if (n < 3) throw new Error('fitTrack3D needs at least 3 points');
  ensureScratch(n);
  const fit = hook('reco.circleFit', circleFit);
  let xc: number, yc: number, Rr: number;
  if (fit === circleFit) {
    // the reference fit, without building objects
    const xs = new Float64Array(n), ys = new Float64Array(n), ws = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      xs[i] = p.x;
      ys[i] = p.y;
      const sg = p.sxy ?? 1;
      ws[i] = 1 / (sg * sg);
    }
    const out = new Float64Array(3);
    taubinFlat(xs, ys, ws, n, out);
    xc = out[0]!;
    yc = out[1]!;
    Rr = out[2]!;
  } else {
    const circ = fit(points.map((p) => ({ x: p.x, y: p.y, sigma: p.sxy ?? 1 })));
    xc = circ.xc;
    yc = circ.yc;
    Rr = circ.R;
  }
  // innermost and outermost hit
  let iMin = 0, iMax = 0, rMin = Infinity, rMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const r2 = p.x * p.x + p.y * p.y;
    if (r2 < rMin) { rMin = r2; iMin = i; }
    if (r2 > rMax) { rMax = r2; iMax = i; }
  }
  const p1 = points[iMin]!;
  const p2 = points[iMax]!;
  const cross = (p1.x - xc) * (p2.y - yc) - (p1.y - yc) * (p2.x - xc);
  // counter-clockwise (cross > 0) means a negative particle for B > 0
  const sense = cross > 0 ? -1 : 1; // sign of the signed curvature c
  const charge = sense * Math.sign(bTesla || 1);
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
  let phi0 = Math.atan2(diry, dirx);
  let d0 = dirx * py - diry * px;
  // arc length of each hit from the perigee (from the chord) and residuals from the circle, positive to the left of the motion
  const s = new Float64Array(n);
  const eT = new Float64Array(n);
  const R2 = Rr * Rr;
  const invTwoR = 1 / (2 * Rr);
  for (let i = 0; i < n; i++) {
    const pt = points[i]!;
    const dx = pt.x - px;
    const dy = pt.y - py;
    const chord = Math.sqrt(dx * dx + dy * dy);
    const half = Math.min(1, chord * invTwoR);
    const arc = 2 * Rr * Math.asin(half);
    s[i] = dx * dirx + dy * diry < 0 ? -arc : arc;
    const cx = pt.x - xc;
    const cy = pt.y - yc;
    const d = Math.sqrt(cx * cx + cy * cy);
    const g = pt.x * pt.x + pt.y * pt.y - 2 * (xc * pt.x + yc * pt.y) + (xc * xc + yc * yc - R2);
    eT[i] = sense * (Rr > 1e5 ? g / (d + Rr) : d - Rr);
  }
  let cSigned = sense / Rr;
  // first line fit z = z0 + t s
  let Sw = 0, Ss = 0, Sss = 0, Sz = 0, Ssz = 0;
  for (let i = 0; i < n; i++) {
    const sz = points[i]!.sz ?? 1;
    const wi = 1 / (sz * sz);
    const si = s[i]!, zi = points[i]!.z;
    Sw += wi;
    Ss += wi * si;
    Sss += wi * si * si;
    Sz += wi * zi;
    Ssz += wi * si * zi;
  }
  const D = Sw * Sss - Ss * Ss;
  let tanL = (Sw * Ssz - Ss * Sz) / D;
  let z0 = (Sss * Sz - Ss * Ssz) / D;
  let covT: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let covZ: number[][] = [[Sss / D, -Ss / D], [-Ss / D, Sw / D]];
  let chi2xy = 0;
  let chi2z = 0;
  const resT: number[] = new Array(n);
  const resZ: number[] = new Array(n);

  if (opts.scattering) {
    const mass = opts.mass ?? 0.13957;
    // order by arc length (insertion sort: n is small)
    const order = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      let j = i;
      while (j > 0 && s[order[j - 1]!]! > s[i]!) {
        order[j] = order[j - 1]!;
        j--;
      }
      order[j] = i;
    }
    const nPass = opts.passes ?? 1;
    for (let pass = 0; pass < nPass; pass++) {
      const pT = (GEV_PER_TESLA_M * Math.abs(bTesla)) / (1000 * Math.max(Math.abs(cSigned), 1e-12));
      const cosLam = 1 / Math.sqrt(1 + tanL * tanL);
      const p = pT / cosLam;
      const invCos2 = 1 + tanL * tanL; // 1/cos²λ
      // scattering angle in the polar direction at each point (in arc-length order); θ_T² = θ²/cos²λ
      const th2 = new Float64Array(n);
      const sOrd = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const pt = points[order[k]!]!;
        const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
        const cosInc = Math.sqrt(Math.max(0.04, 1 - (r * Math.abs(cSigned) * 0.5) ** 2));
        const th = highland(p, (pt.x0 ?? 0) / (cosInc * cosLam), mass);
        th2[k] = th * th;
        sOrd[k] = s[order[k]!]!;
      }
      const CT = new Float64Array(n * n), CZ = new Float64Array(n * n);
      const HT = new Float64Array(n * 3), HZ = new Float64Array(n * 2);
      const eTs = new Float64Array(n), zs = new Float64Array(n);
      const t2 = invCos2 * invCos2;
      for (let a = 0; a < n; a++) {
        const sa = sOrd[a]!;
        const ra = a * n;
        for (let b = 0; b <= a; b++) {
          const sb = sOrd[b]!;
          let m2 = 0;
          for (let j = 0; j < b; j++) {
            const sj = sOrd[j]!;
            m2 += th2[j]! * (sa - sj) * (sb - sj);
          }
          CT[ra + b] = CT[b * n + a] = m2 * invCos2;
          CZ[ra + b] = CZ[b * n + a] = m2 * t2;
        }
        const pt = points[order[a]!]!;
        const sxy = pt.sxy ?? 1;
        const sz = pt.sz ?? 1;
        CT[ra + a]! += sxy * sxy;
        CZ[ra + a]! += sz * sz;
        HT[a * 3] = 1;
        HT[a * 3 + 1] = sa;
        HT[a * 3 + 2] = -0.5 * sa * sa;
        HZ[a * 2] = 1;
        HZ[a * 2 + 1] = sa;
        eTs[a] = eT[order[a]!]!;
        zs[a] = pt.z;
      }
      const gT = generalisedLeastSquares(n, 3, CT, HT, eTs);
      const gZ = generalisedLeastSquares(n, 2, CZ, HZ, zs);
      covT = gT.cov;
      covZ = gZ.cov;
      chi2xy = gT.chi2;
      chi2z = gZ.chi2;
      for (let k = 0; k < n; k++) {
        const i = order[k]!;
        resT[i] = eTs[k]! - gT.fitted[k]!;
        resZ[i] = zs[k]! - gZ.fitted[k]!;
      }
      // apply the corrections to the circle parameters; a further pass works on the residuals left over
      d0 += gT.delta[0]!;
      phi0 += gT.delta[1]!;
      cSigned += gT.delta[2]!;
      if (cSigned * sense <= 0) cSigned = sense * 1e-9;
      tanL = gZ.delta[1]!;
      z0 = gZ.delta[0]!;
      if (pass + 1 < nPass) for (let k = 0; k < n; k++) eT[order[k]!] = eT[order[k]!]! - gT.fitted[k]!;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const r = points[i]!.z - (z0 + tanL * s[i]!);
      resZ[i] = r;
      const sz = points[i]!.sz ?? 1;
      chi2z += (r / sz) * (r / sz);
      const rt = sense * eT[i]!;
      resT[i] = rt;
      const sg = points[i]!.sxy ?? 1;
      chi2xy += (rt / sg) * (rt / sg);
    }
    if (opts.covariance) {
      // transverse: covariance of (d0, φ0, c) from the hit resolution alone
      const H = new Float64Array(n * 3);
      const CT = new Float64Array(n * n);
      const e0 = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        H[i * 3] = 1;
        H[i * 3 + 1] = s[i]!;
        H[i * 3 + 2] = -0.5 * s[i]! * s[i]!;
        CT[i * n + i] = (points[i]!.sxy ?? 1) ** 2;
      }
      try {
        covT = generalisedLeastSquares(n, 3, CT, H, e0).cov;
      } catch {
        /* keep zeros */
      }
    }
  }
  const ndof = 2 * n - 5;
  const cAbs = Math.max(Math.abs(cSigned), 1e-12);
  const Rfinal = 1 / cAbs;
  return {
    d0,
    z0,
    phi0,
    tanLambda: tanL,
    c: cSigned,
    pt: (GEV_PER_TESLA_M * Math.abs(bTesla) * Math.min(Rfinal, R_MAX)) / 1000,
    eta: Math.asinh(tanL),
    phi: phi0,
    charge,
    chi2: chi2xy + chi2z,
    ndof,
    chi2xy,
    chi2z,
    circle: { xc, yc, R: Rr },
    sigmaZ0: Math.sqrt(Math.max(0, covZ[0]![0]!)),
    sigmaTanLambda: Math.sqrt(Math.max(0, covZ[1]![1]!)),
    covZ0TanLambda: covZ[0]![1]!,
    resT,
    resZ,
    covT,
    covZ,
  };
}
