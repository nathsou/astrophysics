/**
 * Synthetic events for developing and testing the event display, built from the event types alone.
 *
 * The truth is a small generator (a hard process, a recoil spray or jets, an underlying event and optional pile-up); the
 * detector is a toy built from the `DisplayGeometry`: helical tracks in the solenoid field with hits on the tracker layers,
 * calorimeter cells around the impact point of each particle with plausible energies, and hits in the muon stations; the
 * reconstruction finds tracks, vertices, clusters, electrons, muons, photons, jets and the missing transverse momentum.
 * Everything is seeded: the same name and seed give the same event.
 *
 * It is not the course's detector simulation (`hep/detector`) and does not import it. The numbers are plausible, not tuned.
 */
import type { CaloCell, Cluster, FullEvent, Hit, MuonHit, RecoObject, Track, TruthEvent, TruthParticle, Vertex } from '../hep/event/index.ts';
import { breitWigner, choice, exponential, normal, poisson, rng, uniform, type Rng } from '../hep/random/index.ts';
import { fromPtEtaPhiM, pt as ptOf, eta as etaOf, phi as phiOf, sum, twoBodyDecay, type P4 } from '../hep/kinematics/index.ts';
import { particle } from '../hep/particles/index.ts';
import { defaultGeometry, etaPhiOf, type DisplayGeometry } from './geometry.ts';
import { exitCylinder, helixFromMomentum, helixFromTrack, pathToRadius, pointAt, traceHelix, type HelixParams } from './helix.ts';

export type SampleName = 'zmumu' | 'h4e' | 'hgg' | 'dijet' | 'wenu' | 'pileup' | 'stress';
export const SAMPLE_NAMES: readonly SampleName[] = ['zmumu', 'h4e', 'hgg', 'dijet', 'wenu', 'pileup', 'stress'];

export const SAMPLE_LABELS: Record<SampleName, string> = {
  zmumu: 'Z → μ⁺μ⁻',
  h4e: 'H → ZZ* → 4e',
  hgg: 'H → γγ',
  dijet: 'Dijet',
  wenu: 'W → eν',
  pileup: 'Z → μ⁺μ⁻ with pile-up',
  stress: 'Stress test (about 1,000 tracks)',
};

/** Accept the spellings a Markdown directive might use ('weν', 'W->eν', 'Z→μμ'…). */
export function resolveSampleName(s: string | undefined): SampleName {
  const t = (s ?? 'zmumu').toLowerCase().replace(/[\s_→>-]/g, '');
  if ((SAMPLE_NAMES as readonly string[]).includes(t)) return t as SampleName;
  if (t.startsWith('we') || t === 'w') return 'wenu';
  if (t.startsWith('zmu') || t.startsWith('zμμ') || t === 'z') return 'zmumu';
  if (t.startsWith('h4') || t === 'hzz') return 'h4e';
  if (t.startsWith('hgg') || t.startsWith('hγγ') || t === 'hgamgam') return 'hgg';
  if (t.startsWith('jet') || t === 'qcd') return 'dijet';
  if (t.startsWith('pile') || t === 'pu') return 'pileup';
  return 'zmumu';
}

export interface SampleOptions {
  seed?: number;
  geometry?: DisplayGeometry;
  /** Number of pile-up collisions (default 35 for 'pileup', 140 for 'stress', else 0). */
  pileup?: number;
  /** Hits per tracker layer per particle (2 for double-sided modules). */
  hitsPerLayer?: number;
  /** Random noise hits added to the tracker. */
  noiseHits?: number;
}

const SQRT_S = 13000;
const ETA_CALO = 3.0;
const ETA_TRACK = 2.5;
const M_MU = 0.1056583755;
const M_E = 0.51099895e-3;

type V3 = [number, number, number];

// ── Truth building ────────────────────────────────────────────────────────────────────────────

class Builder {
  particles: TruthParticle[] = [];
  primaryVertices: V3[] = [];

  add(pdg: number, p: P4, status: TruthParticle['status'], mothers: number[], vertex: V3, collision: number, endVertex?: V3): number {
    const id = this.particles.length;
    const tp: TruthParticle = { id, pdg, p, vertex, status, mothers: [...mothers], daughters: [], collision };
    if (endVertex) tp.endVertex = endVertex;
    this.particles.push(tp);
    for (const m of mothers) this.particles[m]?.daughters.push(id);
    return id;
  }
}

function chargeOf(pdg: number): number {
  try {
    return particle(pdg).charge3 / 3;
  } catch {
    return 0;
  }
}
function massOf(pdg: number): number {
  try {
    return particle(pdg).mass;
  } catch {
    return 0;
  }
}

/** A unit vector pair perpendicular to u. */
function basis(u: V3): [V3, V3] {
  const ref: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1: V3 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]];
  const n = Math.hypot(...e1);
  e1 = [e1[0] / n, e1[1] / n, e1[2] / n];
  const e2: V3 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  return [e1, e2];
}

const HADRONS: { pdg: number; w: number }[] = [
  { pdg: 211, w: 0.5 },
  { pdg: 111, w: 0.22 },
  { pdg: 321, w: 0.07 },
  { pdg: 130, w: 0.03 },
  { pdg: 2212, w: 0.04 },
  { pdg: 2112, w: 0.03 },
];

/** A hadron species: a π⁰ decays at once to two photons; charged species get a random sign. */
function addHadron(b: Builder, r: Rng, p3: V3, mothers: number[], vertex: V3, collision: number): void {
  const k = HADRONS[choice(r, HADRONS.map((h) => h.w))]!;
  let pdg = k.pdg;
  if (chargeOf(pdg) !== 0 && r() < 0.5) pdg = -pdg;
  const m = massOf(pdg);
  const E = Math.sqrt(m * m + p3[0] ** 2 + p3[1] ** 2 + p3[2] ** 2);
  const p: P4 = { E, px: p3[0], py: p3[1], pz: p3[2] };
  if (pdg === 111) {
    const id = b.add(111, p, 'decayed', mothers, vertex, collision, vertex);
    const [g1, g2] = twoBodyDecay(r, p, 0, 0);
    b.add(22, g1, 'final', [id], vertex, collision);
    b.add(22, g2, 'final', [id], vertex, collision);
  } else {
    b.add(pdg, p, 'final', mothers, vertex, collision);
  }
}

/**
 * A parton of three-momentum magnitude `P` along (η, φ) fragments into collimated hadrons. The parton's four-vector is set
 * to the sum of the hadrons', so the momentum is conserved exactly.
 */
function fragment(b: Builder, r: Rng, pdg: number, eta: number, phi: number, P: number, mothers: number[], vertex: V3, collision: number): number {
  const u: V3 = [Math.cos(phi) / Math.cosh(eta), Math.sin(phi) / Math.cosh(eta), Math.tanh(eta)];
  const [e1, e2] = basis(u);
  const id = b.add(pdg, { E: P, px: P * u[0], py: P * u[1], pz: P * u[2] }, 'decayed', mothers, vertex, collision);
  const n = Math.max(3, Math.min(16, poisson(r, 2 + 1.5 * Math.log(Math.max(P, 2)))));
  const w = Array.from({ length: n }, () => exponential(r, 1) ** 1.5 + 0.02);
  const W = w.reduce((a, c) => a + c, 0);
  const kicks = w.map(() => [normal(r, 0, 0.42), normal(r, 0, 0.42)] as [number, number]);
  const mk: [number, number] = [kicks.reduce((a, k) => a + k[0], 0) / n, kicks.reduce((a, k) => a + k[1], 0) / n];
  for (let i = 0; i < n; i++) {
    const f = (P * w[i]!) / W;
    const kx = kicks[i]![0] - mk[0], ky = kicks[i]![1] - mk[1];
    const p3: V3 = [f * u[0] + kx * e1[0] + ky * e2[0], f * u[1] + kx * e1[1] + ky * e2[1], f * u[2] + kx * e1[2] + ky * e2[2]];
    if (Math.hypot(...p3) < 0.35) continue;
    addHadron(b, r, p3, [id], vertex, collision);
  }
  const fin = b.particles.filter((p) => p.mothers.includes(id)).map((p) => p.p);
  if (fin.length) b.particles[id]!.p = sum(fin);
  return id;
}

/** A recoil of transverse momentum (px, py) against the hard system: a soft parton that fragments. */
function recoil(b: Builder, r: Rng, px: number, py: number, vertex: V3): void {
  const pT = Math.hypot(px, py);
  if (pT < 1.5) return;
  const eta = normal(r, 0, 1.4);
  fragment(b, r, 21, eta, Math.atan2(py, px), pT * Math.cosh(eta), [], vertex, 0);
}

/** Soft particles of one proton–proton collision: the underlying event or a pile-up interaction. */
function softCollision(b: Builder, r: Rng, collision: number, vertex: V3, n: number, pTmean: number, etaMax: number): void {
  for (let i = 0; i < n; i++) {
    const pT = 0.15 + exponential(r, pTmean);
    const eta = uniform(r, -etaMax, etaMax);
    const phi = uniform(r, -Math.PI, Math.PI);
    const p3: V3 = [pT * Math.cos(phi), pT * Math.sin(phi), pT * Math.sinh(eta)];
    addHadron(b, r, p3, [], vertex, collision);
  }
}

/** A resonance with mass m, transverse momentum pt and rapidity y. */
function resonance(r: Rng, m: number, ptMean: number, yWidth: number): P4 {
  const pT = exponential(r, ptMean);
  const phi = uniform(r, -Math.PI, Math.PI);
  const y = normal(r, 0, yWidth);
  const mT = Math.hypot(m, pT);
  return { E: mT * Math.cosh(y), px: pT * Math.cos(phi), py: pT * Math.sin(phi), pz: mT * Math.sinh(y) };
}

const inAcc = (p: P4, ptMin: number, etaMax: number) => ptOf(p) > ptMin && Math.abs(etaOf(p)) < etaMax;

function beams(b: Builder): number[] {
  const e = SQRT_S / 2;
  const a = b.add(2212, { E: e, px: 0, py: 0, pz: e }, 'beam', [], [0, 0, 0], 0);
  const c = b.add(2212, { E: e, px: 0, py: 0, pz: -e }, 'beam', [], [0, 0, 0], 0);
  return [a, c];
}

/** The truth of a named process. */
function buildTruth(name: SampleName, r: Rng, number: number, pileup: number): TruthEvent {
  const b = new Builder();
  const pvz = normal(r, 0, 25);
  const pv0: V3 = [normal(r, 0, 0.012), normal(r, 0, 0.012), pvz];
  b.primaryVertices.push(pv0);
  const bm = beams(b);
  let process = '';
  const base = name === 'pileup' || name === 'stress' ? 'zmumu' : name;

  switch (base) {
    case 'zmumu': {
      process = 'pp → Z → μ⁺μ⁻';
      let z: P4 = resonance(r, 91.19, 9, 1.1), mm: [P4, P4] = twoBodyDecay(r, z, M_MU, M_MU);
      for (let i = 0; i < 100; i++) {
        z = resonance(r, breitWigner(r, 91.1876, 2.4952, 60, 120), 9, 1.1);
        mm = twoBodyDecay(r, z, M_MU, M_MU);
        if (inAcc(mm[0], 12, 2.4) && inAcc(mm[1], 12, 2.4)) break;
      }
      const zi = b.add(23, z, 'hard', bm, pv0, 0, pv0);
      b.add(13, mm[0], 'final', [zi], pv0, 0);
      b.add(-13, mm[1], 'final', [zi], pv0, 0);
      recoil(b, r, -z.px, -z.py, pv0);
      break;
    }
    case 'wenu': {
      process = 'pp → W → eν';
      const sign = r() < 0.5 ? 1 : -1; // W⁺ → e⁺ν or W⁻ → e⁻ν̄
      let w: P4 = resonance(r, 80.4, 9, 1.0), d: [P4, P4] = twoBodyDecay(r, w, M_E, 0);
      for (let i = 0; i < 100; i++) {
        w = resonance(r, breitWigner(r, 80.37, 2.085, 60, 100), 9, 1.0);
        d = twoBodyDecay(r, w, M_E, 0);
        if (inAcc(d[0], 25, 2.4)) break;
      }
      const wi = b.add(sign * 24, w, 'hard', bm, pv0, 0, pv0);
      b.add(-sign * 11, d[0], 'final', [wi], pv0, 0);
      b.add(sign * 12, d[1], 'final', [wi], pv0, 0);
      recoil(b, r, -w.px, -w.py, pv0);
      break;
    }
    case 'h4e': {
      process = 'pp → H → ZZ* → 4e';
      const mH = 125.2;
      let h: P4 = resonance(r, mH, 25, 1.0), e4: P4[] = [];
      let hi = 0, z1 = 0, z2 = 0, zA: P4 = h, zB: P4 = h;
      for (let i = 0; i < 400; i++) {
        h = resonance(r, mH, 25, 1.0);
        const m2 = uniform(r, 14, 45);
        const m1 = Math.min(breitWigner(r, 91.19, 2.5, 50, 110), mH - m2 - 1);
        [zA, zB] = twoBodyDecay(r, h, m1, m2);
        const [a1, a2] = twoBodyDecay(r, zA, M_E, M_E);
        const [c1, c2] = twoBodyDecay(r, zB, M_E, M_E);
        e4 = [a1, a2, c1, c2];
        if (e4.every((p) => inAcc(p, 6, 2.45)) && e4.filter((p) => ptOf(p) > 15).length >= 2) break;
      }
      hi = b.add(25, h, 'hard', bm, pv0, 0, pv0);
      z1 = b.add(23, zA, 'intermediate', [hi], pv0, 0, pv0);
      z2 = b.add(23, zB, 'intermediate', [hi], pv0, 0, pv0);
      b.add(11, e4[0]!, 'final', [z1], pv0, 0);
      b.add(-11, e4[1]!, 'final', [z1], pv0, 0);
      b.add(11, e4[2]!, 'final', [z2], pv0, 0);
      b.add(-11, e4[3]!, 'final', [z2], pv0, 0);
      recoil(b, r, -h.px, -h.py, pv0);
      break;
    }
    case 'hgg': {
      process = 'pp → H → γγ';
      let h: P4 = resonance(r, 125.2, 25, 1.0), g: [P4, P4] = twoBodyDecay(r, h, 0, 0);
      for (let i = 0; i < 200; i++) {
        h = resonance(r, 125.2, 25, 1.0);
        g = twoBodyDecay(r, h, 0, 0);
        if (inAcc(g[0], 30, 2.4) && inAcc(g[1], 25, 2.4)) break;
      }
      const hi = b.add(25, h, 'hard', bm, pv0, 0, pv0);
      b.add(22, g[0], 'final', [hi], pv0, 0);
      b.add(22, g[1], 'final', [hi], pv0, 0);
      recoil(b, r, -h.px, -h.py, pv0);
      break;
    }
    case 'dijet': {
      process = 'pp → jj (QCD)';
      const pT = Math.min(700, 130 * (1 - r()) ** (-1 / 4));
      const eta1 = uniform(r, -1.8, 1.8), eta2 = uniform(r, -1.8, 1.8);
      const phi1 = uniform(r, -Math.PI, Math.PI);
      const imbalance = normal(r, 0, 4);
      const flav = () => (r() < 0.5 ? 21 : (1 + Math.floor(r() * 4)) * (r() < 0.5 ? 1 : -1));
      const pdg1 = flav(), pdg2 = flav();
      fragment(b, r, pdg1, eta1, phi1, pT * Math.cosh(eta1), bm, pv0, 0);
      fragment(b, r, pdg2, eta2, phi1 + Math.PI + imbalance / pT, (pT - imbalance) * Math.cosh(eta2), bm, pv0, 0);
      break;
    }
  }

  // Underlying event.
  softCollision(b, r, 0, pv0, poisson(r, base === 'dijet' ? 22 : 14), 0.55, 3.0);

  // Pile-up: independent soft collisions at other points along the beam.
  for (let c = 1; c <= pileup; c++) {
    const v: V3 = [normal(r, 0, 0.012), normal(r, 0, 0.012), normal(r, 0, 45)];
    b.primaryVertices.push(v);
    softCollision(b, r, c, v, Math.max(4, poisson(r, name === 'stress' ? 20 : 17)), 0.6, 3.2);
  }
  return { number, weight: 1, process, sqrtS: SQRT_S, particles: b.particles, primaryVertices: b.primaryVertices };
}

// ── Detector and reconstruction ───────────────────────────────────────────────────────────────

const ECAL_LAYERS = [0.35, 0.45, 0.2];
const HCAL_LAYERS = [0.4, 0.3, 0.2, 0.1];

interface CellAcc {
  calo: 'ecal' | 'hcal';
  layer: number;
  ieta: number;
  iphi: number;
  energy: number;
  truth: Set<number>;
}

function wrapPhi(d: number): number {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

export interface SimOptions {
  hitsPerLayer?: number;
  noiseHits?: number;
}

/**
 * The toy detector and reconstruction: from a truth event to the detector output and the reconstructed objects.
 * Exported so that the particle gun can fire arbitrary particles through the same model.
 */
export function simulateAndReconstruct(truth: TruthEvent, geo: DisplayGeometry, r: Rng, opts: SimOptions = {}): Pick<FullEvent, 'detector' | 'reco' | 'trigger'> {
  const hitsPerLayer = opts.hitsPerLayer ?? 1;
  const cell = geo.ecal.cell;
  const nPhi = Math.round((2 * Math.PI) / cell);
  const dPhi = (2 * Math.PI) / nPhi;
  const hits: Hit[] = [];
  const muonHits: MuonHit[] = [];
  const hitsOf = new Map<number, number[]>();
  const cells = new Map<string, CellAcc>();
  const last = geo.muon[geo.muon.length - 1];

  const deposit = (calo: 'ecal' | 'hcal', eta: number, phi: number, E: number, width: number, layers: number[], id: number) => {
    const ie0 = Math.floor(eta / cell), ip0 = Math.floor(phi / dPhi);
    const weights: { di: number; dj: number; w: number }[] = [];
    let wsum = 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const ce = (ie0 + di + 0.5) * cell, cp = (ip0 + dj + 0.5) * dPhi;
        const d2 = ((ce - eta) / cell) ** 2 + ((cp - phi) / dPhi) ** 2;
        const w = Math.exp(-d2 / (2 * width * width));
        weights.push({ di, dj, w });
        wsum += w;
      }
    }
    for (const { di, dj, w } of weights) {
      const e = (E * w) / wsum;
      let ip = ip0 + dj;
      ip = ((ip % nPhi) + nPhi) % nPhi;
      for (let l = 0; l < layers.length; l++) {
        const el = e * layers[l]!;
        if (el < 0.02) continue;
        const key = `${calo}|${l}|${ie0 + di}|${ip}`;
        let c = cells.get(key);
        if (!c) cells.set(key, (c = { calo, layer: l, ieta: ie0 + di, iphi: ip, energy: 0, truth: new Set() }));
        c.energy += el;
        c.truth.add(id);
      }
    }
  };

  for (const p of truth.particles) {
    if (p.status !== 'final') continue;
    const a = Math.abs(p.pdg);
    if (a === 12 || a === 14 || a === 16) continue;
    const pT = ptOf(p.p);
    if (pT < 1e-3) continue;
    const eta = etaOf(p.p), phi = phiOf(p.p);
    const q = chargeOf(p.pdg);
    const h = helixFromMomentum(q, p.p.px, p.p.py, p.p.pz, p.vertex, geo.bField);

    // Tracker hits.
    if (q !== 0 && pT > 0.15) {
      const list: number[] = [];
      geo.tracker.forEach((layer, k) => {
        const s = pathToRadius(h, layer.r);
        if (s === null) return;
        const pos = pointAt(h, s);
        if (Math.abs(pos[2]) > layer.halfLength) return;
        for (let j = 0; j < hitsPerLayer; j++) {
          if (r() < 0.03) continue;
          const sj = hitsPerLayer > 1 ? s + (j - 0.5) * 4 : s;
          const pj = pointAt(h, sj);
          list.push(hits.length);
          hits.push({ layer: k, x: pj[0] + normal(r, 0, 0.02), y: pj[1] + normal(r, 0, 0.02), z: pj[2] + normal(r, 0, 0.06), truth: p.id, edep: Math.max(1, exponential(r, 3)) });
        }
      });
      hitsOf.set(p.id, list);
    }

    // The impact point on the front face of the ECAL.
    let impact: { eta: number; phi: number } | null;
    if (q !== 0) {
      const ex = exitCylinder(h, geo.ecal.rIn, geo.ecal.halfLength);
      if (!ex || !Number.isFinite(ex.s)) impact = null;
      else {
        const pos = pointAt(h, ex.s);
        impact = etaPhiOf(pos[0], pos[1], pos[2]);
      }
    } else impact = { eta, phi };
    if (!impact || Math.abs(impact.eta) > ETA_CALO) continue;

    const E = p.p.E;
    if (a === 11 || a === 22) {
      const Edep = E * Math.max(0.2, 1 + normal(r, 0, Math.hypot(0.03 / Math.sqrt(E), 0.005)));
      if (Edep > 0.3) deposit('ecal', impact.eta, impact.phi, Edep, 0.55, ECAL_LAYERS, p.id);
    } else if (a === 13) {
      if (pT > 0.8) {
        deposit('ecal', impact.eta, impact.phi, 0.3 + exponential(r, 0.1), 0.25, ECAL_LAYERS, p.id);
        deposit('hcal', impact.eta, impact.phi, 2.2 + exponential(r, 0.4), 0.25, HCAL_LAYERS, p.id);
      }
    } else {
      const Ek = Math.max(0, E - massOf(p.pdg));
      if (Ek < 0.4) continue;
      const fem = Math.min(0.6, Math.max(0.02, normal(r, 0.22, 0.12)));
      const Eh = Math.max(0, Ek * (1 - fem) * (1 + normal(r, 0, 0.9 / Math.sqrt(Ek))));
      if (Ek * fem > 0.25) deposit('ecal', impact.eta, impact.phi, Ek * fem, 0.8, ECAL_LAYERS, p.id);
      if (Eh > 0.4) deposit('hcal', impact.eta, impact.phi, Eh, 0.85, HCAL_LAYERS, p.id);
    }

    // Muon chambers: follow the same trajectory the display will draw.
    if (a === 13 && last && pT > 3.5) {
      const tr = traceHelix(h, { rStop: last.r, zStop: last.halfLength, maxStep: 40, rCoil: geo.solenoid.r, outerFactor: geo.outerFieldFactor, maxTurns: 0.6 });
      geo.muon.forEach((st, k) => {
        const pts = tr.points;
        for (let i = 3; i < pts.length; i += 3) {
          const r0 = Math.hypot(pts[i - 3]!, pts[i - 2]!), r1 = Math.hypot(pts[i]!, pts[i + 1]!);
          const out0 = r0 >= st.r || Math.abs(pts[i - 1]!) >= st.halfLength;
          const out1 = r1 >= st.r || Math.abs(pts[i + 2]!) >= st.halfLength;
          if (!out0 && out1) {
            for (let j = 0; j < 2; j++) muonHits.push({ station: k, x: pts[i]! + normal(r, 0, 1), y: pts[i + 1]! + normal(r, 0, 1), z: pts[i + 2]! + normal(r, 0, 1), truth: p.id });
            return;
          }
        }
      });
    }
  }

  // Noise hits.
  const noise = opts.noiseHits ?? 8;
  for (let i = 0; i < noise; i++) {
    const k = Math.floor(r() * geo.tracker.length);
    const L = geo.tracker[k]!;
    const ph = uniform(r, -Math.PI, Math.PI);
    hits.push({ layer: k, x: L.r * Math.cos(ph), y: L.r * Math.sin(ph), z: uniform(r, -L.halfLength, L.halfLength) * 0.8, truth: -1, edep: 1 });
  }

  // Cells above threshold.
  const cellList: CaloCell[] = [];
  const cellsOut = [...cells.values()].filter((c) => c.energy > (c.calo === 'ecal' ? 0.05 : 0.1)).sort((x, y) => (x.calo === y.calo ? y.energy - x.energy : x.calo === 'ecal' ? -1 : 1));
  for (const c of cellsOut) {
    cellList.push({ calo: c.calo, eta: (c.ieta + 0.5) * cell, phi: wrapPhi((c.iphi + 0.5) * dPhi), energy: c.energy, layer: c.layer, truth: [...c.truth] });
  }

  // ── Reconstruction ──
  const pv0 = truth.primaryVertices[0] ?? [0, 0, 0];
  const tracks: Track[] = [];
  for (const p of truth.particles) {
    if (p.status !== 'final') continue;
    const q = chargeOf(p.pdg);
    const list = hitsOf.get(p.id);
    if (q === 0 || !list || list.length < 4 * Math.min(1, hitsPerLayer)) continue;
    const pT = ptOf(p.p);
    if (pT < 0.5 || Math.abs(etaOf(p.p)) > ETA_TRACK) continue;
    const sigma = Math.hypot(0.008, 0.0002 * pT);
    const ptReco = pT * (1 + normal(r, 0, sigma));
    const ndof = 2 * list.length - 5;
    // Transverse impact parameter relative to the hard-scatter vertex (the production point is at the collision's vertex).
    const dx = p.vertex[0] - pv0[0], dy = p.vertex[1] - pv0[1];
    const ph = phiOf(p.p);
    const d0 = -dx * Math.sin(ph) + dy * Math.cos(ph) + normal(r, 0, 0.012);
    tracks.push({
      id: tracks.length,
      charge: Math.sign(q),
      pt: ptReco,
      eta: etaOf(p.p) + normal(r, 0, 0.0006),
      phi: ph + normal(r, 0, 0.0004),
      d0,
      z0: p.vertex[2] - pv0[2] + normal(r, 0, 0.04),
      chi2: Math.max(0.2, ndof + normal(r, 0, Math.sqrt(2 * ndof))),
      ndof,
      hits: list,
      truth: p.id,
      purity: 1,
    });
  }

  const vertices: Vertex[] = truth.primaryVertices.map((v, c) => ({
    x: v[0] + normal(r, 0, 0.004),
    y: v[1] + normal(r, 0, 0.004),
    z: v[2] + normal(r, 0, 0.02),
    tracks: tracks.filter((t) => (truth.particles[t.truth]?.collision ?? 0) === c).map((t) => t.id),
    kind: c === 0 ? ('primary' as const) : ('pileup' as const),
    chi2: 1,
  }));

  // Clusters: seeded 3×3 sums of towers (all layers of a cell summed).
  const towers = new Map<string, { calo: 'ecal' | 'hcal'; ieta: number; iphi: number; energy: number; cells: number[] }>();
  cellList.forEach((c, i) => {
    const ie = Math.floor(c.eta / cell);
    const ip = Math.floor((c.phi < 0 ? c.phi + 2 * Math.PI : c.phi) / dPhi) % nPhi;
    const key = `${c.calo}|${ie}|${ip}`;
    let t = towers.get(key);
    if (!t) towers.set(key, (t = { calo: c.calo, ieta: ie, iphi: ip, energy: 0, cells: [] }));
    t.energy += c.energy;
    t.cells.push(i);
  });
  const clusters: Cluster[] = [];
  const used = new Set<string>();
  const sorted = [...towers.entries()].sort((x, y) => y[1].energy - x[1].energy);
  for (const [key, seed] of sorted) {
    if (used.has(key)) continue;
    if (seed.energy < (seed.calo === 'ecal' ? 1 : 1.5)) break;
    let E = 0, se = 0, sp = 0;
    const members: number[] = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const k2 = `${seed.calo}|${seed.ieta + di}|${(((seed.iphi + dj) % nPhi) + nPhi) % nPhi}`;
        const t = towers.get(k2);
        if (!t || used.has(k2)) continue;
        used.add(k2);
        E += t.energy;
        se += t.energy * (t.ieta + 0.5) * cell;
        sp += t.energy * dj * dPhi;
        members.push(...t.cells);
      }
    }
    const seedPhi = wrapPhi((seed.iphi + 0.5) * dPhi);
    if (E >= (seed.calo === 'ecal' ? 1.5 : 2)) clusters.push({ calo: seed.calo, energy: E, eta: se / E, phi: wrapPhi(seedPhi + sp / E), cells: members });
  }

  const cl = clusters.map((c) => ({ c, et: c.energy / Math.cosh(c.eta) }));
  const dR = (e1: number, p1: number, e2: number, p2: number) => Math.hypot(e1 - e2, wrapPhi(p1 - p2));
  const objects: RecoObject[] = [];
  const usedCluster = new Set<number>();
  const trackSumPt = (eta: number, phi: number, cone: number, skip: number[]) => {
    let s = 0;
    for (const t of tracks) if (!skip.includes(t.id) && dR(t.eta, t.phi, eta, phi) < cone) s += t.pt;
    return s;
  };
  const dominantTruth = (ci: number): number => {
    const count = new Map<number, number>();
    for (const cellIdx of clusters[ci]!.cells) for (const t of cellList[cellIdx]!.truth) count.set(t, (count.get(t) ?? 0) + cellList[cellIdx]!.energy);
    let best = -1, bestE = 0;
    for (const [t, e] of count) if (e > bestE) (best = t), (bestE = e);
    return best;
  };

  // Muons and electrons from tracks.
  for (const t of tracks) {
    const tp = truth.particles[t.truth];
    if (!tp) continue;
    const a = Math.abs(tp.pdg);
    if (a === 13 && t.pt > 5 && muonHits.some((m) => m.truth === t.truth)) {
      objects.push({
        kind: 'muon',
        p: fromPtEtaPhiM(t.pt, t.eta, t.phi, M_MU),
        charge: t.charge,
        isolation: trackSumPt(t.eta, t.phi, 0.3, [t.id]) / t.pt,
        tracks: [t.id],
        clusters: [],
        truth: t.truth,
      });
    } else if (a === 11 && t.pt > 8) {
      let best = -1, bd = 0.12;
      cl.forEach(({ c }, i) => {
        if (c.calo !== 'ecal' || usedCluster.has(i)) return;
        const d = dR(c.eta, c.phi, t.eta, t.phi);
        if (d < bd) (bd = d), (best = i);
      });
      if (best >= 0) {
        usedCluster.add(best);
        const c = clusters[best]!;
        const ptE = c.energy / Math.cosh(t.eta);
        objects.push({
          kind: 'electron',
          p: fromPtEtaPhiM(ptE, t.eta, t.phi, M_E),
          charge: t.charge,
          isolation: trackSumPt(t.eta, t.phi, 0.3, [t.id]) / ptE,
          tracks: [t.id],
          clusters: [best],
          truth: t.truth,
        });
      }
    }
  }
  // Photons: isolated electromagnetic clusters without a track.
  cl.forEach(({ c, et }, i) => {
    if (c.calo !== 'ecal' || usedCluster.has(i) || et < 15) return;
    if (tracks.some((t) => t.pt > 1 && dR(t.eta, t.phi, c.eta, c.phi) < 0.12)) return;
    const iso = trackSumPt(c.eta, c.phi, 0.3, []) / et;
    if (iso > 0.15) return;
    usedCluster.add(i);
    objects.push({ kind: 'photon', p: fromPtEtaPhiM(et, c.eta, c.phi, 0), isolation: iso, tracks: [], clusters: [i], truth: dominantTruth(i) });
  });
  // Jets: a cone of ΔR = 0.4 around the hardest unused cluster, repeatedly.
  const order = cl.map((x, i) => ({ ...x, i })).filter((x) => !usedCluster.has(x.i)).sort((x, y) => y.et - x.et);
  const taken = new Set<number>();
  const partons = truth.particles.filter((p) => p.status === 'decayed' && (Math.abs(p.pdg) <= 6 || p.pdg === 21));
  for (const seed of order) {
    if (taken.has(seed.i) || seed.et < 6) continue;
    const members = order.filter((o) => !taken.has(o.i) && dR(o.c.eta, o.c.phi, seed.c.eta, seed.c.phi) < 0.4);
    const vec = members.map((m) => fromPtEtaPhiM(m.et, m.c.eta, m.c.phi, 0));
    const tot = sum(vec);
    const jpt = ptOf(tot);
    if (jpt < 20) continue;
    members.forEach((m) => taken.add(m.i));
    const je = etaOf(tot), jp = phiOf(tot);
    const jt = tracks.filter((t) => dR(t.eta, t.phi, je, jp) < 0.4).map((t) => t.id);
    let tr = -1, best = 0.4;
    for (const pa of partons) {
      const d = dR(etaOf(pa.p), phiOf(pa.p), je, jp);
      if (d < best) (best = d), (tr = pa.id);
    }
    objects.push({ kind: 'jet', p: tot, btag: Math.min(1, Math.abs(normal(r, 0.1, 0.12))), tracks: jt, clusters: members.map((m) => m.i), nConstituents: jt.length + members.length, truth: tr });
  }
  objects.sort((x, y) => ptOf(y.p) - ptOf(x.p));

  // Missing transverse momentum: minus the vector sum of the calorimeter clusters and muons, with a resolution term.
  let mx = 0, my = 0, sumEt = 0;
  for (const { c, et } of cl) {
    mx -= et * Math.cos(c.phi);
    my -= et * Math.sin(c.phi);
    sumEt += et;
  }
  for (const o of objects) {
    if (o.kind !== 'muon') continue;
    mx -= ptOf(o.p) * Math.cos(phiOf(o.p));
    my -= ptOf(o.p) * Math.sin(phiOf(o.p));
    sumEt += ptOf(o.p);
  }
  const res = 0.5 * Math.sqrt(Math.max(sumEt, 1));
  mx += normal(r, 0, res);
  my += normal(r, 0, res);

  const trig: string[] = [];
  const mu = objects.filter((o) => o.kind === 'muon');
  if (mu.some((o) => ptOf(o.p) > 24)) trig.push('HLT_IsoMu24');
  if (objects.some((o) => o.kind === 'electron' && ptOf(o.p) > 32)) trig.push('HLT_Ele32');
  if (objects.filter((o) => o.kind === 'photon' && ptOf(o.p) > 25).length >= 2) trig.push('HLT_Diphoton');
  if (objects.some((o) => o.kind === 'jet' && ptOf(o.p) > 200)) trig.push('HLT_PFJet200');

  const pileup = truth.primaryVertices.length - 1;
  return {
    detector: { hits, cells: cellList, muonHits, pileup },
    reco: { tracks, vertices, clusters, objects, met: { x: mx, y: my }, sumEt },
    trigger: trig,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────────────────────

/** A seeded synthetic event of the named kind. */
export function sampleEvent(name: SampleName | string, opts: SampleOptions = {}): FullEvent {
  const n = resolveSampleName(name);
  const seed = opts.seed ?? 1;
  const r = rng(seed * 7919 + 13);
  const geo = opts.geometry ?? defaultGeometry;
  const pileup = opts.pileup ?? (n === 'pileup' ? 35 : n === 'stress' ? 140 : 0);
  const truth = buildTruth(n, r, seed, pileup);
  const out = simulateAndReconstruct(truth, geo, r.fork('detector'), { hitsPerLayer: opts.hitsPerLayer ?? (n === 'stress' ? 2 : 1), noiseHits: opts.noiseHits ?? (pileup > 0 ? 40 : 8) });
  return { truth, ...out, weight: 1 };
}

/** `count` events of one kind with consecutive seeds starting at `seed`. */
export function sampleEvents(name: SampleName | string, count: number, seed = 1, opts: Omit<SampleOptions, 'seed'> = {}): FullEvent[] {
  return Array.from({ length: count }, (_, i) => sampleEvent(name, { ...opts, seed: seed + i }));
}

export interface GunOptions {
  /** PDG number of the particle to fire. */
  pdg: number;
  /** Transverse momentum in GeV. */
  pt: number;
  eta: number;
  phi: number;
  seed?: number;
  geometry?: DisplayGeometry;
  /** Override the geometry's field (T). */
  bField?: number;
}

/** Fire a single particle from the primary vertex through the toy detector: to see what each kind does. */
export function gunEvent(o: GunOptions): FullEvent {
  const geo = { ...(o.geometry ?? defaultGeometry), bField: o.bField ?? (o.geometry ?? defaultGeometry).bField };
  const r = rng((o.seed ?? 1) * 104729 + 7);
  const pv: V3 = [0, 0, 0];
  const m = massOf(o.pdg);
  const p = fromPtEtaPhiM(o.pt, o.eta, o.phi, m);
  const tp: TruthParticle = { id: 0, pdg: o.pdg, p, vertex: pv, status: 'final', mothers: [], daughters: [], collision: 0 };
  const truth: TruthEvent = { number: o.seed ?? 1, weight: 1, process: `particle gun: ${particle(o.pdg).symbol}`, sqrtS: SQRT_S, particles: [tp], primaryVertices: [pv] };
  const out = simulateAndReconstruct(truth, geo, r, { noiseHits: 0 });
  return { truth, ...out, weight: 1 };
}

/** The helix of a reconstructed track in a geometry (convenience for tests and views). */
export function trackHelix(t: Track, pv: readonly [number, number, number], geo: DisplayGeometry): HelixParams {
  return helixFromTrack(t, pv, geo.bField);
}
