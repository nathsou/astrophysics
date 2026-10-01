/**
 * A toy irreducible background for H → ZZ* → 4ℓ: q q̄ → Z Z* → 4ℓ (ℓ = e, μ) at leading order, in a window of the four-lepton mass.
 *
 * `hep/gen` has no ZZ continuum, and a Higgs peak with no background under it would teach the wrong thing, so this module builds one from
 * the same pieces the generator uses (`makeMCProcess`: a point specification that VEGAS integrates, and a record builder).
 *
 * Physics kept:
 *  - t- and u-channel quark exchange for massless quarks, colour-averaged, the Z couplings of the quark in the G_F scheme
 *    (e²/(sin²θ cos²θ) = 4√2 G_F m_Z²),
 *        dσ̂/dt = (2 G_F² m_Z⁴ / 3π ŝ²) (g_L⁴ + g_R⁴) F,
 *        F = t/u + u/t + 2 (m₁² + m₂²) ŝ /(t u) − m₁² m₂² (1/t² + 1/u²),
 *    which for m₁ = m₂ = m_Z is the textbook q q̄ → ZZ result and for m₂ = 0 that of q q̄ → Zγ;
 *    `zz.test.ts` checks F and the normalisation against an explicit Dirac trace for unequal masses;
 *  - both Z's are off-shell: each has the Breit–Wigner mass distribution of a Z that decays to e⁺e⁻ or μ⁺μ⁻, (1/π) m Γ_ℓℓ(m)/((m² − M²)² + M²Γ²)
 *    with Γ_ℓℓ(m) ∝ m (so the narrow-width limit gives the branching fraction 2 × 3.36 % = 6.7 % per Z), both masses above 4 GeV;
 *  - identical bosons: a factor ½ over the full (m₁, m₂) square; parton densities from `hep/gen`, at the scale Q = m₄ℓ.
 * Not kept: photon exchange and the Z/γ* interference (only Z's), the gluon-fusion gg → ZZ box, the spin correlations between the two
 * decays (each Z decays isotropically in its rest frame), and identical-lepton interference. The normalisation is leading order, so a real
 * calculation is larger by about 1.6 (the next-to-leading-order factor for qq̄ → ZZ is commonly quoted as 1.5–1.7; not verified here).
 */
import { G_F, GAMMA_Z, M_Z, zCouplings } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { fromMass } from '../kinematics/index.ts';
import { choice, type Rng } from '../random/index.ts';
import { NPDF, addBeamsAndPartons, density, massMap, pdfAll, quarkColour } from '../gen/hadron.ts';
import { makeMCProcess, addParticle, boostZ, decayIsotropic, newEvent, type Process } from '../gen/index.ts';
import { breitWignerMap, mixMap, powerMap, type Mapping } from '../gen/integrate.ts';

const QUARKS = [1, 2, 3, 4, 5];
const M_LOW = 4;

/** The squared-amplitude function F(ŝ, t, u, m₁², m₂²) of q q̄ → V₁V₂ by t- and u-channel exchange (see the header). */
export function zzForm(s: number, t: number, u: number, m1sq: number, m2sq: number): number {
  return t / u + u / t + (2 * (m1sq + m2sq) * s) / (t * u) - m1sq * m2sq * (1 / (t * t) + 1 / (u * u));
}

/** Källén function λ(a, b, c). */
const lam = (a: number, b: number, c: number): number => a * a + b * b + c * c - 2 * a * b - 2 * a * c - 2 * b * c;

/** dσ̂/dcosθ in GeV⁻² for one quark flavour (colour averaged, no decay factors): √λ/2 × dσ̂/dt, cosθ measured from the quark direction. */
export function dsigmaDcos(q: number, s: number, m1sq: number, m2sq: number, c: number): number {
  const l = lam(s, m1sq, m2sq);
  if (!(l > 0)) return 0;
  const sl = Math.sqrt(l);
  const t = m1sq - (s + m1sq - m2sq) / 2 + (sl / 2) * c;
  const u = m2sq - (s + m2sq - m1sq) / 2 - (sl / 2) * c;
  if (!(t < 0 && u < 0)) return 0;
  const g = zCouplings(q);
  const coupling = g.gL ** 4 + g.gR ** 4;
  const pref = (2 * G_F * G_F * M_Z ** 4) / (3 * Math.PI * s * s);
  return pref * coupling * zzForm(s, t, u, m1sq, m2sq) * (sl / 2);
}

/** The weight of a Z mass for decay to e⁺e⁻ or μ⁺μ⁻ (two flavours, each with the branching ratio at the pole), per unit m² (GeV⁻²). */
const BR_LL2 = 0.0336 * 2;
export const zMassDensity = (msq: number): number => (BR_LL2 / Math.PI) * (M_Z * GAMMA_Z) / ((msq - M_Z * M_Z) ** 2 + M_Z * M_Z * GAMMA_Z * GAMMA_Z);

interface ZZCtx {
  m4sq: number;
  y: number;
  m1sq: number;
  m2sq: number;
  c: number;
  x1: number;
  x2: number;
  contrib: Float64Array;
}

export interface ZZOptions {
  /** Window of the four-lepton mass, GeV (default 100–160). */
  lo?: number;
  hi?: number;
}

export function zzStarProcess(opt: ZZOptions = {}): Process {
  const lo = opt.lo ?? 100;
  const hi0 = opt.hi ?? 160;
  const name = 'pp->ZZ*->4l';
  const title = 'pp → ZZ* → 4ℓ (toy)';
  const f1 = new Float64Array(NPDF), f2 = new Float64Array(NPDF);
  const BRMIN = M_LOW * M_LOW;

  const spec = (sqrtS: number) => {
    const s = sqrtS * sqrtS;
    const hi = Math.min(hi0, sqrtS * 0.9999);
    const m4map = massMap(lo * lo, hi * hi, [], 1);
    const mzMax = (hi - M_LOW) ** 2;
    const zmap: Mapping = mixMap([
      { map: breitWignerMap(M_Z, GAMMA_Z, BRMIN, mzMax), weight: 0.5 },
      { map: powerMap(1, BRMIN, mzMax), weight: 0.5 },
    ]);
    return {
      dim: 5,
      makeCtx: (): ZZCtx => ({ m4sq: 0, y: 0, m1sq: 0, m2sq: 0, c: 0, x1: 0, x2: 0, contrib: new Float64Array(2 * QUARKS.length) }),
      point(u: Float64Array, _s: number, ctx: ZZCtx): number {
        if (!(hi > lo)) return 0;
        const { x: m4sq, jac: j0 } = m4map(u[0]!);
        const tau = m4sq / s;
        const ymax = 0.5 * Math.log(1 / tau);
        const y = ymax * (2 * u[1]! - 1);
        const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
        if (x1 >= 1 || x2 >= 1) return 0;
        const { x: m1sq, jac: j1 } = zmap(u[2]!);
        const { x: m2sq, jac: j2 } = zmap(u[3]!);
        const m4 = Math.sqrt(m4sq);
        if (Math.sqrt(m1sq) + Math.sqrt(m2sq) >= m4) return 0;
        const c = 2 * u[4]! - 1;
        ctx.m4sq = m4sq; ctx.y = y; ctx.m1sq = m1sq; ctx.m2sq = m2sq; ctx.c = c; ctx.x1 = x1; ctx.x2 = x2;
        pdfAll(x1, m4, f1);
        pdfAll(x2, m4, f2);
        const inv = 1 / (x1 * x2);
        let sum = 0;
        for (let i = 0; i < QUARKS.length; i++) {
          const q = QUARKS[i]!;
          const ds = dsigmaDcos(q, m4sq, m1sq, m2sq, c);
          const d0 = density(f1, q, false) * density(f2, -q, false) * inv * ds;
          const d1 = density(f1, -q, false) * density(f2, q, false) * inv * ds;
          ctx.contrib[2 * i] = d0;
          ctx.contrib[2 * i + 1] = d1;
          sum += d0 + d1;
        }
        // ½ for the two identical bosons, ∫ dcosθ = 2 u₄, dτ = dm²/s, ∫ dy = 2 y_max
        const dens = zMassDensity(m1sq) * zMassDensity(m2sq);
        return (0.5 * sum * dens * j0 * j1 * j2 * 2 * 2 * ymax * HBARC2_GEV2_PB) / s;
      },
      build(ctx: ZZCtx, r: Rng, sq: number): TruthEvent {
        const k = choice(r, ctx.contrib);
        const q = QUARKS[k >> 1]!;
        const orient = k & 1;
        const pa = orient === 0 ? q : -q, pb = orient === 0 ? -q : q;
        const ev = newEvent(title, sq);
        const [ia, ib] = addBeamsAndPartons(ev, 'pp', sq, pa, pb, ctx.x1, ctx.x2, quarkColour(pa, 101), quarkColour(pb, 101));
        const m4 = Math.sqrt(ctx.m4sq), m1 = Math.sqrt(ctx.m1sq), m2 = Math.sqrt(ctx.m2sq);
        // Z1 at polar angle θ from the quark direction (+z for orientation 0, −z for orientation 1), in the parton frame
        const kk = Math.sqrt(Math.max(0, lam(ctx.m4sq, ctx.m1sq, ctx.m2sq))) / (2 * m4);
        const c = orient === 0 ? ctx.c : -ctx.c;
        const sinT = Math.sqrt(Math.max(0, 1 - c * c));
        const phi = 2 * Math.PI * r();
        const z1 = fromMass(m1, kk * sinT * Math.cos(phi), kk * sinT * Math.sin(phi), kk * c);
        const z2 = fromMass(m2, -z1.px, -z1.py, -z1.pz);
        const z1L = boostZ(z1, ctx.y), z2L = boostZ(z2, ctx.y);
        const iz1 = addParticle(ev, 23, z1L, 'intermediate', [ia, ib]);
        const iz2 = addParticle(ev, 23, z2L, 'intermediate', [ia, ib]);
        for (const [zp, iz] of [[z1L, iz1], [z2L, iz2]] as const) {
          const fl = r() < 0.5 ? 11 : 13;
          const [lm, lp] = decayIsotropic(r, zp, 0, 0);
          addParticle(ev, fl, lm, 'final', [iz]);
          addParticle(ev, -fl, lp, 'final', [iz]);
        }
        return ev;
      },
    };
  };

  return makeMCProcess<ZZCtx>({ name, title, beams: 'pp', spec, iterations: 6, points: 4000 });
}
