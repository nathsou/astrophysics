/**
 * Physics objects from tracks and clusters: a simplified particle flow, muons, electrons and photons (with conversions),
 * isolation, hadronic taus, jets, missing transverse momentum.
 *
 * **Particle flow.** Every track and cluster is used once. Tracks, and the ECAL and HCAL clusters near them, are linked
 * into blocks. In a block the charged particles take their momentum from the tracker (far better than the calorimeter
 * at low energy); the calorimeter energy they are expected to have left (equal to their momentum) is subtracted; what
 * remains, if significant compared with the calorimeter's resolution, is neutral: photons from the ECAL part, neutral
 * hadrons from the HCAL part. Clusters with no track are photons (ECAL only) or neutral hadrons. The list of these
 * particles is what the jet algorithm clusters: the jet energy is dominated by tracker-measured charged particles and
 * finely resolved photons, instead of by the coarse HCAL.
 *
 * **Not modelled:** a proper calibration of the expected calorimeter response as a function of momentum, the split of a
 * block's energy between several neutral particles, electron and photon superclusters beyond a simple φ road, vertex
 * constraints on conversions, pile-up subtraction for neutral particles (no PUPPI, no area subtraction).
 */
import type { MuonHit } from '../event/index.ts';
import { deltaPhi, fromPtEtaPhiM, type P4 } from '../kinematics/index.ts';
import { resolveConfig, type RecoConfig } from './config.ts';
import { clusterGrid, clusterP4, extrapolateToRadius, matchTracksToClusters } from './calo.ts';
import type { RecoGeometry } from './geometry.ts';
import { curvatureFromPt, helixAtRadius, propagateToRadius } from './helix.ts';
import { highland } from './material.ts';
import type { RecoCluster, RecoObjectX, RecoTrack } from './types.ts';
import { fitVertex, trackHelix, type RecoVertex } from './vertex.ts';
import { hook } from '../hooks.ts';

const M_PI = 0.13957039;
const M_MU = 0.1056583755;
const M_E = 0.000510998950;

/** The four-vector of a track with the given mass, at its perigee direction. */
export function trackP4(t: { pt: number; eta: number; phi: number }, m: number): P4 {
  return fromPtEtaPhiM(t.pt, t.eta, t.phi, m);
}

const pt2 = (p: P4) => Math.hypot(p.px, p.py);
const etaOf = (p: P4) => {
  const pt = pt2(p);
  return pt > 0 ? Math.asinh(p.pz / pt) : p.pz >= 0 ? 10 : -10;
};
const phiOf = (p: P4) => Math.atan2(p.py, p.px);
const dR = (e1: number, p1: number, e2: number, p2: number) => Math.hypot(e1 - e2, deltaPhi(p1, p2));

// ── missing pT ─────────────────────────────────────────────────────────────────────────────

/** Missing transverse momentum of a set of objects: minus their vector sum, (x, y) in GeV. Reference for the hook `reco.missingPt`. */
export function missingPt(objects: P4[]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const o of objects) {
    x -= o.px;
    y -= o.py;
  }
  return { x, y };
}

/**
 * Missing transverse momentum of the whole event from the calorimeter: minus the vector sum of the transverse energy of
 * all cells (E/cosh η, pointing along the cell's φ), corrected for muons (which leave only a sliver of energy in the
 * calorimeters) by adding their momenta. Also returns the scalar sum of transverse energy. Uses the hook `reco.missingPt`.
 */
export function metFromEvent(cells: readonly { calo: 'ecal' | 'hcal'; eta: number; phi: number; energy: number }[], geom: RecoGeometry, muons: readonly P4[] = []): { met: { x: number; y: number }; sumEt: number } {
  const parts: P4[] = [];
  let sumEt = 0;
  for (const c of cells) {
    const e = c.energy * geom[c.calo].scale;
    const et = e / Math.cosh(c.eta);
    sumEt += et;
    parts.push({ E: e, px: et * Math.cos(c.phi), py: et * Math.sin(c.phi), pz: et * Math.sinh(c.eta) });
  }
  for (const m of muons) {
    parts.push(m);
    sumEt += pt2(m);
  }
  return { met: hook('reco.missingPt', missingPt)(parts), sumEt };
}

// ── particle flow ──────────────────────────────────────────────────────────────────────────────

export interface PFCandidate {
  kind: 'chHad' | 'photon' | 'nHad' | 'muon';
  p: P4;
  charge: number;
  /** Index of the track (−1 for neutrals) and of the clusters it was made from. */
  track: number;
  clusters: number[];
  truth: number;
  /** For charged candidates: compatible with the primary vertex. */
  fromPV: boolean;
}

export interface PFOptions {
  /** z of the primary vertex (mm) and the uncertainty of its z (for charged-hadron association). */
  pvZ?: number;
  /** Tracks identified as muons (by index): they keep their tracker momentum and consume a MIP worth of calorimeter energy. */
  muonTracks?: ReadonlySet<number>;
  /** Drop charged candidates that are not from the primary vertex (charged-hadron subtraction). */
  chs?: boolean;
  /** An excess of calorimeter energy over the tracks' momenta is neutral if it exceeds this many σ (default 1.5). */
  excessSigma?: number;
}

function dominantTruth(c: RecoCluster): number {
  const t = c.truthEnergy?.[0];
  return t && t.energy > 0.5 * c.energy ? t.truth : -1;
}

/**
 * The simplified particle-flow reconstruction (see the file header): a list of particles with four-momenta, each with the
 * track and clusters it came from. `tracks` and `clusters` are the event's; clusters include both calorimeters.
 */
export function particleFlow(tracks: readonly RecoTrack[], clusters: readonly RecoCluster[], geom: RecoGeometry, opts: PFOptions = {}): PFCandidate[] {
  const zv = opts.pvZ ?? 0;
  const muonTracks = opts.muonTracks ?? new Set<number>();
  const nSig = opts.excessSigma ?? 1.5;
  const nT = tracks.length;
  const nC = clusters.length;
  // union-find over tracks [0, nT) and clusters [nT, nT + nC)
  const parent = Array.from({ length: nT + nC }, (_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!;
      a = parent[a]!;
    }
    return a;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (const l of matchTracksToClusters(tracks, clusters, 'ecal', geom, 0.05, 0, 1)) union(l.track, nT + l.cluster);
  for (const l of matchTracksToClusters(tracks, clusters, 'hcal', geom, 0.1, 0, 1.5)) union(l.track, nT + l.cluster);
  // each ECAL cluster to the nearest HCAL cluster within 0.1
  const hgrid = clusterGrid(clusters, 'hcal', geom, 0.2);
  for (let i = 0; i < nC; i++) {
    const a = clusters[i]!;
    if (a.calo !== 'ecal') continue;
    let best = -1, bd = 0.1;
    hgrid.near(a.eta, a.phi, (j) => {
      const b = clusters[j]!;
      const d = dR(a.eta, a.phi, b.eta, b.phi);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best >= 0) union(nT + i, nT + best);
  }
  const blocks = new Map<number, { tracks: number[]; ecal: number[]; hcal: number[] }>();
  const get = (r: number) => {
    let b = blocks.get(r);
    if (!b) blocks.set(r, (b = { tracks: [], ecal: [], hcal: [] }));
    return b;
  };
  for (let i = 0; i < nT; i++) get(find(i)).tracks.push(i);
  for (let j = 0; j < nC; j++) (clusters[j]!.calo === 'ecal' ? get(find(nT + j)).ecal : get(find(nT + j)).hcal).push(j);

  const out: PFCandidate[] = [];
  const pvOk = (t: RecoTrack): boolean => {
    const dz = Math.abs((t.z0Raw ?? t.z0) - zv);
    return dz < Math.max(0.5, 3 * (t.sigmaZ0 ?? 0.3));
  };
  const nearestP4 = (ids: number[], m: number): P4 => {
    // energy-weighted direction of the clusters, corrected for the vertex position
    let E = 0, px = 0, py = 0, pz = 0;
    for (const j of ids) {
      const p = clusterP4(clusters[j]!, geom, zv);
      E += p.E;
      px += p.px;
      py += p.py;
      pz += p.pz;
    }
    void m;
    return { E, px, py, pz };
  };
  for (const b of blocks.values()) {
    const eE = b.ecal.reduce((a, j) => a + clusters[j]!.energy, 0);
    const eH = b.hcal.reduce((a, j) => a + clusters[j]!.energy, 0);
    const cl = [...b.ecal, ...b.hcal];
    let expected = 0;
    for (const i of b.tracks) {
      const t = tracks[i]!;
      const isMu = muonTracks.has(i);
      const p = t.pt * Math.cosh(t.eta);
      expected += isMu ? Math.min(p, 1.0) : p;
      const cand: PFCandidate = {
        kind: isMu ? 'muon' : 'chHad',
        p: trackP4(t, isMu ? M_MU : M_PI),
        charge: t.charge,
        track: i,
        clusters: cl,
        truth: t.truth,
        fromPV: pvOk(t),
      };
      if (!(opts.chs && !cand.fromPV)) out.push(cand);
    }
    if (cl.length === 0) continue;
    if (b.tracks.length === 0) {
      // neutral block: photons from ECAL-only clusters, neutral hadrons otherwise
      if (b.hcal.length === 0) {
        for (const j of b.ecal) out.push({ kind: 'photon', p: clusterP4(clusters[j]!, geom, zv), charge: 0, track: -1, clusters: [j], truth: dominantTruth(clusters[j]!), fromPV: true });
      } else {
        const p = nearestP4(cl, 0);
        out.push({ kind: 'nHad', p, charge: 0, track: -1, clusters: cl, truth: dominantTruth(clusters[cl[0]!]!), fromPV: true });
      }
      continue;
    }
    // charged block: is there a significant neutral excess?
    const E = eE + eH;
    const sig = Math.hypot(eE * Math.hypot(geom.ecal.stochastic / Math.sqrt(Math.max(eE, 1e-3)), geom.ecal.constant), eH * Math.hypot(geom.hcal.stochastic / Math.sqrt(Math.max(eH, 1e-3)), geom.hcal.constant));
    const excess = E - expected;
    if (excess > nSig * sig && excess > 1) {
      if (eE > 0 && b.ecal.length) {
        const e = excess * (eE / E);
        if (e > 0.5) {
          const base = nearestP4(b.ecal, 0);
          const k = e / base.E;
          out.push({ kind: 'photon', p: { E: e, px: base.px * k, py: base.py * k, pz: base.pz * k }, charge: 0, track: -1, clusters: b.ecal, truth: dominantTruth(clusters[b.ecal[0]!]!), fromPV: true });
        }
      }
      if (eH > 0 && b.hcal.length) {
        const e = excess * (eH / E);
        if (e > 0.5) {
          const base = nearestP4(b.hcal, 0);
          const k = e / base.E;
          out.push({ kind: 'nHad', p: { E: e, px: base.px * k, py: base.py * k, pz: base.pz * k }, charge: 0, track: -1, clusters: b.hcal, truth: dominantTruth(clusters[b.hcal[0]!]!), fromPV: true });
        }
      }
    }
  }
  return out;
}

// ── muons ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Where the muon system should see a track: the track is continued through the calorimeters (losing the mean muon energy
 * loss, bending in the solenoid field with the lower momentum), then, beyond the coil, through the return field of the
 * muon system, which is opposite to the solenoid's and bends it back. Returns, per station, the expected position and
 * the half-widths of the matching window (resolution, and multiple scattering in the calorimeters and the return yoke).
 */
export function predictStationHits(track: RecoTrack, geom: RecoGeometry): { station: number; x: number; y: number; z: number; wT: number; wZ: number }[] {
  const p = track.pt * Math.cosh(track.eta);
  if (p < 0.8 * geom.muon.minP || geom.muon.stations.length === 0) return [];
  const pe = helixAtRadius(trackHelix(track), geom.ecal.rInner);
  if (!pe) return [];
  const ch = Math.cosh(track.eta);
  const f = Math.min(10, ch);
  const pa = geom.muon.momentumAfterCalo(p, f);
  if (pa < 0.5) return [];
  const ptA = pa / ch;
  const st0 = { x: pe.x, y: pe.y, z: pe.z, psi: pe.phi, tanLambda: track.tanLambda, c: curvatureFromPt(ptA, geom.bField, track.charge) };
  const coil = propagateToRadius(st0, geom.coilRadius);
  if (!coil) return [];
  const B2 = geom.muon.returnField;
  const bent = { ...coil, c: B2 !== 0 ? curvatureFromPt(ptA, B2, track.charge) : 0 };
  const straight = { ...coil, c: 0 };
  const th0 = highland(0.5 * (p + pa), geom.muon.caloX0 * f);
  const out: { station: number; x: number; y: number; z: number; wT: number; wZ: number }[] = [];
  geom.muon.stations.forEach((S, i) => {
    const n = propagateToRadius(bent, S.r);
    if (!n || Math.abs(n.z) > S.halfLength) return;
    const s = propagateToRadius(straight, S.r);
    const bend = s ? Math.hypot(n.x - s.x, n.y - s.y) : 0;
    const lever = Math.max(0, S.r - geom.coilRadius);
    const wT = 4 * S.sigmaRPhi + 12 + 0.3 * bend + 3 * th0 * lever;
    const wZ = 4 * S.sigmaZ + 12 + 3 * th0 * lever * ch * ch;
    out.push({ station: i, x: n.x, y: n.y, z: n.z, wT, wZ });
  });
  return out;
}

export interface MuonCandidate {
  track: number;
  nStations: number;
  /** Matched muon-hit indices, one per station. */
  hits: number[];
}

/**
 * Muon identification: a tracker track (pT above `muonPtMin`, enough momentum to reach the muon system) becomes a muon if
 * at least `min(2, number of stations)` stations have a hit inside the predicted window (see `predictStationHits`).
 */
export function findMuons(tracks: readonly RecoTrack[], muonHits: readonly MuonHit[], geom: RecoGeometry, rcIn?: Partial<RecoConfig>): MuonCandidate[] {
  const rc = resolveConfig(rcIn);
  const need = Math.min(2, geom.muon.stations.length);
  if (need === 0 || muonHits.length === 0) return [];
  const byStation: number[][] = geom.muon.stations.map(() => []);
  muonHits.forEach((h, i) => byStation[h.station]?.push(i));
  const claimed = new Set<number>();
  const out: MuonCandidate[] = [];
  const order = tracks.map((_, i) => i).sort((a, b) => tracks[b]!.pt - tracks[a]!.pt);
  for (const i of order) {
    const t = tracks[i]!;
    if (t.pt < rc.muonPtMin) continue;
    const pred = predictStationHits(t, geom);
    if (pred.length < need) continue;
    const hitsFound: number[] = [];
    for (const s of pred) {
      let best = -1, bd = Infinity;
      for (const hi of byStation[s.station]!) {
        if (claimed.has(hi)) continue;
        const h = muonHits[hi]!;
        const r = Math.hypot(h.x, h.y);
        const dphi = Math.atan2(h.y, h.x) - Math.atan2(s.y, s.x);
        const dT = deltaPhi(Math.atan2(h.y, h.x), Math.atan2(s.y, s.x)) * r;
        void dphi;
        const dz = h.z - s.z;
        if (Math.abs(dT) > s.wT || Math.abs(dz) > s.wZ) continue;
        const d = (dT / s.wT) ** 2 + (dz / s.wZ) ** 2;
        if (d < bd) {
          bd = d;
          best = hi;
        }
      }
      if (best >= 0) hitsFound.push(best);
    }
    if (hitsFound.length >= need) {
      for (const h of hitsFound) claimed.add(h);
      out.push({ track: i, nStations: hitsFound.length, hits: hitsFound });
    }
  }
  return out;
}

// ── isolation ──────────────────────────────────────────────────────────────────────────────────

/**
 * Isolation: the scalar sum of the pT of other tracks (from the primary vertex, pT above `minPt`) in a cone of radius
 * `cone` around the object, divided by the object's own pT. Tracks in `exclude` (the object's own) and within
 * ΔR < 0.01 are skipped. Small means isolated. Reference for the isolation of electrons, muons and photons.
 */
export function trackIsolation(obj: { eta: number; phi: number; pt: number }, tracks: readonly RecoTrack[], opts: { exclude?: ReadonlySet<number>; pvZ?: number; cone?: number; minPt?: number } = {}): number {
  const cone = opts.cone ?? 0.3;
  const minPt = opts.minPt ?? 0.5;
  let s = 0;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (t.pt < minPt || opts.exclude?.has(i)) continue;
    if (opts.pvZ !== undefined && Math.abs((t.z0Raw ?? t.z0) - opts.pvZ) > Math.max(0.5, 3 * (t.sigmaZ0 ?? 0.3))) continue;
    const d = dR(t.eta, t.phi, obj.eta, obj.phi);
    if (d < cone && d > 0.01) s += t.pt;
  }
  return s / obj.pt;
}

/** Calorimeter isolation: transverse energy of clusters in the cone (except those in `exclude`), relative to the object's pT. */
export function caloIsolation(obj: { eta: number; phi: number; pt: number }, clusters: readonly RecoCluster[], geom: RecoGeometry, opts: { exclude?: ReadonlySet<number>; pvZ?: number; cone?: number } = {}): number {
  const cone = opts.cone ?? 0.3;
  let s = 0;
  for (let j = 0; j < clusters.length; j++) {
    if (opts.exclude?.has(j)) continue;
    const c = clusters[j]!;
    const p = clusterP4(c, geom, opts.pvZ ?? 0);
    const d = dR(etaOf(p), phiOf(p), obj.eta, obj.phi);
    if (d < cone) s += pt2(p);
  }
  return s / obj.pt;
}

// ── electrons and photons ───────────────────────────────────────────────────────────────────────

export interface EgammaResult {
  electrons: RecoObjectX[];
  photons: RecoObjectX[];
  /** Tracks and clusters that the objects used. */
  usedTracks: Set<number>;
  usedClusters: Set<number>;
}

interface Conversion {
  a: number;
  b: number;
  p: P4;
  radius: number;
}

/** Photon conversions: pairs of opposite-charge tracks, nearly parallel, with a small invariant mass, meeting at a displaced point. */
export function findConversions(tracks: readonly RecoTrack[], minRadius = 10): Conversion[] {
  const out: Conversion[] = [];
  // candidates sorted by η, so each track is only compared with the ones within 0.06 of it
  const idx: number[] = [];
  for (let i = 0; i < tracks.length; i++) if (tracks[i]!.pt >= 0.5) idx.push(i);
  idx.sort((p, q) => tracks[p]!.eta - tracks[q]!.eta);
  for (let u = 0; u < idx.length; u++) {
    const i0 = idx[u]!;
    const a = tracks[i0]!;
    for (let w = u + 1; w < idx.length; w++) {
      const j0 = idx[w]!;
      const b = tracks[j0]!;
      if (b.eta - a.eta > 0.06) break;
      if (a.charge * b.charge > 0 || Math.abs(deltaPhi(a.phi, b.phi)) > 0.08) continue;
      const pa = trackP4(a, M_E), pb = trackP4(b, M_E);
      const s = { E: pa.E + pb.E, px: pa.px + pb.px, py: pa.py + pb.py, pz: pa.pz + pb.pz };
      const m2 = s.E * s.E - s.px * s.px - s.py * s.py - s.pz * s.pz;
      if (m2 > 0.05 * 0.05) continue;
      const v = fitVertex([a, b], { chi2Cut: Infinity });
      const radius = Math.hypot(v.x, v.y);
      if (v.chi2 > 9 || radius < minRadius) continue;
      const lo = Math.min(i0, j0), hi = Math.max(i0, j0);
      out.push({ a: lo, b: hi, p: s, radius });
    }
  }
  return out;
}

/**
 * Electrons and photons from ECAL clusters and tracks. A cluster is first grown into a supercluster by adding ECAL clusters
 * in a narrow η, wide φ road (bremsstrahlung photons are displaced in φ because the electron bends). An electron is a
 * supercluster with an extrapolated track, E/p between 0.6 and 2 and little energy behind it in the HCAL (H/E < 0.15); a
 * photon is a supercluster without a track (or with a conversion pair), H/E < 0.1 and ET above `photonPtMin`.
 */
export function findElectronsPhotons(tracks: readonly RecoTrack[], clusters: readonly RecoCluster[], geom: RecoGeometry, rcIn?: Partial<RecoConfig>, pvZ = 0, skipTracks: ReadonlySet<number> = new Set()): EgammaResult {
  const rc = resolveConfig(rcIn);
  const electrons: RecoObjectX[] = [];
  const photons: RecoObjectX[] = [];
  const usedTracks = new Set<number>();
  const usedClusters = new Set<number>();
  const ecal = clusters.map((c, i) => ({ c, i })).filter((x) => x.c.calo === 'ecal').sort((a, b) => b.c.energy - a.c.energy);
  const hgrid = clusterGrid(clusters, 'hcal', geom, 0.2);
  // track extrapolations
  const ext = tracks.map((t, i) => (!skipTracks.has(i) && (t.pt >= 0.5 * rc.electronPtMin || t.pt >= 1) ? extrapolateToRadius(t, geom.ecal.rInner) : undefined));
  const conversions = findConversions(tracks);
  const claimed = new Set<number>();
  for (const { c, i } of ecal) {
    if (claimed.has(i)) continue;
    const dir0 = clusterP4(c, geom, pvZ);
    const et0 = pt2(dir0);
    if (et0 < Math.min(rc.electronPtMin, rc.photonPtMin) * 0.6) continue;
    // supercluster: ECAL clusters in the road
    const members = [i];
    let E = c.energy;
    for (const o of ecal) {
      if (o.i === i || claimed.has(o.i)) continue;
      if (Math.abs(o.c.eta - c.eta) < 0.04 && Math.abs(deltaPhi(o.c.phi, c.phi)) < 0.15 && o.c.energy < c.energy) {
        members.push(o.i);
        E += o.c.energy;
      }
    }
    // hadronic leakage
    let H = 0;
    hgrid.near(c.eta, c.phi, (j) => {
      if (dR(clusters[j]!.eta, clusters[j]!.phi, c.eta, c.phi) < 0.15) H += clusters[j]!.energy;
    });
    const hOverE = H / E;
    // best matching track
    let bt = -1, bd = Infinity;
    for (let k = 0; k < tracks.length; k++) {
      const x = ext[k];
      if (!x) continue;
      const de = Math.abs(x.eta - c.eta);
      const dp = Math.abs(deltaPhi(x.phi, c.phi));
      if (de > 0.04 || dp > 0.1) continue;
      // prefer the track whose momentum agrees best with the energy
      const d = Math.abs(Math.log(E / (tracks[k]!.pt * Math.cosh(tracks[k]!.eta))));
      if (d < bd) {
        bd = d;
        bt = k;
      }
    }
    if (bt >= 0) {
      const t = tracks[bt]!;
      const p = t.pt * Math.cosh(t.eta);
      const eop = E / p;
      if (hOverE < 0.15 && eop > 0.6 && eop < 2.0 && t.pt >= rc.electronPtMin * 0.5 && E / Math.cosh(t.eta) >= rc.electronPtMin) {
        // the object: the supercluster's energy along the track direction
        const pe = fromPtEtaPhiM(E / Math.cosh(t.eta), t.eta, t.phi, M_E);
        electrons.push({ kind: 'electron', p: pe, charge: t.charge, tracks: [bt], clusters: members, truth: t.truth >= 0 ? t.truth : dominantTruth(c), variables: { eOverP: eop, hOverE, nMembers: members.length } });
        usedTracks.add(bt);
        for (const m of members) {
          claimed.add(m);
          usedClusters.add(m);
        }
        continue;
      }
    }
    // a conversion: a pair whose summed momentum points at the cluster
    let conv: Conversion | undefined;
    for (const cv of conversions) {
      const ph = Math.atan2(cv.p.py, cv.p.px);
      const eta = Math.asinh(cv.p.pz / Math.hypot(cv.p.px, cv.p.py));
      // extrapolate the pair direction to the calorimeter: a straight line from the conversion is fine at these pT
      if (Math.abs(eta - c.eta) < 0.05 && Math.abs(deltaPhi(ph, c.phi)) < 0.1) {
        const pp = Math.sqrt(cv.p.px ** 2 + cv.p.py ** 2 + cv.p.pz ** 2);
        if (E / pp > 0.6 && E / pp < 1.6) {
          conv = cv;
          break;
        }
      }
    }
    // tracks pointing at the cluster that are not part of a conversion veto a photon
    let vetoTrack = false;
    if (!conv) {
      for (let k = 0; k < tracks.length; k++) {
        const x = ext[k];
        if (!x || tracks[k]!.pt < 1) continue;
        if (dR(x.eta, x.phi, c.eta, c.phi) < 0.05) {
          vetoTrack = true;
          break;
        }
      }
    }
    if (!vetoTrack && hOverE < 0.1 && et0 >= rc.photonPtMin) {
      const d = conv ? { eta: Math.asinh(conv.p.pz / Math.hypot(conv.p.px, conv.p.py)), phi: Math.atan2(conv.p.py, conv.p.px) } : { eta: etaOf(dir0), phi: phiOf(dir0) };
      const pe = fromPtEtaPhiM(E / Math.cosh(d.eta), d.eta, d.phi, 0);
      photons.push({ kind: 'photon', p: pe, tracks: conv ? [conv.a, conv.b] : undefined, clusters: members, truth: dominantTruth(c), variables: { hOverE, converted: conv ? 1 : 0, etaWidth: c.etaWidth, phiWidth: c.phiWidth } });
      if (conv) {
        usedTracks.add(conv.a);
        usedTracks.add(conv.b);
      }
      for (const m of members) {
        claimed.add(m);
        usedClusters.add(m);
      }
    }
  }
  return { electrons, photons, usedTracks, usedClusters };
}

// ── taus ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Hadronic tau candidates from jets: a narrow jet (R = 0.4) with one or three charged particles (pT > 1 GeV) inside
 * ΔR < 0.15 of its axis, no other charged particle of pT > 1 GeV within 0.4, a visible mass below 1.8 GeV and, for three
 * prongs, total charge ±1. The object carries the visible momentum of the jet.
 */
export function findTaus(jets: readonly { p: P4; tracks: number[] }[], tracks: readonly RecoTrack[], rcIn?: Partial<RecoConfig>): RecoObjectX[] {
  const rc = resolveConfig(rcIn);
  const out: RecoObjectX[] = [];
  for (const j of jets) {
    const jpt = pt2(j.p);
    if (jpt < rc.tauPtMin || Math.abs(etaOf(j.p)) > 2.3) continue;
    const je = etaOf(j.p), jp = phiOf(j.p);
    const core: number[] = [];
    let outer = 0;
    for (const k of j.tracks) {
      const t = tracks[k]!;
      if (t.pt < 1) continue;
      const d = dR(t.eta, t.phi, je, jp);
      if (d < 0.15) core.push(k);
      else if (d < 0.4) outer++;
    }
    if (outer > 0 || (core.length !== 1 && core.length !== 3)) continue;
    const q = core.reduce((a, k) => a + tracks[k]!.charge, 0);
    if (Math.abs(q) !== 1) continue;
    const m2 = j.p.E ** 2 - j.p.px ** 2 - j.p.py ** 2 - j.p.pz ** 2;
    if (m2 > 1.8 ** 2) continue;
    out.push({ kind: 'tau', p: j.p, charge: q, tracks: core, truth: -1, variables: { nProngs: core.length } });
  }
  return out;
}

