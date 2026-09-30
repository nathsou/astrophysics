/**
 * Particle decays: every unstable particle of a truth event decays according to the particle table.
 *
 * `decayAll(ev, rng)` walks the event, decays each 'final' particle that is unstable (marking it 'decayed',
 * setting its `endVertex` and appending the daughters, which are themselves decayed in turn). Four-momentum,
 * charge, baryon number and lepton number are conserved exactly by construction. See README.md for the policy
 * (what decays, what is left for the detector), and for what is *not* modelled (matrix elements, spin
 * correlations, form factors).
 */
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { hasParticle, particle, type Decay } from '../particles/index.ts';
import { C_MM_NS } from '../units/index.ts';
import { mass, pmag, twoBodyDecay, twoBodyMomentum, type P4 } from '../kinematics/index.ts';
import { exponential, choice, shuffle, type Rng } from '../random/index.ts';
import { isResonance, minMass, sampleMass } from './masses.ts';
import { shower } from '../shower/index.ts';
import { hadronise } from '../hadronise/index.ts';

export { sampleMass, isResonance, minMass, RESONANCE_MIN_WIDTH_GEV, type SampleMassOptions } from './masses.ts';

/**
 * Default policy of `decayAll`: a particle decays if its proper decay length cτ is at most this many millimetres.
 * That decays π⁰, all resonances, heavy flavour, K_S (cτ = 27 mm), Λ (79 mm), Σ, Ξ, Ω and leaves μ, π±, K±, K_L and n
 * (cτ from 7.8 m upwards) for the detector, which lets them fly and decay in flight. See README.md.
 */
export const DEFAULT_MAX_PROPER_CTAU_MM = 100;

export interface DecayOptions {
  /**
   * If given, a particle decays only if its mean *lab* decay length βγcτ is at most this many mm (so `Infinity`
   * decays everything that has a decay in the table, including μ, π±, K± and n). If omitted, the default policy is
   * used: proper cτ ≤ `DEFAULT_MAX_PROPER_CTAU_MM`.
   */
  maxCtauMm?: number;
  /** Decay only particles whose |PDG ID| is in this list (used by `decayHeavy`). */
  only?: readonly number[];
  /**
   * What to do with quarks and gluons that a decay produces (t → W b, Z → qq̄, Υ → ggg …). 'hadronise' (default) runs a
   * final-state shower and the hadronisation on them and decays the hadrons; 'leave' keeps them as 'final' partons
   * for the caller to shower and hadronise.
   */
  partons?: 'hadronise' | 'leave';
}

/** Proper decay length cτ in mm of a particle type (Infinity for stable ones). */
export function properCtauMm(pdg: number): number {
  return particle(pdg).lifetime * 1e9 * C_MM_NS;
}

/** Mean lab decay length βγcτ in mm of a particle with four-momentum `p` (Infinity if stable or massless). */
export function meanDecayLengthMm(pdg: number, p: P4): number {
  const m = mass(p);
  if (!(m > 0)) return Infinity;
  return (pmag(p) / m) * properCtauMm(pdg);
}

/** Whether `decayAll` with these options would decay the particle. */
export function wouldDecay(p: TruthParticle, opts: DecayOptions = {}): boolean {
  if (p.status !== 'final' || !hasParticle(p.pdg)) return false;
  const info = particle(p.pdg);
  if (info.decays.length === 0 || !Number.isFinite(info.lifetime)) return false;
  if (opts.only && !opts.only.includes(Math.abs(p.pdg))) return false;
  if (opts.maxCtauMm === undefined) return properCtauMm(p.pdg) <= DEFAULT_MAX_PROPER_CTAU_MM;
  return meanDecayLengthMm(p.pdg, p.p) <= opts.maxCtauMm;
}

const isPartonPdg = (pdg: number): boolean => (Math.abs(pdg) >= 1 && Math.abs(pdg) <= 5) || pdg === 21;

// ── n-body phase space: GENBOD (Raubold–Lynch), unweighted ──────────────────────────────────────────────────────

/**
 * Uniform (Lorentz-invariant) phase space for n ≥ 2 bodies of the given masses, decaying from `total`, generated
 * by the sequential two-body method (James, GENBOD) and unweighted by accept–reject against an analytic
 * upper bound of the weight (so there is no running maximum and no bias). Momenta are in the frame of `total`.
 *
 * The course's `phaseSpace` (RAMBO, in kinematics) gives the same distribution with weights; the tests compare the two.
 */
export function uniformPhaseSpace(rng: Rng, total: P4, masses: readonly number[]): P4[] {
  const n = masses.length;
  const M = mass(total);
  if (n === 1) return [{ ...total }];
  if (n === 2) return twoBodyDecay(rng, total, masses[0]!, masses[1]!);
  // Order by increasing mass: the order does not change the distribution, only the efficiency.
  const order = masses.map((_, i) => i).sort((a, b) => masses[a]! - masses[b]!);
  const m = order.map((i) => masses[i]!);
  const cum: number[] = [];
  let acc = 0;
  for (const x of m) cum.push((acc += x));
  const free = M - acc;
  const Mk = new Array<number>(n).fill(0);
  Mk[0] = m[0]!;
  Mk[n - 1] = M;
  let wmax = 1;
  for (let k = 1; k < n; k++) wmax *= twoBodyMomentum(M - (acc - cum[k]!), cum[k - 1]!, m[k]!);
  const r = new Array<number>(n - 2).fill(0);
  for (let tries = 0; ; tries++) {
    for (let i = 0; i < n - 2; i++) r[i] = rng();
    r.sort((a, b) => a - b);
    for (let k = 1; k < n - 1; k++) Mk[k] = cum[k]! + r[k - 1]! * free;
    let w = 1;
    for (let k = 1; k < n; k++) w *= twoBodyMomentum(Mk[k]!, Mk[k - 1]!, m[k]!);
    if (!(wmax > 0) || rng() * wmax <= w || tries > 10000) break;
  }
  const out = new Array<P4>(n);
  let sys = total;
  for (let k = n - 1; k >= 1; k--) {
    const [dk, rest] = twoBodyDecay(rng, sys, m[k]!, Mk[k - 1]!);
    out[order[k]!] = dk;
    sys = rest;
  }
  out[order[0]!] = sys;
  return out;
}

// ── Decay of one particle ───────────────────────────────────────────────────────────────────────────────────────

function maxColourLabel(ev: TruthEvent): number {
  let mx = 0;
  for (const p of ev.particles) if (p.colour) mx = Math.max(mx, p.colour[0], p.colour[1]);
  return mx;
}

/** Colour labels for the coloured products of a decay (see README). */
function assignColour(ev: TruthEvent, parent: TruthParticle, prods: TruthParticle[]): void {
  const col = prods.filter((q) => isPartonPdg(q.pdg));
  if (col.length === 0) return;
  let next = maxColourLabel(ev) + 1;
  const parentColoured = parent.colour && (parent.colour[0] !== 0 || parent.colour[1] !== 0);
  if (parentColoured && col.length === 1) {
    col[0]!.colour = [parent.colour![0], parent.colour![1]]; // t → W b: the b carries the top's colour line
    return;
  }
  const quarks = col.filter((q) => q.pdg > 0 && q.pdg <= 5);
  const anti = col.filter((q) => q.pdg < 0);
  const gl = col.filter((q) => q.pdg === 21);
  // Colour-singlet decays: pair each quark with an antiquark, and close the gluons in a ring.
  const np = Math.min(quarks.length, anti.length);
  for (let i = 0; i < np; i++) {
    const c = next++;
    quarks[i]!.colour = [c, 0];
    anti[i]!.colour = [0, c];
  }
  for (const q of quarks.slice(np)) q.colour = [next++, 0];
  for (const q of anti.slice(np)) q.colour = [0, next++];
  if (gl.length === 1) gl[0]!.colour = [next, next++]; // cannot happen in a singlet decay; keep labels well-formed
  else if (gl.length > 1) {
    const c0 = next;
    next += gl.length;
    for (let i = 0; i < gl.length; i++) gl[i]!.colour = [c0 + i, c0 + ((i + 1) % gl.length)];
  }
}

/** Sample masses for the products of a mode: resonances get a Breit–Wigner mass truncated by the available energy. */
function productMasses(rng: Rng, M: number, products: readonly number[]): number[] | null {
  const n = products.length;
  const ms = products.map((q) => (isResonance(q) ? -1 : particle(q).mass));
  const lows = products.map((q) => minMass(q));
  const resIdx: number[] = [];
  for (let i = 0; i < n; i++) if (ms[i]! < 0) resIdx.push(i);
  if (resIdx.length === 0) return ms;
  const tryOnce = (): number[] | null => {
    const out = ms.slice();
    // Sample the resonances in random order; each may take what the others' lower limits leave.
    const ord = shuffle(rng, resIdx.slice());
    const cur = lows.slice();
    for (const i of ord) {
      let others = 0;
      for (let j = 0; j < n; j++) if (j !== i) others += ms[j]! >= 0 ? ms[j]! : cur[j]!;
      const avail = M - others;
      if (avail < lows[i]!) return null;
      out[i] = sampleMass(products[i]!, rng, { max: avail });
      cur[i] = out[i]!;
    }
    return out;
  };
  let best: number[] | null = null;
  for (let t = 0; t < 200; t++) {
    const cand = tryOnce();
    if (!cand) continue;
    best = cand;
    if (n === 2) {
      // Two-body decay with a resonance: weight by the decay momentum (phase space) by accept–reject.
      const pmaxRef = twoBodyMomentum(M, lows[0]!, lows[1]!);
      if (pmaxRef <= 0 || rng() * pmaxRef <= twoBodyMomentum(M, cand[0]!, cand[1]!)) return cand;
    } else {
      return cand;
    }
  }
  return best;
}

function chooseMode(rng: Rng, info: { decays: Decay[] }, M: number): Decay | null {
  const weights: number[] = [];
  let any = false;
  for (const d of info.decays) {
    let thr = 0;
    for (const q of d.products) thr += minMass(q);
    const ok = thr <= M * (1 - 1e-12);
    weights.push(ok ? d.br : 0);
    if (ok) any = true;
  }
  if (!any) return null;
  return info.decays[choice(rng, weights)] ?? null;
}

/**
 * Decay particle `index` of the event now, whatever the policy says (the detector uses this to decay μ, π± and K± in
 * flight). The particle must have status 'final'. The decay point is drawn from the exponential law with the table's
 * lifetime (the lab decay length is βγcτ) unless `at` (mm) is given. Returns false if the particle is stable, unknown,
 * has no decay mode open at its mass, or is not 'final'. Daughters are appended with status 'final'; they are not
 * decayed further (use `decayAll`, or call this again).
 */
export function decayParticle(ev: TruthEvent, index: number, rng: Rng, at?: [number, number, number]): boolean {
  const p = ev.particles[index];
  if (!p || p.status !== 'final' || !hasParticle(p.pdg)) return false;
  const info = particle(p.pdg);
  if (info.decays.length === 0 || !Number.isFinite(info.lifetime)) return false;
  let M = mass(p.p);
  if (!(M > 0)) M = info.mass;
  const mode = chooseMode(rng, info, M);
  if (!mode) return false;
  const masses = productMasses(rng, M, mode.products);
  if (!masses) return false;
  const n = mode.products.length;
  let moms: P4[];
  if (n === 1) {
    moms = [{ ...p.p }]; // K⁰ → K_S / K_L: same four-momentum
  } else {
    moms = uniformPhaseSpace(rng, p.p, masses);
  }
  // Decay vertex.
  let end: [number, number, number];
  if (at) end = [at[0], at[1], at[2]];
  else {
    const ct = exponential(rng, properCtauMm(p.pdg));
    const k = M > 0 ? ct / M : 0;
    end = [p.vertex[0] + p.p.px * k, p.vertex[1] + p.p.py * k, p.vertex[2] + p.p.pz * k];
  }
  p.status = 'decayed';
  p.endVertex = end;
  const prods: TruthParticle[] = [];
  for (let i = 0; i < n; i++) {
    const id = ev.particles.length;
    const q: TruthParticle = {
      id,
      pdg: mode.products[i]!,
      p: moms[i]!,
      vertex: [end[0], end[1], end[2]],
      status: 'final',
      mothers: [index],
      daughters: [],
    };
    if (p.collision !== undefined) q.collision = p.collision;
    ev.particles.push(q);
    p.daughters.push(id);
    prods.push(q);
  }
  assignColour(ev, p, prods);
  return true;
}

/**
 * Decay every unstable particle of the event (see `DecayOptions` and the README for the policy), recursively.
 * Quarks and gluons produced by the decays (e.g. t → W b, Z → qq̄) are showered and hadronised unless
 * `opts.partons === 'leave'`.
 */
export function decayAll(ev: TruthEvent, rng: Rng, opts: DecayOptions = {}): void {
  for (let pass = 0; pass < 20; pass++) {
    let madePartons = false;
    for (let i = 0; i < ev.particles.length; i++) {
      const p = ev.particles[i]!;
      if (!wouldDecay(p, opts)) continue;
      if (decayParticle(ev, i, rng)) {
        if (!madePartons) for (const d of p.daughters) if (isPartonPdg(ev.particles[d]!.pdg)) madePartons = true;
      }
    }
    if (!madePartons || opts.partons === 'leave') return;
    shower(ev, rng, { isr: false });
    hadronise(ev, rng);
  }
}

/** Heavy resonances, in |PDG ID|: top, Z, W, H. */
export const HEAVY_RESONANCES: readonly number[] = [6, 23, 24, 25];

/**
 * Decay only the top quark, Z, W and Higgs boson (recursively), leaving the quarks and gluons they produce as 'final'
 * partons with colour labels. Call this before `shower` when the hard process leaves these particles undecayed.
 */
export function decayHeavy(ev: TruthEvent, rng: Rng): void {
  decayAll(ev, rng, { maxCtauMm: Infinity, only: HEAVY_RESONANCES, partons: 'leave' });
}
