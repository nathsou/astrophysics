/**
 * Types of the Feynman-diagram model.
 *
 * A diagram is a graph. Its nodes are the external legs (`in` and `out`, one node per particle of the process)
 * and the interaction vertices. Its edges are particle lines. An edge `{ from, to, pdg }` says "the particle
 * `pdg` travels from `from` to `to`": for a fermion that is the direction of the arrow (charge flow), so an
 * antifermion moving forward in time is an edge drawn against the flow of time. The sign of `pdg` therefore
 * carries the arrow: `{ from: A, to: B, pdg: -11 }` and `{ from: B, to: A, pdg: 11 }` are the same line.
 * Photons, gluons, Z and H are their own antiparticles, so their edges have no direction.
 */

/** The forces a vertex can belong to. `fermi` is the effective four-fermion contact interaction. */
export type Force = 'qed' | 'qcd' | 'weak' | 'higgs' | 'fermi';

/** How a line is drawn: straight with an arrow, wavy (photon), curly (gluon), wavy with a label (W, Z), dashed (Higgs). */
export type LineKind = 'fermion' | 'photon' | 'gluon' | 'W' | 'Z' | 'higgs';

export interface DiagramNode {
  id: number;
  /** `in`: an incoming particle of the process; `out`: an outgoing one; `vertex`: an interaction point. */
  kind: 'in' | 'out' | 'vertex';
  /** For external legs: the position in the `initial` or `final` list. */
  leg?: number;
  /** For external legs: the particle as written in the process (an incoming e⁺ is -11). */
  pdg?: number;
}

export interface DiagramEdge {
  id: number;
  from: number;
  to: number;
  /** The particle that travels from `from` to `to` (negative: the antiparticle). */
  pdg: number;
}

export interface Diagram {
  /** PDG IDs of the incoming particles, as written in the process. */
  initial: number[];
  /** PDG IDs of the outgoing particles. */
  final: number[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Free text, e.g. "s-channel γ". Not used for comparisons. */
  label?: string;
}

export interface Process {
  initial: number[];
  final: number[];
}

/** Options of the enumerator. */
export interface EnumerateOptions {
  /**
   * The largest allowed order of the amplitude in the couplings: a number (total power of couplings, e³ counts 3)
   * or an object limiting the electroweak (`ew`: powers of e, g, g′, y) and strong (`s`: powers of g_s) parts separately.
   * Every tree diagram of an n-particle process has total order n − 2, so for trees this option selects or
   * rejects whole orders, for example `{ s: 0 }` removes every diagram with a gluon.
   */
  maxOrder?: number | { ew?: number; s?: number };
  /**
   * The interactions allowed. Default: `['qed', 'qcd', 'weak']`, plus `'higgs'` when the process contains a Higgs boson.
   * Add `'fermi'` for the four-fermion contact vertex.
   */
  forces?: Force[];
  /**
   * CKM treatment. `diagonal`: a W connects members of the same generation only (u–d, c–s, t–b). `full`: every
   * up-type to down-type pair. `auto` (default): diagonal for internal lines, but a W vertex whose two quark
   * legs are both external particles may be off-diagonal, so that `s → u e ν̄` and `u s̄ → W⁺` have diagrams.
   */
  ckm?: 'auto' | 'diagonal' | 'full';
  /**
   * Yukawa couplings f f̄ H are proportional to the fermion mass. Fermions lighter than this (GeV) are taken
   * not to couple to the Higgs boson. Default 0.01 GeV, which removes e⁺e⁻H and the u and d quarks. Use 0 to keep all.
   */
  minYukawaMass?: number;
}

export interface LoopOptions extends EnumerateOptions {
  /**
   * PDG IDs (signs ignored) allowed in the loop. Default: every charged lepton, quark, W, γ, Z, g and H allowed by the forces.
   * `[6]` gives the top-quark loop.
   */
  loopParticles?: number[];
  /** Keep self-energy insertions on external legs (off by default: they are absorbed in the renormalisation of the legs). */
  keepExternalSelfEnergies?: boolean;
}

/** The order of a diagram (or of one amplitude) in the couplings. */
export interface DiagramOrder {
  /** Power of the electroweak couplings (e, g, g′, Yukawa, G_F counts 2) in the amplitude. */
  ew: number;
  /** Power of the strong coupling g_s in the amplitude. */
  s: number;
  /** ew + s. */
  total: number;
  /** The diagram squared scales as α^ew · α_s^s; these are the exponents. */
  alpha: number;
  alphaS: number;
  /** Number of loops (0: tree). */
  loops: number;
}

export type IssueCode =
  | 'charge'
  | 'arrows'
  | 'lepton-flavour'
  | 'generation'
  | 'baryon'
  | 'colour'
  | 'photon-neutral'
  | 'gluon-lepton'
  | 'gluon-flavour'
  | 'higgs-mass'
  | 'flavour-change'
  | 'neutral-bosons'
  | 'degree'
  | 'unknown'
  | 'leg-particle'
  | 'leg-open'
  | 'leg-multiple'
  | 'leg-through'
  | 'disconnected'
  | 'dangling'
  | 'effective'
  | 'yukawa-small';

export interface Issue {
  code: IssueCode;
  /** The vertex or leg the issue is about. */
  node?: number;
  edge?: number;
  message: string;
  /** `error`: a rule is broken. `todo`: not wrong, but not finished. `note`: worth knowing. */
  severity: 'error' | 'todo' | 'note';
}
