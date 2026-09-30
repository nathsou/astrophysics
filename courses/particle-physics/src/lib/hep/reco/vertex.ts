/**
 * Vertexing: primary vertices by clustering track z0, vertex fits by weighted least squares, secondary vertices from
 * displaced tracks, and track impact parameters.
 *
 * **Vertex fit.** A track is a helix; the vertex v = (x, y, z) is where several tracks should meet. For each track i the
 * residuals are the signed transverse distance d_i(v) from v to the track's circle, and the z-distance r_z,i(v) between
 * the vertex and the track's z at the point nearest to it in the transverse plane. Both are (nearly) linear in v, with
 * the gradient of d_i the track's unit normal n_i in the plane and ∂r_z/∂z = −1. The uncertainties come from the
 * tracks' covariance (propagated from the perigee to the vertex). The weighted least-squares minimum is found by
 * Gauss–Newton steps, and χ² = Σ (d_i/σ_d,i)² + (r_z,i/σ_z,i)² has 2n − 3 degrees of freedom. Outliers (tracks that
 * contribute χ² > `chi2Cut` to a vertex) are dropped one at a time, worst first, and the vertex refitted.
 *
 * **Not modelled:** correlations between the transverse and z parameters of a track, the change of a track's
 * uncertainty with the vertex position beyond a first-order propagation, and vertex-constrained refits of the tracks.
 */
import { hook } from '../hooks.ts';
import type { Vertex } from '../event/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { fromMass, mass } from '../kinematics/index.ts';
import { arcNearest, distanceToHelix, helixAt, type Helix } from './helix.ts';
import { resolveConfig, type RecoConfig } from './config.ts';
import type { RecoTrack } from './types.ts';
import { solve } from './linalg.ts';

export interface RecoVertex extends Vertex {
  /** Covariance of (x, y, z) in mm². */
  cov: number[][];
  ndof: number;
  /** Σ pT² of the tracks (primary-vertex ranking). */
  sumPt2: number;
  /** Invariant mass of the tracks (pion hypothesis), for secondary vertices. */
  mass?: number;
  /** Transverse flight distance from the primary vertex (mm) and its significance, for secondary vertices. */
  lxy?: number;
  lxySig?: number;
  /** Track indices that were dropped as outliers. */
  rejected?: number[];
}

/** The helix of a track relative to the beam line (x = y = 0). */
export function trackHelix(t: RecoTrack): Helix {
  return { d0: t.d0Raw ?? t.d0, z0: t.z0Raw ?? t.z0, phi0: t.phi, tanLambda: t.tanLambda ?? Math.sinh(t.eta), c: t.c };
}

export interface TrackAtVertex {
  /** Signed transverse distance from the vertex to the track (positive: the vertex is to the left of the direction of motion), mm. */
  dxy: number;
  /** z of the track at the nearest transverse point minus the vertex z, mm. */
  dz: number;
  /** Uncertainties of dxy and dz (mm), from the track covariance. */
  sxy: number;
  sz: number;
  /** Gradient of dxy with respect to (x, y) of the vertex: the unit normal of the track at the nearest point. */
  nx: number;
  ny: number;
  /** Gradient of dz with respect to (x, y). */
  gzx: number;
  gzy: number;
  /** Arc length (mm) from the perigee to the point nearest the vertex. */
  s: number;
}

const FD = 1e-3;

/** The residuals and uncertainties of a track relative to a point. */
export function trackAtVertex(t: RecoTrack, x: number, y: number, z: number): TrackAtVertex {
  const h = trackHelix(t);
  const a = distanceToHelix(h, x, y);
  // uncertainty of the transverse distance: propagate (d0, φ0, c) through the distance function numerically
  const C = t.cov;
  const params: [keyof Helix, number][] = [['d0', 0], ['phi0', 1], ['c', 2]];
  const g: number[] = [];
  for (const [key, k] of params) {
    const step = key === 'c' ? Math.max(1e-7, Math.abs(h.c) * 1e-3) : 1e-6;
    const hp: Helix = { ...h, [key]: h[key] + step };
    g[k] = (distanceToHelix(hp, x, y).d - a.d) / step;
  }
  let v = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += g[i]! * g[j]! * C[i]![j]!;
  // z: z at arc s is z0 + tanλ s; variance from (z0, tanλ) and a small term from the arc-length uncertainty
  const s = a.s;
  const vz = C[3]![3]! + 2 * s * C[3]![4]! + s * s * C[4]![4]!;
  // gradient of dz with respect to the vertex position in the plane: tanλ ∂s/∂(x,y)
  const s1 = arcNearest(h, x + FD, y), s2 = arcNearest(h, x, y + FD);
  const dsx = wrapArc(s1 - s, h) / FD;
  const dsy = wrapArc(s2 - s, h) / FD;
  return {
    dxy: a.d,
    dz: a.z - z,
    sxy: Math.sqrt(Math.max(v, 1e-12)),
    sz: Math.sqrt(Math.max(vz, 1e-12)),
    nx: a.gx,
    ny: a.gy,
    gzx: h.tanLambda * dsx,
    gzy: h.tanLambda * dsy,
    s,
  };
}

function wrapArc(ds: number, h: Helix): number {
  if (Math.abs(h.c) < 1e-12) return ds;
  const period = (2 * Math.PI) / Math.abs(h.c);
  if (ds > period / 2) return ds - period;
  if (ds < -period / 2) return ds + period;
  return ds;
}

export interface VertexFitOptions {
  /** Drop tracks whose χ² contribution exceeds this (2 degrees of freedom; 9 ≈ 3σ), worst first. Default 9; Infinity keeps all. */
  chi2Cut?: number;
  /** Starting point (default: the tracks' mean z0 on the beam line). */
  start?: [number, number, number];
  /** A measured beam position and size in x and y: adds a constraint (for primary vertices). */
  beamSpot?: { x: number; y: number; sigma: number };
  maxIterations?: number;
}

/**
 * Fit a common vertex to tracks by weighted least squares (see the file header). Reference for the vertex fit; returns
 * the position, its covariance, χ² and the tracks used (`tracks` holds indices into the input list).
 */
export function fitVertex(tracks: readonly RecoTrack[], opts: VertexFitOptions = {}): RecoVertex {
  const n = tracks.length;
  if (n < 1) throw new Error('fitVertex needs at least one track');
  const chi2Cut = opts.chi2Cut ?? 9;
  const maxIt = opts.maxIterations ?? 8;
  const use: boolean[] = new Array(n).fill(true);
  let v: [number, number, number] = opts.start ? [...opts.start] : [opts.beamSpot?.x ?? 0, opts.beamSpot?.y ?? 0, tracks.reduce((a, t) => a + (t.z0Raw ?? t.z0), 0) / n];
  const rejected: number[] = [];
  let cov: number[][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let chi2 = 0;
  let info: TrackAtVertex[] = [];
  for (;;) {
    const idxs: number[] = [];
    for (let i = 0; i < n; i++) if (use[i]) idxs.push(i);
    for (let it = 0; it < maxIt; it++) {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const b = [0, 0, 0];
      info = tracks.map((t, i) => (use[i] ? trackAtVertex(t, v[0], v[1], v[2]) : (undefined as unknown as TrackAtVertex)));
      for (const i of idxs) {
        const a = info[i]!;
        // transverse: dxy + n·δ = 0
        const wT = 1 / (a.sxy * a.sxy);
        const Jt = [a.nx, a.ny, 0];
        // longitudinal: dz + gz·δxy − δz = 0
        const wZ = 1 / (a.sz * a.sz);
        const Jz = [a.gzx, a.gzy, -1];
        for (let p = 0; p < 3; p++) {
          b[p]! += wT * Jt[p]! * a.dxy + wZ * Jz[p]! * a.dz;
          for (let q = 0; q < 3; q++) A[p]![q]! += wT * Jt[p]! * Jt[q]! + wZ * Jz[p]! * Jz[q]!;
        }
      }
      if (opts.beamSpot) {
        const w = 1 / (opts.beamSpot.sigma * opts.beamSpot.sigma);
        A[0]![0]! += w;
        A[1]![1]! += w;
        b[0]! += w * (v[0] - opts.beamSpot.x);
        b[1]! += w * (v[1] - opts.beamSpot.y);
      }
      let step: number[];
      try {
        step = solve(A, b.map((x) => -x));
      } catch {
        break;
      }
      v = [v[0] + step[0]!, v[1] + step[1]!, v[2] + step[2]!];
      if (Math.abs(step[0]!) + Math.abs(step[1]!) + Math.abs(step[2]!) < 1e-5) break;
    }
    // covariance and χ² at the solution
    info = tracks.map((t, i) => (use[i] ? trackAtVertex(t, v[0], v[1], v[2]) : (undefined as unknown as TrackAtVertex)));
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    chi2 = 0;
    let worst = -1;
    let worstChi = -1;
    for (const i of idxs) {
      const a = info[i]!;
      const wT = 1 / (a.sxy * a.sxy);
      const wZ = 1 / (a.sz * a.sz);
      const Jt = [a.nx, a.ny, 0];
      const Jz = [a.gzx, a.gzy, -1];
      const c2 = a.dxy * a.dxy * wT + a.dz * a.dz * wZ;
      chi2 += c2;
      if (c2 > worstChi) {
        worstChi = c2;
        worst = i;
      }
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) A[p]![q]! += wT * Jt[p]! * Jt[q]! + wZ * Jz[p]! * Jz[q]!;
    }
    if (opts.beamSpot) {
      const w = 1 / (opts.beamSpot.sigma * opts.beamSpot.sigma);
      A[0]![0]! += w;
      A[1]![1]! += w;
      chi2 += w * ((v[0] - opts.beamSpot.x) ** 2 + (v[1] - opts.beamSpot.y) ** 2);
    }
    try {
      cov = invert3(A);
    } catch {
      cov = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    }
    if (worstChi > chi2Cut && idxs.length > 2) {
      use[worst] = false;
      rejected.push(worst);
      continue;
    }
    break;
  }
  const kept: number[] = [];
  for (let i = 0; i < n; i++) if (use[i]) kept.push(i);
  let sumPt2 = 0;
  for (const i of kept) sumPt2 += tracks[i]!.pt ** 2;
  return { x: v[0], y: v[1], z: v[2], tracks: kept, kind: 'pileup', chi2, ndof: Math.max(0, 2 * kept.length - 3 + (opts.beamSpot ? 2 : 0)), cov, sumPt2, rejected };
}

function invert3(A: number[][]): number[][] {
  const a = A[0]![0]!, b = A[0]![1]!, c = A[0]![2]!, d = A[1]![1]!, e = A[1]![2]!, f = A[2]![2]!;
  const c00 = d * f - e * e, c01 = c * e - b * f, c02 = b * e - c * d;
  const c11 = a * f - c * c, c12 = b * c - a * e, c22 = a * d - b * b;
  const det = a * c00 + b * c01 + c * c02;
  if (!(Math.abs(det) > 1e-300)) throw new Error('singular');
  return [
    [c00 / det, c01 / det, c02 / det],
    [c01 / det, c11 / det, c12 / det],
    [c02 / det, c12 / det, c22 / det],
  ];
}

// ── impact parameter ────────────────────────────────────────────────────────────────────────────

export interface ImpactParameter {
  /** Signed transverse impact parameter (mm): the distance of closest approach of the track to the vertex in the transverse plane. */
  d0: number;
  /** Its uncertainty, from the track covariance and (when given) the vertex covariance. */
  sigma: number;
  /** d0/σ. */
  significance: number;
  /** Longitudinal impact parameter (mm), its uncertainty and significance. */
  dz: number;
  sigmaDz: number;
  significanceZ: number;
}

/**
 * The signed transverse impact parameter of a track with respect to a vertex, and its significance. The sign follows the
 * convention of d0 (positive when the point of closest approach lies to the left of the vertex as seen along the
 * track's direction of motion). With `jet`, the sign is instead the *lifetime* sign: positive when the point of closest
 * approach is ahead of the vertex along the jet axis, as it is for the decay products of a particle that flew out of
 * the vertex. Reference for the hook `reco.impactParameter`.
 */
export function impactParameter(track: RecoTrack, vertex: { x: number; y: number; z: number; cov?: number[][] }, jet?: P4): ImpactParameter {
  const a = trackAtVertex(track, vertex.x, vertex.y, vertex.z);
  let d0 = -a.dxy;
  let s2 = a.sxy * a.sxy;
  let sz2 = a.sz * a.sz;
  if (vertex.cov) {
    const C = vertex.cov;
    s2 += a.nx * a.nx * C[0]![0]! + 2 * a.nx * a.ny * C[0]![1]! + a.ny * a.ny * C[1]![1]!;
    sz2 += C[2]![2]!;
  }
  if (jet) {
    // point of closest approach relative to the vertex, along the jet direction in the transverse plane
    const h = trackHelix(track);
    const p = helixAt(h, a.s);
    const dot = (p.x - vertex.x) * jet.px + (p.y - vertex.y) * jet.py;
    d0 = Math.abs(d0) * (dot >= 0 ? 1 : -1);
  }
  const sigma = Math.sqrt(s2);
  return { d0, sigma, significance: d0 / sigma, dz: a.dz, sigmaDz: Math.sqrt(sz2), significanceZ: a.dz / Math.sqrt(sz2) };
}

/** The transverse impact parameter through the hook `reco.impactParameter` (the reader's version if installed). */
export function impactParameterHook(): typeof impactParameter {
  return hook('reco.impactParameter', impactParameter);
}

// ── primary vertices ────────────────────────────────────────────────────────────────────────────

/**
 * Primary vertices by clustering in z. Prompt tracks (small impact parameter with respect to the beam line) are smoothed
 * into a z-density by Gaussians of their z0 uncertainty (at least 0.1 mm); every local maximum seeds a vertex; each
 * track goes to the nearest seed within `vertexAssocSigma` uncertainties; each cluster is fitted (with outlier
 * rejection); clusters with too few tracks are dropped. The hard-scatter vertex is the one with the largest Σ pT², returned
 * first with kind 'primary'; the others are 'pileup'. `Vertex.tracks` indexes the input list.
 */
export function findPrimaryVertices(tracks: readonly RecoTrack[], rcIn?: Partial<RecoConfig>, beamSpot?: { x: number; y: number; sigma: number }): RecoVertex[] {
  const rc = resolveConfig(rcIn);
  const cand: number[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    const d0 = t.d0Raw ?? t.d0;
    const sd = Math.hypot(t.sigmaD0 ?? 0.05, beamSpot?.sigma ?? 0.02);
    if (t.pt >= 0.5 && Math.abs(d0) < Math.max(0.5, 5 * sd)) cand.push(i);
  }
  if (cand.length < rc.minVertexTracks) return [];
  const zs = cand.map((i) => tracks[i]!.z0Raw ?? tracks[i]!.z0);
  const sg = cand.map((i) => Math.max(tracks[i]!.sigmaZ0 ?? 0.2, 0.1));
  const lo = Math.min(...zs) - 1;
  const hi = Math.max(...zs) + 1;
  const dz = 0.05;
  const nb = Math.max(1, Math.ceil((hi - lo) / dz));
  const dens = new Float64Array(nb + 1);
  for (let k = 0; k < cand.length; k++) {
    const s = sg[k]!;
    const b0 = Math.max(0, Math.floor((zs[k]! - 4 * s - lo) / dz));
    const b1 = Math.min(nb, Math.ceil((zs[k]! + 4 * s - lo) / dz));
    for (let b = b0; b <= b1; b++) {
      const u = (lo + b * dz - zs[k]!) / s;
      dens[b]! += Math.exp(-0.5 * u * u) / s;
    }
  }
  // local maxima with enough weight: at least ~ minVertexTracks worth of tracks at 0.3 mm
  const thr = (rc.minVertexTracks - 0.5) / 0.3 / Math.sqrt(2 * Math.PI) * 0.6;
  const seeds: number[] = [];
  for (let b = 1; b < nb; b++) if (dens[b]! >= thr && dens[b]! >= dens[b - 1]! && dens[b]! > dens[b + 1]!) seeds.push(lo + b * dz);
  // assign tracks to the nearest seed, fit, iterate once with the fitted positions
  let centres = seeds;
  let groups: number[][] = [];
  for (let pass = 0; pass < 2; pass++) {
    groups = centres.map(() => []);
    for (let k = 0; k < cand.length; k++) {
      let bi = -1, bd = Infinity;
      for (let s = 0; s < centres.length; s++) {
        const d = Math.abs(zs[k]! - centres[s]!);
        if (d < bd) {
          bd = d;
          bi = s;
        }
      }
      if (bi >= 0 && bd < rc.vertexAssocSigma * sg[k]! + 0.05) groups[bi]!.push(cand[k]!);
    }
    if (pass === 0) {
      centres = centres.map((c, s) => {
        const g = groups[s]!;
        if (g.length === 0) return c;
        let sw = 0, sz = 0;
        for (const i of g) {
          const w = 1 / Math.max(tracks[i]!.sigmaZ0 ?? 0.2, 0.05) ** 2;
          sw += w;
          sz += w * (tracks[i]!.z0Raw ?? tracks[i]!.z0);
        }
        return sz / sw;
      });
    }
  }
  const out: RecoVertex[] = [];
  for (const g of groups) {
    if (g.length < rc.minVertexTracks) continue;
    const sub = g.map((i) => tracks[i]!);
    const f = fitVertex(sub, { beamSpot });
    if (f.tracks.length < rc.minVertexTracks) continue;
    f.tracks = f.tracks.map((k) => g[k]!);
    f.rejected = (f.rejected ?? []).map((k) => g[k]!);
    out.push(f);
  }
  out.sort((a, b) => b.sumPt2 - a.sumPt2);
  out.forEach((v, i) => (v.kind = i === 0 ? 'primary' : 'pileup'));
  return out;
}

// ── secondary vertices ──────────────────────────────────────────────────────────────────────────

export interface SecondaryVertexOptions {
  /** Tracks need |d0 significance| above this with respect to the primary vertex (default 2.5). */
  minIpSig?: number;
  minPt?: number;
  /** Two-track vertex fit χ² must be below this (1 degree of freedom in the transverse plane plus z: ndof = 1 total). Default 9. */
  maxChi2?: number;
  /** Flight distance significance above which a vertex counts (default 5) and the minimum distance (mm, default 0.3). */
  minLxySig?: number;
  minLxy?: number;
  /** Maximum transverse flight distance (mm, default 300). */
  maxLxy?: number;
  /** cos of the angle between the flight direction and the momentum of the vertex's tracks (default 0.9). */
  minCosine?: number;
  /** Veto K0s → π⁺π⁻ and Λ → pπ candidates by mass (default true). */
  vetoV0?: boolean;
}

/**
 * Secondary vertices from displaced tracks. Candidates are tracks with significant impact parameter; every pair is
 * fitted; pairs that are good (χ², distance and direction compatible with a flight from the primary vertex, not a K0s
 * or a conversion) are sorted by flight significance, and each seeds a vertex to which further tracks are added while the
 * χ² stays acceptable. Tracks are used in at most one vertex.
 */
export function findSecondaryVertices(tracks: readonly RecoTrack[], primary: { x: number; y: number; z: number; cov?: number[][] }, opts: SecondaryVertexOptions = {}): RecoVertex[] {
  const minIp = opts.minIpSig ?? 2.5;
  const minPt = opts.minPt ?? 0.8;
  const maxChi2 = opts.maxChi2 ?? 9;
  const minL = opts.minLxy ?? 0.3;
  const minLSig = opts.minLxySig ?? 5;
  const maxL = opts.maxLxy ?? 300;
  const minCos = opts.minCosine ?? 0.9;
  const cand: number[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (t.pt < minPt) continue;
    const ip = impactParameter(t, primary);
    if (Math.abs(ip.significance) < minIp) continue;
    if (Math.abs(ip.d0) > maxL) continue;
    cand.push(i);
  }
  if (cand.length < 2) return [];
  const mom = (t: RecoTrack): P4 => {
    const px = t.pt * Math.cos(t.phi), py = t.pt * Math.sin(t.phi), pz = t.pt * t.tanLambda;
    return fromMass(0.13957, px, py, pz);
  };
  const flight = (v: RecoVertex): { l: number; sig: number; cos: number } => {
    const dx = v.x - primary.x, dy = v.y - primary.y;
    const l = Math.hypot(dx, dy);
    // significance of the transverse distance along the flight direction
    const ux = dx / (l || 1), uy = dy / (l || 1);
    const C = v.cov;
    let s2 = ux * ux * C[0]![0]! + 2 * ux * uy * C[0]![1]! + uy * uy * C[1]![1]!;
    if (primary.cov) s2 += ux * ux * primary.cov[0]![0]! + 2 * ux * uy * primary.cov[0]![1]! + uy * uy * primary.cov[1]![1]!;
    let px = 0, py = 0;
    for (const k of v.tracks) {
      px += tracks[k]!.pt * Math.cos(tracks[k]!.phi);
      py += tracks[k]!.pt * Math.sin(tracks[k]!.phi);
    }
    const pm = Math.hypot(px, py) || 1;
    return { l, sig: l / Math.sqrt(Math.max(s2, 1e-12)), cos: (px * dx + py * dy) / (pm * (l || 1)) };
  };
  const vertexMass = (ids: number[]): number => {
    let E = 0, px = 0, py = 0, pz = 0;
    for (const k of ids) {
      const p = mom(tracks[k]!);
      E += p.E; px += p.px; py += p.py; pz += p.pz;
    }
    return mass({ E, px, py, pz });
  };
  interface Pair { a: number; b: number; v: RecoVertex; sig: number }
  const pairs: Pair[] = [];
  for (let ia = 0; ia < cand.length; ia++) {
    for (let ib = ia + 1; ib < cand.length; ib++) {
      const a = cand[ia]!, b = cand[ib]!;
      const v = fitVertex([tracks[a]!, tracks[b]!], { chi2Cut: Infinity, start: [primary.x, primary.y, primary.z] });
      v.tracks = [a, b];
      if (v.chi2 > maxChi2) continue;
      const f = flight(v);
      if (f.l < minL || f.l > maxL || f.sig < minLSig || f.cos < minCos) continue;
      if (opts.vetoV0 !== false) {
        const m = vertexMass([a, b]);
        if (Math.abs(m - 0.4976) < 0.03 && tracks[a]!.charge * tracks[b]!.charge < 0) continue;
        if (m < 0.04) continue; // photon conversions and other tiny-mass pairs
      }
      pairs.push({ a, b, v, sig: f.sig });
    }
  }
  pairs.sort((p, q) => q.sig - p.sig);
  const used = new Set<number>();
  const out: RecoVertex[] = [];
  for (const p of pairs) {
    if (used.has(p.a) || used.has(p.b)) continue;
    let ids = [p.a, p.b];
    let cur = p.v;
    // add tracks that are compatible with the vertex
    for (const c of cand) {
      if (used.has(c) || ids.includes(c)) continue;
      const a = trackAtVertex(tracks[c]!, cur.x, cur.y, cur.z);
      const c2 = (a.dxy / a.sxy) ** 2 + (a.dz / a.sz) ** 2;
      if (c2 > 6) continue;
      const trial = fitVertex([...ids, c].map((k) => tracks[k]!), { chi2Cut: Infinity, start: [cur.x, cur.y, cur.z] });
      if (trial.chi2 - cur.chi2 < 6) {
        ids = [...ids, c];
        trial.tracks = ids.slice();
        cur = trial;
      }
    }
    const f = flight(cur);
    const v: RecoVertex = { ...cur, tracks: ids.slice(), kind: 'secondary', mass: vertexMass(ids), lxy: f.l, lxySig: f.sig };
    for (const k of ids) used.add(k);
    out.push(v);
  }
  return out;
}

