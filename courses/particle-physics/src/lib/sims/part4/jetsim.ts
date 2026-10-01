/**
 * Chapter 18's jet figure: generate e⁺e⁻ → qq̄ events with `hep/gen` (hard process, parton shower, toy Lund hadronisation,
 * decays), keep the visible final-state particles, rotate each event so that its plane lies in the transverse plane, and
 * cluster with anti-kT (`hep/reco`, through the hook `reco.antiKt`, so the reader's version is used when it is installed).
 *
 * The rotation changes nothing physical in an e⁺e⁻ event, where the beam direction means nothing to the hadronic system
 * except through the 1 + cos²θ distribution; it makes the event look like what a hadron-collider detector would record
 * for a jet pair at rapidity about zero, which is where anti-kT with radius R in (y, φ) is at home.
 */
import { generate } from '../../hep/gen/index.ts';
import { rng, type Rng } from '../../hep/random/index.ts';
import { clusterJets, type JetResult } from '../../hep/reco/jets.ts';
import { pt, eta, phi, mass, pmag, type P4 } from '../../hep/kinematics/index.ts';
import { particle } from '../../hep/particles/index.ts';

export interface Visible {
  p: P4;
  pdg: number;
  charged: boolean;
}

export interface JetEvent {
  particles: Visible[];
  /** Eigenvalues of the momentum tensor, largest first (they sum to one). */
  lambdas: [number, number, number];
  /** The generator's hard partons (from the hard process, before the shower), for labelling. */
  sqrtS: number;
}

/** Eigen-decomposition of a real symmetric 3×3 matrix by Jacobi rotations. Returns eigenvalues descending and unit vectors. */
export function eigenSym3(m: number[][]): { values: [number, number, number]; vectors: [number[], number[], number[]] } {
  const a = m.map((r) => r.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += a[i]![j]! ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < 2; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p]![q]!) < 1e-300) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k]![p]!, akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p]![k]!, aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k]![p]!, vkq = v[k]![q]!;
          v[k]![p] = c * vkp - s * vkq;
          v[k]![q] = s * vkp + c * vkq;
        }
      }
  }
  const idx = [0, 1, 2].sort((i, j) => a[j]![j]! - a[i]![i]!);
  const col = (j: number) => [v[0]![j]!, v[1]![j]!, v[2]![j]!];
  return {
    values: [a[idx[0]!]![idx[0]!]!, a[idx[1]!]![idx[1]!]!, a[idx[2]!]![idx[2]!]!],
    vectors: [col(idx[0]!), col(idx[1]!), col(idx[2]!)],
  };
}

/** The sphericity (momentum) tensor S_ab = Σ p_a p_b / Σ p², and its principal axes. */
export function principalAxes(ps: readonly P4[]) {
  const S = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let norm = 0;
  for (const p of ps) {
    const c = [p.px, p.py, p.pz];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i]![j]! += c[i]! * c[j]!;
    norm += c[0]! ** 2 + c[1]! ** 2 + c[2]! ** 2;
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i]![j]! /= norm || 1;
  return eigenSym3(S);
}

/** Express every momentum in the frame (major, semi-major, minor axis) = (x, y, z): the event plane becomes x–y. */
export function rotateToEventPlane(ps: Visible[]): { rotated: Visible[]; lambdas: [number, number, number] } {
  const { values, vectors } = principalAxes(ps.map((q) => q.p));
  const [e1, e2, e3] = vectors;
  // make the frame right-handed
  const cross = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
  const s = cross[0]! * e3[0]! + cross[1]! * e3[1]! + cross[2]! * e3[2]! < 0 ? -1 : 1;
  const dot = (p: P4, e: number[]) => p.px * e[0]! + p.py * e[1]! + p.pz * e[2]!;
  const rotated = ps.map((q) => ({ ...q, p: { E: q.p.E, px: dot(q.p, e1), py: dot(q.p, e2), pz: s * dot(q.p, e3) } }));
  return { rotated, lambdas: values };
}

/** Generate `count` events. Neutrinos are dropped (a detector does not see them). */
export function generateJetEvents(sqrtS: number, count: number, seed: number, opts: { shower?: boolean } = {}): JetEvent[] {
  const r: Rng = rng(seed);
  const out: JetEvent[] = [];
  for (let i = 0; i < count; i++) {
    const ev = generate('ee->qq', { sqrtS, shower: opts.shower ?? true }, r);
    const vis: Visible[] = [];
    for (const q of ev.particles) {
      if (q.status !== 'final') continue;
      const a = Math.abs(q.pdg);
      if (a === 12 || a === 14 || a === 16) continue;
      const info = particle(q.pdg);
      vis.push({ p: q.p, pdg: q.pdg, charged: info.charge3 !== 0 });
    }
    const { rotated, lambdas } = rotateToEventPlane(vis);
    out.push({ particles: rotated, lambdas, sqrtS });
  }
  return out;
}

export interface Jet {
  p: P4;
  pt: number;
  eta: number;
  phi: number;
  m: number;
  members: number[];
}

export function clusterEvent(ev: JetEvent, R: number, ptMin: number): Jet[] {
  const res: JetResult = clusterJets(
    ev.particles.map((q) => q.p),
    R,
    ptMin,
  );
  return res.jets.map((p, k) => ({ p, pt: pt(p), eta: eta(p), phi: phi(p), m: Math.max(0, mass(p)), members: res.constituents[k]! }));
}

/** The number of jets found in each event. */
export function jetMultiplicities(events: JetEvent[], R: number, ptMin: number): number[] {
  return events.map((e) => clusterEvent(e, R, ptMin).length);
}

/** Add one soft particle in a random direction (a test of infrared safety). */
export function addSoft(ev: JetEvent, r: Rng, energy = 0.05): JetEvent {
  const c = 2 * r() - 1;
  const ph = 2 * Math.PI * r();
  const s = Math.sqrt(1 - c * c);
  const p: P4 = { E: energy, px: energy * s * Math.cos(ph), py: energy * s * Math.sin(ph), pz: energy * c };
  return { ...ev, particles: [...ev.particles, { p, pdg: 22, charged: false }] };
}

/** Replace the hardest particle by two collinear particles sharing its momentum (a test of collinear safety). */
export function splitHardest(ev: JetEvent, fraction = 0.5): JetEvent {
  let best = 0;
  for (let i = 1; i < ev.particles.length; i++) if (pmag(ev.particles[i]!.p) > pmag(ev.particles[best]!.p)) best = i;
  const q = ev.particles[best]!;
  const a: Visible = { ...q, p: { E: q.p.E * fraction, px: q.p.px * fraction, py: q.p.py * fraction, pz: q.p.pz * fraction } };
  const b: Visible = { ...q, p: { E: q.p.E * (1 - fraction), px: q.p.px * (1 - fraction), py: q.p.py * (1 - fraction), pz: q.p.pz * (1 - fraction) } };
  return { ...ev, particles: [...ev.particles.filter((_, i) => i !== best), a, b] };
}
