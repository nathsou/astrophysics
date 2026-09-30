/**
 * Calorimeter reconstruction: topological clustering of cells, energy calibration, and the matching of tracks to clusters.
 *
 * **Topological clustering.** A cell is a (calorimeter, layer, η-index, φ-index) with an energy. Cells above the *grow*
 * threshold that touch each other (neighbours in η, φ and depth, with φ periodic) form connected groups; a group becomes a
 * cluster only if it contains a cell above the higher *seed* threshold, which keeps noise out. A group with several well
 * separated local maxima is split between them (each cell goes to the nearest maximum), so that two nearby photons are not
 * one cluster. The cluster energy is the sum of the cell energies times the calorimeter's calibration constant; the
 * position is the energy-weighted mean of the cell positions.
 *
 * **Not modelled:** shared-cell energy splitting between neighbouring clusters (cells go wholly to one cluster), a
 * non-linear or η-dependent calibration, noise-only cells (the simulation does not make them), and the hadronic
 * response correction (hadron showers are simulated with full visible energy, so the calibration constant is 1).
 */
import type { CaloCell } from '../event/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { deltaPhi } from '../kinematics/index.ts';
import { resolveConfig, type RecoConfig } from './config.ts';
import type { CaloGeometry, RecoGeometry } from './geometry.ts';
import { helixAtRadius, type Helix } from './helix.ts';
import type { RecoCluster, RecoTrack } from './types.ts';
import { trackHelix } from './vertex.ts';

const TWO_PI = 2 * Math.PI;

interface CellInfo {
  idx: number;
  ieta: number;
  iphi: number;
  layer: number;
  e: number;
}

/**
 * Cluster the cells of both calorimeters. Thresholds (GeV, on the raw cell energy) come from `rc`: `ecalSeed`, `ecalGrow`,
 * `hcalSeed`, `hcalGrow`; clusters with calibrated energy below `ecalClusterMin` / `hcalClusterMin` are dropped. Cell
 * indices in `RecoCluster.cells` refer to the input list.
 */
export function clusterCells(cells: readonly CaloCell[], geom: RecoGeometry, rcIn?: Partial<RecoConfig>): RecoCluster[] {
  const rc = resolveConfig(rcIn);
  const out: RecoCluster[] = [];
  for (const calo of ['ecal', 'hcal'] as const) {
    const g = geom[calo];
    const seed = (calo === 'ecal' ? rc.ecalSeed : rc.hcalSeed) || Math.max(calo === 'ecal' ? 0.25 : 0.5, 8 * g.noise);
    const grow = (calo === 'ecal' ? rc.ecalGrow : rc.hcalGrow) || Math.max(0.05, 3 * g.noise);
    const minE = calo === 'ecal' ? rc.ecalClusterMin : rc.hcalClusterMin;
    out.push(...clusterOne(cells, calo, g, seed, grow, minE));
  }
  out.sort((a, b) => b.energy - a.energy);
  return out;
}

function clusterOne(cells: readonly CaloCell[], calo: 'ecal' | 'hcal', g: CaloGeometry, seedE: number, growE: number, minE: number): RecoCluster[] {
  const nPhi = Math.max(4, Math.round(TWO_PI / g.dPhi));
  const infos: CellInfo[] = [];
  const at = new Map<number, number>();
  const keyOf = (ieta: number, iphi: number, layer: number): number => ((ieta + 8192) * nPhi + iphi) * 32 + layer;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.calo !== calo || !(c.energy > growE)) continue;
    const ieta = Math.round(c.eta / g.dEta - 0.5);
    let iphi = Math.round((c.phi + Math.PI) / g.dPhi - 0.5);
    iphi = ((iphi % nPhi) + nPhi) % nPhi;
    const info: CellInfo = { idx: i, ieta, iphi, layer: c.layer, e: c.energy };
    const k = keyOf(ieta, iphi, c.layer);
    const prev = at.get(k);
    if (prev !== undefined) infos[prev]!.e += c.energy; // duplicate address: add up
    else {
      at.set(k, infos.length);
      infos.push(info);
    }
  }
  // connected components over the 26-neighbourhood
  const comp = new Int32Array(infos.length).fill(-1);
  const clusters: RecoCluster[] = [];
  const stack: number[] = [];
  let nComp = 0;
  for (let s = 0; s < infos.length; s++) {
    if (comp[s] !== -1) continue;
    const members: number[] = [];
    comp[s] = nComp;
    stack.push(s);
    let hasSeed = false;
    while (stack.length) {
      const a = stack.pop()!;
      members.push(a);
      const ci = infos[a]!;
      if (ci.e > seedE) hasSeed = true;
      for (let de = -1; de <= 1; de++) {
        for (let dp = -1; dp <= 1; dp++) {
          for (let dl = -1; dl <= 1; dl++) {
            if (de === 0 && dp === 0 && dl === 0) continue;
            const j = at.get(keyOf(ci.ieta + de, (ci.iphi + dp + nPhi) % nPhi, ci.layer + dl));
            if (j !== undefined && comp[j] === -1) {
              comp[j] = nComp;
              stack.push(j);
            }
          }
        }
      }
    }
    nComp++;
    if (!hasSeed) continue;
    for (const grp of splitByMaxima(members, infos, at, keyOf, nPhi, seedE)) {
      const cl = makeCluster(grp, infos, cells, calo, g, nPhi);
      if (cl.energy >= minE) clusters.push(cl);
    }
  }
  return clusters;
}

/** Split a group at its local maxima (cells above 2 × the seed threshold, separated by at least 2 cells from a larger one). */
function splitByMaxima(members: number[], infos: CellInfo[], at: Map<number, number>, keyOf: (a: number, b: number, c: number) => number, nPhi: number, seedE: number): number[][] {
  if (members.length < 6) return [members];
  // a cell is a local maximum if it is the largest of its 26 neighbours and in the largest layer of its tower
  const maxima: number[] = [];
  for (const a of members) {
    const ci = infos[a]!;
    if (ci.e < 2 * seedE) continue;
    let isMax = true;
    for (let de = -1; de <= 1 && isMax; de++) {
      for (let dp = -1; dp <= 1 && isMax; dp++) {
        for (let dl = -1; dl <= 1; dl++) {
          if (de === 0 && dp === 0 && dl === 0) continue;
          const j = at.get(keyOf(ci.ieta + de, (ci.iphi + dp + nPhi) % nPhi, ci.layer + dl));
          if (j !== undefined && infos[j]!.e >= ci.e) {
            isMax = false;
            break;
          }
        }
      }
    }
    if (isMax) maxima.push(a);
  }
  if (maxima.length < 2) return [members];
  // keep maxima that are at least 3 cells from every larger one (closer ones are fluctuations of the same shower)
  maxima.sort((p, q) => infos[q]!.e - infos[p]!.e);
  const kept: number[] = [];
  const dist = (p: CellInfo, q: CellInfo) => Math.hypot(p.ieta - q.ieta, Math.min(Math.abs(p.iphi - q.iphi), nPhi - Math.abs(p.iphi - q.iphi)));
  for (const m of maxima) if (kept.every((k) => dist(infos[k]!, infos[m]!) >= 3)) kept.push(m);
  if (kept.length < 2) return [members];
  const groups: number[][] = kept.map(() => []);
  for (const a of members) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < kept.length; k++) {
      const d = dist(infos[a]!, infos[kept[k]!]!) / Math.sqrt(infos[kept[k]!]!.e); // a bigger shower claims a wider region
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    groups[best]!.push(a);
  }
  return groups.filter((g) => g.length > 0);
}

function makeCluster(members: number[], infos: CellInfo[], cells: readonly CaloCell[], calo: 'ecal' | 'hcal', g: CaloGeometry, nPhi: number): RecoCluster {
  let E = 0;
  let top = members[0]!;
  for (const a of members) {
    E += infos[a]!.e;
    if (infos[a]!.e > infos[top]!.e) top = a;
  }
  const phiRef = cells[infos[top]!.idx]!.phi;
  let se = 0, sp = 0, sl = 0;
  for (const a of members) {
    const c = cells[infos[a]!.idx]!;
    const e = infos[a]!.e;
    se += e * c.eta;
    sp += e * deltaPhi(c.phi, phiRef);
    sl += e * c.layer;
  }
  const eta = se / E;
  const dphi = sp / E;
  let ve = 0, vp = 0;
  const cellIds: number[] = [];
  const share = new Map<number, number>();
  for (const a of members) {
    const c = cells[infos[a]!.idx]!;
    const e = infos[a]!.e;
    ve += e * (c.eta - eta) ** 2;
    vp += e * (deltaPhi(c.phi, phiRef) - dphi) ** 2;
    cellIds.push(infos[a]!.idx);
    if (c.truth.length) for (const t of c.truth) share.set(t, (share.get(t) ?? 0) + e / c.truth.length);
  }
  let phi = phiRef + dphi;
  while (phi > Math.PI) phi -= TWO_PI;
  while (phi <= -Math.PI) phi += TWO_PI;
  const truthEnergy = [...share.entries()].map(([truth, energy]) => ({ truth, energy: energy * g.scale })).sort((p, q) => q.energy - p.energy);
  void nPhi;
  return {
    calo,
    energy: E * g.scale,
    eta,
    phi,
    cells: cellIds,
    etaWidth: Math.sqrt(ve / E),
    phiWidth: Math.sqrt(vp / E),
    nCells: members.length,
    depth: sl / E,
    truthEnergy: truthEnergy.length ? truthEnergy : undefined,
  };
}

// ── tracks and clusters ─────────────────────────────────────────────────────────────────────────

export interface CaloPoint {
  eta: number;
  phi: number;
}

/**
 * Where a track (helix relative to the beam line) crosses the cylinder of radius r (the calorimeter's inner face):
 * pseudorapidity of the crossing point seen from the origin, and azimuth. Undefined for a track that curls up before r.
 */
export function extrapolateToRadius(track: RecoTrack | Helix, r: number): CaloPoint | undefined {
  const h = 'pt' in track ? trackHelix(track) : track;
  const p = helixAtRadius(h, r);
  if (!p) return undefined;
  return { eta: Math.asinh(p.z / r), phi: Math.atan2(p.y, p.x) };
}

export interface TrackClusterLink {
  track: number;
  cluster: number;
  /** Angular distance ΔR between the extrapolated track and the cluster. */
  dR: number;
}

/**
 * Match every track to the nearest cluster of a calorimeter within `maxDR` (extrapolating the track to the calorimeter's
 * inner radius). Returns, for each track index, the index of the matched cluster or −1.
 */
export function matchTracksToClusters(tracks: readonly RecoTrack[], clusters: readonly RecoCluster[], calo: 'ecal' | 'hcal', geom: RecoGeometry, maxDR = 0.05, minPt = 0.5): TrackClusterLink[] {
  const r = geom[calo].rInner;
  const links: TrackClusterLink[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (t.pt < minPt) continue;
    const at = extrapolateToRadius(t, r);
    if (!at) continue;
    let best = -1, bd = maxDR;
    for (let j = 0; j < clusters.length; j++) {
      const c = clusters[j]!;
      if (c.calo !== calo) continue;
      const d = Math.hypot(at.eta - c.eta, deltaPhi(at.phi, c.phi));
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    if (best >= 0) links.push({ track: i, cluster: best, dR: bd });
  }
  return links;
}

/** Direction of a cluster as seen from a vertex at z = zv: the cluster position is on the calorimeter's inner cylinder. */
export function clusterDirection(c: { eta: number; phi: number; calo: 'ecal' | 'hcal' }, geom: RecoGeometry, zv = 0): { eta: number; phi: number } {
  const r = geom[c.calo].rInner;
  const z = r * Math.sinh(c.eta);
  return { eta: Math.asinh((z - zv) / r), phi: c.phi };
}

/** Massless four-vector of a cluster pointing from the vertex at z = zv. */
export function clusterP4(c: RecoCluster, geom: RecoGeometry, zv = 0): P4 {
  const d = clusterDirection(c, geom, zv);
  const pt = c.energy / Math.cosh(d.eta);
  return { E: c.energy, px: pt * Math.cos(d.phi), py: pt * Math.sin(d.phi), pz: pt * Math.sinh(d.eta) };
}
