/**
 * Top-quark pair production at leading order (gg → tt̄ and qq̄ → tt̄) with the decays t → W b and W → ℓν or qq′ at matrix-element level.
 *
 * Production: dσ̂/dt̂ = π αs²/ŝ² Σ|M|²/g⁴ with τ₁ = (m² − t̂)/ŝ, τ₂ = (m² − û)/ŝ, ρ = 4m²/ŝ and
 *     qq̄ → tt̄:  4/9 (τ₁² + τ₂² + ρ/2)
 *     gg → tt̄:  (1/(6τ₁τ₂) − 3/8)(τ₁² + τ₂² + ρ − ρ²/(4τ₁τ₂)) .
 * The angle-integrated cross-sections are σ̂(qq̄) = (8παs²/27ŝ)(1 + ρ/2)β and σ̂(gg) = (παs²/3ŝ)[(1 + ρ + ρ²/16) ln((1+β)/(1−β)) − β(7/4 + 31ρ/16)],
 which the tests compare with the integrated differential cross-section. Scales: αs and the parton densities at Q = mt (one-loop αs).
 The top quarks are produced on shell (the top width, 1.4 GeV, is neglected in the production).
 Decays: the W mass follows a Breit–Wigner (truncated), the W helicity fractions are the leading-order ones, F₀ = mt²/(mt² + 2mW²),
 F_L = 2mW²/(mt² + 2mW²), F_R = 0, and the lepton (or down-type quark) angle in the W rest frame follows the corresponding
 distribution (3/8)(1 ∓ cosθ)² F_L + (3/4) sin²θ F₀ + (3/8)(1 ± cosθ)² F_R. The spin correlation between the t and the t̄ is NOT modelled.
 The LO cross-section is about 60 % of the NNLO+NNLL value (831.8 pb at 13 TeV and mt = 172.5 GeV, Czakon and Mitov's Top++, quoted from
 memory: check before citing): use `kFactor`.
 */
import { GAMMA_W, M_T, M_W, alphaS1 } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import { particle } from '../particles/index.ts';
import type { Rng } from '../random/index.ts';
import { choice } from '../random/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { boost, fromMass } from '../kinematics/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { NPDF, addBeamsAndPartons, density, pdfAll } from './hadron.ts';
import { breitWignerMap, gaussLegendre, integrateMapped, powerMap } from './integrate.ts';
import { type Beams, type Process, addParticle, boostZ, decayAbout, decayIsotropic, makeMCProcess, newEvent, registerProcess } from './process.ts';

export type TopDecay = 'inclusive' | 'dilepton' | 'leptonjets' | 'hadronic';

/** σ̂(qq̄ → tt̄)/(αs²) in GeV⁻², for ŝ and the top mass m. */
export function sigmaHatQQ(s: number, m: number): number {
  const rho = (4 * m * m) / s;
  const beta = Math.sqrt(Math.max(0, 1 - rho));
  return ((8 * Math.PI) / (27 * s)) * (1 + rho / 2) * beta;
}
/** σ̂(gg → tt̄)/(αs²) in GeV⁻². */
export function sigmaHatGG(s: number, m: number): number {
  const rho = (4 * m * m) / s;
  const beta = Math.sqrt(Math.max(0, 1 - rho));
  if (beta === 0) return 0;
  return (Math.PI / (3 * s)) * ((1 + rho + (rho * rho) / 16) * Math.log((1 + beta) / (1 - beta)) - beta * (7 / 4 + (31 * rho) / 16));
}
/** Σ|M|²/g⁴ for qq̄ → tt̄ and gg → tt̄ at cosθ* (in the parton CM frame) for ŝ and mass m. */
export function topMatrixElements(s: number, m: number, c: number): { qq: number; gg: number } {
  const rho = (4 * m * m) / s;
  const beta = Math.sqrt(Math.max(0, 1 - rho));
  const t1 = (1 - beta * c) / 2, t2 = (1 + beta * c) / 2;
  return {
    qq: (4 / 9) * (t1 * t1 + t2 * t2 + rho / 2),
    gg: (1 / (6 * t1 * t2) - 3 / 8) * (t1 * t1 + t2 * t2 + rho - (rho * rho) / (4 * t1 * t2)),
  };
}

export interface TopOptions {
  decay?: TopDecay;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
  /** Top mass, GeV (default: the particle table). */
  mt?: number;
}

// W decay modes from the particle table (W⁺): [first product = charged-lepton-like antifermion... see below]
interface WMode {
  /** PDG codes of the W⁺ daughters: (ℓ⁺-like antifermion, partner). */
  plus: [number, number];
  br: number;
  leptonic: boolean;
  m: [number, number];
}
function wModes(): WMode[] {
  const W = particle(24);
  const modes: WMode[] = [];
  for (const d of W.decays) {
    const [p, q] = d.products as [number, number];
    // W⁺ → ℓ⁺ ν: products (−11, 12): lepton-like first. W⁺ → u d̄: products (2, −1): the down-type antiquark is lepton-like.
    const leptonic = Math.abs(p) >= 11;
    const plus: [number, number] = leptonic ? [p, q] : [q, p];
    // light quarks are treated as massless; charged leptons and charm keep their masses
    const massOf = (id: number) => (Math.abs(id) <= 3 ? 0 : particle(Math.abs(id)).mass);
    modes.push({ plus, br: d.br, leptonic, m: [massOf(plus[0]), massOf(plus[1])] });
  }
  const tot = modes.reduce((s, m) => s + m.br, 0);
  for (const m of modes) m.br /= tot;
  return modes;
}

/** Branching factor of the chosen decay channels (the cross-section includes it). */
export function topDecayBranching(decay: TopDecay): number {
  const modes = wModes();
  const lep = modes.filter((m) => m.leptonic && Math.abs(m.plus[0]) !== 15).reduce((s, m) => s + m.br, 0);
  const had = modes.filter((m) => !m.leptonic).reduce((s, m) => s + m.br, 0);
  switch (decay) {
    case 'inclusive': return 1;
    case 'dilepton': return lep * lep;
    case 'leptonjets': return 2 * lep * had;
    case 'hadronic': return had * had;
  }
}

interface TCtx {
  x1: number;
  x2: number;
  y: number;
  s: number;
  c: number;
  contrib: Float64Array;
}
const FL = [1, 2, 3, 4, 5];

export function ttbar(opt: TopOptions = {}): Process {
  const decay = opt.decay ?? 'inclusive';
  const mt = opt.mt ?? M_T;
  const beams: Beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  const brDecay = topDecayBranching(decay);
  const name = `${beams}->ttbar${decay === 'inclusive' ? '' : '->' + decay}`;
  const title = `${beams === 'pp' ? 'pp' : 'pp̄'} → tt̄${decay === 'dilepton' ? ' → dilepton' : decay === 'leptonjets' ? ' → ℓ+jets' : decay === 'hadronic' ? ' → all jets' : ''}`;
  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);
  const as = alphaS1(mt);
  const modes = wModes();

  /** contrib: [gg, then (q, orientation) × 10] ; c = null integrates analytically */
  const terms = (s: number, x1: number, x2: number, c: number | null, out: Float64Array): number => {
    pdfAll(x1, mt, f1);
    pdfAll(x2, mt, f2);
    const inv = 1 / (x1 * x2);
    const rho = (4 * mt * mt) / s;
    const beta = Math.sqrt(Math.max(0, 1 - rho));
    const pref = (Math.PI * as * as) / (s * s);
    const jac = (beta * s) / 2; // dt̂ = (β ŝ/2) dcosθ
    let gg: number, qq: number;
    if (c === null) {
      gg = sigmaHatGG(s, mt) * as * as;
      qq = sigmaHatQQ(s, mt) * as * as;
    } else {
      const me = topMatrixElements(s, mt, c);
      gg = pref * jac * me.gg;
      qq = pref * jac * me.qq;
    }
    const dgg = density(f1, 21, false) * density(f2, 21, anti) * inv;
    out[0] = dgg * gg;
    let sum = out[0]!;
    for (let i = 0; i < FL.length; i++) {
      const q = FL[i]!;
      const d0 = density(f1, q, false) * density(f2, -q, anti) * inv;
      const d1 = density(f1, -q, false) * density(f2, q, anti) * inv;
      out[1 + 2 * i] = d0 * qq;
      out[2 + 2 * i] = d1 * qq;
      sum += out[1 + 2 * i]! + out[2 + 2 * i]!;
    }
    return sum;
  };

  // ── decays ───────────────────────────────────────────────────────────────────────────────────────────────────
  const F0 = (mt * mt) / (mt * mt + 2 * M_W * M_W); // F_L = 1 − F₀ at leading order
  const mb = particle(5).mass;
  const wMap = breitWignerMap(M_W, GAMMA_W, 20 ** 2, (mt - mb - 1) ** 2);
  /** cosθ of the lepton-like daughter of W⁺ (sign = +1) or W⁻ (−1) in the W rest frame, relative to the W direction */
  const sampleCos = (r: Rng, sign: number): number => {
    const helicity = r() < F0 ? 0 : 1; // F_R = 0: the rest is left-handed
    for (;;) {
      const c = 2 * r() - 1;
      const w = helicity === 0 ? 1 - c * c : (1 - sign * c) ** 2 / 4; // both have maximum 1
      if (r() <= w) return c;
    }
  };

  const pickMode = (r: Rng, want: 'any' | 'lepton' | 'hadron'): WMode => {
    const pool = modes.filter((m) => (want === 'any' ? true : want === 'lepton' ? m.leptonic && Math.abs(m.plus[0]) !== 15 : !m.leptonic));
    return pool[choice(r, pool.map((m) => m.br))]!;
  };

  /**
   * Decay a top (sign +1) or antitop (−1) with lab momentum P: adds t → W b and the W decay to the record. `tag` is the colour of the top;
   * `wWant` selects the W decay class. Returns nothing; all particles are appended.
   */
  const decayTop = (ev: TruthEvent, r: Rng, idx: number, P: P4, sign: 1 | -1, tag: number, wWant: 'any' | 'lepton' | 'hadron', nextTag: { n: number }): void => {
    const rest: P4 = { E: mt, px: 0, py: 0, pz: 0 };
    const { x: mw2 } = wMap(r());
    const mW = Math.sqrt(mw2);
    const [Wt, bt] = decayIsotropic(r, rest, mW, mb); // in the top rest frame
    const pw = Math.hypot(Wt.px, Wt.py, Wt.pz);
    const axis: [number, number, number] = [Wt.px / pw, Wt.py / pw, Wt.pz / pw];
    const mode = pickMode(r, wWant);
    // W⁺: (lepton-like antifermion, partner); W⁻: charge conjugates, lepton-like = fermion
    const [pl, pn] = sign === 1 ? mode.plus : [-mode.plus[0], -mode.plus[1]];
    const c = sampleCos(r, sign);
    const phi = 2 * Math.PI * r();
    const [dl, dn] = decayAbout(Wt, mode.m[0], mode.m[1], axis, c, phi);
    const toLab = (p: P4): P4 => boost(p, P.px / P.E, P.py / P.E, P.pz / P.E);
    const W = addParticle(ev, sign === 1 ? 24 : -24, toLab(Wt), 'intermediate', [idx]);
    addParticle(ev, sign === 1 ? 5 : -5, toLab(bt), 'final', [idx], { colour: sign === 1 ? [tag, 0] : [0, tag] });
    if (mode.leptonic) {
      addParticle(ev, pl, toLab(dl), 'final', [W]);
      addParticle(ev, pn, toLab(dn), 'final', [W]);
    } else {
      const t1 = nextTag.n++;
      // the down-type (anti)quark and its partner share a colour line
      const colFor = (p: number, tg: number): [number, number] => (p > 0 ? [tg, 0] : [0, tg]);
      addParticle(ev, pl, toLab(dl), 'final', [W], { colour: colFor(pl, t1) });
      addParticle(ev, pn, toLab(dn), 'final', [W], { colour: colFor(pn, t1) });
    }
  };

  const spec = (sqrtS: number) => {
    const s = sqrtS * sqrtS;
    const lo = 4 * mt * mt * 1.000001;
    const smap = powerMap(2, lo, s * 0.9999);
    return {
      dim: 3,
      makeCtx: (): TCtx => ({ x1: 0, x2: 0, y: 0, s: 0, c: 0, contrib: new Float64Array(11) }),
      point(u: Float64Array, _s: number, ctx: TCtx): number {
        if (!(s > lo)) return 0;
        const { x: sh, jac } = smap(u[0]!);
        const tau = sh / s;
        const ymax = 0.5 * Math.log(1 / tau);
        const y = ymax * (2 * u[1]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) return 0;
        ctx.x1 = x1; ctx.x2 = x2; ctx.y = y; ctx.s = sh;
        ctx.c = 2 * u[2]! - 1;
        const sum = terms(sh, x1, x2, ctx.c, ctx.contrib);
        return (sum * jac * 2 * ymax * 2 * HBARC2_GEV2_PB * brDecay) / s;
      },
      build(ctx: TCtx, r: Rng, sq: number): TruthEvent {
        const k = choice(r, ctx.contrib);
        const ev = newEvent(title, sq);
        let pa: number, pb: number;
        let colA: [number, number], colB: [number, number], colT: [number, number], colTb: [number, number];
        let tagT = 101;
        if (k === 0) {
          pa = 21; pb = 21;
          colA = [101, 102];
          // which gluon the top attaches to: weights 1/τ₁ and 1/τ₂ (t-channel and u-channel quark exchange)
          const beta = Math.sqrt(1 - (4 * mt * mt) / ctx.s);
          const t1 = (1 - beta * ctx.c) / 2, t2 = (1 + beta * ctx.c) / 2;
          if (r() * (t1 * t1 + t2 * t2) < t2 * t2) {
            colB = [102, 103]; colT = [101, 0]; colTb = [0, 103];
          } else {
            colB = [103, 101]; colT = [103, 0]; colTb = [0, 102];
          }
          tagT = colT[0];
        } else {
          const q = FL[(k - 1) >> 1]!;
          const orient = (k - 1) & 1;
          pa = orient === 0 ? q : -q;
          pb = orient === 0 ? -q : q;
          const tg = (p: number) => (p > 0 ? 101 : 102);
          colA = pa > 0 ? [tg(pa), 0] : [0, tg(pa)];
          colB = pb > 0 ? [tg(pb), 0] : [0, tg(pb)];
          colT = [101, 0];
          colTb = [0, 102];
        }
        const [ia, ib] = addBeamsAndPartons(ev, beams, sq, pa, pb, ctx.x1, ctx.x2, colA, colB);
        // tops in the parton CM frame, boosted along z
        const sh = Math.sqrt(ctx.s);
        const beta = Math.sqrt(1 - (4 * mt * mt) / ctx.s);
        const p = (beta * sh) / 2;
        const sinT = Math.sqrt(Math.max(0, 1 - ctx.c * ctx.c));
        const phi = 2 * Math.PI * r();
        const t = fromMass(mt, p * sinT * Math.cos(phi), p * sinT * Math.sin(phi), p * ctx.c);
        const tb = fromMass(mt, -t.px, -t.py, -t.pz);
        const tLab = boostZ(t, ctx.y), tbLab = boostZ(tb, ctx.y);
        const it = addParticle(ev, 6, tLab, 'intermediate', [ia, ib], { colour: colT });
        const itb = addParticle(ev, -6, tbLab, 'intermediate', [ia, ib], { colour: colTb });
        // which decay classes (for the lepton + jets channel, which top decays leptonically is random)
        let wt: 'any' | 'lepton' | 'hadron' = 'any', wtb: 'any' | 'lepton' | 'hadron' = 'any';
        if (decay === 'dilepton') wt = wtb = 'lepton';
        else if (decay === 'hadronic') wt = wtb = 'hadron';
        else if (decay === 'leptonjets') [wt, wtb] = r() < 0.5 ? ['lepton', 'hadron'] : ['hadron', 'lepton'];
        const nextTag = { n: 110 };
        decayTop(ev, r, it, tLab, 1, tagT, wt, nextTag);
        decayTop(ev, r, itb, tbLab, -1, colTb[1], wtb, nextTag);
        return ev;
      },
    };
  };

  const cache = new Map<number, number>();
  const analytic = (sqrtS: number): number | undefined => {
    const hit = cache.get(sqrtS);
    if (hit !== undefined) return hit;
    const s = sqrtS * sqrtS;
    const lo = 4 * mt * mt * 1.000001;
    if (!(s > lo)) return 0;
    const smap = powerMap(2, lo, s * 0.9999);
    const gy = gaussLegendre(24);
    const out = new Float64Array(11);
    const total = integrateMapped(smap, 48, (u) => {
      const { x: sh, jac } = smap(u);
      const tau = sh / s;
      const ymax = 0.5 * Math.log(1 / tau);
      let inner = 0;
      for (let j = 0; j < gy.x.length; j++) {
        const y = ymax * (2 * gy.x[j]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) continue;
        inner += gy.w[j]! * terms(sh, x1, x2, null, out);
      }
      return jac * inner * 2 * ymax;
    });
    const v = (total * HBARC2_GEV2_PB * brDecay) / s;
    cache.set(sqrtS, v);
    return v;
  };
  return makeMCProcess<TCtx>({ name, title, beams, spec, analytic, kFactor: opt.kFactor });
}

registerProcess(['pp->ttbar', 'pp->tt'], () => ttbar());
registerProcess(['pp->ttbar->dilepton'], () => ttbar({ decay: 'dilepton' }));
registerProcess(['pp->ttbar->leptonjets'], () => ttbar({ decay: 'leptonjets' }));
registerProcess(['pp->ttbar->hadronic'], () => ttbar({ decay: 'hadronic' }));
registerProcess(['ppbar->ttbar'], () => ttbar({ beams: 'ppbar' }));
