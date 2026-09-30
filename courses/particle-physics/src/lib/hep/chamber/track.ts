/**
 * Tracks of charged particles in a cloud or bubble chamber, as polylines with local ionisation density.
 *
 * Coordinates: millimetres; x to the right, y up, z towards the viewer (the picture plane is x–y). The magnetic field
 * is along z: `bField` > 0 points out of the page, towards the viewer. A positive charge then circles clockwise.
 * Momenta and energies are in GeV, angles in radians.
 *
 * What is modelled (see README.md): mean ionisation loss (Bethe–Bloch) with Bohr straggling, range, multiple scattering
 * (Highland, with a single-scattering tail that makes visible kinks), delta rays, bremsstrahlung and pair production
 * (photons and electrons in lead or hydrogen), decays in flight and at rest from the particle table, and V⁰ decays of
 * neutral parents that leave no track. Every random number comes from the `rng` passed in.
 */
import { exponential, normal, poisson, type Rng } from '../random/index.ts';
import { boost, boostVector, fromMass, pmag, twoBodyDecay, phaseSpace, type P4 } from '../kinematics/index.ts';
import { hasParticle, particle } from '../particles/index.ts';
import {
  CURVATURE_CONST,
  ME_MEV,
  K_MEV_CM2_MOL,
  ionisationLoss,
  maxEnergyTransfer,
  pairConversionRate,
  radiationLengthMm,
  radiativeLoss,
  resolveMaterial,
  resolveMedium,
  type Material,
  type MaterialName,
  type MediumName,
  type Species,
} from './material.ts';

export type Vec3 = [number, number, number];

/** PDG Monte Carlo number of the helium-4 nucleus (alpha particle). */
export const ALPHA_PDG = 1000020040;

export interface ParticleInfo {
  pdg: number;
  name: string;
  symbol: string;
  /** GeV */
  mass: number;
  /** In units of e. */
  charge: number;
  /** Mean proper lifetime (s), Infinity if stable. */
  lifetime: number;
}

/** Table entry for a PDG ID, plus the alpha particle (which the course's particle table does not carry). */
export function info(pdg: number): ParticleInfo {
  if (Math.abs(pdg) === ALPHA_PDG) {
    return { pdg, name: pdg > 0 ? 'alpha' : 'anti-alpha', symbol: pdg > 0 ? 'α' : 'ᾱ', mass: 3.7273794, charge: pdg > 0 ? 2 : -2, lifetime: Infinity };
  }
  const p = particle(pdg);
  return { pdg, name: p.name, symbol: p.symbol, mass: p.mass, charge: p.charge3 / 3, lifetime: p.lifetime };
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  /** Momentum at this point (GeV/c). */
  p: number;
  /** Local ionisation loss near the track (MeV/mm): restricted to delta-ray energies below the material's cut. */
  dedx: number;
  /** Path length from the start of the track (mm). */
  s: number;
  /** Would this point show in the chamber (inside the sensitive volume, not inside an opaque plate)? */
  visible: boolean;
  /** 0 = the chamber medium; i + 1 = the i-th plate. */
  layer: number;
}

export type TrackOrigin = 'primary' | 'delta ray' | 'decay' | 'bremsstrahlung' | 'pair production' | 'annihilation';
export type TrackEnd = 'range' | 'decay' | 'exit' | 'conversion' | 'interaction' | 'stopped';

export interface Kink {
  /** Index of the point where the direction changes. */
  index: number;
  kind: 'scatter' | 'decay' | 'bremsstrahlung' | 'delta ray';
  /** Angle between the directions before and after (rad); for a decay, to the first charged daughter. */
  angle: number;
  s: number;
}

export interface Track {
  id: number;
  parent: number | null;
  pdg: number;
  name: string;
  symbol: string;
  /** Charge in units of e. */
  charge: number;
  /** Mass in GeV. */
  mass: number;
  origin: TrackOrigin;
  points: TrackPoint[];
  /** Neutral particles leave no ionisation: physically there is no track, only this line for teaching. */
  neutral: boolean;
  /** Momentum at production (GeV/c) and kinetic energy (GeV). */
  p0: number;
  T0: number;
  end: TrackEnd;
  /** For a decay or conversion: the products, e.g. "π⁻ + p". */
  endDetail: string;
  kinks: Kink[];
  children: number[];
  /** Total path length (mm). */
  length: number;
  /** Free-text label set by the caller (e.g. "A"). */
  label?: string;
}

export interface Plate {
  /** The plate fills y0 ≤ y < y1 (mm), across the whole chamber. */
  y0: number;
  y1: number;
  material?: MaterialName | Material;
}

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export interface Injection {
  pdg: number;
  /** Four-momentum in the lab (GeV). Alternatively give `p` (GeV/c) or `T` (GeV kinetic) and `direction`. */
  p4?: P4;
  p?: number;
  T?: number;
  direction?: Vec3;
  /** Start point (mm). */
  position: Vec3;
  label?: string;
  /** End the track by an interaction (no products are made) after this path length (mm): a beam particle striking a proton. */
  endAt?: number;
}

export interface EventOptions {
  particles: Injection[];
  /** Magnetic field along +z in tesla (positive = out of the page). */
  bField: number;
  medium: MediumName | Material;
  rng: Rng;
  /** Absorber plates (y slabs). */
  plates?: Plate[];
  bounds?: Partial<Bounds>;
  /** Only z within [zMin, zMax] shows (a cloud chamber's sensitive layer). Default: everything. */
  sensitiveZ?: [number, number];
  /** Produce delta rays, bremsstrahlung, conversions, decays. Default true. */
  secondaries?: boolean;
  /** Decays in flight (default true). `lifetimeScale` multiplies every lifetime: 0.01 makes decays 100 times more likely (for teaching). */
  decays?: boolean;
  lifetimeScale?: number;
  /** Force a decay (by particle PDG) after this path length in mm. Arrays are used one per occurrence, in order. */
  forceDecayAt?: Record<number, number | number[]>;
  /** Force photon conversion after this path length (mm), one entry per photon in order of appearance. */
  forceConversionAt?: number[];
  /** Choose the decay channel of a species (PDG → product PDG list) instead of sampling the branching fractions. */
  channel?: Record<number, number[]>;
  /** Scale the delta-ray rate (default 1; 0 disables). */
  deltaRays?: number;
  /** Bohr straggling and stochastic bremsstrahlung (default true). With false, losses are the mean. */
  fluctuations?: boolean;
  /** Multiple scattering (default true). */
  multipleScattering?: boolean;
  /** Single-scattering tail of multiple scattering (visible kinks). Default true. */
  scatterTail?: boolean;
  /** Longest step (mm). */
  maxStep?: number;
  /** Stop creating secondaries beyond this many tracks. */
  maxTracks?: number;
  /** Include neutrinos as (invisible) tracks. Default false. */
  neutrinos?: boolean;
  /** Longest path of any one track (mm); a low-energy electron can spiral for metres in a strong field. Default 4000. */
  maxPath?: number;
}

export interface TrackSet {
  tracks: Track[];
  /** The first injected particle's track. */
  primary: Track;
  bField: number;
  medium: Material;
  plates: { y0: number; y1: number; material: Material }[];
  bounds: Bounds;
}

export type SimulateOptions = Omit<EventOptions, 'particles'> & Injection;

/** Simulate one particle and everything it makes. */
export function simulateTrack(o: SimulateOptions): TrackSet {
  const { pdg, p4, p, T, direction, position, label, endAt, ...rest } = o;
  return simulateEvent({ ...rest, particles: [{ pdg, p4, p, T, direction, position, label, endAt }] });
}

// ───────────────────────── vector helpers ─────────────────────────
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Two unit vectors perpendicular to u (and to each other): e1 lies in the picture plane when it can. */
function frame(u: Vec3): [Vec3, Vec3] {
  const t = Math.hypot(u[0], u[1]);
  const e1: Vec3 = t > 1e-9 ? [-u[1] / t, u[0] / t, 0] : [1, 0, 0];
  return [e1, cross3(u, e1)];
}
/** Rotate u by a polar angle θ about itself at azimuth φ (in the frame of u). */
function deflect(u: Vec3, theta: number, phi: number): Vec3 {
  const [e1, e2] = frame(u);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const a = s * Math.cos(phi);
  const b = s * Math.sin(phi);
  return norm3([c * u[0] + a * e1[0] + b * e2[0], c * u[1] + a * e1[1] + b * e2[1], c * u[2] + a * e1[2] + b * e2[2]]);
}
const angleBetween = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));

// ───────────────────────── the event engine ─────────────────────────
interface Job {
  track: Track;
  pos: Vec3;
  p4: P4;
  endAt?: number;
}

interface Ctx {
  o: EventOptions;
  rng: Rng;
  medium: Material;
  plates: { y0: number; y1: number; material: Material }[];
  bounds: Bounds;
  tracks: Track[];
  queue: Job[];
  maxTracks: number;
  decayQueue: Map<number, number[]>;
  convQueue: number[];
  secondaries: boolean;
  fluct: boolean;
  ms: boolean;
  tail: boolean;
  deltaScale: number;
  maxStep: number;
  lifetimeScale: number;
  decaysOn: boolean;
  maxPath: number;
}

const C_MM_PER_S = 299792458 * 1000;
const T_STOP_MEV = 0.001;

/** Simulate several injected particles in one event; ids run across all of them. */
export function simulateEvent(o: EventOptions): TrackSet {
  const medium = resolveMedium(o.medium);
  const plates = (o.plates ?? []).map((p) => ({ y0: Math.min(p.y0, p.y1), y1: Math.max(p.y0, p.y1), material: resolveMaterial(p.material ?? 'lead') }));
  const big = 1e5;
  const bounds: Bounds = { xMin: -big, xMax: big, yMin: -big, yMax: big, zMin: -big, zMax: big, ...(o.bounds ?? {}) };
  const decayQueue = new Map<number, number[]>();
  for (const [k, v] of Object.entries(o.forceDecayAt ?? {})) decayQueue.set(Number(k), Array.isArray(v) ? [...v] : [v]);
  const ctx: Ctx = {
    o,
    rng: o.rng,
    medium,
    plates,
    bounds,
    tracks: [],
    queue: [],
    maxTracks: o.maxTracks ?? 500,
    decayQueue,
    convQueue: [...(o.forceConversionAt ?? [])],
    secondaries: o.secondaries ?? true,
    fluct: o.fluctuations ?? true,
    ms: o.multipleScattering ?? true,
    tail: o.scatterTail ?? true,
    deltaScale: o.deltaRays ?? 1,
    maxStep: o.maxStep ?? 2,
    lifetimeScale: o.lifetimeScale ?? 1,
    decaysOn: o.decays ?? true,
    maxPath: o.maxPath ?? 4000,
  };
  for (const inj of o.particles) {
    const i = info(inj.pdg);
    const m = i.mass;
    let p4: P4;
    if (inj.p4) p4 = inj.p4;
    else {
      const dir = norm3(inj.direction ?? [0, 1, 0]);
      let p = inj.p;
      if (p === undefined) {
        const T = inj.T ?? 0;
        p = Math.sqrt(T * (T + 2 * m));
      }
      p4 = fromMass(m, p * dir[0], p * dir[1], p * dir[2]);
    }
    spawn(ctx, { pdg: inj.pdg, pos: inj.position, p4, parent: null, origin: 'primary', label: inj.label, endAt: inj.endAt });
  }
  for (let guard = 0; ctx.queue.length && guard < 5000; guard++) {
    const job = ctx.queue.shift()!;
    if (job.track.charge === 0) runNeutral(ctx, job);
    else runCharged(ctx, job);
  }
  return { tracks: ctx.tracks, primary: ctx.tracks[0]!, bField: o.bField, medium, plates, bounds };
}

function spawn(ctx: Ctx, s: { pdg: number; pos: Vec3; p4: P4; parent: Track | null; origin: TrackOrigin; label?: string; endAt?: number }): Track | null {
  const i = info(s.pdg);
  const p = pmag(s.p4);
  const t: Track = {
    id: ctx.tracks.length,
    parent: s.parent ? s.parent.id : null,
    pdg: s.pdg,
    name: i.name,
    symbol: i.symbol,
    charge: i.charge,
    mass: i.mass,
    origin: s.origin,
    points: [],
    neutral: i.charge === 0,
    p0: p,
    T0: s.p4.E - i.mass,
    end: 'exit',
    endDetail: '',
    kinks: [],
    children: [],
    length: 0,
    label: s.label,
  };
  ctx.tracks.push(t);
  if (s.parent) s.parent.children.push(t.id);
  ctx.queue.push({ track: t, pos: [...s.pos] as Vec3, p4: s.p4, endAt: s.endAt });
  return t;
}

function layerAt(ctx: Ctx, y: number): { layer: number; mat: Material } {
  for (let i = 0; i < ctx.plates.length; i++) {
    const p = ctx.plates[i]!;
    if (y >= p.y0 && y < p.y1) return { layer: i + 1, mat: p.material };
  }
  return { layer: 0, mat: ctx.medium };
}

/** Distance along u (mm) to the next plate surface, or Infinity. */
function distToPlateEdge(ctx: Ctx, y: number, uy: number): number {
  if (Math.abs(uy) < 1e-12 || !ctx.plates.length) return Infinity;
  let best = Infinity;
  for (const p of ctx.plates) {
    for (const e of [p.y0, p.y1]) {
      const d = (e - y) / uy;
      if (d > 1e-9 && d < best) best = d;
    }
  }
  return best;
}

function isVisible(ctx: Ctx, mat: Material, z: number): boolean {
  if (mat.opaque) return false;
  const sz = ctx.o.sensitiveZ;
  return !sz || (z >= sz[0] && z <= sz[1]);
}

/** Clip the step pos → np at the chamber bounds; returns the fraction of the step travelled and whether it left. */
function clipToBounds(ctx: Ctx, pos: Vec3, np: Vec3): { t: number; out: boolean } {
  const b = ctx.bounds;
  const lo = [b.xMin, b.yMin, b.zMin];
  const hi = [b.xMax, b.yMax, b.zMax];
  let t = 1;
  let out = false;
  for (let a = 0; a < 3; a++) {
    const d = np[a]! - pos[a]!;
    if (np[a]! > hi[a]!) {
      t = Math.min(t, Math.max(0, (hi[a]! - pos[a]!) / d));
      out = true;
    } else if (np[a]! < lo[a]!) {
      t = Math.min(t, Math.max(0, (lo[a]! - pos[a]!) / d));
      out = true;
    }
  }
  return { t, out };
}

// ───────────────────────── charged particles ─────────────────────────
function runCharged(ctx: Ctx, job: Job): void {
  const t = job.track;
  const rng = ctx.rng;
  const mMeV = t.mass * 1000;
  const sp: Species = { mass: mMeV, charge: t.charge };
  const q = t.charge;
  const B = ctx.o.bField;
  const isE = Math.abs(mMeV - ME_MEV) < 1e-3;
  let pos: Vec3 = [...job.pos] as Vec3;
  let u = norm3([job.p4.px, job.p4.py, job.p4.pz]);
  let E = job.p4.E * 1000; // MeV
  let s = 0;
  let xCum = 0; // path in the current material, g/cm²
  let curLayer = -1;
  const info0 = info(t.pdg);
  const forced = takeForced(ctx, t.pdg);
  const unstable = canDecay(ctx, t.pdg, info0.lifetime, forced);
  const cTau = unstable ? C_MM_PER_S * info0.lifetime * ctx.lifetimeScale : Infinity;
  let budget = unstable && forced === undefined ? exponential(rng, 1) : Infinity;

  const push = (mat: Material, layer: number, dedx: number) => {
    const p = Math.sqrt(Math.max(0, E * E - mMeV * mMeV)) / 1000;
    t.points.push({ x: pos[0], y: pos[1], z: pos[2], p, dedx, s, visible: isVisible(ctx, mat, pos[2]), layer });
  };

  {
    const { layer, mat } = layerAt(ctx, pos[1] + u[1] * 1e-7);
    curLayer = layer;
    const p0 = Math.sqrt(E * E - mMeV * mMeV);
    push(mat, layer, localDedx(sp, p0, mat));
  }

  for (let step = 0; step < 40000; step++) {
    const { layer, mat } = layerAt(ctx, pos[1] + u[1] * 1e-7);
    if (layer !== curLayer) {
      curLayer = layer;
      xCum = 0;
    }
    if (s > ctx.maxPath) {
      t.end = 'stopped';
      t.length = s;
      return;
    }
    const T = E - mMeV;
    // Inside an opaque plate nothing is seen, so steps may be coarser and the track may end earlier.
    const coarse = mat.opaque;
    if (T <= (coarse ? 0.05 : T_STOP_MEV)) {
      endOfRange(ctx, t, job, pos, u, E, s);
      return;
    }
    const pMeV = Math.sqrt(T * (T + 2 * mMeV));
    const beta = pMeV / E;
    const rho = mat.density;
    // MeV/mm that drives the track: restricted to energy transfers below the delta-ray cut when delta rays are
    // produced as separate tracks, the full mean loss otherwise.
    const ionR = ctx.secondaries && ctx.deltaScale > 0 ? localDedx(sp, pMeV, mat) : (ionisationLoss(sp, pMeV, mat) * mat.density) / 10;
    const radTot = (radiativeLoss(sp, pMeV, mat) * rho) / 10; // MeV/mm
    // Discrete bremsstrahlung above kmin; below it the loss is continuous.
    const kmin = isE && ctx.secondaries ? Math.max(0.3, 0.02 * E) : Infinity;
    const x0 = radiationLengthMm(mat);
    let radCont = radTot;
    let nPhotonPerMm = 0;
    if (isE && ctx.secondaries && E > 2 * kmin) {
      const y = kmin / E;
      nPhotonPerMm = ((4 / 3) * Math.log(1 / y) - (4 / 3) * (1 - y) + 0.5 * (1 - y * y)) / x0;
      radCont = ((4 / 3) * kmin - (2 / 3) * (kmin * kmin) / E + (kmin ** 3) / (3 * E * E)) / x0;
    } else if (isE && ctx.secondaries) {
      nPhotonPerMm = 0;
    }
    const dedxMean = ionR + radCont;

    // Step length
    let ds = Math.min(ctx.maxStep, ((coarse ? 0.12 : 0.04) * T) / Math.max(dedxMean, 1e-12));
    if (B !== 0 && q !== 0) ds = Math.min(ds, (0.2 * (pMeV / 1000)) / (CURVATURE_CONST * 1e-3 * Math.abs(q) * Math.abs(B)));
    if (ctx.ms) {
      const dxMax = (Math.pow(((coarse ? 0.5 : 0.15) * beta * pMeV) / (13.6 * Math.abs(q)), 2) * mat.X0) / rho; // cm
      ds = Math.min(ds, Math.max(dxMax * 10, 1e-3));
    }
    if (nPhotonPerMm > 0) ds = Math.min(ds, 0.3 / nPhotonPerMm);
    ds = Math.max(ds, 1e-4);
    const edge = distToPlateEdge(ctx, pos[1], u[1]);
    if (edge < ds) ds = edge + 1e-6;
    let willDecay = false;
    let willEnd = false;
    if (job.endAt !== undefined && s + ds >= job.endAt) {
      ds = Math.max(job.endAt - s, 0);
      willEnd = true;
    }
    if (unstable && !willEnd) {
      const lambda = (pMeV / mMeV) * cTau;
      if (forced !== undefined) {
        if (s + ds >= forced) {
          ds = Math.max(forced - s, 0);
          willDecay = true;
        }
      } else if (ds >= budget * lambda) {
        ds = budget * lambda;
        willDecay = true;
      } else budget -= ds / lambda;
    }

    // Energy loss
    let dE = dedxMean * ds;
    if (ctx.fluct && ds > 0) {
      const xg = (ds / 10) * rho; // g/cm²
      const b2 = beta * beta;
      const sigma = Math.sqrt(0.1569 * mat.zOverA * xg * q * q * ((1 - b2 / 2) / (1 - b2)));
      dE += sigma * normal(rng, 0, 1) * Math.min(1, dE / Math.max(sigma, 1e-12) / 2);
    }
    dE = Math.max(0, dE);

    // Multiple scattering, at the midpoint direction
    let uNew = u;
    if (ctx.ms && ds > 0) {
      const xStep = (ds / 10) * rho; // g/cm²
      xCum += xStep;
      const f = Math.min(1.5, Math.max(0.4, 1 + 0.038 * Math.log(Math.max((xCum / mat.X0) * q * q / (beta * beta), 1e-12))));
      const sigma = ((13.6 / (beta * pMeV)) * Math.abs(q) * Math.sqrt(xStep / mat.X0)) * f;
      const [e1, e2] = frame(u);
      const a = normal(rng, 0, sigma);
      const b = normal(rng, 0, sigma);
      uNew = norm3([u[0] + a * e1[0] + b * e2[0], u[1] + a * e1[1] + b * e2[1], u[2] + a * e1[2] + b * e2[2]]);
      if (ctx.tail && ctx.secondaries) {
        const thetaC = Math.max(0.08, 5 * sigma);
        const nTail = poisson(rng, (0.2 * sigma * sigma) / (thetaC * thetaC));
        for (let k = 0; k < nTail; k++) {
          const th = Math.min(1.6, thetaC / Math.sqrt(1 - rng()));
          uNew = deflect(uNew, th, 2 * Math.PI * rng());
        }
      }
    }

    // Move along the helix: rotate the direction in the picture plane by dφ
    const pGeV = pMeV / 1000;
    const dphi = B !== 0 ? (-q * CURVATURE_CONST * 1e-3 * B * ds) / pGeV : 0;
    const cm = Math.cos(dphi / 2);
    const sm = Math.sin(dphi / 2);
    const sinc = Math.abs(dphi) < 1e-6 ? 1 : sm / (dphi / 2);
    const ux = uNew[0] * cm - uNew[1] * sm;
    const uy = uNew[0] * sm + uNew[1] * cm;
    const np: Vec3 = [pos[0] + ds * ux * sinc, pos[1] + ds * uy * sinc, pos[2] + ds * uNew[2]];
    const cf = Math.cos(dphi);
    const sf = Math.sin(dphi);
    const uEnd = norm3([uNew[0] * cf - uNew[1] * sf, uNew[0] * sf + uNew[1] * cf, uNew[2]]);

    const { t: tf, out } = clipToBounds(ctx, pos, np);
    let dsAct = ds;
    if (out) {
      dsAct = ds * tf;
      for (let a = 0; a < 3; a++) np[a] = pos[a]! + (np[a]! - pos[a]!) * tf;
    }
    s += dsAct;
    pos = np;
    const scatterAngle = angleBetween(u, uEnd) - Math.abs(dphi);
    u = uEnd;
    E = Math.max(mMeV, E - dE * (out ? tf : 1));
    const after = layerAt(ctx, pos[1] + u[1] * 1e-7);
    const pNow = Math.sqrt(Math.max(0, (E - mMeV) * (E - mMeV + 2 * mMeV)));
    push(after.mat, out ? layer : after.layer, localDedx(sp, pNow, after.mat));
    if (scatterAngle > 0.05) t.kinks.push({ index: t.points.length - 1, kind: 'scatter', angle: scatterAngle, s });
    if (out) {
      t.end = 'exit';
      t.length = s;
      return;
    }

    // Discrete processes at the end of the step
    if (ctx.secondaries && ds > 0 && t.points.length > 1) {
      const pN = Math.sqrt(Math.max(1e-12, (E - mMeV) * (E + mMeV)));
      // Delta rays
      const cutD = mat.deltaCut;
      const tmax = maxEnergyTransfer(sp, pN);
      if (ctx.deltaScale > 0 && tmax > cutD * 1.05 && t.origin !== 'delta ray') {
        const b2 = (pN / E) ** 2;
        const ratePerMm = (0.5 * K_MEV_CM2_MOL * mat.zOverA * q * q * rho) / b2 / 10 * (1 / cutD - 1 / tmax) * ctx.deltaScale;
        const n = poisson(rng, ratePerMm * dsAct);
        for (let k = 0; k < n && ctx.tracks.length < ctx.maxTracks; k++) {
          const tdelta = 1 / (1 / cutD - rng() * (1 / cutD - 1 / tmax));
          if (tdelta >= E - mMeV) continue;
          const pd = Math.sqrt(tdelta * (tdelta + 2 * ME_MEV));
          const cosT = Math.min(1, (tdelta / pd) * ((E + ME_MEV) / pN));
          const dir = deflect(u, Math.acos(cosT), 2 * Math.PI * rng());
          E -= tdelta;
          t.points[t.points.length - 1]!.p = Math.sqrt(Math.max(0, (E - mMeV) * (E + mMeV))) / 1000;
          spawn(ctx, { pdg: 11, pos, p4: fromMass(ME_MEV / 1000, (pd / 1000) * dir[0], (pd / 1000) * dir[1], (pd / 1000) * dir[2]), parent: t, origin: 'delta ray' });
        }
      }
      // Bremsstrahlung photons
      if (isE && nPhotonPerMm > 0 && ctx.fluct) {
        const n = poisson(rng, nPhotonPerMm * dsAct);
        for (let k = 0; k < n; k++) {
          // k distributed as 1/k (times 1 − y + 0.75 y²) between kmin and E
          let kk = 0;
          for (let tries = 0; tries < 50; tries++) {
            kk = kmin * Math.pow(E / kmin, rng());
            const y = kk / E;
            if (rng() < 1 - y + 0.75 * y * y) break;
          }
          if (kk >= E - mMeV) continue;
          const theta = (ME_MEV / E) * Math.sqrt(-2 * Math.log(1 - rng()));
          const dir = deflect(u, theta, 2 * Math.PI * rng());
          E -= kk;
          t.points[t.points.length - 1]!.p = Math.sqrt(Math.max(0, (E - mMeV) * (E + mMeV))) / 1000;
          if (ctx.tracks.length < ctx.maxTracks) spawn(ctx, { pdg: 22, pos, p4: { E: kk / 1000, px: (kk / 1000) * dir[0], py: (kk / 1000) * dir[1], pz: (kk / 1000) * dir[2] }, parent: t, origin: 'bremsstrahlung' });
          t.kinks.push({ index: t.points.length - 1, kind: 'bremsstrahlung', angle: theta, s });
        }
      }
    }

    if (willEnd) {
      t.end = 'interaction';
      t.endDetail = 'interacts with a proton';
      t.length = s;
      return;
    }
    if (willDecay) {
      decayCharged(ctx, t, job, pos, u, E, s);
      return;
    }
  }
  t.end = 'stopped';
  t.length = s;
}

/** Ionisation loss restricted to energy transfers below the material's delta-ray cut (what stays near the track), MeV/mm. */
function localDedx(sp: Species, pMeV: number, mat: Material): number {
  return (ionisationLoss(sp, pMeV, mat, mat.deltaCut) * mat.density) / 10;
}

/** May this particle decay in flight? Yes if decays are on, or a decay was forced, or it lives less than 0.05 mm·c (resonances, π⁰). */
function canDecay(ctx: Ctx, pdg: number, lifetime: number, forced: number | undefined): boolean {
  if (!ctx.secondaries || !Number.isFinite(lifetime) || !hasDecays(pdg)) return false;
  return ctx.decaysOn || forced !== undefined || lifetime * C_MM_PER_S < 0.05;
}

function takeForced(ctx: Ctx, pdg: number): number | undefined {
  const q = ctx.decayQueue.get(pdg);
  if (!q || !q.length) return undefined;
  return q.shift();
}

function hasDecays(pdg: number): boolean {
  if (Math.abs(pdg) === ALPHA_PDG) return false;
  return hasParticle(pdg) && particle(pdg).decays.length > 0;
}

/** What happens when a charged particle runs out of energy. */
function endOfRange(ctx: Ctx, t: Track, job: Job, pos: Vec3, u: Vec3, E: number, s: number): void {
  t.end = 'range';
  t.length = s;
  if (!ctx.secondaries) return;
  const pdg = t.pdg;
  // Positrons annihilate: two back-to-back 511 keV photons.
  if (pdg === -11) {
    const dir = norm3([ctx.rng() - 0.5, ctx.rng() - 0.5, ctx.rng() - 0.5]);
    const k = ME_MEV / 1000;
    for (const sign of [1, -1]) {
      if (ctx.tracks.length < ctx.maxTracks) spawn(ctx, { pdg: 22, pos, p4: { E: k, px: sign * k * dir[0], py: sign * k * dir[1], pz: sign * k * dir[2] }, parent: t, origin: 'annihilation' });
    }
    t.endDetail = 'annihilates with an electron: γ γ';
    return;
  }
  // Positive pions and kaons and both muons decay at rest (negative pions and kaons are captured by nuclei).
  if (ctx.decaysOn && (pdg === 13 || pdg === -13 || pdg === 211 || pdg === 321) && hasDecays(pdg)) {
    const rest = fromMass(t.mass, 0, 0, 0);
    // A tiny direction so that the decay products are isotropic.
    const prods = pickDecay(ctx, pdg, rest);
    emitProducts(ctx, t, pos, prods, u, 'decay', job);
    t.end = 'decay';
    t.endDetail = describeProducts(prods) + ' (at rest)';
  }
}

function decayCharged(ctx: Ctx, t: Track, job: Job, pos: Vec3, u: Vec3, E: number, s: number): void {
  t.length = s;
  t.end = 'decay';
  const pMeV = Math.sqrt(Math.max(0, E * E - (t.mass * 1000) ** 2));
  const parent: P4 = { E: E / 1000, px: (pMeV / 1000) * u[0], py: (pMeV / 1000) * u[1], pz: (pMeV / 1000) * u[2] };
  const prods = pickDecay(ctx, t.pdg, parent);
  t.endDetail = describeProducts(prods);
  emitProducts(ctx, t, pos, prods, u, 'decay', job);
}

// ───────────────────────── decays ─────────────────────────
interface Product {
  pdg: number;
  p4: P4;
}

function describeProducts(prods: { pdg: number }[]): string {
  return prods.map((p) => info(p.pdg).symbol).join(' + ');
}

function pickDecay(ctx: Ctx, pdg: number, parent: P4): Product[] {
  const rng = ctx.rng;
  const forcedCh = ctx.o.channel?.[pdg];
  let ids: number[];
  if (forcedCh) ids = forcedCh;
  else {
    const p = particle(pdg);
    const ok = p.decays.filter((d) => d.products.every((x) => hasParticle(x)));
    const total = ok.reduce((a, d) => a + d.br, 0);
    let r = rng() * total;
    let chosen = ok[ok.length - 1]!;
    for (const d of ok) {
      r -= d.br;
      if (r < 0) {
        chosen = d;
        break;
      }
    }
    ids = chosen.products;
  }
  // Michel spectrum for muon decay.
  if (Math.abs(pdg) === 13 && ids.some((x) => Math.abs(x) === 11)) return muonDecay(ctx, pdg, ids, parent);
  const masses = ids.map((id) => info(id).mass);
  if (ids.length === 1) return [{ pdg: ids[0]!, p4: parent }];
  if (ids.length === 2) {
    const [a, b] = twoBodyDecay(rng, parent, masses[0]!, masses[1]!);
    return [{ pdg: ids[0]!, p4: a }, { pdg: ids[1]!, p4: b }];
  }
  // n ≥ 3: unweighted phase space by accept–reject against the largest of a few trial weights.
  let wmax = 0;
  const probe = rng.fork('ps');
  for (let i = 0; i < 40; i++) wmax = Math.max(wmax, phaseSpace(probe, parent, masses).weight);
  wmax *= 1.3;
  let best = phaseSpace(rng, parent, masses);
  for (let tries = 0; tries < 500; tries++) {
    const r = phaseSpace(rng, parent, masses);
    best = r;
    if (rng() * wmax <= r.weight) break;
  }
  return ids.map((id, i) => ({ pdg: id, p4: best.p[i]! }));
}

function muonDecay(ctx: Ctx, pdg: number, ids: number[], parent: P4): Product[] {
  const rng = ctx.rng;
  const M = info(pdg).mass;
  const emax = M / 2;
  let x = 1;
  for (let i = 0; i < 100; i++) {
    x = rng();
    if (rng() * 1 <= x * x * (3 - 2 * x)) break;
  }
  const ee = Math.max(ME_MEV / 1000 + 1e-6, x * emax);
  const pe = Math.sqrt(ee * ee - (ME_MEV / 1000) ** 2);
  const c = 2 * rng() - 1;
  const sn = Math.sqrt(1 - c * c);
  const ph = 2 * Math.PI * rng();
  const el = { E: ee, px: pe * sn * Math.cos(ph), py: pe * sn * Math.sin(ph), pz: pe * c };
  const b = boostVector(parent);
  const out: Product[] = [];
  const eId = ids.find((x) => Math.abs(x) === 11)!;
  out.push({ pdg: eId, p4: boost(el, b[0], b[1], b[2]) });
  // The two neutrinos share the rest of the energy; they are invisible, so only their existence matters.
  for (const id of ids) {
    if (Math.abs(id) === 11) continue;
    const eN = (M - ee) / 2;
    const cc = 2 * rng() - 1;
    const ss = Math.sqrt(1 - cc * cc);
    const pp = 2 * Math.PI * rng();
    out.push({ pdg: id, p4: boost({ E: eN, px: eN * ss * Math.cos(pp), py: eN * ss * Math.sin(pp), pz: eN * cc }, b[0], b[1], b[2]) });
  }
  return out;
}

function emitProducts(ctx: Ctx, t: Track, pos: Vec3, prods: Product[], uParent: Vec3, origin: TrackOrigin, _job: Job): void {
  let firstCharged: Vec3 | null = null;
  for (const pr of prods) {
    const isNu = [12, 14, 16].includes(Math.abs(pr.pdg));
    if (isNu && !ctx.o.neutrinos) continue;
    if (ctx.tracks.length >= ctx.maxTracks) break;
    const ch = info(pr.pdg).charge;
    if (ch !== 0 && !firstCharged) firstCharged = norm3([pr.p4.px, pr.p4.py, pr.p4.pz]);
    spawn(ctx, { pdg: pr.pdg, pos, p4: pr.p4, parent: t, origin });
  }
  if (firstCharged && t.points.length) {
    t.kinks.push({ index: t.points.length - 1, kind: 'decay', angle: angleBetween(uParent, firstCharged), s: t.length });
  }
}

// ───────────────────────── neutral particles ─────────────────────────
function runNeutral(ctx: Ctx, job: Job): void {
  const t = job.track;
  const rng = ctx.rng;
  const isGamma = t.pdg === 22;
  const u = norm3([job.p4.px, job.p4.py, job.p4.pz]);
  const E = job.p4.E; // GeV
  const pGeV = Math.sqrt(Math.max(0, E * E - t.mass * t.mass));
  let pos: Vec3 = [...job.pos] as Vec3;
  let s = 0;
  const i0 = info(t.pdg);
  let forced: number | undefined = isGamma ? ctx.convQueue.shift() : takeForced(ctx, t.pdg);
  const unstable = !isGamma && canDecay(ctx, t.pdg, i0.lifetime, forced);
  const cTau = unstable ? C_MM_PER_S * i0.lifetime * ctx.lifetimeScale : Infinity;
  const lambda = unstable ? (pGeV / t.mass) * cTau : Infinity;
  let tau = exponential(rng, 1); // optical depth (photons) or decay lengths
  const push = (mat: Material, layer: number) => t.points.push({ x: pos[0], y: pos[1], z: pos[2], p: pGeV, dedx: 0, s, visible: isVisible(ctx, mat, pos[2]), layer });
  {
    const { layer, mat } = layerAt(ctx, pos[1] + u[1] * 1e-7);
    push(mat, layer);
  }
  for (let guard = 0; guard < 400; guard++) {
    const { layer, mat } = layerAt(ctx, pos[1] + u[1] * 1e-7);
    const edge = distToPlateEdge(ctx, pos[1], u[1]);
    // Distance to the chamber bounds
    let dB = Infinity;
    const b = ctx.bounds;
    const lo = [b.xMin, b.yMin, b.zMin];
    const hi = [b.xMax, b.yMax, b.zMax];
    for (let a = 0; a < 3; a++) {
      if (u[a]! > 1e-12) dB = Math.min(dB, (hi[a]! - pos[a]!) / u[a]!);
      else if (u[a]! < -1e-12) dB = Math.min(dB, (lo[a]! - pos[a]!) / u[a]!);
    }
    dB = Math.max(0, dB);
    const seg = Math.min(edge, dB);
    // Interaction rate in this layer
    let dInt = Infinity;
    if (forced !== undefined) dInt = Math.max(0, forced - s);
    else if (isGamma) {
      const rate = pairConversionRate(E * 1000, mat) * (ctx.secondaries ? 1 : 0);
      dInt = rate > 0 ? tau / rate : Infinity;
    } else if (unstable) dInt = tau * lambda;
    if (dInt <= seg) {
      s += dInt;
      pos = [pos[0] + u[0] * dInt, pos[1] + u[1] * dInt, pos[2] + u[2] * dInt];
      const l2 = layerAt(ctx, pos[1] + u[1] * 1e-7);
      push(l2.mat, l2.layer);
      t.length = s;
      if (isGamma) convert(ctx, t, pos, u, E);
      else {
        t.end = 'decay';
        const parent: P4 = { E, px: pGeV * u[0], py: pGeV * u[1], pz: pGeV * u[2] };
        const prods = pickDecay(ctx, t.pdg, parent);
        t.endDetail = describeProducts(prods);
        emitProducts(ctx, t, pos, prods, u, 'decay', job);
      }
      return;
    }
    // No interaction in this segment
    if (forced === undefined) {
      if (isGamma) tau -= pairConversionRate(E * 1000, mat) * seg;
      else if (unstable) tau -= seg / lambda;
    }
    s += seg;
    pos = [pos[0] + u[0] * seg, pos[1] + u[1] * seg, pos[2] + u[2] * seg];
    t.length = s;
    if (dB <= edge) {
      push(mat, layer);
      t.end = 'exit';
      return;
    }
    const l2 = layerAt(ctx, pos[1] + u[1] * 1e-6);
    push(l2.mat, l2.layer);
    pos = [pos[0] + u[0] * 1e-6, pos[1] + u[1] * 1e-6, pos[2] + u[2] * 1e-6];
    if (forced !== undefined) forced = Math.max(forced, s);
  }
  t.end = 'stopped';
}

/** Photon → e⁺e⁻ (Bethe–Heitler sharing, opening angle ~ m/E). */
function convert(ctx: Ctx, t: Track, pos: Vec3, u: Vec3, Egev: number): void {
  const rng = ctx.rng;
  t.end = 'conversion';
  const me = ME_MEV / 1000;
  if (Egev <= 2 * me) {
    t.endDetail = 'absorbed';
    return;
  }
  // Energy sharing: flat for k ≫ m, forbidden within m of either end.
  let x = 0.5;
  const lo = me / Egev;
  for (let i = 0; i < 100; i++) {
    x = lo + (1 - 2 * lo) * rng();
    if (rng() <= 1 - (4 / 3) * x * (1 - x)) break;
  }
  const eMinus = Math.max(me * 1.0001, x * Egev);
  const ePlus = Math.max(me * 1.0001, Egev - eMinus);
  // Transverse momentum balance: both leptons carry the same p⊥ ~ m (exponentially distributed).
  const pperp = me * Math.sqrt(-2 * Math.log(1 - rng())) * 0.8;
  const az = 2 * Math.PI * rng();
  const mk = (E: number, sign: number): P4 => {
    const p = Math.sqrt(Math.max(1e-12, E * E - me * me));
    const th = Math.asin(Math.min(0.9, pperp / p));
    const dir = deflect(u, th, az + (sign > 0 ? 0 : Math.PI));
    return { E, px: p * dir[0], py: p * dir[1], pz: p * dir[2] };
  };
  t.endDetail = 'e⁺e⁻ pair';
  if (ctx.tracks.length + 2 <= ctx.maxTracks + 2) {
    spawn(ctx, { pdg: 11, pos, p4: mk(eMinus, 1), parent: t, origin: 'pair production' });
    spawn(ctx, { pdg: -11, pos, p4: mk(ePlus, -1), parent: t, origin: 'pair production' });
  }
  const first = t.children[0];
  if (first !== undefined) t.kinks.push({ index: t.points.length - 1, kind: 'decay', angle: 0, s: t.length });
}

// ───────────────────────── helpers for users of the results ─────────────────────────
/** The track with this id. */
export function trackById(set: TrackSet, id: number): Track | undefined {
  return set.tracks[id];
}

/** Charged tracks, in id order: what a cloud or bubble chamber would show (if they lie in the sensitive volume). */
export function chargedTracks(set: TrackSet): Track[] {
  return set.tracks.filter((t) => !t.neutral);
}

/** The direction (unit vector) of a track at point i, from the neighbouring points. */
export function directionAt(t: Track, i: number): Vec3 {
  const a = t.points[Math.max(0, i - 1)]!;
  const b = t.points[Math.min(t.points.length - 1, i + 1)]!;
  return norm3([b.x - a.x, b.y - a.y, b.z - a.z]);
}

/** Path length of the visible part of a track (mm). */
export function visibleLength(t: Track): number {
  let L = 0;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    if (a.visible && b.visible) L += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return L;
}

/** Mean ionisation relative to a minimum-ionising particle over the visible part of the track. */
export function meanIonisation(t: Track, mipMevPerMm: number): number {
  let sum = 0;
  let len = 0;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    if (!(a.visible && b.visible)) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    sum += 0.5 * (a.dedx + b.dedx) * d;
    len += d;
  }
  return len > 0 ? sum / len / mipMevPerMm : 0;
}

export { radiationLengthMm };
