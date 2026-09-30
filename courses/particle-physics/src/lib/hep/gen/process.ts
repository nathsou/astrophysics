/**
 * The `Process` interface, the truth-record helpers every process uses, and `makeMCProcess`, the machinery that turns a
 * phase-space mapping plus a matrix element into a process with adaptive integration and unweighted events.
 *
 * Conventions of the hard-process record (what the shower, hadronisation and decay stages receive):
 *  - particles 0 and 1 are the beams (status 'beam'): e⁻ (+z) and e⁺ (−z), or p (+z) and p or p̄ (−z);
 *  - for hadron collisions the next two are the incoming partons (status 'hard', mothers = the beam), carrying x₁√s/2 and x₂√s/2;
 *    for e⁺e⁻ the beams are the incoming particles;
 *  - resonances and other internal lines are 'intermediate' (Z, W, H, t, γ*) with the daughters linked;
 *  - the outgoing particles of the hard process are 'final' with `mothers` set: coloured partons carry `colour = [colour, anticolour]`
 *    in the Les Houches convention (tags from 101); the shower replaces them by their showered descendants;
 *  - momentum is conserved between the incoming partons (or beams) and the outgoing 'final' particles, and charge too;
 *    the beam remnants of a hadron collision are not in the record.
 */
import type { P4 } from '../kinematics/index.ts';
import { boost, fromMass, twoBodyDecay, twoBodyMomentum } from '../kinematics/index.ts';
import type { Rng } from '../random/index.ts';
import { rng as makeRng } from '../random/index.ts';
import type { TruthEvent, TruthStatus } from '../event/index.ts';
import { Unweighter, Vegas } from './integrate.ts';

export type Beams = 'ee' | 'pp' | 'ppbar';

export interface ProcessConfig {
  /** Centre-of-mass energy, GeV. */
  sqrtS: number;
  /** Return weighted events (weight in pb) instead of unweighted ones (weight 1). */
  weighted?: boolean;
  /** Event number written to the truth record. */
  eventNumber?: number;
  /** e⁺e⁻ processes: radiate collinear photons from the initial state (leading-log, exponentiated). */
  isr?: boolean;
}

export interface Process {
  /** Machine-readable name, e.g. 'ee->mumu', 'pp->Z->mumu'. */
  readonly name: string;
  /** Typeset label, e.g. "e⁺e⁻ → μ⁺μ⁻". */
  readonly title: string;
  readonly beams: Beams;
  /** The leading-order cross-section in pb at √s, including the K-factor of the process (1 unless requested). */
  sigma(sqrtS: number): number;
  /** An analytic or deterministic (quadrature) value in pb, independent of the Monte Carlo, where one exists. */
  sigmaAnalytic?(sqrtS: number): number | undefined;
  /** One weighted Monte Carlo point of the cross-section integral, in pb: the mean of many is σ. Used by `crossSection`. */
  weightedPoint(rng: Rng, cfg: ProcessConfig): number;
  /** One event of the hard process (resonance decays at matrix-element level, no shower): unit weight unless `cfg.weighted`. */
  generate(rng: Rng, cfg: ProcessConfig): { event: TruthEvent; weight: number };
}

// ── Truth record helpers ──────────────────────────────────────────────────────────────────────────────────────
export function newEvent(process: string, sqrtS: number, number = 0): TruthEvent {
  return { number, weight: 1, process, sqrtS, particles: [], primaryVertices: [[0, 0, 0]] };
}

export interface AddOptions {
  colour?: [number, number];
}
/** Append a particle to the record and link it to its mothers; returns its index. */
export function addParticle(ev: TruthEvent, pdg: number, p: P4, status: TruthStatus, mothers: number[] = [], opt?: AddOptions): number {
  const id = ev.particles.length;
  const part = { id, pdg, p, vertex: [0, 0, 0] as [number, number, number], status, mothers: mothers.slice(), daughters: [] as number[], collision: 0 } as TruthEvent['particles'][number];
  if (opt?.colour) part.colour = opt.colour;
  ev.particles.push(part);
  for (const m of mothers) ev.particles[m]!.daughters.push(id);
  return id;
}

/** Add the two beam particles and return their indices. */
export function addBeams(ev: TruthEvent, beams: Beams, sqrtS: number): [number, number] {
  const E = sqrtS / 2;
  const [a, b] = beams === 'ee' ? [11, -11] : beams === 'pp' ? [2212, 2212] : [2212, -2212];
  const i = addParticle(ev, a, { E, px: 0, py: 0, pz: E }, 'beam');
  const j = addParticle(ev, b, { E, px: 0, py: 0, pz: -E }, 'beam');
  return [i, j];
}

/**
 * The polar angle convention: a direction from (cosθ, φ) about a polar axis (ax, ay, az), a unit vector. The azimuth origin is
 * arbitrary but fixed by the axis.
 */
export function directionAbout(axis: readonly [number, number, number], cosT: number, phi: number): [number, number, number] {
  const [ax, ay, az] = axis;
  // an orthonormal pair perpendicular to the axis
  let ex: number, ey: number, ez: number;
  if (Math.abs(az) < 0.9) {
    const n = Math.hypot(ax, ay);
    ex = -ay / n;
    ey = ax / n;
    ez = 0;
  } else {
    const n = Math.hypot(ay, az);
    ex = 0;
    ey = -az / n;
    ez = ay / n;
  }
  const fx = ay * ez - az * ey, fy = az * ex - ax * ez, fz = ax * ey - ay * ex;
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const c = sinT * Math.cos(phi), s = sinT * Math.sin(phi);
  return [cosT * ax + c * ex + s * fx, cosT * ay + c * ey + s * fy, cosT * az + c * ez + s * fz];
}

/**
 * Two-body decay of `parent` to masses m1, m2 with the first daughter at polar angle θ (cosT) and azimuth φ about `axis`, both
 * defined in the rest frame of the parent (reached from the frame in which `parent` is given by a pure boost, so the axes
 * are parallel). Returns the daughters in the frame of `parent`.
 */
export function decayAbout(parent: P4, m1: number, m2: number, axis: readonly [number, number, number], cosT: number, phi: number): [P4, P4] {
  const M = Math.sqrt(Math.max(0, (parent.E - Math.hypot(parent.px, parent.py, parent.pz)) * (parent.E + Math.hypot(parent.px, parent.py, parent.pz))));
  const k = twoBodyMomentum(M, m1, m2);
  const [nx, ny, nz] = directionAbout(axis, cosT, phi);
  const d1 = fromMass(m1, k * nx, k * ny, k * nz);
  const d2 = fromMass(m2, -k * nx, -k * ny, -k * nz);
  const bx = parent.px / parent.E, by = parent.py / parent.E, bz = parent.pz / parent.E;
  return [boost(d1, bx, by, bz), boost(d2, bx, by, bz)];
}

/** Isotropic two-body decay: `kinematics.twoBodyDecay`. */
export function decayIsotropic(r: Rng, parent: P4, m1: number, m2: number): [P4, P4] {
  return twoBodyDecay(r, parent, m1, m2);
}

/** Boost a four-vector along z by rapidity y. */
export function boostZ(p: P4, y: number): P4 {
  const c = Math.cosh(y), s = Math.sinh(y);
  return { E: c * p.E + s * p.pz, px: p.px, py: p.py, pz: s * p.E + c * p.pz };
}

/** Incoming minus outgoing ('final') four-momentum and charge of a hard-process record (all zero when conserved); the charge is summed in thirds, so exact. */
export function conservation(ev: TruthEvent, chargeOf: (pdg: number) => number): { dE: number; dpx: number; dpy: number; dpz: number; dCharge: number; scale: number } {
  let E = 0, px = 0, py = 0, pz = 0, q = 0;
  const hasHard = ev.particles.some((p) => p.status === 'hard');
  for (const p of ev.particles) {
    const incoming = hasHard ? p.status === 'hard' : p.status === 'beam';
    if (incoming) {
      E += p.p.E; px += p.p.px; py += p.p.py; pz += p.p.pz; q += Math.round(3 * chargeOf(p.pdg));
    } else if (p.status === 'final') {
      E -= p.p.E; px -= p.p.px; py -= p.p.py; pz -= p.p.pz; q -= Math.round(3 * chargeOf(p.pdg));
    }
  }
  return { dE: E, dpx: px, dpy: py, dpz: pz, dCharge: q / 3, scale: ev.sqrtS };
}

/**
 * Check the Les Houches colour flow of a hard-process record: every colour tag must appear exactly twice among the incoming partons
 * (status 'hard') and the outgoing ones (status 'final'), in one of the four allowed pairings: (incoming colour, outgoing colour),
 * (incoming anticolour, outgoing anticolour), (incoming colour, incoming anticolour) or (outgoing colour, outgoing anticolour).
 */
export function colourFlowValid(ev: TruthEvent): boolean {
  const cnt = new Map<number, [number, number, number, number]>();
  const bump = (tag: number, slot: number) => {
    if (!tag) return;
    let c = cnt.get(tag);
    if (!c) cnt.set(tag, (c = [0, 0, 0, 0]));
    c[slot] = c[slot]! + 1;
  };
  for (const p of ev.particles) {
    if (!p.colour) continue;
    if (p.status === 'hard') {
      bump(p.colour[0], 0);
      bump(p.colour[1], 1);
    } else if (p.status === 'final') {
      bump(p.colour[0], 2);
      bump(p.colour[1], 3);
    }
  }
  for (const [a, b, c, d] of cnt.values()) {
    if (a + b + c + d !== 2) return false;
    if (!((a === 1 && c === 1) || (b === 1 && d === 1) || (a === 1 && b === 1) || (c === 1 && d === 1))) return false;
  }
  return true;
}

// ── Monte Carlo process ───────────────────────────────────────────────────────────────────────────────────────
export interface PointSpec<C> {
  /** Dimension of the unit hypercube the integrand lives on. */
  dim: number;
  /** A fresh scratch context, reused from point to point. */
  makeCtx(): C;
  /**
   * The integrand at the unit-hypercube point `u`, in pb, including the jacobians of the mappings from u to physical
   * variables (but not the VEGAS jacobian). Fills `ctx` with whatever `build` needs. Zero outside the phase space.
   */
  point(u: Float64Array, sqrtS: number, ctx: C): number;
  /** Build the truth record for the point in `ctx` (random numbers for discrete choices and angles not in the integrand come from rng). */
  build(ctx: C, r: Rng, sqrtS: number): TruthEvent;
}

export interface MCProcessDef<C> {
  name: string;
  title: string;
  beams: Beams;
  spec: (sqrtS: number) => PointSpec<C>;
  /** Deterministic value in pb, if there is one (quadrature or closed form). Without the K-factor. */
  analytic?: (sqrtS: number) => number | undefined;
  /** Multiplies every cross-section and weight. */
  kFactor?: number;
  /** Training budget. */
  iterations?: number;
  points?: number;
  nb?: number;
}

interface Trained<C> {
  spec: PointSpec<C>;
  vegas: Vegas;
  wMax: number;
  sigma: number;
  sigmaErr: number;
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Build a `Process` from a point specification. Training is lazy, deterministic (fixed seed) and cached per √s. */
export function makeMCProcess<C>(def: MCProcessDef<C>): Process {
  const K = def.kFactor ?? 1;
  const cache = new Map<number, Trained<C>>();
  const states = new WeakMap<Rng, Map<number, Unweighter>>();

  const train = (sqrtS: number): Trained<C> => {
    let t = cache.get(sqrtS);
    if (t) return t;
    const spec = def.spec(sqrtS);
    const vegas = new Vegas(spec.dim, def.nb ?? 40);
    const ctx = spec.makeCtx();
    const f = (u: Float64Array) => spec.point(u, sqrtS, ctx);
    const r = makeRng(hashString(def.name) ^ Math.floor(sqrtS * 1000));
    vegas.integrate(f, r, { iterations: def.iterations ?? 6, points: def.points ?? 3000 });
    // final frozen pass: cross-section and the maximum weight for unweighting
    const res = vegas.integrate(f, r, { iterations: 3, points: 6000, adapt: false });
    t = { spec, vegas, wMax: res.maxWeight * 1.15, sigma: res.value, sigmaErr: res.error };
    cache.set(sqrtS, t);
    return t;
  };

  const stateFor = (r: Rng, sqrtS: number, t: Trained<C>): Unweighter => {
    let m = states.get(r);
    if (!m) states.set(r, (m = new Map()));
    let u = m.get(sqrtS);
    if (!u) m.set(sqrtS, (u = new Unweighter(t.wMax)));
    return u;
  };

  const ctxPool = new Map<number, C>();
  const uPool = new Map<number, Float64Array>();

  return {
    name: def.name,
    title: def.title,
    beams: def.beams,
    sigma(sqrtS) {
      const a = def.analytic?.(sqrtS);
      if (a !== undefined) return a * K;
      return train(sqrtS).sigma * K;
    },
    sigmaAnalytic: def.analytic ? (sqrtS) => { const a = def.analytic!(sqrtS); return a === undefined ? undefined : a * K; } : undefined,
    weightedPoint(r, cfg) {
      const t = train(cfg.sqrtS);
      let ctx = ctxPool.get(cfg.sqrtS);
      if (!ctx) ctxPool.set(cfg.sqrtS, (ctx = t.spec.makeCtx()));
      let u = uPool.get(t.spec.dim);
      if (!u) uPool.set(t.spec.dim, (u = new Float64Array(t.spec.dim)));
      const jac = t.vegas.sample(r, u);
      return t.spec.point(u, cfg.sqrtS, ctx) * jac * K;
    },
    generate(r, cfg) {
      const t = train(cfg.sqrtS);
      const st = stateFor(r, cfg.sqrtS, t);
      const ctx = t.spec.makeCtx();
      const u = new Float64Array(t.spec.dim);
      for (let n = 0; n < 1e6; n++) {
        const jac = t.vegas.sample(r, u);
        const w = t.spec.point(u, cfg.sqrtS, ctx) * jac;
        if (cfg.weighted) {
          if (w <= 0) continue;
          const event = t.spec.build(ctx, r, cfg.sqrtS);
          event.number = cfg.eventNumber ?? 0;
          event.weight = w * K;
          return { event, weight: w * K };
        }
        if (st.accept(w, r)) {
          const event = t.spec.build(ctx, r, cfg.sqrtS);
          event.number = cfg.eventNumber ?? 0;
          return { event, weight: 1 };
        }
      }
      throw new Error(`${def.name}: no event accepted in 1e6 trials (is the cross-section zero at √s = ${cfg.sqrtS}?)`);
    },
  };
}

// ── Registry ──────────────────────────────────────────────────────────────────────────────────────────────────
const registry = new Map<string, () => Process>();
const instances = new Map<string, Process>();

/** Register a process under a name (and any aliases); the factory is called on first use. */
export function registerProcess(names: string | string[], factory: () => Process): void {
  for (const n of Array.isArray(names) ? names : [names]) {
    registry.set(n, factory);
    instances.delete(n);
  }
}
/** Look a process up by name; throws with the list of names if it does not exist. */
export function getProcess(name: string): Process {
  let p = instances.get(name);
  if (p) return p;
  const f = registry.get(name);
  if (!f) throw new Error(`unknown process "${name}"; available: ${listProcesses().join(', ')}`);
  p = f();
  instances.set(name, p);
  return p;
}
/** The names of the registered processes. */
export function listProcesses(): string[] {
  return [...registry.keys()].sort();
}
