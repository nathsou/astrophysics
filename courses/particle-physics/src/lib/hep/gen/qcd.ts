/**
 * Massless 2 → 2 hard scattering in hadron collisions: QCD jets (gg, qg and qq′ channels) and the γγ continuum
 * (qq̄ → γγ and the gg → γγ quark box).
 *
 * Phase space: the transverse momentum pT of the outgoing pair and the two rapidities y₃, y₄, with
 *     x₁ = (pT/√s)(e^y₃ + e^y₄), x₂ = (pT/√s)(e^−y₃ + e^−y₄), t̂ = −x₁ √s pT e^−y₃, û = −x₁ √s pT e^−y₄,
 *     dσ = Σ x₁f_a(x₁) x₂f_b(x₂) (dσ̂/dt̂) dpT² dy₃ dy₄ .
 * Parton 3 is the outgoing parton that has the flavour of the incoming parton a (beam 1), so that t̂ = (p_a − p₃)² is always the
 * momentum transfer of the matrix element. Identical final-state partons carry a factor ½. Scales: parton densities and αs at Q = pT.
 *
 * Matrix elements: the standard leading-order squared amplitudes, averaged over initial and summed over final spins and colours
 * (Ellis–Stirling–Webber, table 7.1; PDG "QCD" review), dσ̂/dt̂ = π αs²/ŝ² · Σ|M|²/g⁴:
 *     qq′ → qq′ 4/9 (s²+u²)/t²           qq → qq 4/9 [(s²+u²)/t² + (s²+t²)/u²] − 8/27 s²/(ut)
 *     qq̄ → q′q̄′ 4/9 (t²+u²)/s²          qq̄ → qq̄ 4/9 [(s²+u²)/t² + (t²+u²)/s²] − 8/27 u²/(st)
 *     qq̄ → gg 32/27 (t²+u²)/(tu) − 8/3 (t²+u²)/s²      gg → qq̄ 1/6 (t²+u²)/(tu) − 3/8 (t²+u²)/s²
 *     qg → qg (s²+u²)/t² − 4/9 (s²+u²)/(su)            gg → gg 9/2 (3 − tu/s² − su/t² − st/u²)
 * The colour flow of the outgoing partons is assigned at leading colour (see `colourFlow`).
 *
 * γγ: dσ̂/dt̂(qq̄ → γγ) = (2π α² e_q⁴/3ŝ²)(û/t̂ + t̂/û) (× ½, identical photons). The gg → γγ box is APPROXIMATE: massless quark loop
 * (u, d, s, c, b), the helicity amplitudes of light-by-light scattering with its colour and charge factors, dσ̂/dt̂ = α²αs²(Σe_q²)² Σ_hel |f|²/(32π ŝ²).
 * Its normalisation was built from the light-by-light amplitude 8α² and has not been checked against a published number.
 */
import { ALPHA_0, alphaS1, fermion } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import type { Rng } from '../random/index.ts';
import { choice } from '../random/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { NPDF, addBeamsAndPartons, density, pdfAll } from './hadron.ts';
import { powerMap } from './integrate.ts';
import { type Beams, type Process, addParticle, makeMCProcess, newEvent, registerProcess } from './process.ts';

type Col = [number, number] | undefined;

// ── Matrix elements ───────────────────────────────────────────────────────────────────────────────────────────
// (plain constants rather than an enum: the library is also loaded with type stripping only)
const Kind = { QQP: 0, QQ: 1, QQBAR_SAME: 2, QQBAR_DIFF: 3, QQBAR_GG: 4, GG_QQBAR: 5, QG: 6, GG_GG: 7 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

function me(kind: Kind, s: number, t: number, u: number): number {
  switch (kind) {
    case Kind.QQP:
      return (4 / 9) * (s * s + u * u) / (t * t);
    case Kind.QQ:
      return (4 / 9) * ((s * s + u * u) / (t * t) + (s * s + t * t) / (u * u)) - (8 / 27) * (s * s) / (u * t);
    case Kind.QQBAR_SAME:
      return (4 / 9) * ((s * s + u * u) / (t * t) + (t * t + u * u) / (s * s)) - (8 / 27) * (u * u) / (s * t);
    case Kind.QQBAR_DIFF:
      return (4 / 9) * (t * t + u * u) / (s * s);
    case Kind.QQBAR_GG:
      return (32 / 27) * (t * t + u * u) / (t * u) - (8 / 3) * (t * t + u * u) / (s * s);
    case Kind.GG_QQBAR:
      return (1 / 6) * (t * t + u * u) / (t * u) - (3 / 8) * (t * t + u * u) / (s * s);
    case Kind.QG:
      return (s * s + u * u) / (t * t) - (4 / 9) * (s * s + u * u) / (s * u);
    case Kind.GG_GG:
      return 4.5 * (3 - (t * u) / (s * s) - (s * u) / (t * t) - (s * t) / (u * u));
  }
  return 0;
}
/** Public access to the QCD squared amplitudes for the tests (Σ|M|²/g⁴, averaged over initial, summed over final). */
export const qcdMatrixElements = {
  qqp: (s: number, t: number, u: number) => me(Kind.QQP, s, t, u),
  qq: (s: number, t: number, u: number) => me(Kind.QQ, s, t, u),
  qqbarSame: (s: number, t: number, u: number) => me(Kind.QQBAR_SAME, s, t, u),
  qqbarDiff: (s: number, t: number, u: number) => me(Kind.QQBAR_DIFF, s, t, u),
  qqbarGG: (s: number, t: number, u: number) => me(Kind.QQBAR_GG, s, t, u),
  ggQqbar: (s: number, t: number, u: number) => me(Kind.GG_QQBAR, s, t, u),
  qg: (s: number, t: number, u: number) => me(Kind.QG, s, t, u),
  gg: (s: number, t: number, u: number) => me(Kind.GG_GG, s, t, u),
};

interface Channel {
  a: number;
  b: number;
  c: number;
  d: number;
  kind: Kind;
  sym: number;
}
const FL = [1, 2, 3, 4, 5];

function qcdChannels(): Channel[] {
  const ch: Channel[] = [];
  // gg
  ch.push({ a: 21, b: 21, c: 21, d: 21, kind: Kind.GG_GG, sym: 0.5 });
  for (const q of FL) ch.push({ a: 21, b: 21, c: q, d: -q, kind: Kind.GG_QQBAR, sym: 1 });
  // qg
  for (const q of FL)
    for (const s of [1, -1]) {
      ch.push({ a: s * q, b: 21, c: s * q, d: 21, kind: Kind.QG, sym: 1 });
      ch.push({ a: 21, b: s * q, c: 21, d: s * q, kind: Kind.QG, sym: 1 });
    }
  // quark–quark and quark–antiquark
  for (const i of [...FL, ...FL.map((q) => -q)])
    for (const j of [...FL, ...FL.map((q) => -q)]) {
      if (i > 0 === j > 0) {
        // qq or q̄q̄
        ch.push(i === j ? { a: i, b: j, c: i, d: j, kind: Kind.QQ, sym: 0.5 } : { a: i, b: j, c: i, d: j, kind: Kind.QQP, sym: 1 });
      } else if (i === -j) {
        // annihilation-capable pair: elastic, gg, other flavours
        ch.push({ a: i, b: j, c: i, d: j, kind: Kind.QQBAR_SAME, sym: 1 });
        ch.push({ a: i, b: j, c: 21, d: 21, kind: Kind.QQBAR_GG, sym: 0.5 });
        for (const q of FL) if (q !== Math.abs(i)) ch.push({ a: i, b: j, c: q, d: -q, kind: Kind.QQBAR_DIFF, sym: 1 });
      } else {
        ch.push({ a: i, b: j, c: i, d: j, kind: Kind.QQP, sym: 1 }); // q q̄′
      }
    }
  return ch;
}

/**
 * The colour flow of a 2 → 2 channel at leading colour, as [colour, anticolour] for (a, b, c, d); tags start at 101.
 * Where two flows are possible one is chosen with probability proportional to the corresponding term of the matrix element.
 */
function colourFlow(ch: Channel, r: Rng, s: number, t: number, u: number): [Col, Col, Col, Col] {
  const col = (p: number, tag: number): Col => (p > 0 ? [tag, 0] : [0, tag]);
  /** quarks carry tag 101 and antiquarks tag 102 when their colour runs through the diagram */
  const tag = (p: number): number => (p > 0 ? 101 : 102);
  switch (ch.kind) {
    case Kind.QQP: {
      if (ch.a > 0 === ch.b > 0) {
        // t-channel gluon between two quarks (or two antiquarks): the outgoing partons swap colours
        return [col(ch.a, 101), col(ch.b, 102), col(ch.c, 102), col(ch.d, 101)];
      }
      // q q̄′: the incoming pair and the outgoing pair are each colour-connected
      return [col(ch.a, 101), col(ch.b, 101), col(ch.c, 102), col(ch.d, 102)];
    }
    case Kind.QQ: {
      // t-flow (swap) or u-flow (straight) in proportion to the two terms
      const wt = (s * s + u * u) / (t * t), wu = (s * s + t * t) / (u * u);
      return r() * (wt + wu) < wt
        ? [col(ch.a, 101), col(ch.b, 102), col(ch.c, 102), col(ch.d, 101)]
        : [col(ch.a, 101), col(ch.b, 102), col(ch.c, 101), col(ch.d, 102)];
    }
    case Kind.QQBAR_SAME: {
      const wt = (s * s + u * u) / (t * t), ws = (t * t + u * u) / (s * s);
      return r() * (wt + ws) < wt
        ? [col(ch.a, 101), col(ch.b, 101), col(ch.c, 102), col(ch.d, 102)] // t-channel gluon: connected pairs
        : [col(ch.a, tag(ch.a)), col(ch.b, tag(ch.b)), col(ch.c, tag(ch.c)), col(ch.d, tag(ch.d))]; // s-channel gluon: colour runs through
    }
    case Kind.QQBAR_DIFF:
      return [col(ch.a, tag(ch.a)), col(ch.b, tag(ch.b)), col(ch.c, tag(ch.c)), col(ch.d, tag(ch.d))];
    case Kind.QQBAR_GG: {
      // the quark line emits c then d, or d then c: weights 1/t² and 1/u²
      const first = r() * (t * t + u * u) < u * u;
      const ina = col(ch.a, tag(ch.a)), inb = col(ch.b, tag(ch.b));
      // the outgoing gluon attached to the quark carries (101, 103), the one attached to the antiquark (103, 102)
      const gq: Col = [101, 103], gb: Col = [103, 102];
      return first ? [ina, inb, gq, gb] : [ina, inb, gb, gq];
    }
    case Kind.GG_QQBAR: {
      const first = r() * (t * t + u * u) < u * u; // the quark attached to gluon a
      return first ? [[101, 102], [102, 103], [101, 0], [0, 103]] : [[101, 102], [103, 101], [103, 0], [0, 102]];
    }
    case Kind.QG: {
      // the gluon's colour (or anticolour) matches the quark line, or the quark takes the gluon's colour
      const qFirst = ch.a !== 21;
      const qp = qFirst ? ch.a : ch.b;
      let inQ: Col, inG: Col, oQ: Col, oG: Col;
      const pick = r() < 0.5;
      if (qp > 0) {
        inQ = [101, 0];
        [inG, oQ, oG] = pick ? [[102, 101], [103, 0], [102, 103]] : [[102, 103], [102, 0], [101, 103]];
      } else {
        inQ = [0, 101];
        [inG, oQ, oG] = pick ? [[101, 102], [0, 103], [103, 102]] : [[103, 102], [0, 102], [103, 101]];
      }
      return qFirst ? [inQ, inG, oQ, oG] : [inG, inQ, oG, oQ];
    }
    case Kind.GG_GG: {
      const pair = r() < 0.5;
      const a: Col = [101, 102];
      const b: Col = pair ? [102, 103] : [103, 101];
      const first = r() < 0.5;
      if (pair) return first ? [a, b, [101, 104], [104, 103]] : [a, b, [104, 103], [101, 104]];
      return first ? [a, b, [103, 104], [104, 102]] : [a, b, [104, 102], [103, 104]];
    }
  }
  return [undefined, undefined, undefined, undefined];
}

// ── The generic 2 → 2 phase-space process ────────────────────────────────────────────────────────────────────
interface Ctx22 {
  x1: number;
  x2: number;
  pt: number;
  y3: number;
  y4: number;
  s: number;
  t: number;
  u: number;
  contrib: Float64Array;
}

interface Def22 {
  name: string;
  title: string;
  beams: Beams;
  ptMin: number;
  ptMax?: number;
  kFactor?: number;
  nChan: number;
  /** Fill ctx.contrib with x₁f x₂f dσ̂/dt̂ (GeV⁻⁴) per channel (including symmetry factors); return the sum. */
  dsigma(ctx: Ctx22, f1: Float64Array, f2: Float64Array): number;
  /** Outgoing/incoming partons and colours of channel k at this point. */
  channel(k: number, ctx: Ctx22, r: Rng): { a: number; b: number; c: number; d: number; colour: [Col, Col, Col, Col] };
}

function make22(def: Def22): Process {
  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);
  return makeMCProcess<Ctx22>({
    name: def.name,
    title: def.title,
    beams: def.beams,
    kFactor: def.kFactor,
    spec: (sqrtS) => {
      const s = sqrtS * sqrtS;
      const ptMax = Math.min(def.ptMax ?? Infinity, 0.4999 * sqrtS);
      const map = powerMap(3, def.ptMin * def.ptMin, ptMax * ptMax);
      return {
        dim: 3,
        makeCtx: (): Ctx22 => ({ x1: 0, x2: 0, pt: 0, y3: 0, y4: 0, s: 0, t: 0, u: 0, contrib: new Float64Array(def.nChan) }),
        point(u: Float64Array, _s: number, ctx: Ctx22): number {
          const { x: pt2, jac } = map(u[0]!);
          const pt = Math.sqrt(pt2);
          const Y = Math.acosh(sqrtS / (2 * pt));
          const y3 = Y * (2 * u[1]! - 1), y4 = Y * (2 * u[2]! - 1);
          const x1 = (pt / sqrtS) * (Math.exp(y3) + Math.exp(y4)), x2 = (pt / sqrtS) * (Math.exp(-y3) + Math.exp(-y4));
          if (x1 >= 1 || x2 >= 1) return 0;
          ctx.x1 = x1; ctx.x2 = x2; ctx.pt = pt; ctx.y3 = y3; ctx.y4 = y4;
          ctx.s = x1 * x2 * s;
          ctx.t = -x1 * sqrtS * pt * Math.exp(-y3);
          ctx.u = -x1 * sqrtS * pt * Math.exp(-y4);
          pdfAll(x1, pt, f1);
          pdfAll(x2, pt, f2);
          const sum = def.dsigma(ctx, f1, f2);
          return sum * jac * (2 * Y) * (2 * Y) * HBARC2_GEV2_PB;
        },
        build(ctx: Ctx22, r: Rng, sq: number): TruthEvent {
          const k = choice(r, ctx.contrib);
          const ch = def.channel(k, ctx, r);
          const ev = newEvent(def.title, sq);
          const [col0, col1, col2, col3] = ch.colour;
          const [ia, ib] = addBeamsAndPartons(ev, def.beams, sq, ch.a, ch.b, ctx.x1, ctx.x2, col0, col1);
          const phi = 2 * Math.PI * r();
          const cx = Math.cos(phi), sx = Math.sin(phi);
          const pt = ctx.pt;
          addParticle(ev, ch.c, { E: pt * Math.cosh(ctx.y3), px: pt * cx, py: pt * sx, pz: pt * Math.sinh(ctx.y3) }, 'final', [ia, ib], col2 ? { colour: col2 } : undefined);
          addParticle(ev, ch.d, { E: pt * Math.cosh(ctx.y4), px: -pt * cx, py: -pt * sx, pz: pt * Math.sinh(ctx.y4) }, 'final', [ia, ib], col3 ? { colour: col3 } : undefined);
          return ev;
        },
      };
    },
  });
}

// ── Dijets ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface DijetOptions {
  /** Minimum pT of the outgoing partons, GeV (default 20). */
  ptMin?: number;
  ptMax?: number;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
}
/** QCD 2 → 2 scattering with five massless quark flavours and gluons: the source of jets and of the QCD background. */
export function dijets(opt: DijetOptions = {}): Process {
  const chans = qcdChannels();
  const beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  return make22({
    name: `${beams}->jj`,
    title: `${beams === 'pp' ? 'pp' : 'pp̄'} → jj (QCD 2 → 2)`,
    beams,
    ptMin: opt.ptMin ?? 20,
    ptMax: opt.ptMax,
    kFactor: opt.kFactor,
    nChan: chans.length,
    dsigma(ctx, f1, f2) {
      const as = alphaS1(ctx.pt);
      const pref = (Math.PI * as * as) / (ctx.s * ctx.s);
      let sum = 0;
      for (let k = 0; k < chans.length; k++) {
        const ch = chans[k]!;
        const d = density(f1, ch.a, false) * density(f2, ch.b, anti);
        const v = d > 0 ? d * pref * ch.sym * me(ch.kind, ctx.s, ctx.t, ctx.u) : 0;
        ctx.contrib[k] = v;
        sum += v;
      }
      return sum;
    },
    channel(k, ctx, r) {
      const ch = chans[k]!;
      return { a: ch.a, b: ch.b, c: ch.c, d: ch.d, colour: colourFlow(ch, r, ctx.s, ctx.t, ctx.u) };
    },
  });
}

// ── γγ ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Squared helicity amplitudes of the massless fermion box (light-by-light scattering), summed over the 16 helicity
 * configurations: Σ|f|² = 10 + 2(|f₋₋₊₊|² + |f₋₊₋₊|² + |f₋₊₊₋|²) with
 *   f₋₋₊₊ = −½ (t²+u²)/s² [ln²(t/u) + π²] − (t−u)/s ln(t/u) − 1,
 *   f₋₊₋₊ = −½ (t²+s²)/u² ln²(−t/s) − (t−s)/u ln(−t/s) − 1 − iπ [(t²+s²)/u² ln(−t/s) + (t−s)/u]   (and t ↔ u for f₋₊₊₋).
 */
export function boxSumSquared(s: number, t: number, u: number): number {
  const lnTU = Math.log(t / u);
  const fppmm = -0.5 * ((t * t + u * u) / (s * s)) * (lnTU * lnTU + Math.PI * Math.PI) - ((t - u) / s) * lnTU - 1;
  const mixed = (x: number, y: number): number => {
    // x, y ∈ {t, u}; f = −½ (x²+s²)/y² ln²(−x/s) − (x−s)/y ln(−x/s) − 1 − iπ[...]
    const l = Math.log(-x / s);
    const re = -0.5 * ((x * x + s * s) / (y * y)) * l * l - ((x - s) / y) * l - 1;
    const im = -Math.PI * (((x * x + s * s) / (y * y)) * l + (x - s) / y);
    return re * re + im * im;
  };
  return 10 + 2 * (fppmm * fppmm + mixed(t, u) + mixed(u, t));
}

export interface DiphotonOptions {
  /** Minimum photon pT, GeV (default 20). */
  ptMin?: number;
  ptMax?: number;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
  /** Include the gg → γγ box (default true). */
  box?: boolean;
}
/** The γγ continuum: qq̄ → γγ and (approximately) gg → γγ. */
export function diphoton(opt: DiphotonOptions = {}): Process {
  const beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  const box = opt.box ?? true;
  // channels: 10 qq̄ (5 flavours × 2 orderings), then gg
  const list: { a: number; b: number }[] = [];
  for (const q of FL) {
    list.push({ a: q, b: -q });
    list.push({ a: -q, b: q });
  }
  const sumE2 = FL.reduce((acc, q) => acc + fermion(q).Q ** 2, 0);
  return make22({
    name: `${beams}->gammagamma`,
    title: `${beams === 'pp' ? 'pp' : 'pp̄'} → γγ`,
    beams,
    ptMin: opt.ptMin ?? 20,
    ptMax: opt.ptMax,
    kFactor: opt.kFactor,
    nChan: list.length + 1,
    dsigma(ctx, f1, f2) {
      const a2 = ALPHA_0 * ALPHA_0;
      let sum = 0;
      const s2 = ctx.s * ctx.s;
      const tu = ctx.u / ctx.t + ctx.t / ctx.u;
      for (let k = 0; k < list.length; k++) {
        const ch = list[k]!;
        const e4 = fermion(ch.a).Q ** 4;
        const d = density(f1, ch.a, false) * density(f2, ch.b, anti);
        // ½ for the identical photons
        const v = d * ((2 * Math.PI * a2 * e4) / (3 * s2)) * tu * 0.5;
        ctx.contrib[k] = v;
        sum += v;
      }
      let g = 0;
      if (box) {
        const as = alphaS1(ctx.pt);
        g = density(f1, 21, false) * density(f2, 21, anti) * ((a2 * as * as * sumE2 * sumE2 * boxSumSquared(ctx.s, ctx.t, ctx.u)) / (32 * Math.PI * s2));
      }
      ctx.contrib[list.length] = g;
      return sum + g;
    },
    channel(k) {
      if (k < list.length) {
        const ch = list[k]!;
        return { a: ch.a, b: ch.b, c: 22, d: 22, colour: [quarkCol(ch.a), quarkCol(ch.b), undefined, undefined] };
      }
      return { a: 21, b: 21, c: 22, d: 22, colour: [[101, 102], [102, 101], undefined, undefined] };
    },
  });
}
const quarkCol = (p: number): Col => (p > 0 ? [101, 0] : [0, 101]);

registerProcess(['pp->jj', 'pp->dijets', 'pp->QCD'], () => dijets());
registerProcess(['ppbar->jj'], () => dijets({ beams: 'ppbar' }));
registerProcess(['pp->gammagamma', 'pp->diphoton', 'pp->aa'], () => diphoton());
