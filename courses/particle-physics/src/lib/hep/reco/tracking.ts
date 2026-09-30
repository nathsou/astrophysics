/**
 * Track finding: from a list of hits to a list of tracks.
 *
 * 1. **Seeding.** Every triplet of hits in three of the four innermost layers that is compatible with a helix from
 *    the luminous region with pT above `ptMin` is a seed. Compatibility is tested in steps so that almost all wrong
 *    combinations are rejected after two hits: the φ and z windows of the second and third hit follow from the
 *    allowed curvature and impact parameter. Hits are binned in φ per layer, so a window is a few bin lookups.
 *    (Alternatively the seeds are the peaks of the Hough transform in the transverse plane, `seeding: 'hough'`.)
 * 2. **Extension.** From each seed the circle is followed outwards layer by layer: intersect the current circle with the
 *    layer's cylinder, take the compatible hit nearest to the prediction inside a road whose width combines the hit
 *    resolution and the expected multiple scattering, refit, continue. (`extension: 'kalman'` replaces this with a
 *    combinatorial Kalman filter that keeps several candidates.)
 * 3. **Fit and quality.** Each candidate is fitted (circle + line, scattering included in the uncertainties) and cut on
 *    hit count, χ², pT, d0 and z0.
 * 4. **Ambiguity resolution.** Candidates are ranked by number of hits and χ²; a candidate that shares more than
 *    `maxSharedHits` hits with an accepted track is dropped. Seeds use the combinations of layers in turn; hits of
 *    accepted tracks are not reused by later seeds.
 *
 * Barrel layers only (cylinders). Hits are identified by their index in the input list, which is what `Track.hits` holds.
 */
import type { DetectorConfig } from '../detector/index.ts';
import { hook } from '../hooks.ts';
import type { Hit } from '../event/index.ts';
import { resolveConfig, type RecoConfig } from './config.ts';
import { fitTrack3D, type FitPoint, type HelixFit } from './fit.ts';
import { geometryFromConfig, type RecoGeometry } from './geometry.ts';
import { GEV_PER_TESLA_M, helixAtRadius, radiusFromPt } from './helix.ts';
import { houghTransform } from './hough.ts';
import { highland } from './material.ts';
import type { RecoTrack } from './types.ts';

const TWO_PI = 2 * Math.PI;

// ── hit index ─────────────────────────────────────────────────────────────────────────────────

/** The hits of one layer on a grid in (z, φ): a window query reads a few cells instead of the whole layer. */
interface LayerGrid {
  nb: number;
  nz: number;
  zMin: number;
  invDz: number;
  start: Int32Array;
  ids: Int32Array;
}
export interface HitIndex {
  n: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  r: Float64Array;
  phi: Float64Array;
  layer: Int16Array;
  used: Uint8Array;
  grids: LayerGrid[];
}

/** Read the hits into flat arrays. The grids are built by `buildGrids`. */
export function buildHitIndex(hits: readonly Hit[], geom: RecoGeometry): HitIndex {
  const n = hits.length;
  const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n), r = new Float64Array(n), phi = new Float64Array(n);
  const layer = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const h = hits[i]!;
    x[i] = h.x;
    y[i] = h.y;
    z[i] = h.z;
    r[i] = Math.hypot(h.x, h.y);
    phi[i] = Math.atan2(h.y, h.x);
    layer[i] = geom.layerMap ? (geom.layerMap[h.layer] ?? -1) : h.layer;
  }
  const idx: HitIndex = { n, x, y, z, r, phi, layer, used: new Uint8Array(n), grids: [] };
  buildGrids(idx, geom);
  return idx;
}

/** (Re)build the per-layer grids from the hits not yet used by an accepted track. */
export function buildGrids(idx: HitIndex, geom: RecoGeometry, onlyLayers = geom.layers.length): void {
  const nLayers = geom.layers.length;
  const counts = new Int32Array(nLayers);
  for (let i = 0; i < idx.n; i++) if (!idx.used[i] && idx.layer[i]! >= 0 && idx.layer[i]! < nLayers) counts[idx.layer[i]!]!++;
  const grids: LayerGrid[] = onlyLayers < nLayers ? idx.grids.slice() : [];
  for (let l = 0; l < onlyLayers; l++) {
    const cnt = counts[l]!;
    const nz = cnt < 64 ? 1 : 16;
    const nb = Math.max(4, Math.min(512, 1 << Math.round(Math.log2(Math.max(4, cnt / nz)))));
    const zHalf = Math.min(geom.zMax, geom.layers[l]!.r * Math.sinh(geom.etaMax + 0.4)) || 1;
    const invDz = nz / (2 * zHalf);
    const cell = (i: number): number => {
      const bz = nz === 1 ? 0 : Math.min(nz - 1, Math.max(0, Math.floor((idx.z[i]! + zHalf) * invDz)));
      const bp = Math.min(nb - 1, Math.floor(((idx.phi[i]! + Math.PI) / TWO_PI) * nb));
      return bz * nb + bp;
    };
    const start = new Int32Array(nb * nz + 1);
    for (let i = 0; i < idx.n; i++) if (!idx.used[i] && idx.layer[i] === l) start[cell(i) + 1]!++;
    for (let c = 0; c < nb * nz; c++) start[c + 1]! += start[c]!;
    const fill = start.slice(0, nb * nz);
    const ids = new Int32Array(cnt);
    for (let i = 0; i < idx.n; i++) if (!idx.used[i] && idx.layer[i] === l) ids[fill[cell(i)]!++] = i;
    grids[l] = { nb, nz, zMin: -zHalf, invDz, start, ids };
  }
  idx.grids = grids;
}

/**
 * Write into `out` the hits of layer l whose grid cell overlaps |φ − phi| ≤ w and zLo ≤ z ≤ zHi (a superset of the window:
 * the caller makes the exact test). Returns how many.
 */
function collect(idx: HitIndex, l: number, phi: number, w: number, zLo: number, zHi: number, out: Int32Array): number {
  const G = idx.grids[l]!;
  if (G.ids.length === 0) return 0;
  const nb = G.nb;
  let bz0 = 0, bz1 = 0;
  if (G.nz > 1) {
    bz0 = Math.max(0, Math.floor((zLo - G.zMin) * G.invDz));
    bz1 = Math.min(G.nz - 1, Math.floor((zHi - G.zMin) * G.invDz));
  }
  let b0: number, b1: number;
  if (w >= Math.PI) {
    b0 = 0;
    b1 = nb - 1;
  } else {
    b0 = Math.floor(((phi - w + Math.PI) / TWO_PI) * nb);
    b1 = Math.floor(((phi + w + Math.PI) / TWO_PI) * nb);
  }
  let m = 0;
  for (let bz = bz0; bz <= bz1; bz++) {
    const row = bz * nb;
    for (let b = b0; b <= b1; b++) {
      const bb = b < 0 ? b + nb : b >= nb ? b - nb : b;
      const cell = row + bb;
      for (let k = G.start[cell]!; k < G.start[cell + 1]!; k++) out[m++] = G.ids[k]!;
    }
  }
  return m;
}

function wrap(a: number): number {
  while (a > Math.PI) a -= TWO_PI;
  while (a <= -Math.PI) a += TWO_PI;
  return a;
}

// ── scattering-aware road widths ─────────────────────────────────────────────────────────────────

/** Per-geometry constants for road widths and effective hit uncertainties. */
export interface RoadModel {
  /** Q[l]: quadrature sum over inner layers j of θ̂_j (r_l − r_j), with θ̂ the scattering angle at p = 1 GeV. */
  Q: Float64Array;
}
const roadCache = new WeakMap<RecoGeometry, RoadModel>();
export function roadModel(geom: RecoGeometry): RoadModel {
  const hit = roadCache.get(geom);
  if (hit) return hit;
  const n = geom.layers.length;
  const Q = new Float64Array(n);
  for (let l = 0; l < n; l++) {
    let s = 0;
    for (let j = 0; j < l; j++) {
      const th = highland(1, geom.layers[j]!.xOverX0);
      const d = geom.layers[l]!.r - geom.layers[j]!.r;
      s += (th * d) ** 2;
    }
    Q[l] = Math.sqrt(s);
  }
  const m = { Q };
  roadCache.set(geom, m);
  return m;
}

/**
 * The fraction of the quadrature sum of scattering displacements that remains as a residual against a fitted curve
 * (calibrated on simulation: the fit absorbs most of a smooth displacement).
 */
const MS_RESIDUAL = 0.3;

/** Expected rms residual of a hit at layer l from the best-fit helix: hit resolution and scattering. */
export function effectiveSigma(geom: RecoGeometry, rm: RoadModel, l: number, pt: number, eta: number): { t: number; z: number } {
  const ch = Math.cosh(eta);
  const p = pt * ch;
  const ms = (MS_RESIDUAL * rm.Q[l]! * Math.sqrt(ch)) / p;
  const L = geom.layers[l]!;
  return { t: Math.hypot(L.sigmaRPhi, ms), z: Math.hypot(L.sigmaZ, ms * ch * ch) };
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────

/** Circle through three points; null if they are collinear to within rounding. */
export function circleThrough(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): { xc: number; yc: number; R: number } | null {
  const bx_ = bx - ax, by_ = by - ay, cx_ = cx - ax, cy_ = cy - ay;
  const d = 2 * (bx_ * cy_ - by_ * cx_);
  if (Math.abs(d) < 1e-9) return null;
  const b2 = bx_ * bx_ + by_ * by_;
  const c2 = cx_ * cx_ + cy_ * cy_;
  const ux = (cy_ * b2 - by_ * c2) / d;
  const uy = (bx_ * c2 - cx_ * b2) / d;
  return { xc: ax + ux, yc: ay + uy, R: Math.hypot(ux, uy) };
}

/** Transverse arc length from the closest approach (taken at the origin) to radius r on a circle of radius R. */
function arcAt(r: number, R: number): number {
  const x = r / (2 * R);
  if (x < 0.3) {
    const x2 = x * x;
    return r * (1 + x2 * (1 / 6 + x2 * (3 / 40 + x2 * (5 / 112))));
  }
  return 2 * R * Math.asin(Math.min(1, x));
}

// ── the finder ─────────────────────────────────────────────────────────────────────────────────

export interface FinderStats {
  nSeeds: number;
  nCandidates: number;
  nTracks: number;
}

/** Layer combinations used for seeding, most valuable first. */
function seedCombos(nLayers: number, nPix: number): [number, number, number][] {
  const m = Math.min(nLayers, Math.max(3, Math.min(4, nPix + 1)));
  const out: [number, number, number][] = [];
  if (m >= 3) out.push([0, 1, 2]);
  if (m >= 4) out.push([1, 2, 3], [0, 1, 3], [0, 2, 3]);
  return out;
}

interface Cand {
  ids: number[];
  chi2: number;
  ndof: number;
  pt: number;
  eta: number;
}

/**
 * Find tracks in a list of hits. See the file header for the algorithm. Returns the tracks with parameters relative to
 * the beam line (`d0`, `z0` are also stored as `d0Raw`, `z0Raw`; the reconstruction chain later re-expresses `d0`, `z0`
 * relative to the primary vertex). `Track.hits` holds indices into `hits`.
 */
const __T: Record<string, number> = ((globalThis as any).__T = {});
const __now = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
export function findTracks(hits: readonly Hit[], cfg: DetectorConfig | RecoGeometry, rcIn?: Partial<RecoConfig>, statsOut?: FinderStats): RecoTrack[] {
  const geom = geometryFromConfig(cfg);
  const rc = resolveConfig(rcIn);
  const nL = geom.layers.length;
  const stats: FinderStats = statsOut ?? { nSeeds: 0, nCandidates: 0, nTracks: 0 };
  stats.nSeeds = 0;
  stats.nCandidates = 0;
  stats.nTracks = 0;
  if (nL < 3 || hits.length < 3) return [];
  const minHits = rc.minHits > 0 ? rc.minHits : Math.max(3, Math.min(6, Math.round(0.6 * nL)));
  let __t = __now();
  const idx = buildHitIndex(hits, geom);
  __T.index = (__T.index ?? 0) + __now() - __t;
  const rm = roadModel(geom);
  const B = geom.bField;
  const layerR = Float64Array.from(geom.layers, (l) => l.r);
  const layerSigT = Float64Array.from(geom.layers, (l) => l.sigmaRPhi);
  const layerSigZ = Float64Array.from(geom.layers, (l) => l.sigmaZ);
  const msF = Float64Array.from(rm.Q, (q) => MS_RESIDUAL * q);
  const bufB = new Int32Array(Math.max(16, hits.length));
  const bufC = new Int32Array(Math.max(16, hits.length));
  const bufX = new Int32Array(Math.max(16, hits.length));
  const gIds = new Int32Array(nL + 3);
  const gUsed = new Uint8Array(nL);
  const RS = 1 / 1000; // radial scale for the conditioning of the quadratic extrapolation
  const radiusToPt = (Rm: number): number => (GEV_PER_TESLA_M * Math.abs(B) * Math.min(Rm, 1e7)) / 1000;

  /**
   * Extend a seed (a circle through three hits) through the other layers. The transverse prediction is the seed circle
   * plus a quadratic in r fitted to the hits' offsets from it (weighted by their effective uncertainties), the z
   * prediction a straight line in arc length. The road at a layer is the prediction's own uncertainty, the layer's
   * resolution and the scattering displacement, times `roadSigmas`.
   */
  const grow = (a: number, b: number, c: number, xc: number, yc: number, R: number): Cand | null => {
    const d = Math.hypot(xc, yc);
    if (d < 1e-9 || R > 1e7) return null;
    const ex = xc / d, ey = yc / d;
    const R2d = R * R - d * d;
    let m = 0;
    gUsed.fill(0);
    // running sums: quadratic fit of offsets e(r) = a0 + a1 x + a2 x² (x = r/1000), weights w; line fit z(s)
    let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0, yy = 0;
    let Z0 = 0, Z1 = 0, Z2 = 0, Zz = 0, Zsz = 0, Zzz = 0;
    let z0 = 0, t = 0;
    const pt0 = radiusToPt(R);
    let eta = 0;
    const addHit = (i: number, e: number): void => {
      const l = idx.layer[i]!;
      gUsed[l] = 1;
      gIds[m++] = i;
      const ch = Math.cosh(eta);
      const pp = pt0 * ch;
      const ms = (msF[l]! * Math.sqrt(ch)) / pp;
      const sT = Math.hypot(layerSigT[l]!, ms);
      const sZ = Math.hypot(layerSigZ[l]!, ms * ch * ch);
      const w = 1 / (sT * sT);
      const x = layerR[l]! * RS;
      const x2 = x * x;
      S0 += w; S1 += w * x; S2 += w * x2; S3 += w * x2 * x; S4 += w * x2 * x2;
      T0 += w * e; T1 += w * e * x; T2 += w * e * x2;
      yy += w * e * e;
      const wz = 1 / (sZ * sZ);
      const s = arcAt(layerR[l]!, R);
      Z0 += wz; Z1 += wz * s; Z2 += wz * s * s;
      const zz = idx.z[i]!;
      Zz += wz * zz; Zsz += wz * s * zz; Zzz += wz * zz * zz;
    };
    const refitZ = (): void => {
      const D = Z0 * Z2 - Z1 * Z1;
      if (D > 0) {
        t = (Z0 * Zsz - Z1 * Zz) / D;
        z0 = (Z2 * Zz - Z1 * Zsz) / D;
      }
    };
    // seed hits: offsets from the circle are zero by construction
    {
      // the z slope of the seed, for the scattering estimate
      const ia = a, ib = b, ic = c;
      const sA = arcAt(idx.r[ia]!, R), sC = arcAt(idx.r[ic]!, R);
      t = (idx.z[ic]! - idx.z[ia]!) / (sC - sA);
      eta = Math.asinh(t);
      addHit(ia, 0);
      addHit(ib, 0);
      addHit(ic, 0);
      refitZ();
    }
    const lastSeedHit = b;
    for (let l = 0; l < nL; l++) {
      if (gUsed[l]) continue;
      const r = layerR[l]!;
      // circle ∩ cylinder
      const aa = (r * r - R2d) / (2 * d);
      const h2 = r * r - aa * aa;
      if (h2 < 0) continue;
      const h = Math.sqrt(h2);
      const p1x = aa * ex - h * ey, p1y = aa * ey + h * ex;
      const p2x = aa * ex + h * ey, p2y = aa * ey - h * ex;
      const d1 = (p1x - idx.x[lastSeedHit]!) ** 2 + (p1y - idx.y[lastSeedHit]!) ** 2;
      const d2 = (p2x - idx.x[lastSeedHit]!) ** 2 + (p2y - idx.y[lastSeedHit]!) ** 2;
      const px = d1 < d2 ? p1x : p2x, py = d1 < d2 ? p1y : p2y;
      const phiP = Math.atan2(py, px);
      // quadratic correction and its variance
      const c00 = S2 * S4 - S3 * S3, c01 = S2 * S3 - S1 * S4, c02 = S1 * S3 - S2 * S2;
      const c11 = S0 * S4 - S2 * S2, c12 = S1 * S2 - S0 * S3, c22 = S0 * S2 - S1 * S1;
      const det = S0 * c00 + S1 * c01 + S2 * c02;
      const x = r * RS;
      const x2 = x * x;
      let corr = 0;
      let vT = 1;
      if (det > 0) {
        const k0 = (c00 * T0 + c01 * T1 + c02 * T2) / det;
        const k1 = (c01 * T0 + c11 * T1 + c12 * T2) / det;
        const k2 = (c02 * T0 + c12 * T1 + c22 * T2) / det;
        corr = k0 + k1 * x + k2 * x2;
        vT = (c00 + 2 * c01 * x + 2 * c02 * x2 + c11 * x2 + 2 * c12 * x * x2 + c22 * x2 * x2) / det;
        if (!(vT > 0)) vT = 1;
      }
      const sArc = arcAt(r, R);
      const dzF = Z0 * Z2 - Z1 * Z1;
      let vZ = dzF > 0 ? (Z2 - 2 * sArc * Z1 + sArc * sArc * Z0) / dzF : 10;
      if (!(vZ > 0)) vZ = 10;
      const ch = Math.cosh(eta);
      const ms = (msF[l]! * Math.sqrt(ch)) / (pt0 * ch);
      const sgT = layerSigT[l]!, sgZ = layerSigZ[l]!;
      const wT = rc.roadSigmas * Math.sqrt(vT + sgT * sgT + ms * ms);
      const wZ = rc.roadSigmas * Math.sqrt(vZ + sgZ * sgZ + (ms * ch * ch) ** 2);
      const phiC = phiP + corr / r;
      const zPred = z0 + t * sArc;
      const n = collect(idx, l, phiC, wT / r, zPred - wZ, zPred + wZ, bufX);
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < n; k++) {
        const i = bufX[k]!;
        if (idx.used[i]) continue;
        const dT = wrap(idx.phi[i]! - phiC) * r;
        if (dT > wT || dT < -wT) continue;
        const dz = idx.z[i]! - zPred;
        if (dz > wZ || dz < -wZ) continue;
        const q = (dT / wT) ** 2 + (dz / wZ) ** 2;
        if (q < bestD) {
          bestD = q;
          best = i;
        }
      }
      if (best < 0) continue;
      // offset of the hit from the seed circle (at the same radius), in the transverse direction
      const e = wrap(idx.phi[best]! - phiP) * r;
      addHit(best, e);
      refitZ();
      eta = Math.asinh(t);
    }
    if (m < minHits) return null;
    // χ² of the quadratic (transverse) and line (z) fits
    const c00 = S2 * S4 - S3 * S3, c01 = S2 * S3 - S1 * S4, c02 = S1 * S3 - S2 * S2;
    const c11 = S0 * S4 - S2 * S2, c12 = S1 * S2 - S0 * S3, c22 = S0 * S2 - S1 * S1;
    const det = S0 * c00 + S1 * c01 + S2 * c02;
    let chi2 = 0;
    if (det > 0) {
      const k0 = (c00 * T0 + c01 * T1 + c02 * T2) / det;
      const k1 = (c01 * T0 + c11 * T1 + c12 * T2) / det;
      const k2 = (c02 * T0 + c12 * T1 + c22 * T2) / det;
      chi2 += Math.max(0, yy - (k0 * T0 + k1 * T1 + k2 * T2));
    }
    const dz2 = Z0 * Z2 - Z1 * Z1;
    if (dz2 > 0) chi2 += Math.max(0, Zzz - (t * Zsz + z0 * Zz));
    const ids: number[] = new Array(m);
    for (let k = 0; k < m; k++) ids[k] = gIds[k]!;
    return { ids, chi2, ndof: 2 * m - 5, pt: pt0, eta };
  };

  const accepted: RecoTrack[] = [];
  /** The final fit: hit resolution and multiple scattering in a generalised least-squares fit. */
  const finalFit = (ids: number[]): HelixFit | null => {
    const pts: FitPoint[] = ids.map((i) => {
      const L = geom.layers[idx.layer[i]!]!;
      return { x: idx.x[i]!, y: idx.y[i]!, z: idx.z[i]!, sxy: L.sigmaRPhi, sz: L.sigmaZ, x0: L.xOverX0 };
    });
    try {
      const f = fitTrack3D(pts, B, { scattering: true });
      return Number.isFinite(f.pt) && Number.isFinite(f.chi2) ? f : null;
    } catch {
      return null;
    }
  };
  const acceptCandidates = (cands: Cand[]): void => {
    cands.sort((p, q) => q.ids.length - p.ids.length || p.chi2 / p.ndof - q.chi2 / q.ndof);
    for (const c of cands) {
      let shared = 0;
      for (const i of c.ids) if (idx.used[i]) shared++;
      if (shared > rc.maxSharedHits) continue;
      const f = finalFit(c.ids);
      if (!f) continue;
      if (!(f.pt >= rc.ptMin * 0.9 && Math.abs(f.d0) <= rc.d0Max * 1.5 && Math.abs(f.z0) <= rc.z0Max * 1.2 && f.chi2 / f.ndof <= rc.maxChi2PerDof)) continue;
      for (const i of c.ids) idx.used[i] = 1;
      const cov = [
        [f.covT[0]![0]!, f.covT[0]![1]!, f.covT[0]![2]!, 0, 0],
        [f.covT[1]![0]!, f.covT[1]![1]!, f.covT[1]![2]!, 0, 0],
        [f.covT[2]![0]!, f.covT[2]![1]!, f.covT[2]![2]!, 0, 0],
        [0, 0, 0, f.covZ[0]![0]!, f.covZ[0]![1]!],
        [0, 0, 0, f.covZ[1]![0]!, f.covZ[1]![1]!],
      ];
      accepted.push({
        id: accepted.length,
        charge: f.charge,
        pt: f.pt,
        eta: f.eta,
        phi: f.phi0,
        d0: f.d0,
        z0: f.z0,
        chi2: f.chi2,
        ndof: f.ndof,
        hits: c.ids.slice().sort((p, q) => idx.r[p]! - idx.r[q]!),
        truth: -1,
        tanLambda: f.tanLambda,
        c: f.c,
        d0Raw: f.d0,
        z0Raw: f.z0,
        sigmaD0: Math.sqrt(f.covT[0]![0]!),
        sigmaZ0: f.sigmaZ0,
        cov,
        nLayers: c.ids.length,
      });
    }
  };

  if (rc.seeding === 'hough') {
    const seeds = houghSeeds(idx, geom, rc);
    const cands: Cand[] = [];
    for (const ids of seeds) {
      stats.nSeeds++;
      if (ids.length < minHits) continue;
      const pts: FitPoint[] = ids.map((i) => ({ x: idx.x[i]!, y: idx.y[i]!, z: idx.z[i]!, sxy: layerSigT[idx.layer[i]!]!, sz: layerSigZ[idx.layer[i]!]! }));
      let f: HelixFit;
      try {
        f = fitTrack3D(pts, B);
      } catch {
        continue;
      }
      let chi2 = 0;
      for (let k = 0; k < ids.length; k++) {
        const sg = effectiveSigma(geom, rm, idx.layer[ids[k]!]!, f.pt, f.eta);
        chi2 += (f.resT[k]! / sg.t) ** 2 + (f.resZ[k]! / sg.z) ** 2;
      }
      if (f.pt >= rc.ptMin * 0.9 && chi2 / f.ndof <= 4 * rc.maxChi2PerDof) cands.push({ ids, chi2, ndof: f.ndof, pt: f.pt, eta: f.eta });
    }
    stats.nCandidates = cands.length;
    acceptCandidates(cands);
    stats.nTracks = accepted.length;
    return accepted;
  }

  const phiTol = 1e-3;
  const combos = seedCombos(nL, geom.nPixelLayers);
  const maxSeedLayer = Math.max(...combos.flat()) + 1;
  // Two passes: prompt high-pT tracks first, with narrow windows; then what is left, with the full acceptance.
  const passes: { d0Max: number; ptMin: number; combos: [number, number, number][] }[] = [];
  if (rc.d0Max > 1 || rc.ptMin < 1) passes.push({ d0Max: Math.min(1, rc.d0Max), ptMin: Math.max(1, rc.ptMin), combos: combos.slice(0, 2) });
  passes.push({ d0Max: rc.d0Max, ptMin: rc.ptMin, combos });
  let nBuilt = 0;
  for (const pass of passes) {
    const PRmin = radiusFromPt(pass.ptMin, B);
    // the hits of the tracks found so far are dropped from the grids for this pass
    if (accepted.length > nBuilt) {
      const __b = __now();
      buildGrids(idx, geom, maxSeedLayer);
      __T.grids = (__T.grids ?? 0) + __now() - __b;
      nBuilt = accepted.length;
    }
    for (const [la, lb, lc] of pass.combos) {
      const ra = layerR[la]!, rb = layerR[lb]!, rcc = layerR[lc]!;
      const tolAB = Math.asin(Math.min(1, rb / (2 * PRmin))) - Math.asin(ra / (2 * PRmin)) + pass.d0Max * (1 / ra - 1 / rb) + 0.004;
      const tolC = 1.15 * pass.d0Max * ((rcc - rb) * (rcc - ra)) / (ra * rb * rcc) + 2 * highland(pass.ptMin, geom.layers[lb]!.xOverX0) * ((rcc - rb) / rcc) + phiTol + 4 * layerSigT[lc]! / rcc;
      const sigmaSeedZ = Math.hypot(layerSigZ[la]!, layerSigZ[lb]!, layerSigZ[lc]!);
      const xb = geom.layers[lb]!.xOverX0;
      const cands: Cand[] = [];
      const kAB = (rcc - rb) / (rb - ra);
      const GA = idx.grids[la]!.ids;
      for (let ka = 0; ka < GA.length; ka++) {
        const A = GA[ka]!;
        if (idx.used[A]) continue;
        const phiA = idx.phi[A]!, zA = idx.z[A]!;
        const zBnom = (zA * rb) / ra;
        const zBtol = rc.z0Max * (rb / ra - 1) + 1 + 0.01 * Math.abs(zA);
        const nB = collect(idx, lb, phiA, tolAB, zBnom - zBtol, zBnom + zBtol, bufB);
        for (let kb = 0; kb < nB; kb++) {
          const Bi = bufB[kb]!;
          if (idx.used[Bi]) continue;
          const zB = idx.z[Bi]!;
          if (Math.abs(zB - zBnom) > zBtol) continue;
          const dphi = wrap(idx.phi[Bi]! - phiA);
          if (Math.abs(dphi) > tolAB) continue;
          const phiPred = idx.phi[Bi]! + dphi * kAB;
          const slope = (zB - zA) / (rb - ra);
          const zPred = zB + (zB - zA) * kAB;
          // z window at the third layer: hit resolution, arc-length effect and the scattering at the worst-case pT
          const chB = Math.sqrt(1 + slope * slope);
          const zTol = 6 * sigmaSeedZ + 0.4 + 0.25 * Math.abs(slope) + 3 * chB * chB * highland(pass.ptMin * chB, xb * chB) * (rcc - rb);
          const nC = collect(idx, lc, phiPred, tolC, zPred - zTol, zPred + zTol, bufC);
          for (let kc = 0; kc < nC; kc++) {
            const Ci = bufC[kc]!;
            if (idx.used[Ci]) continue;
            if (Math.abs(idx.z[Ci]! - zPred) > zTol) continue;
            if (Math.abs(wrap(idx.phi[Ci]! - phiPred)) > tolC) continue;
            const cc = circleThrough(idx.x[A]!, idx.y[A]!, idx.x[Bi]!, idx.y[Bi]!, idx.x[Ci]!, idx.y[Ci]!);
            if (!cc) continue;
            const { xc, yc, R } = cc;
            if (R < 0.9 * PRmin) continue;
            // impact parameter: distance of the circle from the origin
            if (Math.abs(Math.hypot(xc, yc) - R) > pass.d0Max * 1.5) continue;
            // z consistency in arc length, and the vertex position
            const sA = arcAt(ra, R), sB = arcAt(rb, R), sC = arcAt(rcc, R);
            const t = (zB - zA) / (sB - sA);
            if (Math.abs(zA - t * sA) > rc.z0Max * 1.2) continue;
            if (Math.abs(idx.z[Ci]! - (zB + t * (sC - sB))) > zTol) continue;
            stats.nSeeds++;
            const __g = __now();
            const cand = grow(A, Bi, Ci, xc, yc, R);
            __T.grow = (__T.grow ?? 0) + __now() - __g;
            if (cand && cand.chi2 / cand.ndof <= 4 * rc.maxChi2PerDof) cands.push(cand);
          }
        }
      }
      stats.nCandidates += cands.length;
      const __a = __now();
      acceptCandidates(cands);
      __T.accept = (__T.accept ?? 0) + __now() - __a;
    }
  }
  stats.nTracks = accepted.length;
  return accepted;
}

// ── Hough seeding ────────────────────────────────────────────────────────────────────────────────

/**
 * Seeds from the Hough transform (see hough.ts): for each peak, the hits in every layer nearest to the parametrised
 * track (within a road) are collected, the helix through them is fitted, and the road is narrowed around the fit for a
 * second collection. Finds tracks that point to the beam line; slower and less precise than triplets in dense
 * events, but it shows how the transform is used.
 */
function houghSeeds(idx: HitIndex, geom: RecoGeometry, rc: RecoConfig): number[][] {
  const hough = hook('reco.houghTransform', houghTransform);
  const pts: { x: number; y: number }[] = new Array(idx.n);
  for (let i = 0; i < idx.n; i++) pts[i] = { x: idx.x[i]!, y: idx.y[i]! };
  const maxCurv = (GEV_PER_TESLA_M * Math.abs(geom.bField)) / (1000 * rc.ptMin);
  const res = hough(pts, { nAngle: 384, nCurv: 48, maxCurv, minVotes: Math.max(4, Math.round(0.5 * geom.layers.length)) });
  const out: number[][] = [];
  const rm = roadModel(geom);
  const buf = new Int32Array(Math.max(16, idx.n));
  const seen = new Set<string>();
  const collectRoad = (phiAt: (r: number) => number | undefined, zAt: ((r: number) => number) | null, pt: number, eta: number, narrow: boolean): number[] => {
    const ids: number[] = [];
    for (let l = 0; l < geom.layers.length; l++) {
      const r = geom.layers[l]!.r;
      const phiPred = phiAt(r);
      if (phiPred === undefined) break;
      const sg = effectiveSigma(geom, rm, l, pt, eta);
      const w = narrow ? 4 * sg.t + 0.2 : 4 * sg.t + 1.5 + 0.4 / Math.max(pt, 0.3);
      const wz = narrow ? 4 * sg.z + 0.3 : Infinity;
      const zp = zAt ? zAt(r) : 0;
      const nC = collect(idx, l, phiPred, w / r, zAt ? zp - wz : -Infinity, zAt ? zp + wz : Infinity, buf);
      let best = -1, bestD = Infinity;
      for (let k = 0; k < nC; k++) {
        const i = buf[k]!;
        if (idx.used[i]) continue;
        const d = Math.abs(wrap(idx.phi[i]! - phiPred)) * r;
        if (d >= w) continue;
        if (zAt && Math.abs(idx.z[i]! - zp) > wz) continue;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) ids.push(best);
    }
    return ids;
  };
  for (const pk of res.peaks) {
    const pt = (GEV_PER_TESLA_M * Math.abs(geom.bField)) / (1000 * Math.max(Math.abs(pk.curvature), 1e-9));
    let ids = collectRoad((r) => {
      const arg = (pk.curvature * r) / 2;
      return Math.abs(arg) >= 1 ? undefined : pk.phi0 + Math.asin(arg);
    }, null, pt, 0, false);
    if (ids.length < 4) continue;
    for (let pass = 0; pass < 2; pass++) {
      let f: HelixFit;
      try {
        f = fitTrack3D(ids.map((i) => ({ x: idx.x[i]!, y: idx.y[i]!, z: idx.z[i]!, sxy: geom.layers[idx.layer[i]!]!.sigmaRPhi, sz: geom.layers[idx.layer[i]!]!.sigmaZ })), geom.bField);
      } catch {
        break;
      }
      const h = { d0: f.d0, z0: f.z0, phi0: f.phi0, tanLambda: f.tanLambda, c: f.c };
      const next = collectRoad(
        (r) => {
          const p = helixAtRadius(h, r);
          return p ? Math.atan2(p.y, p.x) : undefined;
        },
        (r) => helixAtRadius(h, r)?.z ?? 0,
        f.pt,
        f.eta,
        true,
      );
      if (next.length >= ids.length) ids = next;
    }
    if (ids.length < 4) continue;
    const key = ids.slice().sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ids);
  }
  return out;
}
