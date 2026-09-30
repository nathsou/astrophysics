/**
 * A cartoon of string breaking and hadronisation. It is deliberately simple and is not the course's hadronisation model
 * (`hep/hadronise` is separate); it is self-contained, seeded and conserves energy and momentum, so the widget's accounting
 * is an exact statement about the model.
 *
 * 1. `StringModel`: a quark and an antiquark pulled apart in one space dimension (the "yo-yo" picture of the Lund model).
 *    The colour flux between them is a tube with constant energy per unit length κ (about 1 GeV/fm). A parton feels a constant
 *    force κ towards the parton it is joined to (dp/dt = ±κ, with relativistic motion dz/dt = p/E). Whenever a string piece is
 *    longer than d = 2m/κ it may break: a quark–antiquark pair of mass m appears, at rest, with the gap d between them. The
 *    string energy κd that disappears equals the 2m of rest mass that appears, so
 *        work by the reader + initial string energy = kinetic energy of the free quarks + string energy + created rest mass
 *    holds at all times. The probability per unit time of a break is γ·Σ_f w_f (L − d_f), with the Schwinger-like flavour weight
 *    w_f = exp(−π m_f²/κ), so heavier quarks are suppressed.
 *
 * 2. `fragment`: the string of a quark–antiquark pair with total energy √s in its centre of mass, split into pseudoscalar mesons by
 *    the Lund recipe in light-cone variables: each meson takes a fraction z of the remaining p⁺ with the symmetric Lund
 *    distribution f(z) ∝ z⁻¹ (1−z)^a exp(−b m⊥²/z), a Gaussian transverse momentum comes with each new pair, and the last two
 *    mesons share what is left. The rapidity distribution comes out flat (the "plateau") with a length of about ln(s/m⊥²).
 *    Energy, momentum and charge are conserved exactly.
 *
 * Lengths in fm, energies and masses in GeV, times in fm/c (c = 1). κ in GeV/fm: 1 GeV/fm = 0.1973 GeV² (ħc = 0.1973 GeV fm).
 */
import { HBARC_GEV_FM } from './constants.ts';
import { acceptReject, choice, normal, type Rng } from '../random/index.ts';
import { twoBodyDecay, type P4 } from '../kinematics/index.ts';

export type Flavour = 'u' | 'd' | 's';
/** The string tension: about 0.9 GeV/fm (0.18 GeV²). */
export const KAPPA_GEV_FM = 0.9;
/** Coupling used for the short-distance Coulomb-like term of the Cornell potential. */
export const ALPHA_S_CORNELL = 0.3;

export interface StringParams {
  /** String tension, GeV/fm. */
  kappa: number;
  /** Effective masses in GeV of the created quarks (constituent-like: a cartoon value, not a measured one). */
  mass: Record<Flavour, number>;
  /** Break rate per unit length per unit time, fm⁻² (c = 1): sets how far past threshold a string typically stretches. */
  gamma: number;
}
export const defaultStringParams = (): StringParams => ({ kappa: KAPPA_GEV_FM, mass: { u: 0.3, d: 0.3, s: 0.45 }, gamma: 1.5 });

/** The Cornell potential V(r) = −(4/3) α_s ħc/r + κ r, in GeV, r in fm. */
export function cornellPotential(rFm: number, kappa = KAPPA_GEV_FM, alphaS = ALPHA_S_CORNELL): number {
  return (-(4 / 3) * alphaS * HBARC_GEV_FM) / rFm + kappa * rFm;
}
/** The force between the pair, −dV/dr (negative = attractive), in GeV/fm. */
export function cornellForce(rFm: number, kappa = KAPPA_GEV_FM, alphaS = ALPHA_S_CORNELL): number {
  return -(((4 / 3) * alphaS * HBARC_GEV_FM) / (rFm * rFm) + kappa);
}
/** The Coulomb attraction between an electron and a positron, in GeV/fm (negative = attractive). */
export function coulombForce(rFm: number, alpha = 1 / 137.035999): number {
  return -(alpha * HBARC_GEV_FM) / (rFm * rFm);
}
/** The distance at which the stored string energy κ r reaches 2m: where a pair of mass m can first appear. */
export function thresholdLength(m: number, kappa = KAPPA_GEV_FM): number {
  return (2 * m) / kappa;
}

export interface Parton {
  id: number;
  flavour: Flavour;
  /** true for an antiquark. */
  anti: boolean;
  z: number;
  /** Momentum along z, GeV. */
  p: number;
  m: number;
  /** Held by the reader (only the two original partons). */
  held: boolean;
}
/** A string piece joining a quark and an antiquark (ids of partons). */
export interface Piece {
  q: number;
  qbar: number;
}
export interface BreakEvent {
  t: number;
  /** Where the new pair appeared (centre), fm. */
  z: number;
  flavour: Flavour;
  /** Length of the gap in which the field energy disappeared, fm. */
  gap: number;
  /** Length of the piece that broke, fm. */
  pieceLength: number;
}
export interface Budget {
  /** Work done by the reader plus the energy stored in the string at the start. */
  input: number;
  /** Kinetic energy (E − m) of the free partons. */
  kinetic: number;
  /** κ × total string length. */
  string: number;
  /** Rest mass of the created quarks. */
  created: number;
  /** input − (kinetic + string + created). */
  residual: number;
}

const V_END = 0.9; // the reader's hands move at most at 0.9 c

export class StringModel {
  readonly params: StringParams;
  readonly rng: Rng;
  partons: Parton[] = [];
  pieces: Piece[] = [];
  breaks: BreakEvent[] = [];
  t = 0;
  /** Work done by the reader on the ends. */
  work = 0;
  created = 0;
  private nextId = 0;
  private r0: number;
  private target: [number, number];

  /** Start with the pair `r0` fm apart, centred on z = 0; the flavour of the original pair is u. */
  constructor(params: StringParams, rng: Rng, r0 = 0.3, flavour: Flavour = 'u') {
    this.params = params;
    this.rng = rng;
    this.r0 = r0;
    this.target = [-r0 / 2, r0 / 2];
    const q = this.add(flavour, false, -r0 / 2, 0, true);
    const qb = this.add(flavour, true, r0 / 2, 0, true);
    this.pieces.push({ q: q.id, qbar: qb.id });
  }

  private add(flavour: Flavour, anti: boolean, z: number, p: number, held = false): Parton {
    const pt: Parton = { id: this.nextId++, flavour, anti, z, p, m: this.params.mass[flavour], held };
    this.partons.push(pt);
    return pt;
  }
  private get(id: number): Parton {
    return this.partons.find((x) => x.id === id)!;
  }
  /** The two held partons (left and right ends, initially the quark on the left). */
  ends(): [Parton, Parton] {
    return [this.partons[0]!, this.partons[1]!];
  }
  /** The separation of the two held ends. */
  separation(): number {
    const [a, b] = this.ends();
    return Math.abs(b.z - a.z);
  }
  /** Ask the reader's hands to go to these positions (they move at up to 0.9 c). */
  setTarget(zLeft: number, zRight: number): void {
    this.target = [zLeft, zRight];
  }
  /** Ask for a total separation r, symmetric about z = 0. */
  setSeparation(r: number): void {
    this.setTarget(-r / 2, r / 2);
  }
  private partnerOf(id: number): Parton {
    for (const pc of this.pieces) {
      if (pc.q === id) return this.get(pc.qbar);
      if (pc.qbar === id) return this.get(pc.q);
    }
    throw new Error('parton without a string piece');
  }

  /** Advance by `dt` fm/c in sub-steps of at most `h`. Returns the breaks that happened. */
  advance(dt: number, h = 0.004): BreakEvent[] {
    const out: BreakEvent[] = [];
    let left = dt;
    while (left > 1e-12) {
      const s = Math.min(h, left);
      left -= s;
      this.substep(s, out);
    }
    return out;
  }

  /** Position after time τ under a constant force F (exact relativistic motion), without changing the parton. */
  private static zAfter(pt: Parton, F: number, tau: number): number {
    if (F === 0) return pt.z;
    return pt.z + (Math.hypot(pt.m, pt.p + F * tau) - Math.hypot(pt.m, pt.p)) / F;
  }

  private substep(h: number, out: BreakEvent[]): void {
    const k = this.params.kappa;
    // How far each hand will move in this step (they go towards the targets at up to 0.9 c).
    const hand = new Map<number, number>();
    const ends = this.ends();
    for (let i = 0; i < 2; i++) hand.set(ends[i]!.id, Math.max(-V_END * h, Math.min(V_END * h, this.target[i]! - ends[i]!.z)));
    // Every parton belongs to exactly one piece, so the motion is done piece by piece. A free parton feels a constant force κ
    // towards its partner; if the two cross during the step (a yo-yo turning point) the step is split at the crossing so that
    // the force reverses at the right moment and energy is conserved to rounding.
    for (const pc of this.pieces) {
      const a = this.get(pc.q);
      const b = this.get(pc.qbar);
      const s0 = b.z > a.z ? 1 : b.z < a.z ? -1 : 0;
      if (s0 === 0 && !a.held && !b.held) continue;
      const za = (tau: number, s: number) => (a.held ? a.z + (hand.get(a.id) ?? 0) * (tau / h) : StringModel.zAfter(a, k * s, tau));
      const zb = (tau: number, s: number) => (b.held ? b.z + (hand.get(b.id) ?? 0) * (tau / h) : StringModel.zAfter(b, -k * s, tau));
      let tc = h;
      if (s0 !== 0 && (zb(h, s0) - za(h, s0)) * s0 < 0) {
        let lo = 0;
        let hi = h;
        for (let it = 0; it < 60; it++) {
          const mid = 0.5 * (lo + hi);
          if ((zb(mid, s0) - za(mid, s0)) * s0 > 0) lo = mid;
          else hi = mid;
        }
        tc = 0.5 * (lo + hi);
      }
      const segments: [number, number][] = s0 === 0 ? [[0, h]] : tc < h ? [[s0, tc], [-s0, h - tc]] : [[s0, h]];
      for (const [s, dtau] of segments) {
        for (const [pt, F] of [[a, k * s], [b, -k * s]] as const) {
          if (pt.held) {
            const dz = (hand.get(pt.id) ?? 0) * (dtau / h);
            this.work += -F * dz; // the hand pushes with −F (F = force of the string on the end)
            pt.z += dz;
          } else if (F !== 0) {
            const E0 = Math.hypot(pt.m, pt.p);
            pt.p += F * dtau;
            pt.z += (Math.hypot(pt.m, pt.p) - E0) / F;
          }
        }
      }
    }
    // 3. breaks
    const flavours: Flavour[] = ['u', 'd', 's'];
    const pcs = this.pieces.slice();
    for (const pc of pcs) {
      const a = this.get(pc.q);
      const b = this.get(pc.qbar);
      const L = Math.abs(b.z - a.z);
      const rates = flavours.map((f) => {
        const d = (2 * this.params.mass[f]) / k;
        const w = Math.exp((-Math.PI * this.params.mass[f] ** 2) / (k * HBARC_GEV_FM)); // κ in GeV², from GeV/fm
        return L > d ? this.params.gamma * w * (L - d) : 0;
      });
      const R = rates[0]! + rates[1]! + rates[2]!;
      if (R <= 0) continue;
      if (this.rng() < 1 - Math.exp(-R * h)) {
        const f = flavours[choice(this.rng, rates)]!;
        out.push(this.breakPiece(pc, f));
      }
    }
    this.t += h;
  }

  /** Break a piece with a new pair of flavour f (public for tests: requires the piece to be longer than the gap). */
  breakPiece(pc: Piece, f: Flavour): BreakEvent {
    const k = this.params.kappa;
    const a = this.get(pc.q);
    const b = this.get(pc.qbar);
    const m = this.params.mass[f];
    const d = (2 * m) / k;
    const L = Math.abs(b.z - a.z);
    if (L < d) throw new Error('breakPiece: piece shorter than the gap');
    const s = b.z > a.z ? 1 : -1;
    const x = a.z + s * (d / 2 + this.rng() * (L - d));
    const qbarNew = this.add(f, true, x - (s * d) / 2, 0); // next to a
    const qNew = this.add(f, false, x + (s * d) / 2, 0); // next to b
    this.pieces = this.pieces.filter((p) => p !== pc);
    this.pieces.push({ q: a.id, qbar: qbarNew.id }, { q: qNew.id, qbar: b.id });
    this.created += 2 * m;
    const ev: BreakEvent = { t: this.t, z: x, flavour: f, gap: d, pieceLength: L };
    this.breaks.push(ev);
    return ev;
  }

  /** Invariant mass of a piece (partons plus string), or null while a hand still holds one of its ends. */
  pieceMass(pc: Piece): number | null {
    const a = this.get(pc.q);
    const b = this.get(pc.qbar);
    if (a.held || b.held) return null;
    const E = Math.hypot(a.m, a.p) + Math.hypot(b.m, b.p) + this.params.kappa * Math.abs(b.z - a.z);
    const P = a.p + b.p;
    return Math.sqrt(Math.max(0, E * E - P * P));
  }
  /** Energy accounting. */
  budget(): Budget {
    const k = this.params.kappa;
    let kinetic = 0;
    for (const p of this.partons) if (!p.held) kinetic += Math.hypot(p.m, p.p) - p.m;
    let string = 0;
    for (const pc of this.pieces) string += k * Math.abs(this.get(pc.qbar).z - this.get(pc.q).z);
    const input = this.work + k * this.r0;
    return { input, kinetic, string, created: this.created, residual: input - (kinetic + string + this.created) };
  }
  /** Total momentum of the free partons (conserved between breaks; the pulls of the hands change it). */
  freeMomentum(): number {
    return this.partons.filter((p) => !p.held).reduce((s, p) => s + p.p, 0);
  }
}

/** The name of a meson from its quark content (pseudoscalar octet: π, K, η), and its PDG id, for a quark of flavour q and an antiquark of flavour qb. */
export function mesonId(q: Flavour, qbar: Flavour): number {
  if (q === qbar) return q === 's' ? 221 : 111; // ss̄ → η (cartoon), uū/dd̄ → π⁰
  const key = q + qbar;
  switch (key) {
    case 'ud': return 211; // u d̄
    case 'du': return -211; // d ū
    case 'us': return 321; // u s̄ = K⁺
    case 'su': return -321; // s ū = K⁻
    case 'ds': return 311; // d s̄ = K⁰
    case 'sd': return -311; // s d̄ = K̄⁰
  }
  throw new Error('mesonId');
}
/** Mass of the pseudoscalar meson (GeV) for the given pdg id; explicit constants so the module stays self-contained. */
const MESON_MASS: Record<number, number> = { 211: 0.13957039, 111: 0.1349768, 321: 0.493677, 311: 0.497611, 221: 0.547862 };
export const mesonMass = (pdg: number): number => MESON_MASS[Math.abs(pdg)]!;
/** Electric charge (units of e) of a quark flavour. */
const charge3 = (f: Flavour, anti: boolean): number => (f === 'u' ? 2 : -1) * (anti ? -1 : 1);

export interface FragParams {
  /** Centre-of-mass energy of the q q̄ system, GeV. */
  sqrtS: number;
  /** Lund a and b (GeV⁻²): f(z) ∝ (1/z)(1−z)^a exp(−b m⊥²/z). From memory (Pythia-like defaults): flagged for review. */
  a: number;
  b: number;
  /** Width of each Cartesian component of the transverse momentum of a new pair, GeV. */
  sigmaPt: number;
  /** Relative probability of s versus u or d. */
  probS: number;
  /** Stop when the remaining system is lighter than this, GeV. */
  stopMass: number;
}
export const defaultFrag = (sqrtS = 30): FragParams => ({ sqrtS, a: 0.68, b: 0.98, sigmaPt: 0.33 / Math.SQRT2, probS: 0.22, stopMass: 1.5 });

export interface Hadron {
  pdg: number;
  mass: number;
  p: P4;
  /** Rapidity ½ ln[(E + p_z)/(E − p_z)]. */
  y: number;
  pt: number;
  /** 3 × charge. */
  charge3: number;
}
export interface FragEvent {
  hadrons: Hadron[];
  sqrtS: number;
  /** The attempt that succeeded (events with an unphysically light remainder are discarded and redone). */
  attempts: number;
}

function sampleFlavour(r: Rng, probS: number): Flavour {
  const i = choice(r, [1, 1, probS]);
  return (['u', 'd', 's'] as const)[i]!;
}
function lund(z: number, a: number, b: number, mT2: number): number {
  return ((1 - z) ** a * Math.exp((-b * mT2) / z)) / z;
}
function sampleZ(r: Rng, a: number, b: number, mT2: number): number {
  // find the maximum on a grid (the density is smooth), then accept–reject with a flat envelope
  let max = 0;
  for (let i = 1; i <= 200; i++) max = Math.max(max, lund(i / 201, a, b, mT2));
  return acceptReject(r, (z) => lund(z, a, b, mT2), 1e-4, 1 - 1e-6, max * 1.15).x;
}
const rapidityOf = (E: number, pz: number): number => 0.5 * Math.log((E + pz) / (E - pz));

/** One event: a u, d or s quark (and its antiquark) back to back, fragmented into mesons. */
export function fragment(r: Rng, prm: FragParams): FragEvent {
  const { sqrtS, a, b, sigmaPt, probS, stopMass } = prm;
  for (let attempt = 1; attempt <= 500; attempt++) {
    const rr = r.fork(attempt);
    const q0 = (['u', 'd', 's'] as const)[choice(rr, [4, 1, 1])]!;
    const out: Hadron[] = [];
    let Wp = sqrtS;
    let Wm = sqrtS;
    let end: Flavour = q0; // flavour of the quark at the moving end of the string
    let ux = 0;
    let uy = 0; // transverse momentum carried by that end quark
    let ok = true;
    for (let step = 0; step < 200; step++) {
      const Mrem2 = Wp * Wm - ux * ux - uy * uy;
      if (Mrem2 < stopMass * stopMass) break;
      const f = sampleFlavour(rr, probS);
      const pdg = mesonId(end, f);
      const m = mesonMass(pdg);
      const nx = normal(rr, 0, sigmaPt);
      const ny = normal(rr, 0, sigmaPt);
      const px = ux - nx;
      const py = uy - ny;
      const mT2 = m * m + px * px + py * py;
      const z = sampleZ(rr, a, b, mT2);
      const pp = z * Wp;
      const pm = mT2 / pp;
      if (pm >= Wm || pp >= Wp) {
        ok = false;
        break;
      }
      const E = (pp + pm) / 2;
      const pz = (pp - pm) / 2;
      out.push(mk(pdg, m, E, px, py, pz, end, f));
      Wp -= pp;
      Wm -= pm;
      end = f;
      ux = nx;
      uy = ny;
    }
    if (!ok) continue;
    // the last two mesons: the remainder (quark `end`, antiquark of flavour q0) splits into (end, f̄) and (f, q̄0)
    const rem: P4 = { E: (Wp + Wm) / 2, px: ux, py: uy, pz: (Wp - Wm) / 2 };
    const M2 = Wp * Wm - ux * ux - uy * uy;
    const f = sampleFlavour(rr, probS);
    const id1 = mesonId(end, f);
    const id2 = mesonId(f, q0);
    const m1 = mesonMass(id1);
    const m2 = mesonMass(id2);
    if (M2 <= (m1 + m2) ** 2 * 1.0001 || out.length < 1) continue;
    const [h1, h2] = twoBodyDecay(rr, rem, m1, m2);
    out.push(mk2(id1, m1, h1, end, f), mk2(id2, m2, h2, f, q0));
    return { hadrons: out, sqrtS, attempts: attempt };
  }
  throw new Error('fragment: no event found (√s too small?)');
}
function mk(pdg: number, m: number, E: number, px: number, py: number, pz: number, q: Flavour, qb: Flavour): Hadron {
  return mk2(pdg, m, { E, px, py, pz }, q, qb);
}
function mk2(pdg: number, m: number, p: P4, q: Flavour, qb: Flavour): Hadron {
  return { pdg, mass: m, p, y: rapidityOf(p.E, p.pz), pt: Math.hypot(p.px, p.py), charge3: charge3(q, false) + charge3(qb, true) };
}

/** Histogram of rapidities over `nEvents` events with a seeded stream: counts per unit rapidity per event. */
export function rapidityPlateau(r: Rng, prm: FragParams, nEvents: number, yMax: number, nBins: number): { edges: number[]; dNdy: number[]; meanMultiplicity: number } {
  const counts = new Array<number>(nBins).fill(0);
  let mult = 0;
  for (let i = 0; i < nEvents; i++) {
    const ev = fragment(r.fork(i), prm);
    mult += ev.hadrons.length;
    for (const h of ev.hadrons) {
      const j = Math.floor(((h.y + yMax) / (2 * yMax)) * nBins);
      if (j >= 0 && j < nBins) counts[j]!++;
    }
  }
  const w = (2 * yMax) / nBins;
  return { edges: Array.from({ length: nBins + 1 }, (_, i) => -yMax + i * w), dNdy: counts.map((c) => c / (nEvents * w)), meanMultiplicity: mult / nEvents };
}
