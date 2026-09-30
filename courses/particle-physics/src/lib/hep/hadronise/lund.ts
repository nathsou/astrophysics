/**
 * The Lund string model for one two-ended string: breaking it iteratively into hadrons in its own rest frame.
 *
 * The string state is the remaining light-cone momentum (P⁺, P⁻, P_T) with P± = E ± pz along the string axis. Each break
 * creates a pair q q̄ (or diquark–antidiquark) with transverse momenta ±k drawn from a Gaussian; the hadron made of the
 * string end and the pair's member takes the fraction z of the remaining P⁺ (when broken from the quark end) or P⁻ (antiquark end),
 * with z from the Lund symmetric function f(z) ∝ (1/z)(1 − z)^a exp(−b m⊥²/z) (Peterson for c and b), and then p⁻ = m⊥²/p⁺.
 * Breaks alternate randomly between the two ends until the remaining string has mass below `stopMass`; the last one or
 * two hadrons are made from what is left.
 */
import { twoBodyDecay } from '../kinematics/index.ts';
import { normal, type Rng } from '../random/index.ts';
import { HBARC_GEV_FM } from '../units/index.ts';
import { defaultFlavour, hadronFor, hadronMass, lightestMass, pickLight, type FlavourParams } from './flavour.ts';

/** String tension κ in GeV² (≈ 1 GeV/fm: 0.2 GeV² × 0.1973 fm/GeV … i.e. κ = 0.2 GeV² = 1.01 GeV/fm). */
export const stringTension = 0.2;

export interface LundParams extends FlavourParams {
  /** Lund symmetric function exponent a. Pythia 8 default 0.68 (from memory, approximate). */
  a: number;
  /** Lund symmetric function b in GeV⁻². Pythia 8 default 0.98 (from memory, approximate). */
  b: number;
  /** Gaussian width of the pair transverse momentum (the pT² distribution is exp(−pT²/σ²), σ = 0.33 GeV, approximate). */
  sigma: number;
  /** Stop breaking when the remaining string mass falls below this (GeV). Pythia's default is about 1 GeV (from memory). */
  stopMass: number;
  /** Peterson parameters ε_c and ε_b (from memory: typical fitted values 0.05 and 0.005). */
  epsilonC: number;
  epsilonB: number;
}

export const defaultLund: LundParams = {
  ...defaultFlavour,
  a: 0.68,
  b: 0.98,
  sigma: 0.33,
  stopMass: 1.0,
  epsilonC: 0.05,
  epsilonB: 0.005,
};

/**
 * Sample z from the Lund symmetric function f(z) ∝ (1/z)(1 − z)^a exp(−b m⊥²/z) on (0, 1) by rejection in ln z:
 * with u = ln z the density is g(z) = (1 − z)^a exp(−c/z), c = b m⊥², which is bounded by its maximum at
 * a z² + c z − c = 0 and negligible below z ≈ c/8.
 */
export function sampleLundZ(rng: Rng, mT2: number, a: number, b: number): number {
  const c = b * mT2;
  const zStar = a > 0 ? (-c + Math.sqrt(c * c + 4 * a * c)) / (2 * a) : 1;
  const M = Math.pow(1 - Math.min(zStar, 1 - 1e-12), a) * Math.exp(-c / zStar);
  const z0 = Math.min(c / 8, 0.9);
  const lz0 = Math.log(z0);
  for (let i = 0; i < 1000; i++) {
    const z = Math.exp(lz0 * rng());
    if (rng() * M <= Math.pow(1 - z, a) * Math.exp(-c / z)) return z;
  }
  return zStar;
}

const petersonTables = new Map<number, Float64Array>();
const PT_N = 1000;
function petersonCdf(eps: number): Float64Array {
  let t = petersonTables.get(eps);
  if (t) return t;
  t = new Float64Array(PT_N + 1);
  for (let i = 0; i < PT_N; i++) {
    const z = (i + 0.5) / PT_N;
    const D = 1 - 1 / z - eps / (1 - z);
    t[i + 1] = t[i]! + 1 / (z * D * D);
  }
  const tot = t[PT_N]!;
  for (let i = 0; i <= PT_N; i++) t[i] = t[i]! / tot;
  petersonTables.set(eps, t);
  return t;
}
/** Peterson fragmentation function f(z) ∝ 1/(z (1 − 1/z − ε/(1 − z))²), sampled from a tabulated cumulative. */
export function samplePeterson(rng: Rng, eps: number): number {
  const cdf = petersonCdf(eps);
  const u = rng();
  let lo = 0, hi = PT_N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid]! <= u) lo = mid;
    else hi = mid;
  }
  const w = cdf[hi]! - cdf[lo]!;
  return (lo + (w > 0 ? (u - cdf[lo]!) / w : 0.5)) / PT_N;
}

/** A hadron made in the string's rest frame, with light-cone momentum along the string axis. */
export interface FragHadron {
  pdg: number;
  mass: number;
  /** p⁺ = E + pz and p⁻ = E − pz along the axis (quark end at +z), GeV. */
  pp: number;
  pm: number;
  px: number;
  py: number;
  /** The flavour of the pair created at the break on this hadron's inner side (quark id, or 10·q1 + q2 for a diquark pair); 0 if none. */
  pair: number;
  /** 0: made from the quark end, 1: from the antiquark end, 2: final hadron(s). */
  side: 0 | 1 | 2;
}

export interface StringFragmentation {
  /** Hadrons ordered along the string from the quark end to the antiquark end. */
  hadrons: FragHadron[];
  /** Flavour code of the pair created between hadron k and k + 1 (length hadrons.length − 1; 0 if unknown). */
  breaks: number[];
  /** Sum of the hadron masses. */
  sumMass: number;
}

const pairCode = (x: readonly number[]): number => (x.length === 1 ? Math.abs(x[0]!) : 10 * Math.max(Math.abs(x[0]!), Math.abs(x[1]!)) + Math.min(Math.abs(x[0]!), Math.abs(x[1]!)));

/** The lowest mass a remnant string with these ends can have: a single hadron if one exists, otherwise the lightest two-hadron split. */
export function minRemnantMass(A: readonly number[], B: readonly number[]): number {
  const ck = contentKey(A) * 1e8 + contentKey(B);
  let v = remnantCache.get(ck);
  if (v !== undefined) return v;
  const one = lightestMass(A.concat(B));
  if (Number.isFinite(one)) v = one;
  else {
    let best = Infinity;
    for (const x of [1, 2, 3]) best = Math.min(best, lightestMass(A.concat([-x])) + lightestMass([x].concat(B)));
    v = Number.isFinite(best) ? best : 0.6;
  }
  remnantCache.set(ck, v);
  return v;
}
const remnantCache = new Map<number, number>();
const contentKey = (c: readonly number[]): number => {
  let key = 0;
  for (let i = 0; i < c.length; i++) key += Math.pow(6, c[i]! > 0 ? c[i]! - 1 : 4 - c[i]!);
  return key;
};

/**
 * Break a string of rest-frame energy W, with a quark-type end `leftEnd` and an antiquark-type end `rightEnd`, into
 * hadrons. An end is a content: [q] (a quark, q > 0), [−q] (an antiquark), or two same-sign flavours (a diquark or
 * antidiquark). The hadrons' momenta are given in the string frame with the quark end along +z. They are *not* yet
 * exactly consistent with the total: the caller rescales (see `hadronise`). If the string is too light for any hadron of the
 * right flavour the lightest available is made anyway and the caller must check `sumMass` against W.
 */
export function fragmentString(rng: Rng, W: number, leftEnd: readonly number[], rightEnd: readonly number[], par: LundParams = defaultLund): StringFragmentation {
  const left: FragHadron[] = [];
  const right: FragHadron[] = [];
  let Pp = W, Pm = W, Px = 0, Py = 0;
  let A: readonly number[] = leftEnd;
  let B: readonly number[] = rightEnd;
  let kAx = 0, kAy = 0, kBx = 0, kBy = 0;
  const sig = par.sigma / Math.SQRT2;
  const stop2 = par.stopMass * par.stopMass;
  for (let iter = 0; iter < 80; iter++) {
    const M2 = Pp * Pm - Px * Px - Py * Py;
    if (M2 < stop2) break;
    const side = rng() < 0.5 ? 0 : 1;
    const old = side === 0 ? A : B;
    let done = false;
    for (let attempt = 0; attempt < 10 && !done; attempt++) {
      // flavour of the new pair
      let newEnd: number[];
      let code: number;
      if (old.length === 1 && rng() < par.probDiquark) {
        const q1 = pickLight(rng, par), q2 = pickLight(rng, par);
        newEnd = side === 0 ? [-q1, -q2] : [q1, q2];
        code = pairCode(newEnd);
      } else {
        const q = pickLight(rng, par);
        newEnd = side === 0 ? [q] : [-q];
        code = q;
      }
      const content = old.concat(newEnd.map((x) => -x));
      const pdg = hadronFor(content, rng, par);
      if (pdg === 0) continue;
      const m = hadronMass(pdg, rng);
      const kx = normal(rng, 0, sig), ky = normal(rng, 0, sig);
      const hpx = (side === 0 ? kAx : kBx) - kx;
      const hpy = (side === 0 ? kAy : kBy) - ky;
      const mT2 = m * m + hpx * hpx + hpy * hpy;
      const heavy = old.length === 1 && Math.abs(old[0]!) >= 4;
      const lm = minRemnantMass(side === 0 ? newEnd : A, side === 0 ? B : newEnd);
      for (let zt = 0; zt < 8; zt++) {
        const z = heavy ? samplePeterson(rng, Math.abs(old[0]!) === 4 ? par.epsilonC : par.epsilonB) : sampleLundZ(rng, mT2, par.a, par.b);
        let pp: number, pm: number;
        if (side === 0) {
          pp = z * Pp;
          pm = mT2 / pp;
        } else {
          pm = z * Pm;
          pp = mT2 / pm;
        }
        const nPp = Pp - pp, nPm = Pm - pm, nPx = Px - hpx, nPy = Py - hpy;
        if (!(nPp > 0) || !(nPm > 0)) continue;
        const nM2 = nPp * nPm - nPx * nPx - nPy * nPy;
        if (!(nM2 > lm * lm)) continue;
        const h: FragHadron = { pdg, mass: m, pp, pm, px: hpx, py: hpy, pair: code, side };
        (side === 0 ? left : right).push(h);
        Pp = nPp; Pm = nPm; Px = nPx; Py = nPy;
        if (side === 0) {
          A = newEnd;
          kAx = kx; kAy = ky;
        } else {
          B = newEnd;
          kBx = kx; kBy = ky;
        }
        done = true;
        break;
      }
    }
    if (!done) break;
  }
  // The remaining string becomes one or two hadrons.
  const fin: FragHadron[] = [];
  const M2 = Math.max(0, Pp * Pm - Px * Px - Py * Py);
  const M = Math.sqrt(M2);
  const Er = (Pp + Pm) / 2, pzr = (Pp - Pm) / 2;
  let made = false;
  const lightest: LundParams = { ...par, vectorFraction: 0, decupletFraction: 0 };
  for (let attempt = 0; attempt < 10 && !made; attempt++) {
    const x = pickLight(rng, par);
    const ca = A.concat([-x]), cb = [x].concat(B);
    // a quick bound before drawing species and masses: the lightest hadrons of these contents must fit
    if (!(lightestMass(ca) + lightestMass(cb) <= M)) continue;
    // after a couple of failures, fall back on the pseudoscalar mesons and the octet baryons, which are lighter
    const pp = attempt < 2 ? par : lightest;
    const c1 = hadronFor(ca, rng, pp);
    const c2 = hadronFor(cb, rng, pp);
    if (c1 === 0 || c2 === 0) continue;
    const m1 = hadronMass(c1, rng), m2 = hadronMass(c2, rng);
    if (M < m1 + m2) continue;
    const [d1, d2] = twoBodyDecay(rng, { E: Er, px: Px, py: Py, pz: pzr }, m1, m2);
    // the member with the larger pz goes on the quark side
    const [u, v, pu, pv, mu, mv] = d1.pz >= d2.pz ? [d1, d2, c1, c2, m1, m2] : [d2, d1, c2, c1, m2, m1];
    fin.push({ pdg: pu, mass: mu, pp: u.E + u.pz, pm: u.E - u.pz, px: u.px, py: u.py, pair: x, side: 2 });
    fin.push({ pdg: pv, mass: mv, pp: v.E + v.pz, pm: v.E - v.pz, px: v.px, py: v.py, pair: 0, side: 2 });
    made = true;
  }
  if (!made) {
    const one = hadronFor(A.concat(B), rng, par);
    if (one !== 0) {
      const m = hadronMass(one, rng);
      const E = Math.sqrt(m * m + Px * Px + Py * Py + pzr * pzr);
      fin.push({ pdg: one, mass: m, pp: E + pzr, pm: E - pzr, px: Px, py: Py, pair: 0, side: 2 });
    } else {
      // No single hadron and no two-hadron split that fits (for example a b c̄ string end): take the lightest two-hadron
      // split with a u ū pair regardless of the kinematics; the caller's rescaling decides whether that is feasible.
      const c1 = hadronFor(A.concat([-2]), rng, lightest), c2 = hadronFor([2].concat(B), rng, lightest);
      const hs: [number, number][] = [];
      if (c1 !== 0) hs.push([c1, hadronMass(c1, rng)]);
      if (c2 !== 0) hs.push([c2, hadronMass(c2, rng)]);
      for (const [pdg, m] of hs) {
        const f = 1 / hs.length;
        const px = Px * f, py = Py * f, pz = pzr * f;
        const E = Math.sqrt(m * m + px * px + py * py + pz * pz);
        fin.push({ pdg, mass: m, pp: E + pz, pm: E - pz, px, py, pair: fin.length === 0 ? 2 : 0, side: 2 });
      }
    }
  }
  const hadrons = left.concat(fin, right.reverse());
  const breaks: number[] = [];
  for (let k = 0; k + 1 < hadrons.length; k++) {
    const a = hadrons[k]!, b = hadrons[k + 1]!;
    // The pair of a break is recorded on the hadron created with it: the one on its inner side.
    breaks.push(a.side === 1 || (a.side === 2 && b.side === 1) ? b.pair : a.pair);
  }
  let sumMass = 0;
  for (const h of hadrons) sumMass += h.mass;
  return { hadrons, breaks, sumMass };
}

// ── The string picture: potential energy and breaking ────────────────────────────────────────────────────────────

export interface StringBreakingResult {
  /** Separation of the quarks, fm. */
  distanceFm: number;
  /** Potential energy V = κ r stored in the string, GeV. */
  potentialGeV: number;
  /** Energy needed to make a light q q̄ pair, 2 m⊥ in GeV (constituent mass 0.33 GeV, typical pT 0.33 GeV: 2√(0.33² + 0.23²) ≈ 0.8 GeV). */
  pairThresholdGeV: number;
  /** Separation at which V reaches the threshold, fm. */
  thresholdFm: number;
  /** Expected number of breaks while the string was stretched to this length (Schwinger tunnelling, see README). */
  expectedBreaks: number;
  /** Probability that the string has broken at least once, 1 − exp(−expectedBreaks). */
  probability: number;
  /** Probability that it has broken, for an s s̄ pair. */
  probabilityStrange: number;
}

export interface StringBreakingOptions {
  /** String tension in GeV². Default `stringTension`. */
  kappa?: number;
  /** Transverse mass m⊥ of the light quark in GeV. Default 0.4 (constituent mass 0.33 and mean pT of the pair). */
  mT?: number;
  /** m⊥ of the strange quark in GeV. Default 0.55. */
  mTStrange?: number;
}

/**
 * The string picture for a pulled-apart q q̄ pair. Potential energy V = κ r (κ = 0.2 GeV² ≈ 1 GeV/fm). A pair can materialise
 * in the field only if V > 2 m⊥, and then it tunnels with the Schwinger rate per unit length and time
 * w = (κ/2π) exp(−π m⊥²/κ) (for fermions in 1 + 1 dimensions, leading term). Pulling the ends apart at the speed of light
 * to separation r takes time r, so the expected number of breaks is N(r) = w · r_eff · r where r_eff = r − r₀ is the
 * length that exceeds the threshold r₀ = 2 m⊥/κ (no breaks below it), in natural units (1 fm = 1/0.1973 GeV⁻¹), and the
 * probability is 1 − e^(−N). This is a one-line estimate for a widget, not a tuned quantity.
 */
export function stringBreaking(distanceFm: number, opts: StringBreakingOptions = {}): StringBreakingResult {
  const kappa = opts.kappa ?? stringTension;
  const mT = opts.mT ?? 0.4;
  const mTs = opts.mTStrange ?? 0.55;
  const r = Math.max(0, distanceFm);
  const V = kappa * (r / HBARC_GEV_FM); // GeV² · GeV⁻¹
  const thr = 2 * mT;
  const rThr = (thr / kappa) * HBARC_GEV_FM;
  const expected = (mTx: number): number => {
    const r0 = (2 * mTx) / kappa; // GeV⁻¹
    const L = Math.max(0, r / HBARC_GEV_FM - r0);
    const w = (kappa / (2 * Math.PI)) * Math.exp((-Math.PI * mTx * mTx) / kappa);
    return w * L * (r / HBARC_GEV_FM);
  };
  const N = expected(mT);
  return {
    distanceFm: r,
    potentialGeV: V,
    pairThresholdGeV: thr,
    thresholdFm: rThr,
    expectedBreaks: N,
    probability: 1 - Math.exp(-N),
    probabilityStrange: 1 - Math.exp(-expected(mTs)),
  };
}

// ── Snapshot of a string (for the widget) ─────────────────────────────────────────────────────────────────────────

export interface StringBreakPoint {
  /** Index k: the break between hadron k and hadron k + 1 along the string. */
  k: number;
  /** Light-cone coordinates x⁺ = t + z and x⁻ = t − z of the break in fm (string at rest, κ = `stringTension`). */
  xPlus: number;
  xMinus: number;
  /** Time and position of the break, fm (t = (x⁺ + x⁻)/2, z = (x⁺ − x⁻)/2), in the string's rest frame with the quark end at +z. */
  t: number;
  z: number;
  /** Flavour of the pair created there: a quark id (1 = d, 2 = u, 3 = s, …), or 10·q1 + q2 for a diquark–antidiquark pair; 0 if unknown. */
  pair: number;
}

export interface StringSnapshot {
  /** Rest-frame energy of the string, GeV. */
  W: number;
  kappa: number;
  /** Hadron PDG IDs in order along the string, quark end first. */
  hadrons: number[];
  /** Index of each hadron's truth particle in the event (empty when simulated stand-alone). */
  truth: number[];
  /** Light-cone momenta of the hadrons in the string frame, GeV. */
  pPlus: number[];
  pMinus: number[];
  breaks: StringBreakPoint[];
}

/** Break points of a fragmented string: vertex k has x⁺ = (W − Σ_{j ≤ k} p⁺_j)/κ and x⁻ = Σ_{j ≤ k} p⁻_j/κ. */
export function snapshotOf(W: number, fr: StringFragmentation, truth: number[] = [], kappa = stringTension): StringSnapshot {
  const pp = fr.hadrons.map((h) => h.pp), pm = fr.hadrons.map((h) => h.pm);
  const breaks: StringBreakPoint[] = [];
  let sp = 0, sm = 0;
  for (let k = 0; k + 1 < fr.hadrons.length; k++) {
    sp += pp[k]!;
    sm += pm[k]!;
    const xp = ((W - sp) / kappa) * HBARC_GEV_FM, xm = (sm / kappa) * HBARC_GEV_FM;
    breaks.push({ k, xPlus: xp, xMinus: xm, t: (xp + xm) / 2, z: (xp - xm) / 2, pair: fr.breaks[k] ?? 0 });
  }
  return { W, kappa, hadrons: fr.hadrons.map((h) => h.pdg), truth, pPlus: pp, pMinus: pm, breaks };
}

/**
 * Fragment a stand-alone q q̄ string of energy W (GeV) with a quark of flavour `quark` (PDG ID 1–5) and return its
 * snapshot, for a widget that draws the breaking without building an event. The momenta are not rescaled.
 */
export function simulateString(rng: Rng, W: number, quark = 2, par: LundParams = defaultLund): StringSnapshot {
  const fr = fragmentString(rng, W, [quark], [-quark], par);
  return snapshotOf(W, fr);
}
