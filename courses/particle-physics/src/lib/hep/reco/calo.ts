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

import { resolveConfig, type RecoConfig } from './config.ts';
import type { CaloGeometry, RecoGeometry } from './geometry.ts';
import { helixAtRadius, type Helix } from './helix.ts';
import type { RecoCluster, RecoTrack } from './types.ts';
import { trackHelix } from './vertex.ts';

const TWO_PI = 2 * Math.PI;
/** The difference of two azimuths wrapped into (−π, π]. */
const dphiOf = (a: number, b: number): number => {
  let d = a - b;
  if (d > Math.PI) d -= TWO_PI;
  else if (d <= -Math.PI) d += TWO_PI;
  return d;
};

/**
 * Cluster the cells of both calorimeters. Thresholds (GeV, on the raw cell energy) come from `rc`: `ecalSeed`, `ecalGrow`,
 * `hcalSeed`, `hcalGrow` (0 = automatic, from the cell noise); clusters with calibrated energy below `ecalClusterMin` /
 * `hcalClusterMin` are dropped. Cell indices in `RecoCluster.cells` refer to the input list.
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

/** A dense lookup from (η index, φ index, layer) to the cell's slot, reused between events (entries are cleared after use). */
interface CaloGrid {
  etaOff: number;
  nEta: number;
  nPhi: number;
  nLay: number;
  ix: Int32Array;
}
const gridCache = new WeakMap<CaloGeometry, CaloGrid>();
function caloGrid(g: CaloGeometry): CaloGrid {
  let c = gridCache.get(g);
  if (!c) {
    const nPhi = Math.max(4, Math.round(TWO_PI / g.dPhi));
    const etaOff = Math.ceil((g.etaMax + 0.6) / g.dEta) + 2;
    const nLay = Math.max(1, g.layers + 1);
    const nEta = 2 * etaOff;
    c = { etaOff, nEta, nPhi, nLay, ix: new Int32Array(nEta * nPhi * nLay).fill(-1) };
    gridCache.set(g, c);
  }
  return c;
}

let scratchCap = 0;
let sIeta = new Int32Array(0), sIphi = new Int32Array(0), sLay = new Int32Array(0), sCell = new Int32Array(0), sComp = new Int32Array(0), sStack = new Int32Array(0);
let sE = new Float64Array(0);

function clusterOne(cells: readonly CaloCell[], calo: 'ecal' | 'hcal', g: CaloGeometry, seedE: number, growE: number, minE: number): RecoCluster[] {
  const G = caloGrid(g);
  const { nPhi, nLay, etaOff, nEta, ix } = G;
  // the cells above the grow threshold, as parallel arrays (scratch space reused between events)
  const nMax = cells.length;
  if (nMax > scratchCap) {
    scratchCap = Math.max(nMax, 256);
    sIeta = new Int32Array(scratchCap);
    sIphi = new Int32Array(scratchCap);
    sLay = new Int32Array(scratchCap);
    sCell = new Int32Array(scratchCap);
    sComp = new Int32Array(scratchCap);
    sStack = new Int32Array(scratchCap);
    sE = new Float64Array(scratchCap);
  }
  const cIeta = sIeta, cIphi = sIphi, cLay = sLay, cCell = sCell, cE = sE;
  let n = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.calo !== calo || !(c.energy > growE)) continue;
    const ieta = Math.round(c.eta / g.dEta - 0.5) + etaOff;
    if (ieta < 1 || ieta >= nEta - 1 || c.layer < 0 || c.layer >= nLay - 1) continue;
    let iphi = Math.round((c.phi + Math.PI) / g.dPhi - 0.5);
    iphi = ((iphi % nPhi) + nPhi) % nPhi;
    const key = (ieta * nPhi + iphi) * nLay + c.layer;
    const prev = ix[key]!;
    if (prev >= 0) {
      cE[prev]! += c.energy; // duplicate address: add up
      continue;
    }
    ix[key] = n;
    cIeta[n] = ieta;
    cIphi[n] = iphi;
    cLay[n] = c.layer;
    cCell[n] = i;
    cE[n] = c.energy;
    n++;
  }
  const slot = (ieta: number, iphi: number, layer: number): number => (layer < 0 ? -1 : ix[(ieta * nPhi + iphi) * nLay + layer]!);
  const comp = sComp;
  comp.fill(-1, 0, n);
  const stack = sStack;
  const clusters: RecoCluster[] = [];
  let nComp = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const members: number[] = [];
    comp[s] = nComp;
    let sp = 0;
    stack[sp++] = s;
    let hasSeed = false;
    while (sp > 0) {
      const a = stack[--sp]!;
      members.push(a);
      if (cE[a]! > seedE) hasSeed = true;
      const ie = cIeta[a]!, ip = cIphi[a]!, il = cLay[a]!;
      for (let de = -1; de <= 1; de++) {
        for (let dp = -1; dp <= 1; dp++) {
          const jp = ip + dp < 0 ? ip + dp + nPhi : ip + dp >= nPhi ? ip + dp - nPhi : ip + dp;
          for (let dl = -1; dl <= 1; dl++) {
            if (de === 0 && dp === 0 && dl === 0) continue;
            const j = slot(ie + de, jp, il + dl);
            if (j >= 0 && comp[j] === -1) {
              comp[j] = nComp;
              stack[sp++] = j;
            }
          }
        }
      }
    }
    nComp++;
    if (!hasSeed) continue;
    for (const grp of splitByMaxima(members, cIeta, cIphi, cLay, cE, slot, nPhi, seedE)) {
      const cl = makeCluster(grp, cE, cCell, cells, calo, g);
      if (cl.energy >= minE) clusters.push(cl);
    }
  }
  // clear the lookup for the next event
  for (let s = 0; s < n; s++) ix[(cIeta[s]! * nPhi + cIphi[s]!) * nLay + cLay[s]!] = -1;
  return clusters;
}

/** Split a group at its local maxima (cells above 2 × the seed threshold, separated by at least 3 cells from a larger one). */
function splitByMaxima(members: number[], cIeta: Int32Array, cIphi: Int32Array, cLay: Int32Array, cE: Float64Array, slot: (a: number, b: number, c: number) => number, nPhi: number, seedE: number): number[][] {
  if (members.length < 6) return [members];
  // a cell is a local maximum if it is the largest of its 26 neighbours
  const maxima: number[] = [];
  for (const a of members) {
    if (cE[a]! < 2 * seedE) continue;
    let isMax = true;
    for (let de = -1; de <= 1 && isMax; de++) {
      for (let dp = -1; dp <= 1 && isMax; dp++) {
        const jp = (cIphi[a]! + dp + nPhi) % nPhi;
        for (let dl = -1; dl <= 1; dl++) {
          if (de === 0 && dp === 0 && dl === 0) continue;
          const j = slot(cIeta[a]! + de, jp, cLay[a]! + dl);
          if (j >= 0 && cE[j]! >= cE[a]!) {
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
  maxima.sort((p, q) => cE[q]! - cE[p]!);
  const kept: number[] = [];
  // squared distance in cell units
  const dist2 = (p: number, q: number) => {
    const dphi = Math.abs(cIphi[p]! - cIphi[q]!);
    const dp = Math.min(dphi, nPhi - dphi);
    const de = cIeta[p]! - cIeta[q]!;
    return de * de + dp * dp;
  };
  for (const m of maxima) if (kept.every((k) => dist2(k, m) >= 9)) kept.push(m);
  if (kept.length < 2) return [members];
  const groups: number[][] = kept.map(() => []);
  const keptE = kept.map((k) => cE[k]!);
  for (const a of members) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < kept.length; k++) {
      const d = dist2(a, kept[k]!) / keptE[k]!; // a bigger shower claims a wider region (d²/E orders like d/√E)
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    groups[best]!.push(a);
  }
  return groups.filter((gr) => gr.length > 0);
}

function makeCluster(members: number[], cE: Float64Array, cCell: Int32Array, cells: readonly CaloCell[], calo: 'ecal' | 'hcal', g: CaloGeometry): RecoCluster {
  let E = 0;
  let top = members[0]!;
  for (const a of members) {
    E += cE[a]!;
    if (cE[a]! > cE[top]!) top = a;
  }
  const phiRef = cells[cCell[top]!]!.phi;
  let se = 0, sp = 0, sl = 0;
  for (const a of members) {
    const c = cells[cCell[a]!]!;
    const e = cE[a]!;
    se += e * c.eta;
    sp += e * dphiOf(c.phi, phiRef);
    sl += e * c.layer;
  }
  const eta = se / E;
  const dphi = sp / E;
  let ve = 0, vp = 0;
  const cellIds: number[] = [];
  let share: Map<number, number> | undefined;
  for (const a of members) {
    const c = cells[cCell[a]!]!;
    const e = cE[a]!;
    ve += e * (c.eta - eta) ** 2;
    vp += e * (dphiOf(c.phi, phiRef) - dphi) ** 2;
    cellIds.push(cCell[a]!);
    if (c.truth.length) {
      share ??= new Map();
      for (const t of c.truth) share.set(t, (share.get(t) ?? 0) + e / c.truth.length);
    }
  }
  let phi = phiRef + dphi;
  while (phi > Math.PI) phi -= TWO_PI;
  while (phi <= -Math.PI) phi += TWO_PI;
  const truthEnergy = share ? [...share.entries()].map(([truth, energy]) => ({ truth, energy: energy * g.scale })).sort((p, q) => q.energy - p.energy) : undefined;
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
    truthEnergy,
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
 * inner radius); with `widthScale` > 0 a cluster's reach grows by that multiple of its angular rms width. Returns one link
 * per matched track.
 */
export function matchTracksToClusters(tracks: readonly RecoTrack[], clusters: readonly RecoCluster[], calo: 'ecal' | 'hcal', geom: RecoGeometry, maxDR = 0.05, minPt = 0.5, widthScale = 0): TrackClusterLink[] {
  const r = geom[calo].rInner;
  const links: TrackClusterLink[] = [];
  // bin the clusters in (η, φ) so that a track only looks at its own neighbourhood
  let maxReach = maxDR;
  for (const c of clusters) if (c.calo === calo) maxReach = Math.max(maxReach, maxDR + widthScale * Math.hypot(c.etaWidth, c.phiWidth));
  const bin = Math.max(0.1, maxReach);
  const etaMax = geom[calo].etaMax + 1;
  const nE = Math.ceil((2 * etaMax) / bin) + 1;
  const nP = Math.max(1, Math.floor(TWO_PI / bin));
  const binP = TWO_PI / nP;
  const grid: number[][] = new Array(nE * nP);
  clusters.forEach((c, j) => {
    if (c.calo !== calo) return;
    const be = Math.min(nE - 1, Math.max(0, Math.floor((c.eta + etaMax) / bin)));
    const bp = Math.min(nP - 1, Math.floor((c.phi + Math.PI) / binP));
    (grid[be * nP + bp] ??= []).push(j);
  });
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (t.pt < minPt) continue;
    const at = extrapolateToRadius(t, r);
    if (!at) continue;
    const be = Math.floor((at.eta + etaMax) / bin);
    const bp = Math.min(nP - 1, Math.floor((at.phi + Math.PI) / binP));
    let best = -1, bd = Infinity;
    for (let de = -1; de <= 1; de++) {
      const e2 = be + de;
      if (e2 < 0 || e2 >= nE) continue;
      for (let dp = -1; dp <= 1; dp++) {
        const list = grid[e2 * nP + ((bp + dp + nP) % nP)];
        if (!list) continue;
        for (const j of list) {
          const c = clusters[j]!;
          const d = Math.hypot(at.eta - c.eta, dphiOf(at.phi, c.phi));
          // a broad cluster (several overlapping showers) is reached from further away
          const reach = maxDR + widthScale * Math.hypot(c.etaWidth, c.phiWidth);
          if (d < reach && d < bd) {
            bd = d;
            best = j;
          }
        }
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

/**
 * A coarse (η, φ) grid over the clusters of one calorimeter, for "what is near here" queries without looking at every
 * cluster: `near(eta, phi, cb)` calls `cb(j)` for the clusters in the 3 × 3 bins around the point (bin size ≥ the largest
 * distance you will ask about).
 */
export function clusterGrid(clusters: readonly RecoCluster[], calo: 'ecal' | 'hcal', geom: RecoGeometry, bin = 0.2): { near: (eta: number, phi: number, cb: (j: number) => void) => void } {
  const etaMax = geom[calo].etaMax + 1;
  const nE = Math.ceil((2 * etaMax) / bin) + 1;
  const nP = Math.max(1, Math.floor(TWO_PI / bin));
  const binP = TWO_PI / nP;
  const grid: number[][] = new Array(nE * nP);
  clusters.forEach((c, j) => {
    if (c.calo !== calo) return;
    const be = Math.min(nE - 1, Math.max(0, Math.floor((c.eta + etaMax) / bin)));
    const bp = Math.min(nP - 1, Math.floor((c.phi + Math.PI) / binP));
    (grid[be * nP + bp] ??= []).push(j);
  });
  return {
    near(eta, phi, cb) {
      const be = Math.floor((eta + etaMax) / bin);
      const bp = Math.min(nP - 1, Math.max(0, Math.floor((phi + Math.PI) / binP)));
      for (let de = -1; de <= 1; de++) {
        const e2 = be + de;
        if (e2 < 0 || e2 >= nE) continue;
        for (let dp = -1; dp <= 1; dp++) {
          const list = grid[e2 * nP + ((bp + dp + nP) % nP)];
          if (list) for (const j of list) cb(j);
        }
      }
    },
  };
}
