/**
 * The expected covariance of the perigee parameters of a track as a function of (pT, η), for one geometry.
 *
 * Running a Kalman fit for every track of a busy event is too slow for a browser, so the final least-squares tracks
 * are given the covariance that a Kalman fit (with the layer resolutions and multiple scattering) gives to an ideal
 * track of the same pT and η with all its layers hit. The table (about 100 fits) is built once per geometry and
 * interpolated: log pT, |η| bilinear in the standard deviations and the correlation coefficients.
 */
import { kalmanTrackFit } from './kalman.ts';
import { curvatureFromPt, helixAtRadius, type Helix } from './helix.ts';
import type { RecoGeometry } from './geometry.ts';

const PT_GRID = [0.4, 0.6, 0.9, 1.3, 2, 3, 5, 8, 14, 25, 50, 100, 250, 1000];
const ETA_STEP = 0.25;

interface Node {
  sigma: number[];
  rho: number[][];
}

export interface TrackErrorModel {
  /** Covariance of (d0, φ0, c, z0, tanλ). */
  covariance(pt: number, eta: number): number[][];
  sigmaD0(pt: number, eta: number): number;
  sigmaZ0(pt: number, eta: number): number;
  sigmaPtRel(pt: number, eta: number): number;
}

function idealHits(geom: RecoGeometry, pt: number, eta: number) {
  const h: Helix = { d0: 0, z0: 0, phi0: 0.3, tanLambda: Math.sinh(eta), c: curvatureFromPt(pt, geom.bField, 1) };
  const hits: { layer: number; x: number; y: number; z: number }[] = [];
  geom.layers.forEach((L, i) => {
    const p = helixAtRadius(h, L.r);
    if (p && Math.abs(p.z) < geom.zMax) hits.push({ layer: i, x: p.x, y: p.y, z: p.z });
  });
  return hits;
}

const cache = new WeakMap<RecoGeometry, TrackErrorModel>();

export function trackErrorModel(geom: RecoGeometry): TrackErrorModel {
  const hit = cache.get(geom);
  if (hit) return hit;
  const nEta = Math.ceil(geom.etaMax / ETA_STEP) + 1;
  const nodes: (Node | undefined)[][] = [];
  for (let ip = 0; ip < PT_GRID.length; ip++) {
    const row: (Node | undefined)[] = [];
    for (let ie = 0; ie < nEta; ie++) {
      const hits = idealHits(geom, PT_GRID[ip]!, ie * ETA_STEP);
      if (hits.length < 4) {
        row.push(undefined);
        continue;
      }
      try {
        const f = kalmanTrackFit(hits, geom);
        const sigma = f.cov.map((r, i) => Math.sqrt(Math.max(1e-30, r[i]!)));
        const rho = f.cov.map((r, i) => r.map((v, j) => v / (sigma[i]! * sigma[j]!)));
        row.push({ sigma, rho });
      } catch {
        row.push(undefined);
      }
    }
    nodes.push(row);
  }
  // fill holes with the nearest defined neighbour in η
  for (const row of nodes) for (let ie = 0; ie < nEta; ie++) if (!row[ie]) for (let k = 1; k < nEta && !row[ie]; k++) row[ie] = row[ie - k] ?? row[ie + k];
  const lp = PT_GRID.map(Math.log);
  const covariance = (pt: number, eta: number): number[][] => {
    const x = Math.log(Math.max(PT_GRID[0]!, pt));
    let i = 0;
    while (i < lp.length - 2 && x > lp[i + 1]!) i++;
    const fx = Math.min(1, Math.max(0, (x - lp[i]!) / (lp[i + 1]! - lp[i]!)));
    const ye = Math.min(nEta - 1 - 1e-9, Math.abs(eta) / ETA_STEP);
    const j = Math.max(0, Math.floor(ye));
    const fy = ye - j;
    const corners: [Node | undefined, number][] = [
      [nodes[i]![j], (1 - fx) * (1 - fy)],
      [nodes[i + 1]![j], fx * (1 - fy)],
      [nodes[i]![j + 1], (1 - fx) * fy],
      [nodes[i + 1]![j + 1], fx * fy],
    ];
    const sig = [0, 0, 0, 0, 0];
    const rho = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
    let wsum = 0;
    for (const [n, w] of corners) {
      if (!n || w <= 0) continue;
      wsum += w;
      for (let a = 0; a < 5; a++) {
        sig[a]! += w * Math.log(n.sigma[a]!);
        for (let b = 0; b < 5; b++) rho[a]![b]! += w * n.rho[a]![b]!;
      }
    }
    if (wsum === 0) return geom.layers.length ? [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]] : [];
    const s = sig.map((v) => Math.exp(v / wsum));
    return s.map((si, a) => s.map((sj, b) => (rho[a]![b]! / wsum) * si * sj));
  };
  const model: TrackErrorModel = {
    covariance,
    sigmaD0: (pt, eta) => Math.sqrt(covariance(pt, eta)[0]![0]!),
    sigmaZ0: (pt, eta) => Math.sqrt(covariance(pt, eta)[3]![3]!),
    sigmaPtRel: (pt, eta) => {
      const C = covariance(pt, eta);
      return Math.sqrt(C[2]![2]!) / Math.abs(curvatureFromPt(pt, geom.bField, 1));
    },
  };
  cache.set(geom, model);
  return model;
}
