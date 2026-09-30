/**
 * e⁺e⁻ → f f̄ through γ and Z (leptons and quarks), the QED-only reference process of Chapter 16, and Bhabha scattering.
 *
 * The matrix element is the exact tree-level γ/Z result of `ewkernel.ts` (interference and forward–backward asymmetry included).
 * Options:
 *  - `qedOnly`: photon exchange only, with α(0) (86.8 nb/s for μ⁺μ⁻); the angular distribution then comes from the hook
 *    `gen.dsigmaEeMuMu`, so a reader's function drives the events;
 *  - `qcd`: multiply quark final states by 1 + αs(√s)/π (the first QCD correction to the total; the default is leading order);
 *  - `alpha`: 'fixed' (α(0), default) or 'running' (α(√s) in the photon exchange);
 *  - `kFactor`: a global factor.
 * Initial-state radiation is off unless `cfg.isr` is set; then one collinear photon per event is added with the leading-log
 * exponentiated radiator (Kuraev–Fadin / Bonneau–Martin form) and the ff̄ system recoils along the beam.
 */
import { hook } from '../hooks.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import type { Rng } from '../random/index.ts';
import { rng as makeRng } from '../random/index.ts';
import { particle } from '../particles/index.ts';
import { ALPHA_0, GAMMA_Z, M_Z, alphaEM, alphaS, fermion, zCouplings } from '../sm/index.ts';
import { Unweighter, powerMap } from './integrate.ts';
import {
  type Beams, type Process, type ProcessConfig, type PointSpec, addBeams, addParticle, boostZ, makeMCProcess, newEvent, registerProcess,
} from './process.ts';
import { type EwCoefficients, type Exchange, ewAfb, ewCoefficients, ewDiff, ewMax, ewTotal, zExchange } from './ewkernel.ts';
import { fromMass } from '../kinematics/index.ts';
import type { TruthEvent } from '../event/index.ts';

/**
 * Reference for the hook `gen.dsigmaEeMuMu`: the differential cross-section of e⁺e⁻ → μ⁺μ⁻ by photon exchange at tree level,
 * massless leptons, in GeV⁻²: dσ/dcosθ = πα²(1 + cos²θ)/(2s), with α = 1/137.036 and θ the angle between the e⁻ and the μ⁻.
 */
export function ee2mumuDiffXsec(s: number, cosTheta: number): number {
  return (Math.PI * ALPHA_0 * ALPHA_0 * (1 + cosTheta * cosTheta)) / (2 * s);
}

export interface EeOptions {
  /** The final state: a fermion name ('mu', 'tau', 'u', 'd', 's', 'c', 'b', 't') or 'hadrons' (all open quark flavours). */
  final: 'mu' | 'tau' | 'u' | 'd' | 's' | 'c' | 'b' | 't' | 'hadrons';
  qedOnly?: boolean;
  qcd?: boolean;
  alpha?: 'fixed' | 'running';
  kFactor?: number;
  /** Z width used in the propagator (default: the PDG value from the particle table). */
  zWidth?: number;
}
export interface EeProcess extends Process {
  /** Cross-section in pb with the ISR radiator folded in. */
  sigmaISR(sqrtS: number): number;
  /** Forward–backward asymmetry of the (single-flavour, or flavour-summed) final state at √s. */
  afb(sqrtS: number): number;
  /** The cross-section by final-state flavour at √s, in pb, without ISR. */
  sigmaByFlavour(sqrtS: number): Record<number, number>;
}

const PDG_OF: Record<string, number> = { mu: 13, tau: 15, d: 1, u: 2, s: 3, c: 4, b: 5, t: 6 };

/** Final-state mass used in the kinematics: lepton masses from the table, light quarks massless, c, b, t their table masses. */
function finalMass(pdg: number): number {
  if (pdg === 1 || pdg === 2 || pdg === 3) return 0;
  return particle(pdg).mass;
}

// ── ISR radiator ──────────────────────────────────────────────────────────────────────────────────────────────
const M_E = particle(11).mass;
/** β_e = (2α/π)(ln(s/m_e²) − 1). */
const radiatorBeta = (s: number): number => ((2 * ALPHA_0) / Math.PI) * (Math.log(s / (M_E * M_E)) - 1);
/** The radiator ρ(x) per unit photon energy fraction x = 2E_γ/√s, including soft + virtual corrections and the hard term. */
function radiator(x: number, beta: number): number {
  const delta = (ALPHA_0 / Math.PI) * (Math.PI * Math.PI / 3 - 0.5) + 0.75 * beta;
  return beta * Math.pow(x, beta - 1) * (1 + delta) - beta * (1 - x / 2);
}

/** Adaptive Simpson quadrature. */
function quad(f: (x: number) => number, a: number, b: number, tol: number, depth = 18): number {
  const simpson = (fa: number, fm: number, fb: number, h: number) => (h / 6) * (fa + 4 * fm + fb);
  const rec = (a0: number, b0: number, fa: number, fm: number, fb: number, whole: number, tol0: number, d: number): number => {
    const m = 0.5 * (a0 + b0);
    const lm = 0.5 * (a0 + m), rm = 0.5 * (m + b0);
    const flm = f(lm), frm = f(rm);
    const left = simpson(fa, flm, fm, m - a0), right = simpson(fm, frm, fb, b0 - m);
    if (d <= 0 || Math.abs(left + right - whole) <= 15 * tol0) return left + right + (left + right - whole) / 15;
    return rec(a0, m, fa, flm, fm, left, tol0 / 2, d - 1) + rec(m, b0, fm, frm, fb, right, tol0 / 2, d - 1);
  };
  const fa = f(a), fb = f(b), fm = f(0.5 * (a + b));
  return rec(a, b, fa, fm, fb, simpson(fa, fm, fb, b - a), tol, depth);
}

// ── The process ───────────────────────────────────────────────────────────────────────────────────────────────
export function eeToFermions(opt: EeOptions): EeProcess {
  const K = opt.kFactor ?? 1;
  const zWidth = opt.zWidth ?? GAMMA_Z;
  const hadrons = opt.final === 'hadrons';
  const flavours = hadrons ? [1, 2, 3, 4, 5, 6] : [PDG_OF[opt.final]!];
  const finalName = hadrons ? 'qq̄' : particle(flavours[0]!).symbol + particle(-flavours[0]!).symbol;
  const title = `e⁺e⁻ → ${opt.qedOnly ? '(γ*) → ' : ''}${hadrons ? 'hadrons' : finalName}`;
  const name = `ee->${opt.final === 'hadrons' ? 'qq' : opt.final === 'mu' ? 'mumu' : opt.final === 'tau' ? 'tautau' : opt.final + opt.final}${opt.qedOnly ? '-qed' : ''}`;

  /** Coefficients of the angular distribution for one final-state flavour at s. */
  const coefficients = (pdgF: number, s: number): EwCoefficients => {
    const f = fermion(pdgF);
    const mf = finalMass(pdgF);
    const alpha = opt.qedOnly || opt.alpha !== 'running' ? ALPHA_0 : alphaEM(Math.sqrt(s));
    const ex: Exchange[] = [];
    if (!opt.qedOnly) {
      const ze = zCouplings(11);
      const zf = zCouplings(pdgF);
      ex.push(zExchange({ L: ze.gL, R: ze.gR }, { L: zf.gL, R: zf.gR }, alpha, zWidth));
    }
    return ewCoefficients(s, -1, f.Q, ex, alpha, f.Nc, mf);
  };
  const qcdFactor = (pdgF: number, s: number) => (opt.qcd && fermion(pdgF).Nc === 3 ? 1 + alphaS(Math.sqrt(s)) / Math.PI : 1);

  /** dσ/dcosθ summed over the flavours, GeV⁻². */
  const sigmaFlavourGeV2 = (pdgF: number, s: number): number => {
    if (2 * finalMass(pdgF) >= Math.sqrt(s)) return 0;
    if (opt.qedOnly && flavours.length === 1 && pdgF === 13) return ((4 * Math.PI * ALPHA_0 * ALPHA_0) / (3 * s));
    return ewTotal(coefficients(pdgF, s)) * qcdFactor(pdgF, s);
  };
  const sigmaTotalGeV2 = (s: number): number => flavours.reduce((a, f) => a + sigmaFlavourGeV2(f, s), 0);
  const sigmaPb = (sqrtS: number): number => sigmaTotalGeV2(sqrtS * sqrtS) * HBARC2_GEV2_PB * K;

  // the flavour choice and the cosθ for one event at s
  const pickFlavour = (r: Rng, s: number): number => {
    if (flavours.length === 1) return flavours[0]!;
    let tot = 0;
    const w = flavours.map((f) => (tot += sigmaFlavourGeV2(f, s)));
    const u = r() * tot;
    for (let i = 0; i < flavours.length; i++) if (u < w[i]!) return flavours[i]!;
    return flavours[flavours.length - 1]!;
  };
  const sampleCos = (r: Rng, pdgF: number, s: number): number => {
    if (opt.qedOnly && pdgF === 13) {
      // the reader's dσ/dcosθ (hook) drives the angular distribution
      const d = hook('gen.dsigmaEeMuMu', ee2mumuDiffXsec);
      const wmax = 1.05 * Math.max(d(s, 0), d(s, 1), d(s, -1), d(s, 0.5), d(s, -0.5));
      for (let n = 0; n < 1e6; n++) {
        const c = 2 * r() - 1;
        if (r() * wmax < d(s, c)) return c;
      }
      throw new Error('gen.dsigmaEeMuMu: no cosθ accepted in 1e6 trials; is the function positive?');
    }
    const co = coefficients(pdgF, s);
    const wmax = ewMax(co) * 1.0000001;
    for (;;) {
      const c = 2 * r() - 1;
      if (r() * wmax <= ewDiff(co, c)) return c;
    }
  };

  const build = (r: Rng, cfg: ProcessConfig, pdgF: number, s: number, c: number, isr?: { x: number; side: number }): TruthEvent => {
    const sqrtS = cfg.sqrtS;
    const ev = newEvent(title, sqrtS, cfg.eventNumber ?? 0);
    const [b1, b2] = addBeams(ev, 'ee', sqrtS);
    const mf = finalMass(pdgF);
    const sq = Math.sqrt(s);
    const k = Math.sqrt(Math.max(0, s / 4 - mf * mf));
    const phi = 2 * Math.PI * r();
    const sinT = Math.sqrt(Math.max(0, 1 - c * c));
    let pf = fromMass(mf, k * sinT * Math.cos(phi), k * sinT * Math.sin(phi), k * c);
    let pa = fromMass(mf, -pf.px, -pf.py, -pf.pz);
    let boson = { E: sq, px: 0, py: 0, pz: 0 };
    if (isr) {
      // the photon takes x √s/2 along ±z; the ff̄ system has (√s − Eγ, 0, 0, ∓Eγ)
      const Eg = (isr.x * sqrtS) / 2;
      const pgz = isr.side * Eg;
      const Etot = sqrtS - Eg;
      const rap = Math.atanh(-pgz / Etot); // rapidity of the ff̄ system (its pz is −pgz)
      pf = boostZ(pf, rap);
      pa = boostZ(pa, rap);
      boson = boostZ(boson, rap);
      addParticle(ev, 22, { E: Eg, px: 0, py: 0, pz: pgz }, 'final', [isr.side > 0 ? b1 : b2]);
    }
    const bos = addParticle(ev, opt.qedOnly ? 22 : 23, boson, 'intermediate', [b1, b2]);
    const colour = fermion(pdgF).Nc === 3;
    addParticle(ev, pdgF, pf, 'final', [bos], colour ? { colour: [101, 0] } : undefined);
    addParticle(ev, -pdgF, pa, 'final', [bos], colour ? { colour: [0, 101] } : undefined);
    return ev;
  };

  // ISR sampling ---------------------------------------------------------------------------------------------------------
  const sMin = (() => {
    const m = Math.min(...flavours.map((f) => finalMass(f)));
    return Math.max(4 * m * m * 1.0001, 4.0);
  })();
  const isrStates = new WeakMap<Rng, Map<number, Unweighter>>();
  const isrWarm = new Map<number, number>();
  /** One ISR sample: x, the weight W(x)/p(x) in pb, from a mixture of the radiator, the Z return and a flat channel. */
  const isrPoint = (r: Rng, s: number, beta: number): { x: number; w: number } => {
    const xmax = 1 - sMin / s;
    if (xmax <= 0) return { x: 0, w: 0 };
    const hasZ = M_Z * M_Z > sMin && M_Z * M_Z < s;
    const wA = 0.4, wB = hasZ ? 0.3 : 0, wD = 0.25, wC = 1 - wA - wB - wD;
    // channel B: s' = BW(M_Z), x = 1 − s'/s; channel D: s' with density 1/s' (the radiative return to low mass); C: flat in x
    const aZ = Math.atan((sMin - M_Z * M_Z) / (M_Z * GAMMA_Z));
    const bZ = Math.atan((s - M_Z * M_Z) / (M_Z * GAMMA_Z));
    const L = Math.log(s / sMin);
    const pB = (x: number) => {
      const sp = s * (1 - x);
      if (sp < sMin || sp > s) return 0;
      return (s * M_Z * GAMMA_Z) / ((bZ - aZ) * ((sp - M_Z * M_Z) ** 2 + (M_Z * GAMMA_Z) ** 2));
    };
    const pA = (x: number) => (x > 0 && x <= xmax ? (beta * Math.pow(x, beta - 1)) / Math.pow(xmax, beta) : 0);
    const pC = (x: number) => (x > 0 && x <= xmax ? 1 / xmax : 0);
    const pD = (x: number) => (x > 0 && x <= xmax ? 1 / ((1 - x) * L) : 0);
    const u = r();
    let x: number;
    if (u < wA) x = xmax * Math.pow(r(), 1 / beta);
    else if (u < wA + wB) {
      const th = aZ + (bZ - aZ) * r();
      x = 1 - (M_Z * M_Z + M_Z * GAMMA_Z * Math.tan(th)) / s;
    } else if (u < wA + wB + wD) x = 1 - (sMin * Math.exp(L * r())) / s;
    else x = xmax * r();
    if (!(x > 0 && x <= xmax)) return { x: 0, w: 0 };
    const p = wA * pA(x) + wB * pB(x) + wC * pC(x) + wD * pD(x);
    const sp = s * (1 - x);
    const sig = sigmaTotalGeV2(sp) * HBARC2_GEV2_PB * K;
    return { x, w: (radiator(x, beta) * sig) / p };
  };
  const sigmaISR = (sqrtS: number): number => {
    const s = sqrtS * sqrtS;
    const beta = radiatorBeta(s);
    const xmax = 1 - sMin / s;
    if (xmax <= 0) return sigmaPb(sqrtS);
    const sigAt = (x: number) => sigmaTotalGeV2(s * (1 - x)) * HBARC2_GEV2_PB * K;
    const x1 = Math.min(1e-3, xmax);
    // small x: variable v = x^β removes the integrable singularity
    const delta = (ALPHA_0 / Math.PI) * (Math.PI * Math.PI / 3 - 0.5) + 0.75 * beta;
    const v1 = Math.pow(x1, beta);
    const gl = [0.0198550717512319, 0.1016667612931866, 0.2372337950418355, 0.4082826787521751, 0.5917173212478249, 0.7627662049581645, 0.8983332387068134, 0.9801449282487681];
    const gw = [0.0506142681451881, 0.1111905172266872, 0.1568533229389436, 0.1813418916891810, 0.1813418916891810, 0.1568533229389436, 0.1111905172266872, 0.0506142681451881];
    let low = 0;
    for (let i = 0; i < 8; i++) {
      const v = gl[i]! * v1;
      const x = Math.pow(v, 1 / beta);
      low += gw[i]! * v1 * ((1 + delta) - (1 - x / 2) * Math.pow(x, 1 - beta)) * sigAt(x);
    }
    // the rest: adaptive Simpson on x, split at the Z return if it is inside
    const f = (x: number) => radiator(x, beta) * sigAt(x);
    const xZ = 1 - (M_Z * M_Z) / s;
    const pts = [x1];
    if (xZ > x1 && xZ < xmax) pts.push(Math.max(x1, xZ - 10 * M_Z * GAMMA_Z / s), xZ - 0, Math.min(xmax, xZ + 10 * M_Z * GAMMA_Z / s));
    pts.push(xmax);
    pts.sort((a, b) => a - b);
    let high = 0;
    for (let i = 0; i + 1 < pts.length; i++) if (pts[i + 1]! > pts[i]!) high += quad(f, pts[i]!, pts[i + 1]!, 1e-9 * Math.max(1e-30, sigAt(0)), 22);
    return low + high;
  };

  const base = makeMCProcess<{ c: number; pdg: number }>({
    name,
    title,
    beams: 'ee',
    kFactor: K,
    spec: (sqrtS): PointSpec<{ c: number; pdg: number }> => ({
      dim: 1,
      makeCtx: () => ({ c: 0, pdg: 0 }),
      point(u, _sq, ctx) {
        const s = sqrtS * sqrtS;
        ctx.c = 2 * u[0]! - 1;
        ctx.pdg = 0;
        let tot = 0;
        for (const f of flavours) {
          if (2 * finalMass(f) >= sqrtS) continue;
          if (opt.qedOnly && f === 13) tot += hook('gen.dsigmaEeMuMu', ee2mumuDiffXsec)(s, ctx.c);
          else tot += ewDiff(coefficients(f, s), ctx.c) * qcdFactor(f, s);
        }
        return 2 * tot * HBARC2_GEV2_PB;
      },
      build: () => { throw new Error('unused'); },
    }),
    analytic: (sqrtS) => sigmaTotalGeV2(sqrtS * sqrtS) * HBARC2_GEV2_PB,
  });

  const isrWeighted = (r: Rng, sqrtS: number): number => {
    const s = sqrtS * sqrtS;
    return isrPoint(r, s, radiatorBeta(s)).w;
  };

  const self: EeProcess = {
    ...base,
    sigma: (sqrtS) => sigmaPb(sqrtS),
    sigmaISR,
    afb(sqrtS) {
      const s = sqrtS * sqrtS;
      let fb = 0, tot = 0;
      for (const f of flavours) {
        if (2 * finalMass(f) >= sqrtS) continue;
        const co = coefficients(f, s);
        const t = ewTotal(co) * qcdFactor(f, s);
        tot += t;
        fb += ewAfb(co) * t;
      }
      return tot > 0 ? fb / tot : 0;
    },
    sigmaByFlavour(sqrtS) {
      const out: Record<number, number> = {};
      for (const f of flavours) out[f] = sigmaFlavourGeV2(f, sqrtS * sqrtS) * HBARC2_GEV2_PB * K;
      return out;
    },
    weightedPoint(r, cfg) {
      if (cfg.isr) return isrWeighted(r, cfg.sqrtS);
      return base.weightedPoint(r, cfg);
    },
    generate(r, cfg) {
      const s = cfg.sqrtS * cfg.sqrtS;
      if (2 * Math.min(...flavours.map(finalMass)) >= cfg.sqrtS) throw new Error(`${name}: √s = ${cfg.sqrtS} GeV is below the threshold`);
      // no room for a photon (√s′ must stay above 2 GeV): no radiation
      if (!cfg.isr || 1 - sMin / s <= 1e-6) {
        const pdgF = pickFlavour(r, s);
        const c = sampleCos(r, pdgF, s);
        const event = build(r, cfg, pdgF, s, c);
        if (cfg.weighted) {
          event.weight = sigmaPb(cfg.sqrtS);
          return { event, weight: event.weight };
        }
        return { event, weight: 1 };
      }
      // ISR: unweight the radiator sample against a running maximum (warm-up with a fixed seed)
      const beta = radiatorBeta(s);
      let per = isrStates.get(r);
      if (!per) isrStates.set(r, (per = new Map()));
      let st = per.get(cfg.sqrtS);
      if (!st) {
        let wm = isrWarm.get(cfg.sqrtS);
        if (wm === undefined) {
          const rw = makeRng(4242 + Math.floor(cfg.sqrtS));
          wm = 0;
          for (let i = 0; i < 4000; i++) wm = Math.max(wm, isrPoint(rw, s, beta).w);
          wm *= 1.2;
          isrWarm.set(cfg.sqrtS, wm);
        }
        per.set(cfg.sqrtS, (st = new Unweighter(wm)));
      }
      for (let n = 0; n < 1e6; n++) {
        const { x, w } = isrPoint(r, s, beta);
        const keep = cfg.weighted ? w > 0 : st.accept(w, r);
        if (!keep) continue;
        const sp = s * (1 - x);
        const pdgF = pickFlavour(r, sp);
        const c = sampleCos(r, pdgF, sp);
        const side = r() < 0.5 ? 1 : -1;
        const event = build(r, cfg, pdgF, sp, c, { x, side });
        if (cfg.weighted) event.weight = w;
        return { event, weight: cfg.weighted ? w : 1 };
      }
      throw new Error(`${name}: ISR sampling failed`);
    },
  };
  return self;
}

// ── R with the Z ──────────────────────────────────────────────────────────────────────────────────────────────
/** R(s) = σ(e⁺e⁻ → hadrons)/σ_pt with γ/Z exchange (tree level; `qcd` adds 1 + αs/π). σ_pt = 4πα²/(3s). */
export function rRatioWithZ(sqrtS: number, opts: { qcd?: boolean } = {}): number {
  const p = eeToFermions({ final: 'hadrons', qcd: opts.qcd });
  const sigmaPt = (4 * Math.PI * ALPHA_0 * ALPHA_0) / (3 * sqrtS * sqrtS) * HBARC2_GEV2_PB;
  return p.sigma(sqrtS) / sigmaPt;
}

// ── Bhabha scattering ─────────────────────────────────────────────────────────────────────────────────────────
/** The Bhabha cross-section dσ/dcosθ in GeV⁻² (massless, photon exchange in s and t): (πα²/s)[u²(1/s + 1/t)² + (t/s)² + (s/t)²]. */
export function bhabhaDiffXsec(s: number, c: number): number {
  const t = (-s * (1 - c)) / 2, u = (-s * (1 + c)) / 2;
  return ((Math.PI * ALPHA_0 * ALPHA_0) / s) * (u * u * (1 / s + 1 / t) ** 2 + (t / s) ** 2 + (s / t) ** 2);
}

/** e⁺e⁻ → e⁺e⁻ by γ exchange in the s- and t-channels (no Z), for |cosθ| < cosMax with θ the e⁻ scattering angle. */
export function bhabha(opts: { cosMax?: number; kFactor?: number } = {}): Process {
  const cMax = opts.cosMax ?? 0.9;
  const K = opts.kFactor ?? 1;
  return makeMCProcess<{ c: number }>({
    name: 'ee->ee',
    title: 'e⁺e⁻ → e⁺e⁻ (Bhabha)',
    beams: 'ee',
    kFactor: K,
    spec: (sqrtS) => {
      const s = sqrtS * sqrtS;
      // the t-channel pole 1/(1 − c)²: map (1 − c) with a k = 2 power law
      const m = powerMap(2, 1 - cMax, 1 + cMax);
      return {
        dim: 1,
        makeCtx: () => ({ c: 0 }),
        point(u, _sq, ctx) {
          const { x, jac } = m(u[0]!);
          ctx.c = 1 - x;
          return bhabhaDiffXsec(s, ctx.c) * jac * HBARC2_GEV2_PB;
        },
        build(ctx, r, sqrtS2) {
          const ev = newEvent('e⁺e⁻ → e⁺e⁻ (Bhabha)', sqrtS2);
          const [b1, b2] = addBeams(ev, 'ee', sqrtS2);
          const E = sqrtS2 / 2;
          const sinT = Math.sqrt(1 - ctx.c * ctx.c);
          const phi = 2 * Math.PI * r();
          const px = E * sinT * Math.cos(phi), py = E * sinT * Math.sin(phi), pz = E * ctx.c;
          addParticle(ev, 11, { E, px, py, pz }, 'final', [b1, b2]);
          addParticle(ev, -11, { E, px: -px, py: -py, pz: -pz }, 'final', [b1, b2]);
          return ev;
        },
      };
    },
    analytic: (sqrtS) => {
      const s = sqrtS * sqrtS;
      return quad((c) => bhabhaDiffXsec(s, c), -cMax, cMax, 1e-10 * bhabhaDiffXsec(s, 0), 30) * HBARC2_GEV2_PB;
    },
  });
}

// ── Registration ──────────────────────────────────────────────────────────────────────────────────────────────
const eeNames: [string[], EeOptions][] = [
  [['ee->mumu'], { final: 'mu' }],
  [['ee->tautau'], { final: 'tau' }],
  [['ee->qq', 'ee->hadrons'], { final: 'hadrons' }],
  [['ee->uu'], { final: 'u' }], [['ee->dd'], { final: 'd' }], [['ee->ss'], { final: 's' }],
  [['ee->cc'], { final: 'c' }], [['ee->bb'], { final: 'b' }], [['ee->tt'], { final: 't' }],
  [['ee->mumu-qed'], { final: 'mu', qedOnly: true }],
];
for (const [names, o] of eeNames) registerProcess(names, () => eeToFermions(o));
registerProcess(['ee->ee', 'bhabha'], () => bhabha());
export type { Beams };
