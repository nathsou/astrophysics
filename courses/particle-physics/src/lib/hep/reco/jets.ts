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
  // structure of arrays over the usable particles; merged pseudojets reuse the slot of the first member
  const idxMap: number[] = [];
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]!;
    if (a.px * a.px + a.py * a.py > 1e-24) idxMap.push(i); // pT = 0 (along the beam axis) cannot be clustered
  }
  const n0 = idxMap.length;
  const E = new Float64Array(n0), px = new Float64Array(n0), py = new Float64Array(n0), pz = new Float64Array(n0);
  const y = new Float64Array(n0), phi = new Float64Array(n0), k = new Float64Array(n0), dnn = new Float64Array(n0);
  const nn = new Int32Array(n0).fill(-1);
  // the live slots, in a compact list
  const live = new Int32Array(n0);
  const where = new Int32Array(n0); // position of slot i in `live`
  const members: number[][] = new Array(n0);
  for (let s = 0; s < n0; s++) {
    const a = particles[idxMap[s]!]!;
    E[s] = a.E;
    px[s] = a.px;
    py[s] = a.py;
    pz[s] = a.pz;
    y[s] = rapidityOf(a.E, a.pz);
    phi[s] = Math.atan2(a.py, a.px);
    k[s] = p === 0 ? 1 : Math.pow(a.px * a.px + a.py * a.py, p);
    members[s] = [idxMap[s]!];
    live[s] = s;
    where[s] = s;
  }
  let nLive = n0;
  const invR2 = 1 / (R * R);
  const TWO_PI = 2 * Math.PI;
  const dist = (a: number, b: number): number => {
    const dy = y[a]! - y[b]!;
    let dphi = Math.abs(phi[a]! - phi[b]!);
    dphi = Math.min(dphi, TWO_PI - dphi);
    return Math.min(k[a]!, k[b]!) * (dy * dy + dphi * dphi) * invR2;
  };
  const recomputeNN = (a: number): void => {
    let best = Infinity;
    let bj = -1;
    const ya = y[a]!, pa = phi[a]!, ka = k[a]!;
    for (let q = 0; q < nLive; q++) {
      const b = live[q]!;
      if (b === a) continue;
      const dy = ya - y[b]!;
      let dphi = Math.abs(pa - phi[b]!);
      dphi = Math.min(dphi, TWO_PI - dphi);
      const d = Math.min(ka, k[b]!) * (dy * dy + dphi * dphi) * invR2;
      if (d < best) {
        best = d;
        bj = b;
      }
    }
    nn[a] = bj;
    dnn[a] = best;
  };
  const remove = (a: number): void => {
    const w = where[a]!;
    const last = live[nLive - 1]!;
    live[w] = last;
    where[last] = w;
    nLive--;
  };
  for (let s = 0; s < n0; s++) recomputeNN(s);
  const jets: { E: number; px: number; py: number; pz: number; members: number[] }[] = [];
  const target = opts.nJets ?? 0;
  const inclusive = opts.nJets === undefined;
  while (nLive > 0) {
    if (!inclusive && nLive <= target) break;
    let best = Infinity;
    let bi = -1;
    let beam = false;
    for (let q = 0; q < nLive; q++) {
      const a = live[q]!;
      if (inclusive && k[a]! < best) {
        best = k[a]!;
        bi = a;
        beam = true;
      }
      if (nn[a]! >= 0 && dnn[a]! < best) {
        best = dnn[a]!;
        bi = a;
        beam = false;
      }
    }
    if (bi < 0) break;
    if (beam) {
      jets.push({ E: E[bi]!, px: px[bi]!, py: py[bi]!, pz: pz[bi]!, members: members[bi]! });
      remove(bi);
      for (let q = 0; q < nLive; q++) if (nn[live[q]!] === bi) recomputeNN(live[q]!);
      continue;
    }
    const j = nn[bi]!;
    E[bi]! += E[j]!;
    px[bi]! += px[j]!;
    py[bi]! += py[j]!;
    pz[bi]! += pz[j]!;
    members[bi] = members[bi]!.concat(members[j]!);
    y[bi] = rapidityOf(E[bi]!, pz[bi]!);
    phi[bi] = Math.atan2(py[bi]!, px[bi]!);
    k[bi] = p === 0 ? 1 : Math.pow(Math.max(px[bi]! * px[bi]! + py[bi]! * py[bi]!, 1e-300), p);
    remove(j);
    recomputeNN(bi);
    for (let q = 0; q < nLive; q++) {
      const c = live[q]!;
      if (c === bi) continue;
      // Every other particle's distances are unchanged except those to the merged pseudojet. So if the merged pseudojet is
      // at least as close as the old nearest neighbour was, it is the new nearest neighbour; only otherwise is a rescan needed.
      const d = dist(bi, c);
      if (d <= dnn[c]! || (nn[c] !== bi && nn[c] !== j && d < dnn[c]!)) {
        dnn[c] = d;
        nn[c] = bi;
      } else if (nn[c] === bi || nn[c] === j) recomputeNN(c);
    }
  }
  if (!inclusive) for (let q = 0; q < nLive; q++) {
    const a = live[q]!;
    jets.push({ E: E[a]!, px: px[a]!, py: py[a]!, pz: pz[a]!, members: members[a]! });
  }
  const keep = inclusive ? jets.filter((j) => Math.hypot(j.px, j.py) > ptMin) : jets;
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
