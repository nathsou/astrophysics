/**
 * The detector fast simulation: truth particles in, hits, calorimeter cells and muon hits out.
 *
 * Every final-state particle is followed through the detector, layer by layer, with a seeded random stream:
 *
 *  - charged particles move on helices in the solenoid field (see `helix.ts`); at each tracker cylinder they leave a
 *    Gaussian-smeared hit, unless the channel is dead or the particle curls up before reaching it;
 *  - in each layer's material they scatter (Highland), lose energy (Landau-fluctuated Bethe–Bloch), and, if they are
 *    electrons, radiate bremsstrahlung photons (Bethe–Heitler thickness law); photons may convert to e⁺e⁻;
 *  - unstable particles still in the truth record as 'final' decay in flight, with the exponential law in the boosted
 *    lifetime, and their daughters are followed from the decay point (a kink or a secondary vertex);
 *  - electrons and photons shower in the ECAL, hadrons start in the ECAL with probability 1 − e^{−depth/λ} and deposit
 *    in the HCAL, muons deposit a MIP and, if they have enough momentum, leave hits in the muon stations, where they
 *    bend in the return field; neutrinos and anything unknown leave nothing.
 *
 * See README.md for the list of approximations.
 */
import type { CaloCell, DetectorEvent, Hit, MuonHit, TruthEvent } from '../event/index.ts';
import { phaseSpace, twoBodyDecay, type P4 } from '../kinematics/index.ts';
import { hasParticle, particle } from '../particles/index.ts';
import { hook } from '../hooks.ts';
import { exponential, normal, poisson, rng as makeRng, type Rng } from '../random/index.ts';
import { hcalOuterRadius, type DetectorConfig } from './config.ts';
import { HelixTrack, helix, type Helix } from './helix.ts';
import { materials, material, type Material } from './materials.ts';
import { erf, gammaP, gammaVariate, meanEnergyLoss, multipleScatteringAngle, muonEnergyAfter, sampleEnergyLoss, stoppingPower } from './physics.ts';
import { LATERAL_EM, LATERAL_HAD, hadronShape, showerShape } from './shower.ts';

// ── Public types ──────────────────────────────────────────────────────────────────────────────

/** A particle created inside the detector (not in the truth record): a decay product, a conversion pair member or a bremsstrahlung photon. */
export interface SimSecondary {
  pdg: number;
  /** The truth-particle index this one descends from (hits carry that index). */
  parent: number;
  origin: 'decay' | 'conversion' | 'bremsstrahlung';
  /** Where it was created (mm). */
  vertex: [number, number, number];
  p: P4;
  /** Charge in units of e. */
  charge: number;
}

export interface SimulateOptions {
  /** Additional truth events (min-bias collisions) to overlay. Their particles get truth indices offset by `truthOffsets`. */
  pileup?: TruthEvent[];
  /** If given, the secondaries created during the simulation are appended here. */
  secondaries?: SimSecondary[];
}

/**
 * The truth-index offsets of the overlaid events: a hit from particle `i` of `pileup[k]` carries the truth index
 * `offsets[k] + i`, which is ≥ `truth.particles.length`, so it can never be mistaken for a particle of the hard event.
 */
export function truthOffsets(truth: TruthEvent, pileup: readonly TruthEvent[] = []): number[] {
  const out: number[] = [];
  let base = truth.particles.length;
  for (const e of pileup) {
    out.push(base);
    base += e.particles.length;
  }
  return out;
}

/**
 * A copy of `truth` with every vertex shifted to a luminous-region position drawn from the beam spot of `cfg`
 * (σz along the beam, σxy transverse). Use it on generator events that were produced at the origin.
 */
export function placeInBeamSpot(truth: TruthEvent, cfg: DetectorConfig, rng: Rng): TruthEvent {
  const dx = normal(rng) * cfg.beamSpot.sigmaXY;
  const dy = normal(rng) * cfg.beamSpot.sigmaXY;
  const dz = normal(rng) * cfg.beamSpot.sigmaZ;
  return shiftTruth(truth, dx, dy, dz);
}

function shiftTruth(truth: TruthEvent, dx: number, dy: number, dz: number): TruthEvent {
  const mv = (v: [number, number, number]): [number, number, number] => [v[0] + dx, v[1] + dy, v[2] + dz];
  return {
    ...truth,
    particles: truth.particles.map((p) => ({ ...p, vertex: mv(p.vertex), endVertex: p.endVertex ? mv(p.endVertex) : undefined })),
    primaryVertices: truth.primaryVertices.map(mv),
  };
}

// ── Per-species information ───────────────────────────────────────────────────────────────────

type Cat = 'invisible' | 'photon' | 'electron' | 'muon' | 'hadron';

interface Info {
  pdg: number;
  cat: Cat;
  /** Charge in units of e. */
  q: number;
  /** Mass in GeV. */
  m: number;
  /** cτ in mm (Infinity if the particle does not decay within the model). */
  cTau: number;
  /** +1 for baryons, −1 for antibaryons, 0 otherwise. */
  baryon: number;
  cumBr: number[];
  channels: number[][];
}

const INVISIBLE: Omit<Info, 'pdg'> = { cat: 'invisible', q: 0, m: 0, cTau: Infinity, baryon: 0, cumBr: [], channels: [] };
const infoCache = new Map<number, Info>();

function infoOf(pdg: number): Info {
  let info = infoCache.get(pdg);
  if (info) return info;
  info = buildInfo(pdg);
  infoCache.set(pdg, info);
  return info;
}

function buildInfo(pdg: number): Info {
  const a = Math.abs(pdg);
  if (a === 12 || a === 14 || a === 16 || !hasParticle(pdg)) return { pdg, ...INVISIBLE };
  const t = particle(pdg);
  if ((t.kind === 'quark' || t.kind === 'boson') && pdg !== 22) return { pdg, ...INVISIBLE };
  const cat: Cat = pdg === 22 ? 'photon' : a === 11 ? 'electron' : a === 13 ? 'muon' : 'hadron';
  let cTau = Infinity;
  const cumBr: number[] = [];
  const channels: number[][] = [];
  if (Number.isFinite(t.lifetime) && t.decays.length > 0 && cat !== 'photon' && cat !== 'electron') {
    const c = t.lifetime * 1e9 * C_MM_NS;
    if (c < 1e9) {
      cTau = c;
      let acc = 0;
      for (const d of t.decays) {
        if (d.products.every((id) => hasParticle(id))) {
          acc += d.br;
          cumBr.push(acc);
          channels.push(d.products);
        }
      }
      if (channels.length === 0) cTau = Infinity;
    }
  }
  return { pdg, cat, q: t.charge3 / 3, m: t.mass, cTau, baryon: Math.sign(t.baryon3), cumBr, channels };
}

// ── Decay kinematics ──────────────────────────────────────────────────────────────────────────

const maxWeightCache = new Map<string, number>();
function maxWeight(M: number, masses: number[]): number {
  const key = `${M.toFixed(5)}|${masses.join(',')}`;
  let w = maxWeightCache.get(key);
  if (w === undefined) {
    const r = makeRng(987654321); // a private, fixed stream: must not touch the event's random numbers
    const rest: P4 = { E: M, px: 0, py: 0, pz: 0 };
    let mx = 0;
    for (let i = 0; i < 400; i++) mx = Math.max(mx, phaseSpace(r, rest, masses).weight);
    w = mx * 1.25;
    maxWeightCache.set(key, w);
  }
  return w;
}

/** Decay the four-vector `parent` (of mass M) into the particles `ids`: two-body isotropic, n-body by RAMBO with accept–reject. */
function decayKinematics(rng: Rng, parent: P4, M: number, ids: number[]): P4[] {
  const masses = ids.map((id) => particle(id).mass);
  if (ids.length === 1) return [parent];
  const sumM = masses.reduce((a, b) => a + b, 0);
  if (sumM >= M) {
    // not enough phase space (a rounding corner case): share the momentum by mass, along the parent direction
    return ids.map((_, i) => {
      const f = masses[i]! / (sumM || 1);
      const px = parent.px * f, py = parent.py * f, pz = parent.pz * f;
      return { E: Math.sqrt(masses[i]! ** 2 + px * px + py * py + pz * pz), px, py, pz };
    });
  }
  if (ids.length === 2) return twoBodyDecay(rng, parent, masses[0]!, masses[1]!);
  const wmax = maxWeight(M, masses);
  let ps = phaseSpace(rng, parent, masses);
  for (let i = 0; i < 200 && rng() * wmax > ps.weight; i++) ps = phaseSpace(rng, parent, masses);
  return ps.p;
}

// ── Working state ─────────────────────────────────────────────────────────────────────────────

/** A particle being followed. */
interface Work {
  info: Info;
  px: number;
  py: number;
  pz: number;
  x: number;
  y: number;
  z: number;
  /** Truth index (with pile-up offset) that hits and cells are attributed to. */
  truth: number;
  depth: number;
  /** Lab path (mm) to the decay point, Infinity if it does not decay in the detector. */
  decayPath: number;
  /** The decay is certain (its position is known from the truth record). */
  forced: boolean;
  /** The particle ends at `decayPath` but its daughters are in the truth record: do not create any. */
  endsOnly: boolean;
  /** Pile-up particle: followed with the cheaper treatment (see README). */
  light: boolean;
}

interface Lay {
  idx: number;
  r: number;
  hl: number;
  sRPhi: number;
  sZ: number;
  x0: number;
  /** Sensor thickness in g/cm². */
  sensorG: number;
  pitchRPhi: number;
  pitchZ: number;
}

interface CalGeo {
  cal: 0 | 1;
  rIn: number;
  cellEta: number;
  nPhi: number;
  dPhi: number;
  etaMax: number;
  noise: number;
  layers: number;
  stochastic: number;
  constant: number;
  eCut: number;
}

/** Speed of light in mm/ns (as `C_MM_NS` in hep/units; repeated here so this module does not depend on it). */
const C_MM_NS = 299.792458;
const SENSOR_CM = { pixel: 0.03, strip: 0.032 };
/** Pile-up deposits below this energy (GeV) go into a single cell per layer. */
const LIGHT_POINT = 2;
const BREM_EMIT = 0.05; // GeV: bremsstrahlung photons below this are accumulated, not emitted one by one
const DEAD_SEED = 0x9e3779b1;
const MAX_W = 3;

class CellAcc {
  /** One map per (calorimeter, layer), keyed by (ieta + 4096) × nPhi + iphi (small integers, so V8 hashes them fast). */
  private maps: (Map<number, number> | undefined)[] = new Array(32);
  /** Per cell: which (calorimeter, layer), the packed position, energy, variance and the first contributing truth particle. */
  mi: number[] = [];
  key: number[] = [];
  e: number[] = [];
  v: number[] = [];
  t0: number[] = [];
  /** Further contributors, for the cells that have more than one. */
  more = new Map<number, number[]>();

  add(cal: number, layer: number, ieta: number, iphi: number, nPhi: number, e: number, v: number, truth: number): void {
    const mi = cal * 16 + layer;
    let map = this.maps[mi];
    if (!map) map = this.maps[mi] = new Map();
    const key = (ieta + 4096) * nPhi + iphi;
    let i = map.get(key);
    if (i === undefined) {
      i = this.e.length;
      map.set(key, i);
      this.mi.push(mi);
      this.key.push(key);
      this.e.push(e);
      this.v.push(v);
      this.t0.push(truth);
      return;
    }
    this.e[i]! += e;
    this.v[i]! += v;
    const first = this.t0[i]!;
    if (truth < 0 || first === truth) return;
    if (first < 0) {
      this.t0[i] = truth;
      return;
    }
    let m = this.more.get(i);
    if (!m) this.more.set(i, (m = [truth]));
    else if (m.length < 63 && m[m.length - 1] !== truth && !m.includes(truth)) m.push(truth);
  }
  get size(): number {
    return this.e.length;
  }
  truthOf(i: number): number[] {
    const first = this.t0[i]!;
    const m = this.more.get(i);
    if (first < 0) return [];
    return m ? [first, ...m] : [first];
  }
}

interface Ctx {
  cfg: DetectorConfig;
  rng: Rng;
  lays: Lay[];
  hits: Hit[];
  muonHits: MuonHit[];
  cells: CellAcc;
  stack: Work[];
  /** A reusable helix for the particle being followed. */
  hx: HelixTrack;
  /** Multiple-scattering width; the reader's version if the hook `detector.multipleScatteringAngle` is installed. */
  msAngle: typeof multipleScatteringAngle;
  secondaries: SimSecondary[] | null;
  Si: Material;
  siX0: number;
  ecalMat: Material;
  hcalMat: Material;
  ecal: CalGeo;
  hcal: CalGeo;
  ecalEc: number;
  ecalDepthLam: number;
  hcalDepthLam: number;
  mipEcal: number;
  mipHcal: number;
  ecalThickG: number;
  hcalThickG: number;
  coilR: number;
  muonHalf: number;
  /** Scratch for the lateral fractions and layer energies. */
  le: Float64Array;
  cum: Float64Array;
  /** Spare Gaussian deviate (Box–Muller produces them in pairs). */
  spare: number;
  hasSpare: boolean;
  emE: EmTab;
  emG: EmTab;
  rMolEm: number;
  lamEcal: number;
  lamHcal: number;
}

function calGeo(cal: 0 | 1, rIn: number, cellEta: number, cellPhi: number, etaMax: number, noise: number, layers: number, stochastic: number, constant: number): CalGeo {
  const nPhi = Math.max(4, Math.round((2 * Math.PI) / cellPhi));
  return { cal, rIn, cellEta, nPhi, dPhi: (2 * Math.PI) / nPhi, etaMax, noise, layers: Math.min(16, Math.max(1, Math.round(layers))), stochastic, constant, eCut: noise > 0 ? 0.5 * noise : 1e-7 };
}

function makeCtx(cfg: DetectorConfig, rng: Rng, secondaries: SimSecondary[] | null): Ctx {
  const Si = materials.Si!;
  const ecalMat = material(cfg.ecal.material ?? 'PbWO4');
  const hcalMat = material(cfg.hcal.material ?? 'Fe');
  const order = cfg.trackerLayers.map((l, i) => ({ l, i })).sort((a, b) => a.l.r - b.l.r);
  const lays: Lay[] = order.map(({ l, i }) => ({
    idx: i,
    r: l.r,
    hl: l.halfLength,
    sRPhi: l.sigmaRPhi,
    sZ: l.sigmaZ,
    x0: l.x0,
    sensorG: SENSOR_CM[l.kind] * Si.density,
    pitchRPhi: Math.max(1e-3, l.sigmaRPhi * Math.sqrt(12)),
    pitchZ: Math.max(1e-2, l.sigmaZ * Math.sqrt(12)),
  }));
  const ecalThickG = cfg.ecal.depthX0 * ecalMat.X0;
  const hcalThickG = cfg.hcal.depthLambda * hcalMat.lambdaI;
  const hcalEta = cfg.hcal.etaMax ?? cfg.ecal.etaMax;
  return {
    cfg,
    rng,
    lays,
    hits: [],
    muonHits: [],
    cells: new CellAcc(),
    stack: [],
    hx: new HelixTrack(),
    msAngle: hook('detector.multipleScatteringAngle', multipleScatteringAngle),
    secondaries,
    Si,
    siX0: Si.X0,
    ecalMat,
    hcalMat,
    ecal: calGeo(0, cfg.ecal.rIn, cfg.ecal.cellEta, cfg.ecal.cellPhi, cfg.ecal.etaMax, cfg.ecal.noise ?? 0, cfg.ecal.layers, cfg.ecal.stochastic, cfg.ecal.constant),
    hcal: calGeo(1, cfg.hcal.rIn, cfg.hcal.cellEta, cfg.hcal.cellPhi, hcalEta, cfg.hcal.noise ?? 0, cfg.hcal.layers, cfg.hcal.stochastic, cfg.hcal.constant),
    ecalEc: ecalMat.Ec * 1e-3,
    ecalDepthLam: ecalThickG / ecalMat.lambdaI,
    hcalDepthLam: cfg.hcal.depthLambda,
    // MIP: mean collision loss at p = 3 GeV for a pion-like particle times the thickness; HCAL: 30 MeV of visible energy per λ
    mipEcal: (stoppingPower(ecalMat, 3, 0.13957) * ecalThickG) * 1e-3,
    mipHcal: 0.03 * cfg.hcal.depthLambda,
    ecalThickG,
    hcalThickG,
    coilR: cfg.solenoidRadius ?? hcalOuterRadius(cfg),
    muonHalf: Math.max(1, ...cfg.muon.stations.map((s) => s.halfLength)),
    le: new Float64Array(16),
    cum: new Float64Array(16),
    spare: 0,
    hasSpare: false,
    emE: emTable(ecalMat.Ec * 1e-3, cfg.ecal.depthX0, Math.min(16, Math.max(1, Math.round(cfg.ecal.layers))), 'electron'),
    emG: emTable(ecalMat.Ec * 1e-3, cfg.ecal.depthX0, Math.min(16, Math.max(1, Math.round(cfg.ecal.layers))), 'photon'),
    rMolEm: (21.2 * ecalMat.X0cm * 10) / ecalMat.Ec,
    lamEcal: ecalMat.lambdaIcm * 10,
    lamHcal: hcalMat.lambdaIcm * 10,
  };
}

/** A standard normal deviate: Box–Muller, using both numbers of each pair (the spare is kept in the context, so streams stay reproducible). */
function gauss(c: Ctx): number {
  if (c.hasSpare) {
    c.hasSpare = false;
    return c.spare;
  }
  const r = Math.sqrt(-2 * Math.log(1 - c.rng()));
  const a = 6.283185307179586 * c.rng();
  c.spare = r * Math.sin(a);
  c.hasSpare = true;
  return r * Math.cos(a);
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────────

/**
 * Simulate the detector response to a truth event.
 *
 * @param truth the event from the generator (only particles with status 'final' are followed, plus charged particles
 *   that decayed in the generator, up to their decay vertex)
 * @param cfg a detector configuration (see `presets`)
 * @param rng the seeded random stream; the same seed gives the same event
 * @param opts `pileup`: extra truth events to overlay (their hits carry truth indices offset by `truthOffsets`)
 */
export function simulate(truth: TruthEvent, cfg: DetectorConfig, rng: Rng, opts: SimulateOptions = {}): DetectorEvent {
  const c = makeCtx(cfg, rng, opts.secondaries ?? null);
  // collisions already in the truth record
  const collisions = new Set<number>();
  for (const p of truth.particles) if (p.collision && p.collision > 0) collisions.add(p.collision);
  runEvent(c, truth, 0, false);
  const pile = opts.pileup ?? [];
  const offs = truthOffsets(truth, pile);
  for (let k = 0; k < pile.length; k++) {
    let e = pile[k]!;
    // A generator that left the pile-up collision at the origin would stack every collision on one point: spread it.
    const pv = e.primaryVertices[0];
    if (!pv || (pv[0] === 0 && pv[1] === 0 && pv[2] === 0)) e = placeInBeamSpot(e, cfg, rng);
    runEvent(c, e, offs[k]!, true);
  }
  addNoiseHits(c);
  return {
    hits: c.hits,
    cells: finaliseCells(c),
    muonHits: c.muonHits,
    pileup: collisions.size + pile.length,
  };
}

function runEvent(c: Ctx, ev: TruthEvent, offset: number, light: boolean): void {
  const rng = c.rng;
  const B = c.cfg.bField;
  const ps = ev.particles;
  for (let i = 0; i < ps.length; i++) {
    const tp = ps[i]!;
    const final = tp.status === 'final';
    if (!final && tp.status !== 'decayed') continue;
    const info = infoOf(tp.pdg);
    if (info.cat === 'invisible') continue;
    const px = tp.p.px, py = tp.p.py, pz = tp.p.pz;
    const p = Math.sqrt((px) * (px) + (py) * (py) + (pz) * (pz));
    if (!(p > 1e-6)) continue;
    const w: Work = { info, px, py, pz, x: tp.vertex[0], y: tp.vertex[1], z: tp.vertex[2], truth: offset + i, depth: 0, decayPath: Infinity, forced: false, endsOnly: false, light: light || (tp.collision ?? 0) > 0 };
    const hasDaughters = tp.daughters.length > 0;
    if (final && !hasDaughters) {
      if (tp.endVertex && info.cTau < Infinity) {
        // the generator says where it decayed but recorded no daughters: decay there
        w.decayPath = arcLength(w, tp.endVertex, B);
        w.forced = true;
      } else if (info.cTau < Infinity) w.decayPath = exponential(rng, (p / info.m) * info.cTau);
    } else {
      // decayed in the generator (or final with recorded daughters): only the flight before the decay is ours
      if (info.q === 0 || !tp.endVertex) continue;
      w.decayPath = arcLength(w, tp.endVertex, B);
      w.forced = true;
      w.endsOnly = true;
      if (w.decayPath < 1) continue; // decayed at the vertex: no visible track
    }
    c.stack.push(w);
    drain(c);
  }
}

function arcLength(w: Work, end: readonly [number, number, number], B: number): number {
  const m = w.info.m;
  const E = Math.sqrt(w.px * w.px + w.py * w.py + w.pz * w.pz + m * m);
  return helix({ E, px: w.px, py: w.py, pz: w.pz }, w.info.q, [w.x, w.y, w.z], B).arcTo(end);
}

function drain(c: Ctx): void {
  const st = c.stack;
  const etaCut = Math.max(c.cfg.etaMax, c.ecal.etaMax, c.hcal.etaMax) + 0.3;
  while (st.length) {
    const w = st.pop()!;
    if (w.depth > 12) continue;
    // Fast path: a particle that points far outside every detector and will not decay on the way leaves nothing.
    // (A helix only moves its position to larger |η| than its direction, so the test is safe.)
    if (w.decayPath > 12000) {
      const pt = Math.sqrt((w.px) * (w.px) + (w.py) * (w.py));
      if (pt < 1e-9 || Math.abs(Math.asinh(w.pz / pt)) > etaCut) continue;
    }
    const cat = w.info.cat;
    if (w.info.q !== 0) trackCharged(c, w);
    else if (cat === 'photon') trackPhoton(c, w);
    else trackNeutralHadron(c, w);
  }
}

// ── Charged particles ─────────────────────────────────────────────────────────────────────────

function hash32(a: number, b: number, c: number): number {
  let h = DEAD_SEED ^ Math.imul(a | 0, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35) ^ Math.imul(c | 0, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

function trackCharged(c: Ctx, w: Work): void {
  const rng = c.rng;
  const cfg = c.cfg;
  const info = w.info;
  const m = info.m;
  const q = info.q;
  const aq = Math.abs(q);
  const isE = info.cat === 'electron';
  const B = cfg.bField;
  let x = w.x, y = w.y, z = w.z;
  let px = w.px, py = w.py, pz = w.pz;
  let p = Math.sqrt((px) * (px) + (py) * (py) + (pz) * (pz));
  let E = Math.sqrt(p * p + m * m);
  let dLeft = w.decayPath;
  const pt0 = Math.sqrt((px) * (px) + (py) * (py));
  const inAcc = pt0 > 1e-9 && Math.abs(Math.asinh(pz / pt0)) < cfg.etaMax;
  const hx = c.hx.reset(E, px, py, pz, q, x, y, z, B);
  let pendE = 0;
  let pendX = 0, pendY = 0, pendZ = 0, pendUx = 0, pendUy = 0, pendUz = 0;

  if (inAcc) {
    const lays = c.lays;
    for (let li = 0; li < lays.length; li++) {
      const L = lays[li]!;
      if (L.r <= Math.sqrt((x) * (x) + (y) * (y)) + 1e-6) continue;
      const s = hx.intersectCylinder(L.r, L.hl);
      if (s === null) {
        if (hx.crossRadius(L.r) === null) break;
        continue;
      }
      if (s >= dLeft) break;
      hx.evalAt(s);
      const ox = hx.ox, oy = hx.oy, oz = hx.oz;
      let ux = hx.ux, uy = hx.uy, uz = hx.uz;
      const cosA = Math.max(0.05, Math.abs(ux * ox + uy * oy) / L.r);
      // ── the hit
      let dead = false;
      if (cfg.deadFraction > 0) {
        const phi = Math.atan2(oy, ox);
        dead = hash32(L.idx, Math.floor((phi * L.r) / L.pitchRPhi), Math.floor(oz / L.pitchZ)) / 4294967296 < cfg.deadFraction;
      }
      if (!dead) {
        const dT = gauss(c) * L.sRPhi;
        const dz = L.sZ > 0 ? gauss(c) * L.sZ : 0;
        const edep = sampleEnergyLoss(rng, c.Si, L.sensorG / cosA, p, m, aq) * 1e6;
        c.hits.push({ layer: L.idx, x: ox - (dT * oy) / L.r, y: oy + (dT * ox) / L.r, z: oz + dz, truth: w.truth, edep });
      }
      dLeft -= s;
      if (w.light) continue; // pile-up: no scattering, energy loss or radiation in the material
      // ── the material of the layer: thickness t radiation lengths along the path
      const t = L.x0 / cosA;
      const th0 = c.msAngle(p, p / E, t, aq);
      if (th0 > 0) {
        // two perpendicular kicks
        let e1x: number, e1y: number, e1z: number;
        const rho = Math.sqrt((ux) * (ux) + (uy) * (uy));
        if (rho > 0.1) {
          e1x = -uy / rho; e1y = ux / rho; e1z = 0;
        } else {
          const n = Math.sqrt((uy) * (uy) + (uz) * (uz));
          e1x = 0; e1y = -uz / n; e1z = uy / n;
        }
        const e2x = uy * e1z - uz * e1y, e2y = uz * e1x - ux * e1z, e2z = ux * e1y - uy * e1x;
        const a = gauss(c) * th0, b = gauss(c) * th0;
        const vx = ux + a * e1x + b * e2x, vy = uy + a * e1y + b * e2y, vz = uz + a * e1z + b * e2z;
        const nn = Math.sqrt((vx) * (vx) + (vy) * (vy) + (vz) * (vz));
        // the photons an electron radiates go along its incoming direction
        pendUx = pendE === 0 ? ux : pendUx; pendUy = pendE === 0 ? uy : pendUy; pendUz = pendE === 0 ? uz : pendUz;
        ux = vx / nn; uy = vy / nn; uz = vz / nn;
      }
      let dE = meanEnergyLoss(c.Si, t * c.siX0, p, m, aq);
      if (isE) {
        const G = gammaVariate(rng, t / Math.LN2);
        const eb = E * (1 - Math.exp(-G));
        dE += eb;
        pendE += eb;
        pendX = ox; pendY = oy; pendZ = oz;
        if (pendE > BREM_EMIT) {
          emitBrem(c, w, pendE, pendX, pendY, pendZ, pendUx, pendUy, pendUz);
          pendE = 0;
        }
      }
      if (dE >= E - m) return; // stopped in the tracker
      E -= dE;
      p = Math.sqrt(E * E - m * m);
      x = ox; y = oy; z = oz;
      px = p * ux; py = p * uy; pz = p * uz;
      hx.reset(E, px, py, pz, q, x, y, z, B);
    }
  }

  // ── decay (or end of the recorded flight) before the calorimeter?
  if (dLeft < Infinity) {
    const ex = hx.exitVolume(cfg.ecal.rIn, cfg.ecal.halfLength);
    const sLim = ex ? ex.s : hx.turnLength();
    if (w.forced || dLeft < sLim) {
      if (pendE > 0) emitBrem(c, w, pendE, pendX, pendY, pendZ, pendUx, pendUy, pendUz);
      if (!w.endsOnly) decayAt(c, w, hx.pointAt(dLeft), hx.momentumAt(dLeft));
      return;
    }
  }
  if (pendE > 0) emitBrem(c, w, pendE, pendX, pendY, pendZ, pendUx, pendUy, pendUz);

  // ── the calorimeters
  const ex = hx.exitVolume(cfg.ecal.rIn, cfg.ecal.halfLength);
  if (!ex) return;
  hx.evalAt(ex.s);
  if (isE) depositEM(c, E, hx.ox, hx.oy, hx.oz, w.truth, true, w.light && E < LIGHT_POINT);
  else if (info.cat === 'muon') muonPath(c, w, hx, ex.s, [hx.ox, hx.oy, hx.oz], E, p);
  else {
    const eh = hadronEnergy(info, E);
    depositHadron(c, eh, hx.ox, hx.oy, hx.oz, w.truth, true, w.light && eh < LIGHT_POINT);
  }
}

function hadronEnergy(info: Info, E: number): number {
  return E - info.m + (info.baryon < 0 ? 2 * info.m : 0);
}

function emitBrem(c: Ctx, w: Work, e: number, x: number, y: number, z: number, ux: number, uy: number, uz: number): void {
  const n = Math.sqrt((ux) * (ux) + (uy) * (uy) + (uz) * (uz)) || 1;
  spawn(c, w, 22, { E: e, px: (e * ux) / n, py: (e * uy) / n, pz: (e * uz) / n }, [x, y, z], 'bremsstrahlung');
}

/** Put a secondary on the work stack (and in the secondaries list, if requested). */
function spawn(c: Ctx, parent: Work, pdg: number, p4: P4, at: readonly [number, number, number], origin: SimSecondary['origin']): void {
  const info = infoOf(pdg);
  if (info.cat === 'invisible') return;
  if (c.secondaries) c.secondaries.push({ pdg, parent: parent.truth, origin, vertex: [at[0], at[1], at[2]], p: p4, charge: info.q });
  const pm = Math.sqrt((p4.px) * (p4.px) + (p4.py) * (p4.py) + (p4.pz) * (p4.pz));
  c.stack.push({
    info,
    px: p4.px,
    py: p4.py,
    pz: p4.pz,
    x: at[0],
    y: at[1],
    z: at[2],
    truth: parent.truth,
    depth: parent.depth + 1,
    decayPath: info.cTau < Infinity && pm > 0 ? exponential(c.rng, (pm / info.m) * info.cTau) : Infinity,
    forced: false,
    endsOnly: false,
    light: parent.light,
  });
}

/** Decay the particle of `w` at `at` with momentum `mom`: pick a channel by branching fraction, share the energy, follow the daughters. */
function decayAt(c: Ctx, w: Work, at: readonly [number, number, number], mom: P4): void {
  const info = w.info;
  const rng = c.rng;
  const u = rng() * (info.cumBr[info.cumBr.length - 1] ?? 1);
  let k = 0;
  while (k < info.cumBr.length - 1 && info.cumBr[k]! < u) k++;
  const ids = info.channels[k]!;
  const pm = Math.sqrt((mom.px) * (mom.px) + (mom.py) * (mom.py) + (mom.pz) * (mom.pz));
  const parent: P4 = { E: Math.sqrt(pm * pm + info.m * info.m), px: mom.px, py: mom.py, pz: mom.pz };
  const out = decayKinematics(rng, parent, info.m, ids);
  for (let i = 0; i < ids.length; i++) spawn(c, w, ids[i]!, out[i]!, at, 'decay');
}

// ── Photons and neutral hadrons ───────────────────────────────────────────────────────────────

function trackPhoton(c: Ctx, w: Work): void {
  const cfg = c.cfg;
  const E = Math.sqrt((w.px) * (w.px) + (w.py) * (w.py) + (w.pz) * (w.pz));
  const pt = Math.sqrt((w.px) * (w.px) + (w.py) * (w.py));
  const hx = helix({ E, px: w.px, py: w.py, pz: w.pz }, 0, [w.x, w.y, w.z], 0);
  // conversion in the tracker material: survival exp(−(7/9) x/X0)
  if (!w.light && E > 0.0011 && pt > 1e-9 && Math.abs(Math.asinh(w.pz / pt)) < cfg.etaMax) {
    const tau = exponential(c.rng, 1) * (9 / 7);
    let acc = 0;
    const ux = w.px / E, uy = w.py / E;
    for (const L of c.lays) {
      if (L.r <= Math.sqrt((w.x) * (w.x) + (w.y) * (w.y)) + 1e-6) continue;
      const s = hx.intersectCylinder(L.r, L.hl);
      if (s === null) {
        if (hx.crossRadius(L.r) === null) break;
        continue;
      }
      const pos = hx.pointAt(s);
      const cosA = Math.max(0.05, Math.abs(ux * pos[0] + uy * pos[1]) / L.r);
      acc += L.x0 / cosA;
      if (acc >= tau) {
        convert(c, w, E, pos);
        return;
      }
    }
  }
  const ex = hx.exitVolume(cfg.ecal.rIn, cfg.ecal.halfLength);
  if (!ex) return;
  const pos = hx.pointAt(ex.s);
  depositEM(c, E, pos[0], pos[1], pos[2], w.truth, false, w.light && E < LIGHT_POINT);
}

const ME = 0.51099895e-3;
function convert(c: Ctx, w: Work, E: number, at: readonly [number, number, number]): void {
  const rng = c.rng;
  const xmin = (1.0001 * ME) / E;
  if (xmin >= 0.5) return; // below threshold: absorbed
  const f = xmin + (1 - 2 * xmin) * rng();
  const E1 = f * E, E2 = E - E1;
  const ux = w.px / E, uy = w.py / E, uz = w.pz / E;
  const p1 = Math.sqrt(E1 * E1 - ME * ME), p2 = Math.sqrt(E2 * E2 - ME * ME);
  spawn(c, w, 11, { E: E1, px: p1 * ux, py: p1 * uy, pz: p1 * uz }, at, 'conversion');
  spawn(c, w, -11, { E: E2, px: p2 * ux, py: p2 * uy, pz: p2 * uz }, at, 'conversion');
}

function trackNeutralHadron(c: Ctx, w: Work): void {
  const cfg = c.cfg;
  const info = w.info;
  const p = Math.sqrt((w.px) * (w.px) + (w.py) * (w.py) + (w.pz) * (w.pz));
  const E = Math.sqrt(p * p + info.m * info.m);
  const hx = helix({ E, px: w.px, py: w.py, pz: w.pz }, 0, [w.x, w.y, w.z], 0);
  const ex = hx.exitVolume(cfg.ecal.rIn, cfg.ecal.halfLength);
  const sLim = ex ? ex.s : Infinity;
  if (w.decayPath < Infinity && (w.forced || w.decayPath < sLim)) {
    if (!w.endsOnly) decayAt(c, w, hx.pointAt(w.decayPath), { E, px: w.px, py: w.py, pz: w.pz });
    return;
  }
  if (!ex) return;
  const pos = hx.pointAt(ex.s);
  {
    const eh = hadronEnergy(info, E);
    depositHadron(c, eh, pos[0], pos[1], pos[2], w.truth, false, w.light && eh < LIGHT_POINT);
  }
}

// ── Calorimeter deposits ──────────────────────────────────────────────────────────────────────

const INV_SQRT2 = Math.SQRT1_2;
const Phi = (z: number) => 0.5 * (1 + erf(z * INV_SQRT2));

interface Lateral {
  coreWeight: number;
  coreSigma: number;
  haloSigma: number;
}

// Lateral profile tables. A 1-D profile (a narrow and a wide Gaussian) integrated over the cells around the shower
// axis depends on the widths in cell units and on where in its cell the axis falls. Both are quantised (widths in 12 %
// steps, position in 1/32 of a cell) and tabulated on first use, so that a deposit costs two table look-ups
// instead of dozens of error functions.
const LAT_BINS = 32;
interface LatTab {
  W: number;
  n: number;
  rows: Float64Array[];
  /** The largest entry of each row. */
  max: Float64Array;
}
const latCache = new WeakMap<Lateral, Map<number, LatTab>>();
function latTable(lat: Lateral, sCoreCells: number): { tab: LatTab } {
  let m = latCache.get(lat);
  if (!m) latCache.set(lat, (m = new Map()));
  const q = Math.round(Math.log(Math.max(sCoreCells, 1e-3)) * 8);
  let tab = m.get(q);
  if (!tab) {
    const sC = Math.exp(q / 8);
    const sH = (sC * lat.haloSigma) / lat.coreSigma;
    const W = Math.min(MAX_W, Math.max(1, Math.ceil(2.5 * sH)));
    const n = 2 * W + 1;
    const rows: Float64Array[] = [];
    const max = new Float64Array(LAT_BINS);
    for (let o = 0; o < LAT_BINS; o++) {
      const x0 = (o + 0.5) / LAT_BINS;
      const row = new Float64Array(n);
      let prev = lat.coreWeight * Phi((-W - x0) / sC) + (1 - lat.coreWeight) * Phi((-W - x0) / sH);
      for (let k = 0; k < n; k++) {
        const edge = -W + k + 1;
        const cur = lat.coreWeight * Phi((edge - x0) / sC) + (1 - lat.coreWeight) * Phi((edge - x0) / sH);
        row[k] = cur - prev;
        prev = cur;
        if (row[k]! > max[o]!) max[o] = row[k]!;
      }
      rows.push(row);
    }
    tab = { W, n, rows, max };
    m.set(q, tab);
  }
  return { tab };
}

/**
 * Spread layer energies `c.le[0..nl)` over the cells around (eta, phi) with a separable two-Gaussian lateral profile
 * whose widths are `scaleMm × (coreSigma, haloSigma)`, converted to angle at radius `rho`.
 */
function spread(c: Ctx, g: CalGeo, eta: number, phi: number, rho: number, scaleMm: number, lat: Lateral, nl: number, a2: number, truth: number, point = false): void {
  if (point) {
    // a soft pile-up deposit: all in the central cell of each layer
    const ie = Math.floor(eta / g.cellEta);
    if (Math.abs((ie + 0.5) * g.cellEta) >= g.etaMax) return;
    let ip = Math.floor((phi + Math.PI) / g.dPhi) % g.nPhi;
    if (ip < 0) ip += g.nPhi;
    for (let k = 0; k < nl; k++) {
      const ek = c.le[k]!;
      if (ek >= g.eCut) c.cells.add(g.cal, k, ie, ip, g.nPhi, ek, a2 * ek, truth);
    }
    return;
  }
  const sC = (lat.coreSigma * scaleMm) / (rho > 150 ? rho : 150);
  const ux = eta / g.cellEta;
  const ix = Math.floor(ux);
  const tx = latTable(lat, sC / g.cellEta).tab;
  const bx = Math.min(LAT_BINS - 1, Math.floor((ux - ix) * LAT_BINS));
  const fx = tx.rows[bx]!;
  const uy = (phi + Math.PI) / g.dPhi;
  const iy = Math.floor(uy);
  const ty = latTable(lat, sC / g.dPhi).tab;
  const by = Math.min(LAT_BINS - 1, Math.floor((uy - iy) * LAT_BINS));
  const fy = ty.rows[by]!;
  const fyMax = ty.max[by]!;
  const i0 = ix - tx.W;
  const j0 = iy - ty.W;
  const cells = c.cells;
  for (let k = 0; k < nl; k++) {
    const ek = c.le[k]!;
    if (!(ek * tx.max[bx]! * fyMax >= g.eCut)) continue;
    for (let i = 0; i < tx.n; i++) {
      const ei = ek * fx[i]!;
      if (ei * fyMax < g.eCut) continue;
      const ieta = i0 + i;
      if (Math.abs((ieta + 0.5) * g.cellEta) >= g.etaMax) continue;
      for (let j = 0; j < ty.n; j++) {
        const e = ei * fy[j]!;
        if (e < g.eCut) continue;
        let jp = (j0 + j) % g.nPhi;
        if (jp < 0) jp += g.nPhi;
        cells.add(g.cal, k, ieta, jp, g.nPhi, e, a2 * e, truth);
      }
    }
  }
}

// Longitudinal tables: the gamma-distribution CDFs, tabulated against ln E.
interface EmTab {
  lo: number;
  dl: number;
  nb: number;
  n: number;
  cum: Float64Array;
}
const emCache = new Map<string, EmTab>();
function emTable(Ec: number, D: number, n: number, kind: 'electron' | 'photon'): EmTab {
  const key = `${Ec}|${D}|${n}|${kind}`;
  let t = emCache.get(key);
  if (!t) {
    const lo = Math.log(0.002), hi = Math.log(5000), nb = 120;
    const dl = (hi - lo) / (nb - 1);
    const cum = new Float64Array(nb * n);
    for (let i = 0; i < nb; i++) {
      const { a, b } = showerShape(Math.exp(lo + i * dl), Ec, kind);
      for (let k = 0; k < n; k++) cum[i * n + k] = gammaP(a, (b * D * (k + 1)) / n);
    }
    t = { lo, dl, nb, n, cum };
    emCache.set(key, t);
  }
  return t;
}
/** Cumulative longitudinal fractions at the layer boundaries for energy E, interpolated from the table into `out`. */
function emCumulative(t: EmTab, E: number, out: Float64Array): void {
  let u = (Math.log(E) - t.lo) / t.dl;
  if (u < 0) u = 0;
  if (u > t.nb - 1.001) u = t.nb - 1.001;
  const i = Math.floor(u);
  const f = u - i;
  const n = t.n;
  for (let k = 0; k < n; k++) out[k] = t.cum[i * n + k]! * (1 - f) + t.cum[(i + 1) * n + k]! * f;
}

const HAD_X_MAX = 24;
const HAD_DX = 0.05;
const HAD_NX = Math.round(HAD_X_MAX / HAD_DX) + 1;
const HAD_NB = 40;
const HAD_LO = Math.log(0.05);
const HAD_DL = (Math.log(5000) - HAD_LO) / (HAD_NB - 1);
let hadTab: Float64Array | null = null;
/** P(a(E), x) for the hadronic longitudinal profile (x in λ units of the profile scale), by table look-up. */
function hadCdf(E: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= HAD_X_MAX) return 1;
  if (!hadTab) {
    hadTab = new Float64Array(HAD_NB * HAD_NX);
    for (let i = 0; i < HAD_NB; i++) {
      const { a, s } = hadronShape(Math.exp(HAD_LO + i * HAD_DL));
      for (let j = 0; j < HAD_NX; j++) hadTab[i * HAD_NX + j] = gammaP(a, (j * HAD_DX) / s);
    }
  }
  let u = (Math.log(E) - HAD_LO) / HAD_DL;
  if (u < 0) u = 0;
  if (u > HAD_NB - 1.001) u = HAD_NB - 1.001;
  const i = Math.floor(u);
  const f = u - i;
  const xj = x / HAD_DX;
  const j = Math.floor(xj);
  const g = xj - j;
  const r0 = i * HAD_NX + j, r1 = r0 + HAD_NX;
  const t = hadTab;
  return (t[r0]! * (1 - g) + t[r0 + 1]! * g) * (1 - f) + (t[r1]! * (1 - g) + t[r1 + 1]! * g) * f;
}

function depositEM(c: Ctx, E: number, x: number, y: number, z: number, truth: number, electron: boolean, point: boolean): void {
  if (E <= 1e-4) return;
  const rho = Math.sqrt(x * x + y * y);
  const eta = Math.asinh(z / (rho > 1e-9 ? rho : 1e-9));
  const eg = c.ecal;
  const hg = c.hcal;
  if (Math.abs(eta) >= eg.etaMax) return;
  const phi = Math.atan2(y, x);
  const n = eg.layers;
  const cf = eg.constant > 0 ? 1 + eg.constant * gauss(c) : 1;
  const cum = c.cum;
  emCumulative(electron ? c.emE : c.emG, E, cum);
  let prev = 0;
  for (let k = 0; k < n; k++) {
    c.le[k] = E * (cum[k]! - prev) * cf;
    prev = cum[k]!;
  }
  spread(c, eg, eta, phi, rho, c.rMolEm, LATERAL_EM, n, eg.stochastic * eg.stochastic, truth, point);
  // leakage behind the ECAL goes into the first layer of the HCAL
  const leak = E * (1 - prev) * cf;
  if (leak > hg.eCut && Math.abs(eta) < hg.etaMax) {
    c.le.fill(0);
    c.le[0] = leak;
    spread(c, hg, eta, phi, Math.max(rho, hg.rIn * 0.5), c.lamHcal, LATERAL_HAD, 1, hg.stochastic * hg.stochastic, truth, point);
  }
}

function depositHadron(c: Ctx, Ekin: number, x: number, y: number, z: number, truth: number, charged: boolean, point: boolean): void {
  if (Ekin <= 1e-3) return;
  const rho = Math.sqrt(x * x + y * y);
  const eta = Math.asinh(z / (rho > 1e-9 ? rho : 1e-9));
  const phi = Math.atan2(y, x);
  const eg = c.ecal, hg = c.hcal;
  const inE = Math.abs(eta) < eg.etaMax;
  const inH = Math.abs(eta) < hg.etaMax;
  if (!inE && !inH) return;
  const rng = c.rng;
  const Le = c.ecalDepthLam;
  const Lh = c.hcalDepthLam;
  const l0 = exponential(rng, 1);
  const cf = hg.constant > 0 ? 1 + hg.constant * gauss(c) : 1;
  const s = hadronShape(Ekin).s;
  const a2 = hg.stochastic * hg.stochastic;
  // ECAL part: shower energy beyond the interaction point l0, plus a MIP-like deposit of a charged particle before it
  if (inE) {
    const n = eg.layers;
    const mip = charged ? (c.mipEcal * Math.min(1, l0 / Le)) / n : 0;
    let any = false;
    let pLo = 0;
    for (let k = 0; k < n; k++) {
      const hi = (Le * (k + 1)) / n;
      const pHi = hi > l0 ? hadCdf(Ekin, (hi - l0) / s) : 0;
      c.le[k] = Ekin * (pHi - pLo) * cf + mip;
      pLo = pHi;
      if (c.le[k]! > 0) any = true;
    }
    if (any) spread(c, eg, eta, phi, rho, c.lamEcal, LATERAL_HAD, n, a2, truth, point);
  }
  if (inH) {
    const n = hg.layers;
    let any = false;
    let pLo = Le > l0 ? hadCdf(Ekin, (Le - l0) / s) : 0;
    for (let k = 0; k < n; k++) {
      const hi = Le + (Lh * (k + 1)) / n;
      const pHi = hi > l0 ? hadCdf(Ekin, (hi - l0) / s) : 0;
      c.le[k] = Ekin * (pHi - pLo) * cf;
      pLo = pHi;
      if (c.le[k]! > 0) any = true;
    }
    if (any) spread(c, hg, eta, phi, Math.max(rho, hg.rIn * 0.5), c.lamHcal, LATERAL_HAD, n, a2, truth, point);
  }
}

/** A single cell's worth of minimum-ionising deposit in both calorimeters (muons). */
function depositMip(c: Ctx, x: number, y: number, z: number, truth: number): void {
  const rho = Math.sqrt((x) * (x) + (y) * (y));
  const eta = Math.asinh(z / Math.max(rho, 1e-9));
  const phi = Math.atan2(y, x);
  // a muon crossing at a shallow angle has a longer path
  const f = Math.min(3, Math.cosh(eta));
  for (const [g, total] of [[c.ecal, c.mipEcal * f], [c.hcal, c.mipHcal * f]] as const) {
    if (Math.abs(eta) >= g.etaMax) continue;
    const ieta = Math.floor(eta / g.cellEta);
    let iphi = Math.floor((phi + Math.PI) / g.dPhi) % g.nPhi;
    if (iphi < 0) iphi += g.nPhi;
    for (let k = 0; k < g.layers; k++) c.cells.add(g.cal, k, ieta, iphi, g.nPhi, total / g.layers, 0, truth);
  }
}

// ── Muons ─────────────────────────────────────────────────────────────────────────────────────

function muonPath(c: Ctx, w: Work, hx: Helix, sEntry: number, pos: [number, number, number], E: number, p: number): void {
  const cfg = c.cfg;
  const info = w.info;
  const m = info.m;
  depositMip(c, pos[0], pos[1], pos[2], w.truth);
  if (cfg.muon.stations.length === 0) return;
  if (p < cfg.muon.minPToReach) return;
  // mean energy loss through the calorimeters (the path is longer for a slanted track)
  const dir = hx.directionAt(sEntry);
  const sinT = Math.max(0.1, Math.sqrt((dir[0]) * (dir[0]) + (dir[1]) * (dir[1])));
  const f = 1 / sinT;
  let Ea = muonEnergyAfter(c.ecalMat, c.ecalThickG * f, E);
  if (Ea > 0) Ea = muonEnergyAfter(c.hcalMat, c.hcalThickG * f, Ea);
  if (Ea <= m + 0.05) return;
  const pa = Math.sqrt(Ea * Ea - m * m);
  const hx2 = helix({ E: Ea, px: pa * dir[0], py: pa * dir[1], pz: pa * dir[2] }, info.q, pos, cfg.bField);
  const ex = hx2.exitVolume(c.coilR, c.muonHalf);
  if (!ex || ex.endcap) return;
  const pc = hx2.pointAt(ex.s);
  const dc = hx2.directionAt(ex.s);
  // one multiple-scattering kick for the absorber (all the calorimeter steel counts)
  const xOverX0 = f * (c.cfg.ecal.depthX0 + c.hcalThickG / c.hcalMat.X0);
  const pm = 0.5 * (p + pa);
  const th0 = c.msAngle(pm, pm / Math.sqrt(pm * pm + m * m), xOverX0, 1);
  const rho = Math.sqrt((dc[0]) * (dc[0]) + (dc[1]) * (dc[1]));
  let ux = dc[0], uy = dc[1], uz = dc[2];
  if (rho > 0.05) {
    const e1x = -uy / rho, e1y = ux / rho;
    const e2x = -uz * ux / rho, e2y = -uz * uy / rho, e2z = rho;
    const a = gauss(c) * th0, b = gauss(c) * th0;
    ux += a * e1x + b * e2x; uy += a * e1y + b * e2y; uz += b * e2z;
    const nn = Math.sqrt((ux) * (ux) + (uy) * (uy) + (uz) * (uz));
    ux /= nn; uy /= nn; uz /= nn;
  }
  const hx3 = helix({ E: Ea, px: pa * ux, py: pa * uy, pz: pa * uz }, info.q, pc, cfg.muon.returnField ?? 0);
  const st = cfg.muon.stations;
  for (let i = 0; i < st.length; i++) {
    const S = st[i]!;
    const s = hx3.intersectCylinder(S.r, S.halfLength);
    if (s === null) {
      if (hx3.crossRadius(S.r) === null) break;
      continue;
    }
    const pp = hx3.pointAt(s);
    const r = Math.sqrt((pp[0]) * (pp[0]) + (pp[1]) * (pp[1]));
    const dT = gauss(c) * S.sigmaRPhi;
    c.muonHits.push({ station: i, x: pp[0] - (dT * pp[1]) / r, y: pp[1] + (dT * pp[0]) / r, z: pp[2] + gauss(c) * S.sigmaZ, truth: w.truth });
  }
}

// ── Noise and output ──────────────────────────────────────────────────────────────────────────

function addNoiseHits(c: Ctx): void {
  const mean = c.cfg.noiseHitsPerLayer;
  if (!(mean > 0)) return;
  const rng = c.rng;
  for (const L of c.lays) {
    const n = poisson(rng, mean);
    for (let i = 0; i < n; i++) {
      const phi = (rng() * 2 - 1) * Math.PI;
      c.hits.push({ layer: L.idx, x: L.r * Math.cos(phi), y: L.r * Math.sin(phi), z: (rng() * 2 - 1) * L.hl, truth: -1, edep: 5 + exponential(rng, 15) });
    }
  }
}

function finaliseCells(c: Ctx): CaloCell[] {
  const acc = c.cells;
  const out: CaloCell[] = [];
  const rng = c.rng;
  for (let i = 0; i < acc.size; i++) {
    const mi = acc.mi[i]!;
    const g = mi >= 16 ? c.hcal : c.ecal;
    let e = acc.e[i]!;
    const sig2 = acc.v[i]! + g.noise * g.noise;
    const thr = g.noise > 0 ? 2 * g.noise : 1e-9;
    if (sig2 > 0) {
      const sig = Math.sqrt(sig2);
      if (e + 4 * sig < thr) continue; // cannot reach the threshold (p < 4e-5): skip the random number
      e += sig * gauss(c);
    }
    if (!(e > thr)) continue;
    const key = acc.key[i]!;
    const ieta = Math.floor(key / g.nPhi);
    out.push({
      calo: g.cal === 0 ? 'ecal' : 'hcal',
      eta: (ieta - 4096 + 0.5) * g.cellEta,
      phi: -Math.PI + (key - ieta * g.nPhi + 0.5) * g.dPhi,
      energy: e,
      layer: mi & 15,
      truth: acc.truthOf(i),
    });
  }
  return out;
}
