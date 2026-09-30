/**
 * Jet clustering: the sequential recombination algorithms (kT, Cambridge/Aachen, anti-kT), jet mass and N-subjettiness.
 *
 * **The algorithm.** Given particles with transverse momentum pT, rapidity y and azimuth φ, define the distances
 *
 *     d_ij = min(pT_i^{2p}, pT_j^{2p}) · ΔR_ij² / R²,          d_iB = pT_i^{2p},          ΔR² = Δy² + Δφ²
 *
 * and repeat: find the smallest of all d_ij and d_iB. If it is a d_ij, replace i and j by their sum (E-scheme: add the
 * four-vectors); if it is a d_iB, call i a jet and remove it. The exponent p chooses the algorithm: p = 1 kT (soft
 * particles merge first: clustering follows the inverse of a shower), p = 0 Cambridge/Aachen (purely angular),
 * p = −1 anti-kT (hard particles collect the soft ones around them: jets are round cones of radius R, and soft
 * radiation cannot change them). All three are infrared and collinear safe: adding a soft particle, or splitting one
 * particle into two collinear ones, does not change the hard jets.
 *
 * The implementation is the O(N²) one: each particle remembers its nearest neighbour (in the metric d_ij), so finding
 * the smallest distance costs O(N) and a merge only triggers recomputation for the particles that pointed to the two
 * merged ones. This is the reference for `reco.antiKt`.
 */
import { hook } from '../hooks.ts';
import type { P4 } from '../kinematics/index.ts';
import { deltaPhi, mass } from '../kinematics/index.ts';

export interface JetResult {
  /** Jets with pT above `ptMin`, sorted by decreasing pT. */
  jets: P4[];
  /** For each jet, the indices (into the input list) of its constituents. */
  constituents: number[][];
}

interface Pseudo {
  E: number;
  px: number;
  py: number;
  pz: number;
  y: number;
  phi: number;
  /** pT^(2p) */
  k: number;
  alive: boolean;
  nn: number;
  dnn: number;
  members: number[];
}

function rapidityOf(E: number, pz: number): number {
  const a = E + pz;
  const b = E - pz;
  if (a <= 0 || b <= 0) return pz >= 0 ? 1e6 : -1e6;
  return 0.5 * Math.log(a / b);
}

export interface SequentialOptions {
  /** Stop when this many pseudojets remain (exclusive clustering) instead of using the beam distance. */
  nJets?: number;
}

/**
 * Generalised-kT clustering with exponent `p` (−1 anti-kT, 0 Cambridge/Aachen, 1 kT) and radius R.
 * Returns the inclusive jets with pT > ptMin, sorted by pT. With `opts.nJets` the clustering is exclusive: it stops with
 * that many jets (no beam distance, no pT cut).
 */
export function sequentialJets(particles: readonly P4[], R: number, p: number, ptMin = 0, opts: SequentialOptions = {}): JetResult {
  const items: Pseudo[] = [];
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]!;
    const pt2 = a.px * a.px + a.py * a.py;
    if (!(pt2 > 1e-24)) continue; // along the beam axis: cannot be clustered (pT = 0)
    items.push({ E: a.E, px: a.px, py: a.py, pz: a.pz, y: rapidityOf(a.E, a.pz), phi: Math.atan2(a.py, a.px), k: Math.pow(pt2, p), alive: true, nn: -1, dnn: Infinity, members: [i] });
  }
  const n0 = items.length;
  const invR2 = 1 / (R * R);
  const dist = (a: Pseudo, b: Pseudo): number => {
    const dy = a.y - b.y;
    let dphi = Math.abs(a.phi - b.phi);
    if (dphi > Math.PI) dphi = 2 * Math.PI - dphi;
    return (a.k < b.k ? a.k : b.k) * (dy * dy + dphi * dphi) * invR2;
  };
  const recomputeNN = (i: number): void => {
    const a = items[i]!;
    let best = Infinity;
    let bj = -1;
    for (let j = 0; j < items.length; j++) {
      if (j === i) continue;
      const b = items[j]!;
      if (!b.alive) continue;
      const d = dist(a, b);
      if (d < best) {
        best = d;
        bj = j;
      }
    }
    a.nn = bj;
    a.dnn = best;
  };
  for (let i = 0; i < n0; i++) recomputeNN(i);
  const jets: { E: number; px: number; py: number; pz: number; members: number[] }[] = [];
  let nAlive = n0;
  const target = opts.nJets ?? 0;
  while (nAlive > 0) {
    if (opts.nJets !== undefined && nAlive <= target) break;
    // the smallest distance
    let best = Infinity;
    let bi = -1;
    let beam = false;
    for (let i = 0; i < items.length; i++) {
      const a = items[i]!;
      if (!a.alive) continue;
      if (opts.nJets === undefined && a.k < best) {
        best = a.k;
        bi = i;
        beam = true;
      }
      if (a.nn >= 0 && a.dnn < best) {
        best = a.dnn;
        bi = i;
        beam = false;
      }
    }
    if (bi < 0) break;
    const a = items[bi]!;
    if (beam) {
      a.alive = false;
      nAlive--;
      jets.push({ E: a.E, px: a.px, py: a.py, pz: a.pz, members: a.members });
      for (let j = 0; j < items.length; j++) if (items[j]!.alive && items[j]!.nn === bi) recomputeNN(j);
      continue;
    }
    const j = a.nn;
    const b = items[j]!;
    // merge b into a
    a.E += b.E;
    a.px += b.px;
    a.py += b.py;
    a.pz += b.pz;
    a.members = a.members.concat(b.members);
    const pt2 = a.px * a.px + a.py * a.py;
    a.y = rapidityOf(a.E, a.pz);
    a.phi = Math.atan2(a.py, a.px);
    a.k = Math.pow(Math.max(pt2, 1e-300), p);
    b.alive = false;
    nAlive--;
    recomputeNN(bi);
    for (let m = 0; m < items.length; m++) {
      const c = items[m]!;
      if (!c.alive || m === bi) continue;
      if (c.nn === bi || c.nn === j) {
        recomputeNN(m);
      } else {
        const d = dist(a, c);
        if (d < c.dnn) {
          c.dnn = d;
          c.nn = bi;
        }
      }
    }
  }
  if (opts.nJets !== undefined) {
    for (const a of items) if (a.alive) jets.push({ E: a.E, px: a.px, py: a.py, pz: a.pz, members: a.members });
  }
  const keep = opts.nJets !== undefined ? jets : jets.filter((j) => Math.hypot(j.px, j.py) > ptMin);
  keep.sort((u, v) => Math.hypot(v.px, v.py) - Math.hypot(u.px, u.py));
  return {
    jets: keep.map((j) => ({ E: j.E, px: j.px, py: j.py, pz: j.pz })),
    constituents: keep.map((j) => j.members),
  };
}

/** Anti-kT jets with radius R: the standard choice at the LHC. Reference for the hook `reco.antiKt`. */
export function antiKt(particles: P4[], R: number, ptMin = 0): JetResult {
  return sequentialJets(particles, R, -1, ptMin);
}
/** kT jets (p = 1). */
export function kt(particles: P4[], R: number, ptMin = 0): JetResult {
  return sequentialJets(particles, R, 1, ptMin);
}
/** Cambridge/Aachen jets (p = 0). */
export function cambridgeAachen(particles: P4[], R: number, ptMin = 0): JetResult {
  return sequentialJets(particles, R, 0, ptMin);
}
/** Cluster with the current `reco.antiKt` (the reader's version if installed). */
export function clusterJets(particles: P4[], R: number, ptMin = 0): JetResult {
  return hook('reco.antiKt', antiKt)(particles, R, ptMin);
}

/** Exactly n jets by exclusive clustering (kT by default, as used to find subjet axes). */
export function exclusiveJets(particles: readonly P4[], n: number, p = 1, R = 1): JetResult {
  return sequentialJets(particles, R, p, 0, { nJets: n });
}

/** Invariant mass of a jet. */
export function jetMass(jet: P4): number {
  return Math.max(0, mass(jet));
}

/**
 * N-subjettiness τ_N (Thaler & Van Tilburg): how well the constituents fit N subjets,
 * τ_N = Σ_i pT_i min_k ΔR_{i,k}^β / Σ_i pT_i R0^β, with the N axes found by exclusive kT clustering. Small τ_N means
 * the jet has N (or fewer) prongs; the ratio τ₂/τ₁ separates two-prong jets (W, Z, H → bb̄) from single-quark jets.
 */
export function nSubjettiness(constituents: readonly P4[], N: number, beta = 1, R0 = 0.8): number {
  if (N <= 0 || constituents.length === 0) return 1;
  const axes = constituents.length <= N ? constituents.slice() : exclusiveJets(constituents, N, 1).jets;
  const ay = axes.map((a) => rapidityOf(a.E, a.pz));
  const ap = axes.map((a) => Math.atan2(a.py, a.px));
  let num = 0;
  let den = 0;
  for (const c of constituents) {
    const pt = Math.hypot(c.px, c.py);
    if (pt <= 0) continue;
    const y = rapidityOf(c.E, c.pz);
    const phi = Math.atan2(c.py, c.px);
    let dmin = Infinity;
    for (let k = 0; k < axes.length; k++) {
      const d = Math.hypot(y - ay[k]!, deltaPhi(phi, ap[k]!));
      if (d < dmin) dmin = d;
    }
    num += pt * Math.pow(dmin, beta);
    den += pt * Math.pow(R0, beta);
  }
  return den > 0 ? num / den : 1;
}
