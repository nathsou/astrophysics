/**
 * The whole reconstruction chain: detector output in, reconstructed event out.
 *
 *   hits → tracks (`findTracks`) → primary vertices (`findPrimaryVertices`) → track impact parameters relative to the
 *   hard-scatter vertex → cells → clusters (`clusterCells`) → muons, electrons, photons → particle flow → jets (`antiKt`),
 *   b-tags, taus → missing pT. With the truth record, tracks and objects are linked to truth particles.
 */
import type { DetectorConfig } from '../detector/index.ts';
import type { DetectorEvent, TruthEvent, Vertex } from '../event/index.ts';
import { hook } from '../hooks.ts';
import type { P4 } from '../kinematics/index.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import { particle } from '../particles/index.ts';
import { bTagInfo, bTagScore } from './btag.ts';
import { clusterCells } from './calo.ts';
import { resolveConfig, type RecoConfig } from './config.ts';
import { geometryFromConfig, type RecoGeometry } from './geometry.ts';
import { clusterJets } from './jets.ts';
import { jetFlavour as _unused, labelTracks, matchJetToParton, matchSummary } from './match.ts';
import { caloIsolation, findElectronsPhotons, findMuons, findTaus, metFromEvent, particleFlow, trackIsolation, trackP4, type PFCandidate } from './objects.ts';
import { findTracks } from './tracking.ts';
import type { RecoCluster, RecoEventFull, RecoObjectX, RecoTrack } from './types.ts';
import { findPrimaryVertices, impactParameter, type RecoVertex } from './vertex.ts';

void _unused;
const M_MU = 0.1056583755;
const etaOf = (p: P4) => Math.asinh(p.pz / Math.hypot(p.px, p.py));
const phiOf = (p: P4) => Math.atan2(p.py, p.px);
const ptOf = (p: P4) => Math.hypot(p.px, p.py);

export interface ObjectBuild {
  objects: RecoObjectX[];
  pf: PFCandidate[];
  /** Secondary vertices found in b-tagged jets (kind 'secondary'). */
  secondary: RecoVertex[];
}

/**
 * Build the physics objects from tracks, vertices and clusters: muons, electrons, photons, particle flow, jets with
 * b-tag scores, taus; each with isolation. The objects are ordered by kind (muons, electrons, photons, taus, jets) and
 * by decreasing pT within a kind. Objects get their truth link from the track or cluster they were built from; jets
 * from the nearest parton in the truth record (when given).
 */
export function buildObjects(
  tracks: readonly RecoTrack[],
  vertices: readonly RecoVertex[],
  clusters: readonly RecoCluster[],
  det: Pick<DetectorEvent, 'muonHits'>,
  geom: RecoGeometry,
  rcIn?: Partial<RecoConfig>,
  truth?: TruthEvent,
): ObjectBuild {
  const rc = resolveConfig(rcIn);
  const pv = vertices.find((v) => v.kind === 'primary');
  const pvZ = pv?.z ?? 0;
  const objects: RecoObjectX[] = [];
  // muons
  const mu = findMuons(tracks, det.muonHits, geom, rc);
  const muonTracks = new Set(mu.map((m) => m.track));
  const muons: RecoObjectX[] = mu.map((m) => {
    const t = tracks[m.track]!;
    return { kind: 'muon', p: trackP4(t, M_MU), charge: t.charge, tracks: [m.track], truth: t.truth, variables: { nStations: m.nStations } };
  });
  // electrons and photons
  const eg = findElectronsPhotons(tracks, clusters, geom, rc, pvZ, muonTracks);
  const leptons = [...muons, ...eg.electrons, ...eg.photons];
  for (const o of leptons) {
    const pt = ptOf(o.p);
    const own = new Set(o.tracks ?? []);
    const d = { eta: etaOf(o.p), phi: phiOf(o.p), pt };
    o.isolation = trackIsolation(d, tracks, { exclude: own, pvZ });
    o.caloIsolation = caloIsolation(d, clusters, geom, { exclude: new Set(o.clusters ?? []), pvZ });
  }
  // particle flow, without the isolated leptons and photons
  const isolated = leptons.filter((o) => (o.isolation ?? 1) < 0.15 && (o.caloIsolation ?? 1) < 0.5);
  const isoTracks = new Set(isolated.flatMap((o) => o.tracks ?? []));
  const isoClusters = new Set(isolated.flatMap((o) => o.clusters ?? []));
  const pf = particleFlow(tracks, clusters, geom, { pvZ, muonTracks, chs: rc.chs });
  const forJets = pf.filter((c) => !(c.track >= 0 && isoTracks.has(c.track)) && !(c.kind !== 'chHad' && c.kind !== 'muon' && c.clusters.some((j) => isoClusters.has(j))) && Math.abs(etaOf(c.p)) < 4.7);
  // a muon's calorimeter deposit is a MIP, not jet energy: muons do not enter the jets at all
  const jetInputs = forJets.filter((c) => c.kind !== 'muon');
  const { jets, constituents } = clusterJets(jetInputs.map((c) => c.p), rc.jetR, rc.jetPtMin);
  const jetObjs: RecoObjectX[] = jets.map((p, k) => {
    const mem = constituents[k]!.map((i) => jetInputs[i]!);
    const tr = mem.filter((m) => m.track >= 0).map((m) => m.track);
    const cl = [...new Set(mem.flatMap((m) => m.clusters))];
    return { kind: 'jet', p, tracks: tr, clusters: cl, nConstituents: mem.length, truth: truth ? matchJetToParton(p, truth) : -1 };
  });
  // b-tagging (with the secondary vertex of each jet appended to the event's vertex list)
  const secondary: RecoVertex[] = [];
  if (rc.bTag) {
    const tagFn = hook('reco.bTag', bTagScore);
    for (const j of jetObjs) {
      if (ptOf(j.p) < 20 || Math.abs(etaOf(j.p)) > 2.5) continue;
      const info = bTagInfo(j.p, tracks, [...vertices, ...secondary]);
      j.btag = tagFn === bTagScore ? info.score : tagFn(j.p, tracks as RecoTrack[], [...vertices, ...secondary]);
      if (info.vertex && !secondary.includes(info.vertex)) secondary.push(info.vertex);
    }
  }
  const taus = findTaus(jetObjs.map((j) => ({ p: j.p, tracks: j.tracks ?? [] })), tracks, rc);
  for (const t of taus) {
    const d = { eta: etaOf(t.p), phi: phiOf(t.p), pt: ptOf(t.p) };
    t.isolation = trackIsolation({ ...d }, tracks, { exclude: new Set(t.tracks ?? []), pvZ, cone: 0.4 });
  }
  const byPt = (a: RecoObjectX, b: RecoObjectX) => ptOf(b.p) - ptOf(a.p);
  objects.push(...muons.sort(byPt), ...eg.electrons.sort(byPt), ...eg.photons.sort(byPt), ...taus.sort(byPt), ...jetObjs.sort(byPt));
  return { objects, pf, secondary };
}

/**
 * Reconstruct an event from detector output (see the file header for the chain). `cfg` is the detector configuration the
 * event was simulated with (or the description of the real detector), `rc` overrides any of the reconstruction settings
 * (`RecoConfig`), and `truth`, when given, links every track and object to the truth particle it came from and fills
 * `RecoEventFull.match`. With real data `truth` is absent.
 */
export function reconstruct(det: DetectorEvent, cfg: DetectorConfig | RecoGeometry, rc?: Partial<RecoConfig>, truth?: TruthEvent): RecoEventFull {
  const geom = geometryFromConfig(cfg);
  const conf = resolveConfig(rc);
  // tracks
  const tracks = findTracks(det.hits, geom, conf);
  if (truth) labelTracks(tracks, det.hits, conf.matchPurity);
  // vertices
  const beamSpot = { x: 0, y: 0, sigma: Math.max(geom.beamSpotXY, 0.005) };
  const pvs = findPrimaryVertices(tracks, conf, geom.beamSpotXY > 0 ? beamSpot : undefined);
  const primary = pvs[0];
  // impact parameters relative to the hard-scatter vertex (the raw values relative to the beam line are kept)
  if (primary) {
    const ipFn = hook('reco.impactParameter', impactParameter);
    for (const t of tracks) {
      const ip = ipFn(t, primary);
      t.d0 = ip.d0;
      t.z0 = ip.dz;
    }
  }
  // clusters
  const clusters = clusterCells(det.cells, geom, conf);
  // objects
  const built = buildObjects(tracks, pvs, clusters, det, geom, conf, truth);
  // missing transverse momentum from all cells and the muons
  const muonP4s = built.objects.filter((o) => o.kind === 'muon').map((o) => o.p);
  const { met, sumEt } = metFromEvent(det.cells, geom, muonP4s);
  const vertices: Vertex[] = [...pvs, ...built.secondary];
  const out: RecoEventFull = {
    tracks,
    vertices,
    clusters,
    objects: built.objects,
    met,
    sumEt,
    primaryVertex: primary ? 0 : -1,
    pfCandidates: built.pf,
  };
  if (truth) {
    const chargeOf = (pdg: number) => {
      try {
        return particle(pdg).charge3;
      } catch {
        return 0;
      }
    };
    out.match = matchSummary(tracks, truth, det.hits, chargeOf, { ptMin: conf.ptMin, etaMax: geom.etaMax - 0.1, minHits: Math.max(4, Math.min(6, geom.layers.length - 2)) });
  }
  void fromPtEtaPhiM;
  return out;
}
