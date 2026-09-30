/**
 * A toy minimum-bias model for pile-up: the soft inelastic proton–proton collision.
 *
 * This is a parametrisation written for the course, not a tuned generator. The choices, and what they are based on:
 *  - Charged-particle density at mid-rapidity dNch/dη(0) = 6.0 at √s = 7 TeV, scaling as (√s/7 TeV)^0.23 (6.9 at 13 TeV). The 7 TeV value is the
 *    order of magnitude measured for inelastic collisions; the exponent is chosen, not fitted.
 *  - A plateau in η that falls at the edge like a Fermi function, centred at y_beam − 3.5 (y_beam = ln(√s/mp)) with width 1; particles are
 *    generated in |η| < etaMax (default 5.5, which covers the detectors of the course) and the multiplicity refers to that window.
 *  - The number of charged particles in the window follows a negative binomial distribution with mean ⟨Nch⟩ = dNch/dη(0) × ∫ plateau dη and
 *    shape parameter k = 2 (a width typical of hadron collisions, KNO-like scaling is not modelled).
 *  - pT from a power-law (Tsallis) shape p(pT) ∝ pT (1 + pT/a)^(−n), n = 7.5, with ⟨pT⟩ = 2a/(n − 3) = 0.50 GeV for pions, 0.75 GeV for kaons,
 *    0.90 GeV for protons (charged-particle average ≈ 0.55 GeV); azimuth uniform.
 *  - Species: charged pions 84 %, kaons 11 %, protons 5 % of the charged particles, produced as oppositely charged pairs (so the event has zero net
 *    charge and baryon number); π⁰ at half the number of charged pions, K_S and K_L at a quarter of the number of charged kaons each.
 *  - Momentum is NOT conserved (the beam remnants carry what is missing and are not recorded); all particles have status 'final' and no mothers.
 * The inelastic cross-section σ_inel(√s) = 72.5 mb + 9.7 mb × ln(√s/7 TeV) is an interpolation of the values of order 70–80 mb measured at 7–13 TeV,
 * good to about 5 %, used by the machine model to turn luminosity into pile-up.
 */
import { particle } from '../particles/index.ts';
import type { Rng } from '../random/index.ts';
import { normal, poisson } from '../random/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { fromMass } from '../kinematics/index.ts';
import { type Process, addParticle, newEvent, registerProcess } from './process.ts';

const MP = particle(2212).mass;
/** Mid-rapidity charged-particle density for √s in GeV. */
export function dNchDeta(sqrtS: number): number {
  return 6.0 * Math.pow(sqrtS / 7000, 0.23);
}
/** Inelastic pp cross-section in mb (see the header: an interpolation, ±5 %). */
export function sigmaInelMb(sqrtS: number): number {
  return 72.5 + 9.7 * Math.log(sqrtS / 7000);
}

/** The η profile: 1/(1 + exp((|η| − η_e)/w)), normalised to 1 at η = 0. */
function plateau(eta: number, sqrtS: number): number {
  const yb = Math.log(sqrtS / MP);
  return 1 / (1 + Math.exp((Math.abs(eta) - (yb - 3.5)) / 1.0));
}
/** Mean number of charged particles in |η| < etaMax. */
export function meanCharged(sqrtS: number, etaMax = 5.5): number {
  let s = 0;
  const n = 400;
  for (let i = 0; i < n; i++) s += plateau(-etaMax + ((i + 0.5) * 2 * etaMax) / n, sqrtS);
  return (dNchDeta(sqrtS) * s * 2 * etaMax) / n;
}

// Tsallis pT sampler by inverse CDF on a table (per scale a)
const N_TSALLIS = 7.5;
const tsallisTables = new Map<number, { x: Float64Array; cdf: Float64Array }>();
function tsallisTable(a: number) {
  let t = tsallisTables.get(a);
  if (t) return t;
  const n = 4000;
  const xmax = 40;
  const x = new Float64Array(n + 1), cdf = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const p = ((i + 0.5) / n) * xmax;
    x[i + 1] = ((i + 1) / n) * xmax;
    cdf[i + 1] = cdf[i]! + p * Math.pow(1 + p / a, -N_TSALLIS);
  }
  const tot = cdf[n]!;
  for (let i = 0; i <= n; i++) cdf[i] = cdf[i]! / tot;
  t = { x, cdf };
  tsallisTables.set(a, t);
  return t;
}
function samplePt(r: Rng, a: number): number {
  const { x, cdf } = tsallisTable(a);
  const u = r();
  let lo = 0, hi = cdf.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cdf[m]! <= u) lo = m;
    else hi = m;
  }
  const w = cdf[hi]! - cdf[lo]!;
  return x[lo]! + (w > 0 ? ((u - cdf[lo]!) / w) * (x[hi]! - x[lo]!) : 0);
}
/** Gamma(shape, scale) by Marsaglia–Tsang. */
function gamma(r: Rng, shape: number, scale: number): number {
  if (shape < 1) return gamma(r, shape + 1, scale) * Math.pow(r(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(r);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = r();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v * scale;
  }
}
/** Negative binomial with mean `mean` and shape k (gamma–Poisson mixture). */
export function negativeBinomial(r: Rng, mean: number, k: number): number {
  return poisson(r, gamma(r, k, mean / k));
}

// species: [pdg, mass, pT scale a]
const PION = { pdg: 211, m: particle(211).mass, a: 0.5 * (N_TSALLIS - 3) / 2 };
const KAON = { pdg: 321, m: particle(321).mass, a: 0.75 * (N_TSALLIS - 3) / 2 };
const PROTON = { pdg: 2212, m: particle(2212).mass, a: 0.9 * (N_TSALLIS - 3) / 2 };
const PI0 = { pdg: 111, m: particle(111).mass, a: PION.a };
const KS = { pdg: 310, m: particle(310).mass, a: KAON.a };
const KL = { pdg: 130, m: particle(130).mass, a: KAON.a };

export interface MinBiasOptions {
  /** Pseudorapidity window (default 5.5). */
  etaMax?: number;
  /** Shape parameter of the multiplicity distribution (default 2). */
  k?: number;
}

/** One minimum-bias collision as a truth event of final-state hadrons (charged π, K, p; π⁰, K_S, K_L) at the origin. */
export function minimumBiasEvent(r: Rng, sqrtS: number, opt: MinBiasOptions = {}): TruthEvent {
  const etaMax = opt.etaMax ?? 5.5;
  const ev = newEvent('minimum bias', sqrtS);
  const mean = meanCharged(sqrtS, etaMax);
  const nPairs = Math.round(negativeBinomial(r, mean, opt.k ?? 2) / 2);
  const emit = (sp: { pdg: number; m: number; a: number }, sign: number) => {
    // η by rejection from the plateau
    let eta: number;
    do eta = (2 * r() - 1) * etaMax;
    while (r() > plateau(eta, sqrtS));
    const pt = samplePt(r, sp.a);
    const phi = 2 * Math.PI * r() - Math.PI;
    const pz = pt * Math.sinh(eta);
    addParticle(ev, sign * sp.pdg, fromMass(sp.m, pt * Math.cos(phi), pt * Math.sin(phi), pz), 'final');
  };
  let nPi = 0, nK = 0;
  for (let i = 0; i < nPairs; i++) {
    const u = r();
    if (u < 0.84) {
      emit(PION, 1);
      emit(PION, -1);
      nPi++;
    } else if (u < 0.95) {
      emit(KAON, 1);
      emit(KAON, -1);
      nK++;
    } else {
      emit(PROTON, 1);
      emit(PROTON, -1);
    }
  }
  const nPi0 = poisson(r, nPi); // half of the 2·nPi charged pions
  for (let i = 0; i < nPi0; i++) emit(PI0, 1);
  const nKS = poisson(r, 0.5 * nK), nKL = poisson(r, 0.5 * nK); // a quarter of the 2·nK charged kaons each
  for (let i = 0; i < nKS; i++) emit(KS, 1);
  for (let i = 0; i < nKL; i++) emit(KL, 1);
  return ev;
}

/** The minimum-bias process: σ = σ_inel (pb), events from `minimumBiasEvent`. */
export function minimumBias(opt: MinBiasOptions = {}): Process {
  return {
    name: 'minbias',
    title: 'pp → minimum bias (soft inelastic)',
    beams: 'pp',
    sigma: (sqrtS) => sigmaInelMb(sqrtS) * 1e9,
    sigmaAnalytic: (sqrtS) => sigmaInelMb(sqrtS) * 1e9,
    weightedPoint: (_r, cfg) => sigmaInelMb(cfg.sqrtS) * 1e9,
    generate(r, cfg) {
      const event = minimumBiasEvent(r, cfg.sqrtS, opt);
      event.number = cfg.eventNumber ?? 0;
      event.weight = cfg.weighted ? sigmaInelMb(cfg.sqrtS) * 1e9 : 1;
      return { event, weight: event.weight };
    },
  };
}

registerProcess(['minbias', 'minimumbias'], () => minimumBias());
