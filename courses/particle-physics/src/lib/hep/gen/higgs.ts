/**
 * Higgs production by gluon fusion in the effective (infinite top mass) vertex, at leading order, with the Higgs decays
 * H → γγ, H → ZZ* → 4ℓ, H → bb̄, H → ττ and H → WW* → ℓνℓν treated at matrix-element level.
 *
 * Production: σ̂(gg → H) = (π/8) Γ(H → gg) Γ_H / ((ŝ − mH²)² + mH²Γ_H²), with Γ(H → gg) = αs² mH³/(72π³ v²) (the delta function
 * of the narrow-width limit, π²/(8mH) Γ_gg δ(ŝ − mH²), smeared into a Breit–Wigner of width Γ_H = 4.1 MeV). Scales: αs and the
 * parton densities at Q = mH. This is the LEADING-ORDER cross-section: the higher orders enhance it by a factor of about 3
 * (the recommended total at 13 TeV is 48.6 pb, from the LHC Higgs cross-section working group, quoted from memory: check before citing);
 * use `kFactor` or `kFactorFor` to apply it.
 *
 * Decays (branching fractions from the particle table, which the process cross-section includes):
 *  - γγ, bb̄, ττ: isotropic in the Higgs rest frame (spin 0);
 *  - ZZ* → 4ℓ (ℓ = e, μ; the two Z's decay to e⁺e⁻ or μ⁺μ⁻ independently, identical-particle interference is neglected) and
 *    WW* → ℓνℓν (ℓ = e, μ): the two boson masses follow the exact off-shell distribution
 *        dΓ ∝ λ^½(mH², m₁², m₂²) [ (mH² − m₁² − m₂²)² + 8 m₁² m₂² ] / ([(m₁² − M²)² + M²Γ²][(m₂² − M²)² + M²Γ²])
 *    (the heavier boson m₁ is near its pole; m₂ is cut at 4 GeV), and the decay angles carry the full spin correlations of a scalar
 *    decaying to two vector bosons through conserved massless currents:
 *        |M|² ∝ (c_L¹c_L² + c_R¹c_R²)(p₁⁻·p₂⁻)(p₁⁺·p₂⁺) + (c_L¹c_R² + c_R¹c_L²)(p₁⁻·p₂⁺)(p₁⁺·p₂⁻),
 *    with the fermion (ℓ⁻ or ν) labelled − and the antifermion + and c_L, c_R the squared chiral couplings of the Z to the lepton (W: left only).
 */
import { GAMMA_H, G_F, M_H, M_W, GAMMA_W, M_Z, GAMMA_Z, V_EW, alphaS1, zCouplings } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import { particle } from '../particles/index.ts';
import type { Rng } from '../random/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { dot, fromMass } from '../kinematics/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { NPDF, addBeamsAndPartons, density, pdfAll } from './hadron.ts';
import { breitWignerMap, gaussLegendre, integrateMapped, mixMap } from './integrate.ts';
import { type Beams, type Process, addParticle, boostZ, decayAbout, decayIsotropic, makeMCProcess, newEvent, registerProcess } from './process.ts';

export type HiggsDecay = 'none' | 'gammagamma' | 'ZZ4l' | 'bb' | 'tautau' | 'WWlnulnu';

/** Branching fraction of the process' decay, from the particle table (the lepton-flavour factors included for ZZ* → 4ℓ and WW* → ℓνℓν). */
export function higgsBranching(decay: HiggsDecay): number {
  const H = particle(25);
  const br = (a: number, b: number) => H.decays.find((d) => d.products[0] === a && d.products[1] === b)?.br ?? 0;
  switch (decay) {
    case 'none': return 1;
    case 'gammagamma': return br(22, 22);
    case 'bb': return br(5, -5);
    case 'tautau': return br(15, -15);
    case 'ZZ4l': {
      const Z = particle(23);
      const bll = Z.decays.find((d) => d.products[0] === 11)!.br + Z.decays.find((d) => d.products[0] === 13)!.br;
      return br(23, 23) * bll * bll;
    }
    case 'WWlnulnu': {
      const W = particle(24);
      const bl = W.decays.find((d) => d.products[0] === -11)!.br + W.decays.find((d) => d.products[0] === -13)!.br;
      return br(24, -24) * bl * bl;
    }
  }
}

// ── Decay samplers ─────────────────────────────────────────────────────────────────────────────────────────────
interface VV {
  M: number;
  Gamma: number;
  /** squared chiral couplings of the pair of decay products (Z: g_L², g_R² of the lepton; W: 1, 0) */
  c: [number, number];
  /** lower limit on the lighter boson mass */
  mLow: number;
}
const bwDen = (m2: number, M: number, G: number): number => 1 / ((m2 - M * M) ** 2 + M * M * G * G);
const lam = (a: number, b: number, c: number): number => a * a + b * b + c * c - 2 * a * b - 2 * a * c - 2 * b * c;

/** Sample the two boson masses of H → VV* and the decay of each into a massless fermion pair, with the spin correlations. */
function sampleHVV(r: Rng, mH: number, v: VV, scan: { max: number }): { Hframe: [P4, P4]; leptons: [P4, P4, P4, P4] } {
  const H: P4 = { E: mH, px: 0, py: 0, pz: 0 };
  const M = v.M, G = v.Gamma;
  const m1lo = Math.max(mH / 2, v.mLow), m1hi = mH - v.mLow;
  const map = breitWignerMap(M, G, m1lo * m1lo, m1hi * m1hi);
  const [cL, cR] = v.c;
  const A = cL * cL + cR * cR, B = 2 * cL * cR;
  for (let n = 0; n < 1e6; n++) {
    const { x: m1sq, jac } = map(r());
    const m1 = Math.sqrt(m1sq);
    const m2hi = mH - m1;
    if (m2hi <= v.mLow) continue;
    const m2 = v.mLow + (m2hi - v.mLow) * r();
    const m2sq = m2 * m2;
    const l = lam(mH * mH, m1sq, m2sq);
    if (l <= 0) continue;
    const D = Math.sqrt(l) * ((mH * mH - m1sq - m2sq) ** 2 + 8 * m1sq * m2sq) * bwDen(m1sq, M, G) * bwDen(m2sq, M, G);
    const w = D * jac * (m2hi - v.mLow);
    if (r() * scan.max > w) {
      if (w > scan.max) scan.max = w;
      continue;
    }
    if (w > scan.max) scan.max = w;
    const [V1, V2] = decayIsotropic(r, H, m1, m2);
    const [a1m, a1p] = decayIsotropic(r, V1, 0, 0);
    const [a2m, a2p] = decayIsotropic(r, V2, 0, 0);
    const X = dot(a1m, a2m) * dot(a1p, a2p), Y = dot(a1m, a2p) * dot(a1p, a2m);
    const bound = ((V1.E * V2.E) ** 2) / 4;
    // coupling combinations: same chirality (A/2 here for cL²… see the docs) and opposite chirality
    const W = (cL * cL + cR * cR) * X + 2 * cL * cR * Y;
    void A; void B;
    if (r() * (cL + cR) ** 2 * bound <= W) return { Hframe: [V1, V2], leptons: [a1m, a1p, a2m, a2p] };
  }
  throw new Error('H → VV*: no decay accepted');
}

/** Estimate the maximum of the importance-weighted mass density for a decay (grid scan; deterministic). */
function scanMax(mH: number, v: VV): { max: number } {
  const m1lo = Math.max(mH / 2, v.mLow), m1hi = mH - v.mLow;
  const map = breitWignerMap(v.M, v.Gamma, m1lo * m1lo, m1hi * m1hi);
  let mx = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const { x: m1sq, jac } = map((i + 0.5) / N);
    const m1 = Math.sqrt(m1sq);
    const m2hi = mH - m1;
    if (m2hi <= v.mLow) continue;
    for (let j = 0; j < 100; j++) {
      const m2 = v.mLow + (m2hi - v.mLow) * ((j + 0.5) / 100);
      const l = lam(mH * mH, m1sq, m2 * m2);
      if (l <= 0) continue;
      const D = Math.sqrt(l) * ((mH * mH - m1sq - m2 * m2) ** 2 + 8 * m1sq * m2 * m2) * bwDen(m1sq, v.M, v.Gamma) * bwDen(m2 * m2, v.M, v.Gamma);
      mx = Math.max(mx, D * jac * (m2hi - v.mLow));
    }
  }
  return { max: mx * 1.1 };
}

// ── gg → H ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface HiggsOptions {
  decay?: HiggsDecay;
  mH?: number;
  beams?: 'pp' | 'ppbar';
  kFactor?: number;
}
interface HCtx {
  x1: number;
  x2: number;
  y: number;
  m2: number;
}

export function higgsGGF(opt: HiggsOptions = {}): Process {
  const decay = opt.decay ?? 'none';
  const mH = opt.mH ?? M_H;
  const beams: Beams = opt.beams ?? 'pp';
  const anti = beams === 'ppbar';
  const br = higgsBranching(decay);
  const tag = { none: 'H', gammagamma: 'H->gammagamma', ZZ4l: 'H->ZZ->4l', bb: 'H->bb', tautau: 'H->tautau', WWlnulnu: 'H->WW->lnulnu' }[decay];
  const sym = { none: 'H', gammagamma: 'H → γγ', ZZ4l: 'H → ZZ* → 4ℓ', bb: 'H → bb̄', tautau: 'H → ττ', WWlnulnu: 'H → WW* → ℓνℓν' }[decay];
  const name = `${beams}->${tag}`;
  const title = `${beams === 'pp' ? 'pp' : 'pp̄'} → ${sym}`;
  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);
  const as = alphaS1(mH);
  const gammaGG = (as * as * mH ** 3) / (72 * Math.PI ** 3 * V_EW * V_EW);
  const sigmaHat = (m2: number) => ((Math.PI / 8) * gammaGG * GAMMA_H) / ((m2 - mH * mH) ** 2 + mH * mH * GAMMA_H * GAMMA_H) * br;

  const zc = zCouplings(11);
  const ZZ: VV = { M: M_Z, Gamma: GAMMA_Z, c: [zc.gL * zc.gL, zc.gR * zc.gR], mLow: 4 };
  const WW: VV = { M: M_W, Gamma: GAMMA_W, c: [1, 0], mLow: 4 };
  const scanZZ = decay === 'ZZ4l' ? scanMax(mH, ZZ) : { max: 0 };
  const scanWW = decay === 'WWlnulnu' ? scanMax(mH, WW) : { max: 0 };

  const window = 40;
  const lo = (mH - window) ** 2, hi = (mH + window) ** 2;
  const map = breitWignerMap(mH, GAMMA_H, lo, hi);

  const spec = (sqrtS: number) => {
    const s = sqrtS * sqrtS;
    return {
      dim: 2,
      makeCtx: (): HCtx => ({ x1: 0, x2: 0, y: 0, m2: 0 }),
      point(u: Float64Array, _s: number, ctx: HCtx): number {
        const { x: m2, jac } = map(u[0]!);
        const tau = m2 / s;
        if (tau >= 1) return 0;
        const ymax = 0.5 * Math.log(1 / tau);
        const y = ymax * (2 * u[1]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) return 0;
        ctx.x1 = x1; ctx.x2 = x2; ctx.y = y; ctx.m2 = m2;
        pdfAll(x1, mH, f1);
        pdfAll(x2, mH, f2);
        const lumi = (density(f1, 21, false) * density(f2, 21, anti)) / tau;
        return (lumi * sigmaHat(m2) * jac * 2 * ymax * HBARC2_GEV2_PB) / s;
      },
      build(ctx: HCtx, r: Rng, sq: number): TruthEvent {
        const ev = newEvent(title, sq);
        const [ia, ib] = addBeamsAndPartons(ev, beams, sq, 21, 21, ctx.x1, ctx.x2, [101, 102], [102, 101]);
        const m = Math.sqrt(ctx.m2);
        const Hp = boostZ({ E: m, px: 0, py: 0, pz: 0 }, ctx.y);
        if (decay === 'none') {
          addParticle(ev, 25, Hp, 'final', [ia, ib]);
          return ev;
        }
        const h = addParticle(ev, 25, Hp, 'intermediate', [ia, ib]);
        const toLab = (p: P4) => boostZ(p, ctx.y);
        const H0: P4 = { E: m, px: 0, py: 0, pz: 0 };
        switch (decay) {
          case 'gammagamma': {
            const [a, b] = decayIsotropic(r, H0, 0, 0);
            addParticle(ev, 22, toLab(a), 'final', [h]);
            addParticle(ev, 22, toLab(b), 'final', [h]);
            break;
          }
          case 'bb': {
            const mb = particle(5).mass;
            const [a, b] = decayIsotropic(r, H0, mb, mb);
            addParticle(ev, 5, toLab(a), 'final', [h], { colour: [103, 0] });
            addParticle(ev, -5, toLab(b), 'final', [h], { colour: [0, 103] });
            break;
          }
          case 'tautau': {
            const mt = particle(15).mass;
            const [a, b] = decayIsotropic(r, H0, mt, mt);
            addParticle(ev, 15, toLab(a), 'final', [h]);
            addParticle(ev, -15, toLab(b), 'final', [h]);
            break;
          }
          case 'ZZ4l': {
            const { Hframe, leptons } = sampleHVV(r, m, ZZ, scanZZ);
            const fl1 = r() < 0.5 ? 11 : 13, fl2 = r() < 0.5 ? 11 : 13;
            const z1 = addParticle(ev, 23, toLab(Hframe[0]), 'intermediate', [h]);
            const z2 = addParticle(ev, 23, toLab(Hframe[1]), 'intermediate', [h]);
            addParticle(ev, fl1, toLab(leptons[0]), 'final', [z1]);
            addParticle(ev, -fl1, toLab(leptons[1]), 'final', [z1]);
            addParticle(ev, fl2, toLab(leptons[2]), 'final', [z2]);
            addParticle(ev, -fl2, toLab(leptons[3]), 'final', [z2]);
            break;
          }
          case 'WWlnulnu': {
            const { Hframe, leptons } = sampleHVV(r, m, WW, scanWW);
            const fl1 = r() < 0.5 ? 11 : 13, fl2 = r() < 0.5 ? 11 : 13;
            // W⁻ → ℓ⁻ ν̄ (first boson), W⁺ → ν ℓ⁺ (second); "fermion" slots hold ℓ⁻ and ν
            const wm = addParticle(ev, -24, toLab(Hframe[0]), 'intermediate', [h]);
            const wp = addParticle(ev, 24, toLab(Hframe[1]), 'intermediate', [h]);
            addParticle(ev, fl1, toLab(leptons[0]), 'final', [wm]);
            addParticle(ev, -(fl1 + 1), toLab(leptons[1]), 'final', [wm]);
            addParticle(ev, fl2 + 1, toLab(leptons[2]), 'final', [wp]);
            addParticle(ev, -fl2, toLab(leptons[3]), 'final', [wp]);
            break;
          }
        }
        return ev;
      },
    };
  };

  const cache = new Map<number, number>();
  const analytic = (sqrtS: number): number | undefined => {
    const hit = cache.get(sqrtS);
    if (hit !== undefined) return hit;
    const s = sqrtS * sqrtS;
    const gy = gaussLegendre(24);
    const total = integrateMapped(map, 32, (u) => {
      const { x: m2, jac } = map(u);
      const tau = m2 / s;
      const ymax = 0.5 * Math.log(1 / tau);
      let inner = 0;
      for (let j = 0; j < gy.x.length; j++) {
        const y = ymax * (2 * gy.x[j]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) continue;
        pdfAll(x1, mH, f1);
        pdfAll(x2, mH, f2);
        inner += gy.w[j]! * ((density(f1, 21, false) * density(f2, 21, anti)) / tau);
      }
      return jac * sigmaHat(m2) * inner * 2 * ymax;
    });
    const v = (total * HBARC2_GEV2_PB) / s;
    cache.set(sqrtS, v);
    return v;
  };

  return makeMCProcess<HCtx>({ name, title, beams, spec, analytic, kFactor: opt.kFactor });
}

/** The K-factor that brings a process' cross-section at √s to a reference value in pb: reference / σ_LO. */
export function kFactorFor(process: Process, sqrtS: number, referencePb: number): number {
  return referencePb / process.sigma(sqrtS);
}

registerProcess(['pp->H'], () => higgsGGF({ decay: 'none' }));
registerProcess(['pp->H->gammagamma', 'pp->H->aa'], () => higgsGGF({ decay: 'gammagamma' }));
registerProcess(['pp->H->ZZ->4l', 'pp->H->4l'], () => higgsGGF({ decay: 'ZZ4l' }));
registerProcess(['pp->H->bb'], () => higgsGGF({ decay: 'bb' }));
registerProcess(['pp->H->tautau'], () => higgsGGF({ decay: 'tautau' }));
registerProcess(['pp->H->WW->lnulnu', 'pp->H->WW'], () => higgsGGF({ decay: 'WWlnulnu' }));
void G_F; void mixMap; void fromMass; void decayAbout;
