/**
 * Drell–Yan production of a lepton pair (γ* and Z, with interference), of a W decaying to ℓν, and of a hypothetical heavy Z′, in pp
 * and p p̄ collisions at leading order.
 *
 * The partonic cross-sections are the exact tree-level ones of `ewkernel.ts` (Z, γ and Z′ with their interference and the
 * correct lepton angular distribution, including the forward–backward asymmetry in the parton frame) and, for the W, the
 * V−A result dσ̂/dcosθ = |V_ij|² G_F² mW⁴ ŝ (1 ± cosθ)² / (48π |ŝ − mW² + i mW ΓW|²). Since there is no transverse recoil at leading
 * order, the lepton angle is measured in the frame of the parton collision, whose z axis is the beam axis; the shower adds the
 * transverse momentum of the pair.
 * Kinematics: ŝ = m² (the pair mass), rapidity y, x₁,₂ = (m/√s) e^(±y). The mass is sampled from a mixture of Breit–Wigner peaks and
 * power laws; VEGAS refines the (m, y, cosθ) grid.
 */
import { G_F, GAMMA_W, GAMMA_Z, M_W, M_Z, alphaEM, ckmSquared, fermion, zCouplings } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import { particle } from '../particles/index.ts';
import type { Rng } from '../random/index.ts';
import { choice } from '../random/index.ts';
import { fromMass } from '../kinematics/index.ts';
import { gaussLegendre, integrateMapped } from './integrate.ts';
import { NPDF, addBeamsAndPartons, density, massMap, pdfAll, quarkColour } from './hadron.ts';
import { type Beams, type Process, addParticle, boostZ, makeMCProcess, registerProcess } from './process.ts';
import { type Chiral, type Exchange, ewCoefficients, ewDiff, ewPropagators, ewTotal, zExchange, zKappa } from './ewkernel.ts';
import type { TruthEvent } from '../event/index.ts';
import { newEvent } from './process.ts';

const LEPTONS = { e: 11, mu: 13, tau: 15 } as const;
type LeptonName = keyof typeof LEPTONS;

// ── Z′ ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface ZPrimeSpec {
  /** Mass in GeV. */
  mass: number;
  /** Full width in GeV; by default computed from the couplings (decays to all Standard-Model fermions). */
  width?: number;
  /** Couplings to left- and right-handed up-type quarks, down-type quarks and charged leptons (family-universal), in units of e/(sinθW cosθW); default: those of the Z ("sequential" Z′). */
  up?: Chiral;
  down?: Chiral;
  lepton?: Chiral;
}
const sm = (pdg: number): Chiral => {
  const c = zCouplings(pdg);
  return { L: c.gL, R: c.gR };
};
/** The Z′ couplings filled with defaults. */
export function zPrimeCouplings(spec: ZPrimeSpec): { up: Chiral; down: Chiral; lepton: Chiral } {
  return { up: spec.up ?? sm(2), down: spec.down ?? sm(1), lepton: spec.lepton ?? sm(11) };
}
/**
 * Total width of the Z′ from its decays to Standard-Model fermions: Γ_f = N_c g² M β/(24π) [(g_L² + g_R²)(1 − m²/M²) + 6 g_L g_R m²/M²],
 * g² = 4√2 G_F mZ² (the coupling of the Z in units of e/(sinθW cosθW) is 1), the neutrino coupling −(g_L − g_R) of the charged lepton.
 */
export function zPrimeWidth(spec: ZPrimeSpec): number {
  if (spec.width !== undefined) return spec.width;
  const { up, down, lepton } = zPrimeCouplings(spec);
  const M = spec.mass;
  const g2 = 4 * Math.SQRT2 * G_F * M_Z * M_Z;
  const one = (pdg: number, c: Chiral) => {
    const f = fermion(pdg);
    const r = (2 * f.mass) / M;
    if (r >= 1) return 0;
    const beta = Math.sqrt(1 - r * r);
    const m2 = (f.mass / M) ** 2;
    return (f.Nc * g2 * M * beta) / (24 * Math.PI) * ((c.L * c.L + c.R * c.R) * (1 - m2) + 6 * c.L * c.R * m2);
  };
  let w = 0;
  for (const u of [2, 4, 6]) w += one(u, up);
  for (const d of [1, 3, 5]) w += one(d, down);
  for (const l of [11, 13, 15]) w += one(l, lepton);
  const nu: Chiral = { L: -(lepton.L - lepton.R), R: 0 };
  w += 3 * one(12, nu);
  return w;
}

// ── Drell–Yan ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface DrellYanOptions {
  lepton?: LeptonName;
  /** Mass window of the lepton pair, GeV (default 60–120; for a Z′ 0.5–1.5 of its mass). */
  mMin?: number;
  mMax?: number;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
  /** Z width in the propagator (default: table). */
  zWidth?: number;
  /** Add a Z′ with these properties. */
  zPrime?: ZPrimeSpec;
  /** With a Z′: generate only the Z′ exchange (no γ, Z, no interference). */
  signalOnly?: boolean;
  name?: string;
}

const QUARKS = [1, 2, 3, 4, 5];

interface DyCtx {
  m2: number;
  y: number;
  c: number;
  x1: number;
  x2: number;
  contrib: Float64Array;
}

export function drellYan(opt: DrellYanOptions = {}): Process {
  const lepName = opt.lepton ?? 'mu';
  const lep = LEPTONS[lepName];
  const mLep = particle(lep).mass;
  const beams: Beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  const zp = opt.zPrime;
  const zpWidth = zp ? zPrimeWidth(zp) : 0;
  const signalOnly = !!(zp && opt.signalOnly);
  const zw = opt.zWidth ?? GAMMA_Z;
  const lc = zCouplings(lep);
  const lepC: Chiral = { L: lc.gL, R: lc.gR };
  const zpC = zp ? zPrimeCouplings(zp) : undefined;

  // exchange templates per quark flavour (kappa is refreshed per point)
  const exch: Exchange[][] = QUARKS.map((q) => {
    const list: Exchange[] = [];
    const qc = zCouplings(q);
    if (!signalOnly) list.push(zExchange({ L: qc.gL, R: qc.gR }, lepC, 1 / 137, zw));
    if (zp && zpC) {
      const cq = q % 2 === 0 ? zpC.up : zpC.down;
      list.push({ mass: zp.mass, width: zpWidth, gi: cq, gf: zpC.lepton, kappa: 1, running: true });
    }
    return list;
  });
  const tmpl = exch[0]!;

  const defLo = zp ? Math.max(50, 0.5 * zp.mass) : 60;
  const defHi = zp ? 1.5 * zp.mass : 120;
  const lo = opt.mMin ?? defLo;
  const hi0 = opt.mMax ?? defHi;
  const peaks = [...(signalOnly ? [] : [{ M: M_Z, Gamma: zw }]), ...(zp ? [{ M: zp.mass, Gamma: Math.max(zpWidth, 0.01 * zp.mass) }] : [])];
  const name = opt.name ?? (zp ? `${beams}->Zprime->${lepName === 'mu' ? 'mumu' : lepName === 'e' ? 'ee' : 'tautau'}` : `${beams}->Z->${lepName === 'mu' ? 'mumu' : lepName === 'e' ? 'ee' : 'tautau'}`);
  const symbol = particle(lep).symbol.replace('⁻', '') ;
  const boson = zp ? (signalOnly ? 'Z′' : 'γ*/Z/Z′') : 'γ*/Z';
  const title = `${beams === 'pp' ? 'pp' : 'pp̄'} → ${boson} → ${symbol}⁺${symbol}⁻`;

  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);

  /**
   * Fill `out` (10 entries, flavour × orientation) with x₁x₂-weighted parton terms: dσ̂/dcosθ × densities, GeV⁻² (before the 1/s and
   * jacobians). `c` is cosθ of the ℓ⁻ with respect to +z; null integrates over it analytically. Returns the sum.
   */
  const terms = (m2: number, x1: number, x2: number, c: number | null, out: Float64Array): number => {
    const m = Math.sqrt(m2);
    const alpha = alphaEM(m);
    const kap = zKappa(alpha);
    for (const e of tmpl) e.kappa = kap;
    for (const l of exch) for (const e of l) e.kappa = kap;
    const chis = ewPropagators(m2, tmpl);
    pdfAll(x1, m, f1);
    pdfAll(x2, m, f2);
    const inv = 1 / (x1 * x2);
    let sum = 0;
    for (let i = 0; i < QUARKS.length; i++) {
      const q = QUARKS[i]!;
      const Qq = fermion(q).Q;
      const co = ewCoefficients(m2, signalOnly ? 0 : Qq, -1, exch[i]!, alpha, 1 / 3, 0, chis);
      const d0 = density(f1, q, false) * density(f2, -q, anti) * inv;
      const d1 = density(f1, -q, false) * density(f2, q, anti) * inv;
      let s0: number, s1: number;
      if (c === null) {
        const t = ewTotal(co);
        s0 = d0 * t;
        s1 = d1 * t;
      } else {
        s0 = d0 * ewDiff(co, c);
        s1 = d1 * ewDiff(co, -c);
      }
      out[2 * i] = s0;
      out[2 * i + 1] = s1;
      sum += s0 + s1;
    }
    return sum;
  };

  const spec = (sqrtS: number) => {
    const s = sqrtS * sqrtS;
    const hi = Math.min(hi0, sqrtS * 0.9999);
    const mmap = massMap(lo * lo, hi * hi, peaks, peaks.length ? 0.4 : 1);
    return {
      dim: 3,
      makeCtx: (): DyCtx => ({ m2: 0, y: 0, c: 0, x1: 0, x2: 0, contrib: new Float64Array(10) }),
      point(u: Float64Array, _s: number, ctx: DyCtx): number {
        if (!(hi > lo)) return 0;
        const { x: m2, jac } = mmap(u[0]!);
        const tau = m2 / s;
        const ymax = 0.5 * Math.log(1 / tau);
        const y = ymax * (2 * u[1]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) return 0;
        ctx.m2 = m2;
        ctx.y = y;
        ctx.c = 2 * u[2]! - 1;
        ctx.x1 = x1;
        ctx.x2 = x2;
        const sum = terms(m2, x1, x2, ctx.c, ctx.contrib);
        return (sum * jac * 2 * ymax * 2 * HBARC2_GEV2_PB) / s;
      },
      build(ctx: DyCtx, r: Rng, sq: number): TruthEvent {
        const k = choice(r, ctx.contrib);
        const q = QUARKS[k >> 1]!;
        const orient = k & 1;
        const pa = orient === 0 ? q : -q, pb = orient === 0 ? -q : q;
        const ev = newEvent(title, sq);
        const [ia, ib] = addBeamsAndPartons(ev, beams, sq, pa, pb, ctx.x1, ctx.x2, quarkColour(pa, 101), quarkColour(pb, 101));
        const m = Math.sqrt(ctx.m2);
        const kk = Math.sqrt(Math.max(0, ctx.m2 / 4 - mLep * mLep));
        const sinT = Math.sqrt(Math.max(0, 1 - ctx.c * ctx.c));
        const phi = 2 * Math.PI * r();
        const lm = fromMass(mLep, kk * sinT * Math.cos(phi), kk * sinT * Math.sin(phi), kk * ctx.c);
        const lp = fromMass(mLep, -lm.px, -lm.py, -lm.pz);
        const lmL = boostZ(lm, ctx.y), lpL = boostZ(lp, ctx.y);
        const bos = addParticle(ev, zp ? 32 : 23, boostZ({ E: m, px: 0, py: 0, pz: 0 }, ctx.y), 'intermediate', [ia, ib]);
        addParticle(ev, lep, lmL, 'final', [bos]);
        addParticle(ev, -lep, lpL, 'final', [bos]);
        return ev;
      },
    };
  };

  // deterministic quadrature over (m, y) with the angle integrated analytically
  const cache = new Map<number, number>();
  const analytic = (sqrtS: number): number | undefined => {
    const hit = cache.get(sqrtS);
    if (hit !== undefined) return hit;
    const s = sqrtS * sqrtS;
    const hi = Math.min(hi0, sqrtS * 0.9999);
    if (!(hi > lo)) return 0;
    const mmap = massMap(lo * lo, hi * hi, peaks, peaks.length ? 0.4 : 1);
    const gy = gaussLegendre(24);
    const out = new Float64Array(10);
    const total = integrateMapped(mmap, 24, (u) => {
      const { x: m2, jac } = mmap(u);
      const tau = m2 / s;
      const ymax = 0.5 * Math.log(1 / tau);
      let inner = 0;
      for (let j = 0; j < gy.x.length; j++) {
        const y = ymax * (2 * gy.x[j]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) continue;
        inner += gy.w[j]! * terms(m2, x1, x2, null, out);
      }
      return jac * inner * 2 * ymax;
    });
    const v = (total * HBARC2_GEV2_PB) / s;
    cache.set(sqrtS, v);
    return v;
  };

  return makeMCProcess<DyCtx>({ name, title, beams, spec, analytic, kFactor: opt.kFactor });
}

/** A heavy Z′ in Drell–Yan (with the γ*-and-Z background and interference unless `signalOnly`). */
export function zPrime(spec: ZPrimeSpec, opt: Omit<DrellYanOptions, 'zPrime'> = {}): Process {
  return drellYan({ ...opt, zPrime: spec });
}

// ── W → ℓν ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface WOptions {
  /** +1: W⁺ only, −1: W⁻ only, 0: both (default). */
  charge?: 1 | -1 | 0;
  lepton?: LeptonName;
  /** Window on the lepton–neutrino mass (default 40–200 GeV). */
  mMin?: number;
  mMax?: number;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
  name?: string;
}
interface WCtx {
  m2: number;
  y: number;
  c: number;
  x1: number;
  x2: number;
  contrib: Float64Array;
}
const UP = [2, 4];
const DOWN = [1, 3, 5];

export function wBoson(opt: WOptions = {}): Process {
  const charge = opt.charge ?? 0;
  const lepName = opt.lepton ?? 'mu';
  const lep = LEPTONS[lepName];
  const mLep = particle(lep).mass;
  const beams: Beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  const lo = opt.mMin ?? 40;
  const hi0 = opt.mMax ?? 200;
  const signs: (1 | -1)[] = charge === 0 ? [1, -1] : [charge];
  const nPair = UP.length * DOWN.length;
  const nChan = signs.length * nPair * 2;
  const tag = lepName === 'mu' ? 'munu' : lepName === 'e' ? 'enu' : 'taunu';
  const name = opt.name ?? `${beams}->W${charge === 1 ? '+' : charge === -1 ? '-' : ''}->${tag}`;
  const lsym = particle(lep).symbol.replace('⁻', '');
  const title = `${beams === 'pp' ? 'pp' : 'pp̄'} → W${charge === 1 ? '⁺' : charge === -1 ? '⁻' : '±'} → ${charge === 1 ? `${lsym}⁺ν` : charge === -1 ? `${lsym}⁻ν̄` : `${lsym}ν`}`;
  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);
  const pref = (G_F * G_F * M_W ** 4) / (48 * Math.PI);

  /** ordering of contrib: sign index × (up, down) pair × orientation; `c` = cosθ of the charged lepton w.r.t. +z, null = integrated. */
  const terms = (m2: number, x1: number, x2: number, c: number | null, out: Float64Array): number => {
    pdfAll(x1, Math.sqrt(m2), f1);
    pdfAll(x2, Math.sqrt(m2), f2);
    const inv = 1 / (x1 * x2);
    const prop = 1 / ((m2 - M_W * M_W) ** 2 + M_W * M_W * GAMMA_W * GAMMA_W);
    const base = pref * m2 * prop;
    let sum = 0, k = 0;
    for (const sg of signs) {
      for (const u of UP)
        for (const d of DOWN) {
          const v2 = ckmSquared(u, d);
          // W⁺ = u d̄: quark u from beam 1 (orientation 0) or beam 2 (1); W⁻ = d ū.
          const qa = sg === 1 ? u : d, qb = sg === 1 ? d : u; // the quark-like and antiquark-like partons (antiquark = −qb)
          const d0 = density(f1, qa, false) * density(f2, -qb, anti) * inv;
          const d1 = density(f1, -qb, false) * density(f2, qa, anti) * inv;
          // (1 ∓ c)²: W⁺: (1 − cosθ_{u,ℓ⁺})², W⁻: (1 + cosθ_{d,ℓ⁻})², with cosθ relative to the quark direction
          const ang = (cq: number) => (sg === 1 ? (1 - cq) ** 2 : (1 + cq) ** 2);
          let a0: number, a1: number;
          if (c === null) a0 = a1 = 8 / 3;
          else {
            a0 = ang(c);
            a1 = ang(-c);
          }
          const s0 = base * v2 * d0 * a0;
          const s1 = base * v2 * d1 * a1;
          out[k++] = s0;
          out[k++] = s1;
          sum += s0 + s1;
        }
    }
    return sum;
  };

  const spec = (sqrtS: number) => {
    const s = sqrtS * sqrtS;
    const hi = Math.min(hi0, sqrtS * 0.9999);
    const mmap = massMap(lo * lo, hi * hi, [{ M: M_W, Gamma: GAMMA_W }], 0.4);
    return {
      dim: 3,
      makeCtx: (): WCtx => ({ m2: 0, y: 0, c: 0, x1: 0, x2: 0, contrib: new Float64Array(nChan) }),
      point(u: Float64Array, _s: number, ctx: WCtx): number {
        if (!(hi > lo)) return 0;
        const { x: m2, jac } = mmap(u[0]!);
        const tau = m2 / s;
        const ymax = 0.5 * Math.log(1 / tau);
        const y = ymax * (2 * u[1]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) return 0;
        ctx.m2 = m2;
        ctx.y = y;
        ctx.c = 2 * u[2]! - 1;
        ctx.x1 = x1;
        ctx.x2 = x2;
        const sum = terms(m2, x1, x2, ctx.c, ctx.contrib);
        return (sum * jac * 2 * ymax * 2 * HBARC2_GEV2_PB) / s;
      },
      build(ctx: WCtx, r: Rng, sq: number): TruthEvent {
        const k = choice(r, ctx.contrib);
        const orient = k & 1;
        const pairIndex = k >> 1;
        const sg = signs[Math.floor(pairIndex / nPair)]!;
        const pr = pairIndex % nPair;
        const u = UP[Math.floor(pr / DOWN.length)]!;
        const d = DOWN[pr % DOWN.length]!;
        const qa = sg === 1 ? u : d, qb = sg === 1 ? d : u;
        // orientation 0: quark qa from beam 1, antiquark −qb from beam 2
        const pa = orient === 0 ? qa : -qb, pb = orient === 0 ? -qb : qa;
        const ev = newEvent(title, sq);
        const [ia, ib] = addBeamsAndPartons(ev, beams, sq, pa, pb, ctx.x1, ctx.x2, quarkColour(pa, 101), quarkColour(pb, 101));
        const m = Math.sqrt(ctx.m2);
        // charged lepton ℓ^(−sg·…): W⁺ → ℓ⁺ ν (pdg −lep, +νpdg), W⁻ → ℓ⁻ ν̄
        const chPdg = sg === 1 ? -lep : lep;
        const nuPdg = sg === 1 ? lep + 1 : -(lep + 1);
        const kc = Math.sqrt(Math.max(0, (ctx.m2 - mLep * mLep) ** 2 / (4 * ctx.m2)));
        const sinT = Math.sqrt(Math.max(0, 1 - ctx.c * ctx.c));
        const phi = 2 * Math.PI * r();
        const lc = fromMass(mLep, kc * sinT * Math.cos(phi), kc * sinT * Math.sin(phi), kc * ctx.c);
        const nu = { E: kc, px: -lc.px, py: -lc.py, pz: -lc.pz };
        const bos = addParticle(ev, sg === 1 ? 24 : -24, boostZ({ E: m, px: 0, py: 0, pz: 0 }, ctx.y), 'intermediate', [ia, ib]);
        addParticle(ev, chPdg, boostZ(lc, ctx.y), 'final', [bos]);
        addParticle(ev, nuPdg, boostZ(nu, ctx.y), 'final', [bos]);
        return ev;
      },
    };
  };

  const cache = new Map<number, number>();
  const analytic = (sqrtS: number): number | undefined => {
    const hit = cache.get(sqrtS);
    if (hit !== undefined) return hit;
    const s = sqrtS * sqrtS;
    const hi = Math.min(hi0, sqrtS * 0.9999);
    if (!(hi > lo)) return 0;
    const mmap = massMap(lo * lo, hi * hi, [{ M: M_W, Gamma: GAMMA_W }], 0.4);
    const gy = gaussLegendre(24);
    const out = new Float64Array(nChan);
    const total = integrateMapped(mmap, 24, (u) => {
      const { x: m2, jac } = mmap(u);
      const tau = m2 / s;
      const ymax = 0.5 * Math.log(1 / tau);
      let inner = 0;
      for (let j = 0; j < gy.x.length; j++) {
        const y = ymax * (2 * gy.x[j]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) continue;
        inner += gy.w[j]! * terms(m2, x1, x2, null, out);
      }
      return jac * inner * 2 * ymax;
    });
    const v = (total * HBARC2_GEV2_PB) / s;
    cache.set(sqrtS, v);
    return v;
  };

  return makeMCProcess<WCtx>({ name, title, beams, spec, analytic, kFactor: opt.kFactor });
}

// ── Registration ──────────────────────────────────────────────────────────────────────────────────────────────
registerProcess(['pp->Z->mumu', 'pp->DY->mumu'], () => drellYan({ lepton: 'mu' }));
registerProcess(['pp->Z->ee', 'pp->DY->ee'], () => drellYan({ lepton: 'e' }));
registerProcess(['pp->Z->tautau'], () => drellYan({ lepton: 'tau' }));
registerProcess(['ppbar->Z->mumu'], () => drellYan({ lepton: 'mu', beams: 'ppbar' }));
registerProcess(['ppbar->Z->ee'], () => drellYan({ lepton: 'e', beams: 'ppbar' }));
registerProcess(['pp->W->munu'], () => wBoson({ lepton: 'mu' }));
registerProcess(['pp->W->enu'], () => wBoson({ lepton: 'e' }));
registerProcess(['pp->W+->munu'], () => wBoson({ lepton: 'mu', charge: 1 }));
registerProcess(['pp->W-->munu'], () => wBoson({ lepton: 'mu', charge: -1 }));
registerProcess(['ppbar->W->munu'], () => wBoson({ lepton: 'mu', beams: 'ppbar' }));
/** The default Z′: a 3 TeV "sequential" Z′ (couplings of the Z) decaying to μμ, on top of the γ*-and-Z background. */
registerProcess(['pp->Zprime->mumu'], () => zPrime({ mass: 3000 }));
