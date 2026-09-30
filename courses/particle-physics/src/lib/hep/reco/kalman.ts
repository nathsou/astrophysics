/**
 * The Kalman filter: the generic linear measurement update and prediction, and a track fit built on them.
 *
 * **Generic filter.** For a state x with covariance P, a linear measurement z = H x + noise(R):
 *
 *     predict:  x' = F x,              P' = F P Fᵀ + Q
 *     update:   y = z − H x            (innovation)
 *               S = H P Hᵀ + R         (its covariance)
 *               K = P Hᵀ S⁻¹           (gain)
 *               x' = x + K y,   P' = (I − K H) P (I − K H)ᵀ + K R Kᵀ   (Joseph form: stays symmetric positive)
 *               χ² = yᵀ S⁻¹ y          (the measurement's contribution to the track χ²)
 *
 * **Track fit.** The state at a cylindrical layer of radius r is x = (φp, z, ψ, tanλ, c): the position on the cylinder
 * (azimuth φp and z), the azimuth ψ of the direction, tanλ and the signed curvature c (see helix.ts). A hit measures
 * (φp, z) directly, so H is constant. Propagation from one layer to the next is the exact helix intersection with
 * the next cylinder; its Jacobian F is taken by finite differences. Multiple scattering at each layer adds process
 * noise Q to ψ and tanλ (and to c, because a change in polar angle at fixed |p| changes pT): Highland's formula with
 * the layer's x/X0 and the track's path length through it. The fit runs from the outermost hit inwards, so the
 * final state is at the innermost layer, and is then converted to perigee parameters with full covariance.
 *
 * Not modelled: energy loss (the state's momentum is constant), bremsstrahlung, the change of field beyond the tracker.
 */
import type { DetectorConfig } from '../detector/index.ts';
import { hook } from '../hooks.ts';
import type { Hit } from '../event/index.ts';
import { fitTrack3D } from './fit.ts';
import { GEV_PER_TESLA_M, helixAtRadius, perigeeFromPoint, propagateToRadius, wrapPi } from './helix.ts';
import { geometryFromConfig, type RecoGeometry } from './geometry.ts';
import { highland } from './synthetic.ts';
import { identity, inverse, matAdd, matMul, matSub, matVec, transpose, vecAdd, vecSub, type Mat } from './linalg.ts';

export interface KalmanState {
  x: number[];
  P: number[][];
}

/** Prediction step: x' = F x, P' = F P Fᵀ + Q. Reference implementation; pure. */
export function kalmanPredict(state: KalmanState, F: number[][], Q: number[][]): KalmanState {
  return { x: matVec(F, state.x), P: matAdd(matMul(matMul(F, state.P), transpose(F)), Q) };
}

/**
 * Measurement update of a linear Kalman filter (see the file header). Reference for the hook `reco.kalmanUpdate`.
 * `meas.z` is the measured vector, `meas.R` its covariance, `H` the matrix that maps the state to the measurement.
 * Returns the updated state and the χ² of the innovation.
 */
export function kalmanUpdate(state: KalmanState, meas: { z: number[]; R: number[][] }, H: number[][]): { x: number[]; P: number[][]; chi2: number } {
  const Ht = transpose(H);
  const y = vecSub(meas.z, matVec(H, state.x));
  const S = matAdd(matMul(matMul(H, state.P), Ht), meas.R);
  const Sinv = inverse(S);
  const K = matMul(matMul(state.P, Ht), Sinv);
  const x = vecAdd(state.x, matVec(K, y));
  const IKH = matSub(identity(state.x.length), matMul(K, H));
  const P = matAdd(matMul(matMul(IKH, state.P), transpose(IKH)), matMul(matMul(K, meas.R), transpose(K)));
  let chi2 = 0;
  const Sy = matVec(Sinv, y);
  for (let i = 0; i < y.length; i++) chi2 += y[i]! * Sy[i]!;
  return { x, P, chi2 };
}

// ── track fit ──────────────────────────────────────────────────────────────────────────────

/** State vector indices. */
const PHI = 0, Z = 1, PSI = 2, TAN = 3, CUR = 4;
const H_MEAS: Mat = [
  [1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
];

/** Propagate a local state from the cylinder `rFrom` to `rTo` (either direction). */
export function propagateState(x: readonly number[], rFrom: number, rTo: number): number[] | undefined {
  const phi = x[PHI]!;
  const n = propagateToRadius({ x: rFrom * Math.cos(phi), y: rFrom * Math.sin(phi), z: x[Z]!, psi: x[PSI]!, tanLambda: x[TAN]!, c: x[CUR]! }, rTo);
  if (!n) return undefined;
  return [phi + wrapPi(Math.atan2(n.y, n.x) - phi), n.z, x[PSI]! + wrapPi(n.psi - x[PSI]!), x[TAN]!, x[CUR]!];
}

/** Numerical Jacobian of `propagateState`. */
export function propagationJacobian(x: readonly number[], rFrom: number, rTo: number, base?: number[]): Mat | undefined {
  const f0 = base ?? propagateState(x, rFrom, rTo);
  if (!f0) return undefined;
  const steps = [1e-7, 1e-3, 1e-7, 1e-7, Math.max(1e-3 * Math.abs(x[CUR]!), 1e-10)];
  const F: Mat = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  for (let j = 0; j < 5; j++) {
    const xp = x.slice();
    xp[j]! += steps[j]!;
    const fj = propagateState(xp, rFrom, rTo);
    if (!fj) return undefined;
    for (let i = 0; i < 5; i++) F[i]![j] = (fj[i]! - f0[i]!) / steps[j]!;
  }
  return F;
}

/** Multiple-scattering process noise added to (ψ, tanλ, c) when the track crosses `xOverX0` of material at state x. */
export function scatteringNoise(x: readonly number[], rLayer: number, xOverX0: number, bTesla: number, mass = 0.13957): Mat {
  const Q: Mat = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  if (xOverX0 <= 0) return Q;
  const t = x[TAN]!;
  const c = Math.max(Math.abs(x[CUR]!), 1e-9);
  const cosL2 = 1 / (1 + t * t);
  const cosL = Math.sqrt(cosL2);
  const cosInc = Math.abs(Math.cos(x[PSI]! - x[PHI]!));
  const path = xOverX0 / (Math.max(0.2, cosInc) * cosL);
  const pT = (GEV_PER_TESLA_M * Math.abs(bTesla)) / (1000 * c);
  const p = pT * Math.sqrt(1 + t * t);
  const th = highland(p, path, mass);
  const th2 = th * th;
  void rLayer;
  Q[PSI]![PSI] = th2 / cosL2;
  const vT = 1 + t * t;
  const vC = x[CUR]! * t;
  Q[TAN]![TAN] = th2 * vT * vT;
  Q[TAN]![CUR] = Q[CUR]![TAN] = th2 * vT * vC;
  Q[CUR]![CUR] = th2 * vC * vC;
  return Q;
}

export interface KalmanPull {
  layer: number;
  /** (measured − filtered)/σ for the transverse (r·φ) and z coordinate; ≈ N(0, 1) when the model is right. */
  rphi: number;
  z: number;
}

export interface KalmanTrackFit {
  pt: number;
  eta: number;
  /** Direction at the perigee. */
  phi: number;
  charge: number;
  d0: number;
  z0: number;
  tanLambda: number;
  /** Signed curvature in 1/mm. */
  c: number;
  chi2: number;
  ndof: number;
  /** Covariance of the perigee parameters in the order (d0, φ0, c, z0, tanλ). */
  cov: number[][];
  sigmaD0: number;
  sigmaZ0: number;
  sigmaPhi: number;
  sigmaTanLambda: number;
  /** σ(pT)/pT = σ(c)/|c|. */
  sigmaPtRel: number;
  pulls: KalmanPull[];
  nHits: number;
}

export interface KalmanFitOptions {
  /** Mass hypothesis for multiple scattering (default: pion, 0.13957 GeV). */
  mass?: number;
  /** Disable the scattering process noise (pure least squares). */
  noScattering?: boolean;
}

/** Map a local state at radius r to perigee parameters (d0, φ0, c, z0, tanλ). */
function toPerigee(x: readonly number[], r: number): number[] {
  const h = perigeeFromPoint(r * Math.cos(x[PHI]!), r * Math.sin(x[PHI]!), x[Z]!, x[PSI]!, x[TAN]!, x[CUR]!);
  return [h.d0, h.phi0, h.c, h.z0, h.tanLambda];
}

/**
 * A fixed-seed Kalman track fit: the hits are given (the pattern recognition is somebody else's job), the filter
 * runs from the outermost hit to the innermost one and the result is converted to perigee parameters with their
 * covariance. The starting point is a least-squares circle + line fit (`fitTrack3D`), with a broad prior, so the
 * result does not depend on it. Returns χ², the degrees of freedom (2 n − 5), and the filtered pulls of each hit.
 *
 * The update step goes through the hook `reco.kalmanUpdate`.
 */
export function kalmanTrackFit(hits: readonly Pick<Hit, 'layer' | 'x' | 'y' | 'z'>[], cfg: DetectorConfig | RecoGeometry, opts: KalmanFitOptions = {}): KalmanTrackFit {
  const geom = geometryFromConfig(cfg);
  if (hits.length < 3) throw new Error('kalmanTrackFit needs at least 3 hits');
  const update = hook('reco.kalmanUpdate', kalmanUpdate);
  const mass = opts.mass ?? 0.13957;
  const layerR = (h: Pick<Hit, 'layer' | 'x' | 'y'>): number => geom.layers[h.layer]?.r ?? Math.hypot(h.x, h.y);
  const sorted = [...hits].sort((a, b) => layerR(b) - layerR(a));
  // starting state at the outermost hit from a least-squares fit
  const ls = fitTrack3D(sorted.map((h) => ({ x: h.x, y: h.y, z: h.z })), geom.bField);
  const rOut = layerR(sorted[0]!);
  const p0 = helixAtRadius(ls, rOut) ?? { x: sorted[0]!.x, y: sorted[0]!.y, z: sorted[0]!.z, phi: ls.phi0 };
  let x: number[] = [Math.atan2(p0.y, p0.x), p0.z, p0.phi, ls.tanLambda, ls.c];
  const sig0 = geom.layers[sorted[0]!.layer];
  let P: Mat = [
    [(5 * (sig0?.sigmaRPhi ?? 0.05)) ** 2 / rOut ** 2, 0, 0, 0, 0],
    [0, (5 * (sig0?.sigmaZ ?? 0.5)) ** 2, 0, 0, 0],
    [0, 0, 0.05 ** 2, 0, 0],
    [0, 0, 0, (0.2 * (1 + ls.tanLambda ** 2)) ** 2, 0],
    [0, 0, 0, 0, (0.3 * Math.abs(ls.c) + 1e-6) ** 2],
  ];
  let chi2 = 0;
  let rPrev = rOut;
  const pulls: KalmanPull[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i]!;
    const r = layerR(h);
    const L = geom.layers[h.layer];
    if (i > 0 && Math.abs(r - rPrev) > 1e-9) {
      // predict to this layer; the scattering in this layer happens between the state we have and the hit
      const f0 = propagateState(x, rPrev, r);
      const F = f0 && propagationJacobian(x, rPrev, r, f0);
      if (!f0 || !F) throw new Error('kalmanTrackFit: the track does not reach layer ' + h.layer);
      const Q = opts.noScattering || !L ? identity(5).map((row) => row.map(() => 0)) : scatteringNoise(f0, r, L.xOverX0, geom.bField, mass);
      const pred = kalmanPredict({ x, P }, F, Q);
      x = pred.x;
      P = pred.P;
    }
    rPrev = r;
    let phiMeas = Math.atan2(h.y, h.x);
    phiMeas = x[PHI]! + wrapPi(phiMeas - x[PHI]!);
    const sRphi = L?.sigmaRPhi ?? 0.05;
    const sZ = L?.sigmaZ ?? 0.5;
    const Rm: Mat = [
      [(sRphi / r) ** 2, 0],
      [0, sZ * sZ],
    ];
    const upd = update({ x, P }, { z: [phiMeas, h.z], R: Rm }, H_MEAS);
    chi2 += upd.chi2;
    // filtered residual pulls: var(residual) = R − H P_f Hᵀ
    const rp = phiMeas - upd.x[PHI]!;
    const rz = h.z - upd.x[Z]!;
    const vp = Rm[0]![0]! - upd.P[PHI]![PHI]!;
    const vz = Rm[1]![1]! - upd.P[Z]![Z]!;
    pulls.push({ layer: h.layer, rphi: vp > 0 ? rp / Math.sqrt(vp) : 0, z: vz > 0 ? rz / Math.sqrt(vz) : 0 });
    x = upd.x;
    P = upd.P;
  }
  // convert to perigee parameters (d0, φ0, c, z0, tanλ)
  const par = toPerigee(x, rPrev);
  const J: Mat = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  const steps = [1e-7, 1e-3, 1e-7, 1e-7, Math.max(1e-3 * Math.abs(x[CUR]!), 1e-10)];
  for (let j = 0; j < 5; j++) {
    const xp = x.slice();
    xp[j]! += steps[j]!;
    const pj = toPerigee(xp, rPrev);
    for (let i = 0; i < 5; i++) {
      let d = pj[i]! - par[i]!;
      if (i === 1) d = wrapPi(d);
      J[i]![j] = d / steps[j]!;
    }
  }
  const cov = matMul(matMul(J, P), transpose(J));
  const c = par[2]!;
  const sign = Math.sign(geom.bField || 1);
  return {
    pt: (GEV_PER_TESLA_M * Math.abs(geom.bField)) / (1000 * Math.abs(c)),
    eta: Math.asinh(par[4]!),
    phi: par[1]!,
    charge: Math.sign(c) * sign,
    d0: par[0]!,
    z0: par[3]!,
    tanLambda: par[4]!,
    c,
    chi2,
    ndof: 2 * sorted.length - 5,
    cov,
    sigmaD0: Math.sqrt(Math.max(0, cov[0]![0]!)),
    sigmaZ0: Math.sqrt(Math.max(0, cov[3]![3]!)),
    sigmaPhi: Math.sqrt(Math.max(0, cov[1]![1]!)),
    sigmaTanLambda: Math.sqrt(Math.max(0, cov[4]![4]!)),
    sigmaPtRel: Math.sqrt(Math.max(0, cov[2]![2]!)) / Math.abs(c),
    pulls,
    nHits: sorted.length,
  };
}
