/**
 * The display scene: everything the views draw, derived once from a `FullEvent` and a `DisplayGeometry`.
 *
 * The scene is renderer-agnostic (no DOM). It holds the list of selectable objects with their links (a reco object to its
 * tracks, clusters and truth particle; a truth particle to its mothers, daughters and reco matches), and the drawing
 * primitives (polylines, hit points, calorimeter towers, jet cones, the missing-pT arrow) each tagged with the object that
 * owns it, so that a selection in any view highlights the same object in all of them.
 */
import type { CaloCell, FullEvent, RecoObject, Track, TruthParticle } from '../hep/event/index.ts';
import { eta as etaOf4, mass as massOf4, phi as phiOf4, pt as ptOf4 } from '../hep/kinematics/index.ts';
import { hasParticle, particle } from '../hep/particles/index.ts';
import { kindOf, styleFor, type LineStyle, type ParticleClass } from '../theme/particles.ts';
import { faceDistance, etaPhiOf, outerRadius, type DisplayGeometry } from './geometry.ts';
import { helixFromMomentum, helixFromTrack, straightLine, traceHelix, type HelixParams } from './helix.ts';

export type ObjectCat = 'truth' | 'track' | 'object' | 'cluster' | 'tower' | 'vertex' | 'met';

export interface SceneObject {
  /** Index in `scene.objects`; the id used for highlighting. */
  id: number;
  /** Stable key such as 'truth:5', 'track:3', 'object:0', 'cluster:2', 'tower:7', 'vertex:0', 'met'. */
  key: string;
  cat: ObjectCat;
  source: 'truth' | 'reco';
  /** Particle class for colouring (null for calorimeter objects and vertices). */
  kind: ParticleClass | null;
  calo?: 'ecal' | 'hcal';
  label: string;
  /** One line of context, e.g. "truth particle 5 · final state". */
  sub: string;
  pt: number;
  eta: number;
  phi: number;
  energy: number;
  charge?: number;
  mass?: number;
  /** Index into the source array (truth.particles, reco.tracks, …). */
  index: number;
  links: number[];
}

export interface Polyline {
  /** The object that is highlighted when this line is. */
  obj: number;
  /** The object that a click or hover on this line selects. */
  pick: number;
  kind: ParticleClass;
  layer: 'reco' | 'truth';
  line: LineStyle;
  /** Stroke width (px) for a 2D figure. */
  width: number;
  pt: number;
  /** x, y, z of each point (mm). */
  points: Float32Array;
  /** Which half of the longitudinal view the line is drawn in: the side of the beam axis it ends on. */
  rzSign: 1 | -1;
}

export interface PointSet {
  xyz: Float32Array;
  /** The reco object that owns each point (a track, or a muon object), or −1. */
  owner: Int32Array;
  /** The truth particle object that owns each point, or −1. */
  truthOwner: Int32Array;
  count: number;
  /** Tracker layer or muon station of each point. */
  layer: Uint8Array;
}

export interface Tower {
  obj: number;
  calo: 'ecal' | 'hcal';
  eta: number;
  phi: number;
  dEta: number;
  dPhi: number;
  energy: number;
  /** Distances from the origin along the tower's axis: front face and tip (mm). */
  t0: number;
  t1: number;
  cells: number[];
}

export interface JetCone {
  obj: number;
  eta: number;
  phi: number;
  pt: number;
  origin: [number, number, number];
  /** Length along the axis (mm) and tan of the half opening angle. */
  length: number;
  tanHalf: number;
}

export interface MetArrow {
  obj: number;
  /** Missing momentum (GeV). */
  x: number;
  y: number;
  magnitude: number;
  phi: number;
  /** Drawn length (mm). */
  length: number;
  origin: [number, number, number];
}

export interface VertexMarker {
  obj: number;
  x: number;
  y: number;
  z: number;
  kind: 'primary' | 'pileup' | 'secondary';
}

export interface DisplayScene {
  event: FullEvent;
  geometry: DisplayGeometry;
  objects: SceneObject[];
  byKey: Map<string, number>;
  polylines: Polyline[];
  hits: PointSet;
  muonHits: PointSet;
  towers: Tower[];
  cones: JetCone[];
  met: MetArrow | null;
  vertices: VertexMarker[];
  /** Millimetres of tower height per GeV. */
  energyScale: number;
  /** The hard-scatter vertex. */
  pv: [number, number, number];
  hasTruth: boolean;
  hasReco: boolean;
  hasHits: boolean;
  maxPt: number;
}

export interface SceneOptions {
  /** Truth charged particles below this pT (GeV) are not drawn (they curl up). Default 0.5. */
  truthMinPt?: number;
}

const RECO_KIND: Record<RecoObject['kind'], ParticleClass> = {
  electron: 'electron',
  muon: 'muon',
  photon: 'photon',
  jet: 'jet',
  tau: 'tau',
  track: 'hadron',
};
const RECO_LABEL: Record<RecoObject['kind'], string> = {
  electron: 'electron',
  muon: 'muon',
  photon: 'photon',
  jet: 'jet',
  tau: 'tau',
  track: 'track',
};

function truthSymbol(pdg: number): string {
  return hasParticle(pdg) ? particle(pdg).symbol : `PDG ${pdg}`;
}
function truthCharge(pdg: number): number {
  return hasParticle(pdg) ? particle(pdg).charge3 / 3 : 0;
}

function emptyPoints(): PointSet {
  return { xyz: new Float32Array(0), owner: new Int32Array(0), truthOwner: new Int32Array(0), count: 0, layer: new Uint8Array(0) };
}

const v3 = (a: readonly number[] | undefined): [number, number, number] => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];

/** Build the scene for an event. */
export function buildScene(event: FullEvent, geo: DisplayGeometry, options: SceneOptions = {}): DisplayScene {
  const truthMinPt = options.truthMinPt ?? 0.5;
  const reco = event.reco;
  const truth = event.truth;
  const det = event.detector;
  const objects: SceneObject[] = [];
  const byKey = new Map<string, number>();
  const add = (o: Omit<SceneObject, 'id' | 'links'>): number => {
    const id = objects.length;
    objects.push({ ...o, id, links: [] });
    byKey.set(o.key, id);
    return id;
  };
  const link = (a: number, b: number) => {
    if (a < 0 || b < 0 || a === b) return;
    const la = objects[a]!.links, lb = objects[b]!.links;
    if (!la.includes(b)) la.push(b);
    if (!lb.includes(a)) lb.push(a);
  };
  const pvVertex = reco.vertices.find((v) => v.kind === 'primary');
  const pvT: [number, number, number] = pvVertex ? [pvVertex.x, pvVertex.y, pvVertex.z] : v3(truth?.primaryVertices[0]);

  // ── Reco objects ──
  const objId: number[] = [];
  reco.objects.forEach((o, i) => {
    const pT = ptOf4(o.p);
    objId.push(
      add({
        key: `object:${i}`,
        cat: 'object',
        source: 'reco',
        kind: RECO_KIND[o.kind],
        label: RECO_LABEL[o.kind] + (o.charge ? (o.charge > 0 ? '⁺' : '⁻') : ''),
        sub: `reconstructed ${RECO_LABEL[o.kind]}`,
        pt: pT,
        eta: etaOf4(o.p),
        phi: phiOf4(o.p),
        energy: o.p.E,
        charge: o.charge,
        mass: massOf4(o.p),
        index: i,
      }),
    );
  });
  // Which object claims each track, and the class of each track.
  const trackOwner = new Map<number, number>();
  const trackKind = new Map<number, ParticleClass>();
  reco.objects.forEach((o, i) => {
    for (const t of o.tracks ?? []) {
      if (o.kind === 'electron' || o.kind === 'muon' || o.kind === 'tau') {
        if (!trackOwner.has(t)) trackOwner.set(t, objId[i]!);
        trackKind.set(t, RECO_KIND[o.kind]);
      } else if (!trackKind.has(t)) trackKind.set(t, 'hadron');
    }
  });

  // ── Missing pT ──
  const metMag = Math.hypot(reco.met.x, reco.met.y);
  const metObj = add({
    key: 'met',
    cat: 'met',
    source: 'reco',
    kind: 'neutrino',
    label: 'missing pT',
    sub: 'magnitude of the momentum imbalance in the transverse plane',
    pt: metMag,
    eta: 0,
    phi: Math.atan2(reco.met.y, reco.met.x),
    energy: metMag,
    index: 0,
  });

  // ── Vertices ──
  const vertexObjs = reco.vertices.map((v, i) =>
    add({
      key: `vertex:${i}`,
      cat: 'vertex',
      source: 'reco',
      kind: null,
      label: `${v.kind} vertex`,
      sub: `${v.tracks.length} tracks`,
      pt: 0,
      eta: 0,
      phi: 0,
      energy: 0,
      index: i,
    }),
  );

  // ── Reco tracks ──
  const trackObj: number[] = [];
  reco.tracks.forEach((t, i) => {
    trackObj.push(
      add({
        key: `track:${i}`,
        cat: 'track',
        source: 'reco',
        kind: trackKind.get(i) ?? 'hadron',
        label: `track ${t.id}`,
        sub: `reconstructed track, ${t.hits.length} hits`,
        pt: t.pt,
        eta: t.eta,
        phi: t.phi,
        energy: t.pt * Math.cosh(t.eta),
        charge: t.charge,
        index: i,
      }),
    );
  });

  // ── Calorimeter towers: cells summed over depth, on a fixed (η, φ) grid ──
  const towers: Tower[] = [];
  const towerObj: number[] = [];
  const cells: CaloCell[] = det?.cells ?? [];
  const cellTower = new Int32Array(cells.length).fill(-1);
  let energyScale = 1;
  const towerSize = (calo: 'ecal' | 'hcal') => (calo === 'ecal' ? geo.ecal.cell : geo.hcal.cell);
  {
    const grid = new Map<string, { calo: 'ecal' | 'hcal'; ieta: number; iphi: number; energy: number; cells: number[]; eta: number; phi: number }>();
    cells.forEach((c, i) => {
      const s = towerSize(c.calo);
      const nPhi = Math.round((2 * Math.PI) / s);
      const dPhi = (2 * Math.PI) / nPhi;
      const ie = Math.floor(c.eta / s);
      const ip = Math.floor((c.phi < 0 ? c.phi + 2 * Math.PI : c.phi) / dPhi) % nPhi;
      const key = `${c.calo}|${ie}|${ip}`;
      let t = grid.get(key);
      if (!t) grid.set(key, (t = { calo: c.calo, ieta: ie, iphi: ip, energy: 0, cells: [], eta: (ie + 0.5) * s, phi: c.phi }));
      t.energy += c.energy;
      t.cells.push(i);
    });
    let list = [...grid.values()].sort((a, b) => b.energy - a.energy);
    if (list.length > 6000) list = list.slice(0, 6000);
    const maxE = list.reduce((m, t) => Math.max(m, t.energy), 0);
    energyScale = (0.4 * geo.hcal.rOut) / Math.max(40, maxE);
    // With no cells (real data, or a reco-only event) the clusters are drawn instead.
    if (list.length === 0 && reco.clusters.length) {
      list = reco.clusters.map((c, i) => ({ calo: c.calo, ieta: 0, iphi: 0, energy: c.energy, cells: [], eta: c.eta, phi: c.phi, cluster: i })) as typeof list;
      const mE = list.reduce((m, t) => Math.max(m, t.energy), 0);
      energyScale = (0.4 * geo.hcal.rOut) / Math.max(40, mE);
    }
    list.forEach((t, i) => {
      const s = towerSize(t.calo);
      const shell = t.calo === 'ecal' ? geo.ecal : geo.hcal;
      const t0 = faceDistance(t.eta, shell.rIn, shell.halfLength);
      const height = Math.max(6, t.energy * energyScale);
      const id = add({
        key: `tower:${i}`,
        cat: 'tower',
        source: 'reco',
        kind: null,
        calo: t.calo,
        label: `${t.calo === 'ecal' ? 'ECAL' : 'HCAL'} tower`,
        sub: `${t.cells.length || 1} cell${t.cells.length === 1 ? '' : 's'} summed over depth`,
        pt: t.energy / Math.cosh(t.eta),
        eta: t.eta,
        phi: t.cells.length ? cells[t.cells[0]!]!.phi : t.phi,
        energy: t.energy,
        index: i,
      });
      towerObj.push(id);
      towers.push({ obj: id, calo: t.calo, eta: t.eta, phi: objects[id]!.phi, dEta: s * 0.92, dPhi: s * 0.92, energy: t.energy, t0, t1: t0 + height, cells: t.cells });
      for (const c of t.cells) cellTower[c] = i;
    });
  }
  const scale = energyScale;

  // ── Clusters ──
  const clusterObj: number[] = [];
  reco.clusters.forEach((c, i) => {
    clusterObj.push(
      add({
        key: `cluster:${i}`,
        cat: 'cluster',
        source: 'reco',
        kind: null,
        calo: c.calo,
        label: `${c.calo === 'ecal' ? 'ECAL' : 'HCAL'} cluster`,
        sub: `cluster of ${c.cells.length} cells`,
        pt: c.energy / Math.cosh(c.eta),
        eta: c.eta,
        phi: c.phi,
        energy: c.energy,
        index: i,
      }),
    );
  });

  // ── Truth particles ──
  const truthObj: number[] = [];
  const particles: TruthParticle[] = truth?.particles ?? [];
  particles.forEach((p, i) => {
    const sym = truthSymbol(p.pdg);
    truthObj.push(
      add({
        key: `truth:${i}`,
        cat: 'truth',
        source: 'truth',
        kind: kindOf(p.pdg),
        label: sym,
        sub: `truth particle ${p.id} · ${p.status}${p.collision ? ` · pile-up collision ${p.collision}` : ''}`,
        pt: ptOf4(p.p),
        eta: Number.isFinite(etaOf4(p.p)) ? etaOf4(p.p) : 0,
        phi: phiOf4(p.p),
        energy: p.p.E,
        charge: truthCharge(p.pdg),
        mass: massOf4(p.p),
        index: i,
      }),
    );
  });

  // ── Links ──
  reco.objects.forEach((o, i) => {
    for (const t of o.tracks ?? []) link(objId[i]!, trackObj[t] ?? -1);
    for (const c of o.clusters ?? []) link(objId[i]!, clusterObj[c] ?? -1);
    if (o.truth >= 0) link(objId[i]!, truthObj[o.truth] ?? -1);
  });
  reco.tracks.forEach((t, i) => {
    if (t.truth >= 0) link(trackObj[i]!, truthObj[t.truth] ?? -1);
  });
  reco.vertices.forEach((v, i) => {
    for (const t of v.tracks) link(vertexObjs[i]!, trackObj[t] ?? -1);
  });
  reco.clusters.forEach((c, i) => {
    const seen = new Set<number>();
    for (const cell of c.cells) {
      const tw = cellTower[cell];
      if (tw !== undefined && tw >= 0 && !seen.has(tw)) {
        seen.add(tw);
        link(clusterObj[i]!, towerObj[tw]!);
      }
    }
    for (const t of topTruth(c.cells.map((k) => cells[k]).filter((x): x is CaloCell => !!x), 6)) link(clusterObj[i]!, truthObj[t] ?? -1);
  });
  towers.forEach((tw, i) => {
    const ts = new Map<number, number>();
    for (const c of tw.cells) for (const t of cells[c]!.truth) ts.set(t, (ts.get(t) ?? 0) + cells[c]!.energy);
    [...ts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([t]) => link(towerObj[i]!, truthObj[t] ?? -1));
  });
  particles.forEach((p, i) => {
    for (const m of p.mothers) link(truthObj[i]!, truthObj[m] ?? -1);
    for (const d of p.daughters) link(truthObj[i]!, truthObj[d] ?? -1);
  });

  // ── Geometry: lines ──
  const polylines: Polyline[] = [];
  const last = geo.muon[geo.muon.length - 1];
  const rMuon = last?.r ?? outerRadius(geo);
  const zMuon = last?.halfLength ?? geo.hcal.halfLength;
  const Bz = geo.bField;
  let maxPt = 1;

  const pushLine = (obj: number, pick: number, kind: ParticleClass, layer: 'reco' | 'truth', line: LineStyle, pts: number[], pt: number, width?: number) => {
    if (pts.length < 6) return;
    const f = new Float32Array(pts);
    const yEnd = f[f.length - 2]!;
    polylines.push({ obj, pick, kind, layer, line, width: width ?? styleFor(kind).width, pt, points: f, rzSign: yEnd < 0 ? -1 : 1 });
    if (pt > maxPt) maxPt = pt;
  };
  const traceFor = (h: HelixParams, kind: ParticleClass, sMax?: number) => {
    const toMuon = kind === 'muon';
    return traceHelix(h, {
      rStop: toMuon ? rMuon : geo.ecal.rIn,
      zStop: toMuon ? zMuon : geo.ecal.halfLength,
      rCoil: geo.solenoid.r,
      outerFactor: geo.outerFieldFactor,
      sMax,
      maxTurns: 1,
    });
  };

  // Reco tracks.
  reco.tracks.forEach((t: Track, i) => {
    const kind = trackKind.get(i) ?? 'hadron';
    const h = helixFromTrack(t, pvT, Bz);
    const tr = traceFor(h, kind);
    const owner = trackOwner.get(i);
    pushLine(trackObj[i]!, owner ?? trackObj[i]!, kind, 'reco', 'solid', tr.points, t.pt);
  });
  // Reco objects without a track of their own: photons (a straight line to the ECAL), and leptons with no track list.
  reco.objects.forEach((o, i) => {
    if ((o.tracks?.length ?? 0) > 0 || o.kind === 'jet' || o.kind === 'track') return;
    const eta = etaOf4(o.p), phi = phiOf4(o.p);
    if (o.kind === 'photon') {
      pushLine(objId[i]!, objId[i]!, 'photon', 'reco', 'wavy', straightLine(pvT[0], pvT[1], pvT[2], eta, phi, geo.ecal.rIn, geo.ecal.halfLength), ptOf4(o.p));
    } else if (o.charge) {
      const h = helixFromMomentum(Math.sign(o.charge), o.p.px, o.p.py, o.p.pz, pvT, Bz);
      pushLine(objId[i]!, objId[i]!, RECO_KIND[o.kind], 'reco', 'solid', traceFor(h, RECO_KIND[o.kind]).points, ptOf4(o.p));
    }
  });
  // Truth trajectories.
  particles.forEach((p, i) => {
    const kind = kindOf(p.pdg);
    const q = truthCharge(p.pdg);
    const pT = ptOf4(p.p);
    const displaced = p.status === 'decayed' && p.endVertex && Math.hypot(p.endVertex[0] - p.vertex[0], p.endVertex[1] - p.vertex[1], p.endVertex[2] - p.vertex[2]) > 1;
    if (p.status !== 'final' && !displaced) return;
    if (pT < 1e-3) return;
    const eta = etaOf4(p.p), phi = phiOf4(p.p);
    if (kind === 'neutrino') {
      if (pT < 1) return;
      pushLine(truthObj[i]!, truthObj[i]!, 'neutrino', 'truth', 'dotted', straightLine(p.vertex[0], p.vertex[1], p.vertex[2], eta, phi, rMuon * 1.04, zMuon * 1.04), pT);
      return;
    }
    if (q === 0) {
      const E = p.p.E;
      if (kind === 'photon') {
        if (E < 1.5) return;
        pushLine(truthObj[i]!, truthObj[i]!, 'photon', 'truth', 'wavy', straightLine(p.vertex[0], p.vertex[1], p.vertex[2], eta, phi, geo.ecal.rIn, geo.ecal.halfLength), pT);
      } else if (kind === 'hadron') {
        if (E < 2) return;
        const pts = straightLine(p.vertex[0], p.vertex[1], p.vertex[2], eta, phi, geo.hcal.rIn, geo.hcal.halfLength);
        pushLine(truthObj[i]!, truthObj[i]!, 'hadron', 'truth', 'dotted', pts, pT, 1);
      }
      return;
    }
    if (pT < truthMinPt) return;
    const h = helixFromMomentum(Math.sign(q), p.p.px, p.p.py, p.p.pz, p.vertex, Bz);
    let sMax: number | undefined;
    if (displaced && p.endVertex) sMax = Math.hypot(p.endVertex[0] - p.vertex[0], p.endVertex[1] - p.vertex[1]);
    pushLine(truthObj[i]!, truthObj[i]!, kind, 'truth', 'solid', traceFor(h, kind, sMax).points, pT);
  });

  // ── Hit points ──
  const trackOfHit = new Int32Array(det?.hits.length ?? 0).fill(-1);
  reco.tracks.forEach((t, i) => {
    for (const h of t.hits) if (h >= 0 && h < trackOfHit.length) trackOfHit[h] = trackObj[i]!;
  });
  const hits = emptyPoints();
  if (det && det.hits.length) {
    const n = det.hits.length;
    hits.xyz = new Float32Array(n * 3);
    hits.owner = new Int32Array(n);
    hits.truthOwner = new Int32Array(n);
    hits.layer = new Uint8Array(n);
    hits.count = n;
    det.hits.forEach((h, i) => {
      hits.xyz[3 * i] = h.x;
      hits.xyz[3 * i + 1] = h.y;
      hits.xyz[3 * i + 2] = h.z;
      hits.owner[i] = trackOfHit[i]!;
      hits.truthOwner[i] = h.truth >= 0 ? (truthObj[h.truth] ?? -1) : -1;
      hits.layer[i] = Math.min(255, h.layer);
    });
  }
  const muonHits = emptyPoints();
  if (det && det.muonHits.length) {
    const n = det.muonHits.length;
    muonHits.xyz = new Float32Array(n * 3);
    muonHits.owner = new Int32Array(n);
    muonHits.truthOwner = new Int32Array(n);
    muonHits.layer = new Uint8Array(n);
    muonHits.count = n;
    const muonOfTruth = new Map<number, number>();
    reco.objects.forEach((o, i) => {
      if (o.kind === 'muon' && o.truth >= 0) muonOfTruth.set(o.truth, objId[i]!);
    });
    det.muonHits.forEach((h, i) => {
      muonHits.xyz[3 * i] = h.x;
      muonHits.xyz[3 * i + 1] = h.y;
      muonHits.xyz[3 * i + 2] = h.z;
      muonHits.owner[i] = muonOfTruth.get(h.truth) ?? -1;
      muonHits.truthOwner[i] = h.truth >= 0 ? (truthObj[h.truth] ?? -1) : -1;
      muonHits.layer[i] = Math.min(255, h.station);
    });
  }

  // ── Jet cones ──
  const cones: JetCone[] = [];
  const jets = reco.objects.map((o, i) => ({ o, i })).filter((x) => x.o.kind === 'jet');
  const maxJetPt = jets.reduce((m, x) => Math.max(m, ptOf4(x.o.p)), 1);
  for (const { o, i } of jets) {
    const eta = etaOf4(o.p), phi = phiOf4(o.p), pT = ptOf4(o.p);
    const reach = faceDistance(eta, geo.hcal.rOut, geo.hcal.halfLength);
    cones.push({ obj: objId[i]!, eta, phi, pt: pT, origin: [...pvT], length: reach * (0.5 + 0.5 * (pT / maxJetPt)), tanHalf: 0.4 / Math.cosh(eta) });
    if (pT > maxPt) maxPt = pT;
  }

  // ── Missing pT arrow ──
  let met: MetArrow | null = null;
  if (metMag > 1) {
    const length = Math.min(0.95 * geo.hcal.rOut, Math.max(0.12 * geo.hcal.rOut, metMag * scale));
    met = { obj: metObj, x: reco.met.x, y: reco.met.y, magnitude: metMag, phi: Math.atan2(reco.met.y, reco.met.x), length, origin: [pvT[0], pvT[1], pvT[2]] };
  }
  const vertices: VertexMarker[] = reco.vertices.map((v, i) => ({ obj: vertexObjs[i]!, x: v.x, y: v.y, z: v.z, kind: v.kind }));

  return {
    event,
    geometry: geo,
    objects,
    byKey,
    polylines,
    hits,
    muonHits,
    towers,
    cones,
    met,
    vertices,
    energyScale: scale,
    pv: pvT,
    hasTruth: !!truth,
    hasReco: true,
    hasHits: hits.count > 0,
    maxPt,
  };
}

/** The truth particles that contributed most energy to a set of cells. */
function topTruth(cells: CaloCell[], n: number): number[] {
  const ts = new Map<number, number>();
  for (const c of cells) for (const t of c.truth) ts.set(t, (ts.get(t) ?? 0) + c.energy);
  return [...ts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

// ── Selection and highlighting ───────────────────────────────────────────────────────────────

/** Highlight states of an object: 0 normal, 1 related to the selection, 2 the selection, 3 dimmed (something else is selected). */
export const HL_NORMAL = 0;
export const HL_RELATED = 1;
export const HL_PRIMARY = 2;
export const HL_DIM = 3;

/** Pairs (from category, to category) through which a selection spreads to a second hop. */
const SECOND_HOP: Record<string, true> = {
  'track>object': true,
  'object>track': true,
  'object>cluster': true,
  'cluster>tower': true,
  'cluster>object': true,
  'tower>cluster': true,
  'vertex>track': true,
  'track>vertex': true,
};

/** The objects related to `id`: its direct links, and through tracks, clusters and towers the objects built from them. */
export function relatedObjects(scene: DisplayScene, id: number): Set<number> {
  const out = new Set<number>();
  const obj = scene.objects[id];
  if (!obj) return out;
  for (const n of obj.links) out.add(n);
  for (const n of obj.links) {
    const no = scene.objects[n]!;
    for (const m of no.links) {
      if (m === id || out.has(m)) continue;
      if (SECOND_HOP[`${no.cat}>${scene.objects[m]!.cat}`]) out.add(m);
    }
  }
  return out;
}

/**
 * The highlight state of every object when `activeKey` is hovered or selected (null → everything normal). The array is
 * reused if `into` is given and has the right length.
 */
export function highlightStates(scene: DisplayScene, activeKey: string | null, into?: Uint8Array): Uint8Array {
  const n = scene.objects.length;
  const st = into && into.length === n ? into : new Uint8Array(n);
  const id = activeKey === null ? undefined : scene.byKey.get(activeKey);
  if (id === undefined) {
    st.fill(HL_NORMAL);
    return st;
  }
  st.fill(HL_DIM);
  st[id] = HL_PRIMARY;
  for (const r of relatedObjects(scene, id)) st[r] = HL_RELATED;
  return st;
}

/** Keys of the truth particles an object stands for or was matched to (used to link a truth display with a reco one). */
export function truthKeysOf(scene: DisplayScene, id: number): string[] {
  const o = scene.objects[id];
  if (!o) return [];
  if (o.cat === 'truth') return [o.key];
  return o.links.filter((l) => scene.objects[l]!.cat === 'truth').map((l) => scene.objects[l]!.key);
}

/** Objects of a category sorted by descending pT (energy for towers and clusters). */
export function listObjects(scene: DisplayScene, cat: ObjectCat): SceneObject[] {
  return scene.objects.filter((o) => o.cat === cat).sort((a, b) => (cat === 'tower' || cat === 'cluster' ? b.energy - a.energy : b.pt - a.pt));
}

/** Convert the direction angles of a point, for callers that have positions rather than (η, φ). */
export const etaPhi = etaPhiOf;
