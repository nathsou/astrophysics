/**
 * The event model shared by every stage of the pipeline.
 *
 * An event exists in two linked forms: the **truth** (what the generator produced) and, after the detector and
 * reconstruction, the **reconstructed objects** (what the algorithms saw). In simulation each reconstructed
 * object carries the index of the truth particle it came from (`truth`), which is how efficiencies and fake
 * rates are computed. With real data only the reconstruction exists.
 *
 * Geometry conventions: z along the beam, r transverse, φ azimuth, η pseudorapidity; lengths in mm, energies in GeV.
 */
import type { P4 } from '../kinematics/index.ts';

// ── Truth ──────────────────────────────────────────────────────────────────────────────────────

/** Status of a truth particle, in the style of HepMC. */
export type TruthStatus = 'beam' | 'hard' | 'intermediate' | 'final' | 'decayed';

export interface TruthParticle {
  /** Index in the event's `particles` array. */
  id: number;
  pdg: number;
  p: P4;
  /** Production vertex in mm (x, y, z) and time in ns. */
  vertex: [number, number, number];
  /** Decay vertex for particles that decayed (mm). */
  endVertex?: [number, number, number];
  status: TruthStatus;
  /** Indices of the mother particles. */
  mothers: number[];
  /** Indices of the daughters. */
  daughters: number[];
  /** Colour flow labels, for partons (optional; used by the shower and hadronisation). */
  colour?: [number, number];
  /** Which collision of a bunch crossing this particle belongs to (0 = the hard-scatter, ≥1 pile-up). */
  collision?: number;
}

export interface TruthEvent {
  /** Event number within a run. */
  number: number;
  /** Generator weight (1 for unweighted events). */
  weight: number;
  /** Process label, e.g. "pp → Z → μμ". */
  process: string;
  /** Centre-of-mass energy in GeV. */
  sqrtS: number;
  particles: TruthParticle[];
  /** Positions of the primary vertices (mm), one per collision; index 0 is the hard scatter. */
  primaryVertices: [number, number, number][];
}

// ── Detector output ───────────────────────────────────────────────────────────────────────────

/** A position measurement in a tracking layer. */
export interface Hit {
  /** Layer index (0 = innermost). */
  layer: number;
  /** Position in mm. */
  x: number;
  y: number;
  z: number;
  /** Truth particle that produced the hit, or −1 for noise. */
  truth: number;
  /** Energy deposit in keV (for dE/dx). */
  edep?: number;
}

/** A calorimeter cell's energy deposit. */
export interface CaloCell {
  /** 'ecal' or 'hcal'. */
  calo: 'ecal' | 'hcal';
  eta: number;
  phi: number;
  /** Energy in GeV. */
  energy: number;
  /** Depth layer within the calorimeter. */
  layer: number;
  /** Indices of truth particles that contributed (for linking). */
  truth: number[];
}

/** A hit in a muon chamber. */
export interface MuonHit {
  station: number;
  x: number;
  y: number;
  z: number;
  truth: number;
}

export interface DetectorEvent {
  hits: Hit[];
  cells: CaloCell[];
  muonHits: MuonHit[];
  /** Number of pile-up collisions overlaid on this crossing. */
  pileup: number;
}

// ── Reconstruction ───────────────────────────────────────────────────────────────────────────

export interface Track {
  id: number;
  /** Charge ±1. */
  charge: number;
  pt: number;
  eta: number;
  phi: number;
  /** Transverse and longitudinal impact parameters relative to the primary vertex (mm). */
  d0: number;
  z0: number;
  /** Fit quality. */
  chi2: number;
  ndof: number;
  /** Indices into the event's hit list. */
  hits: number[];
  /** Truth particle this track was matched to (−1 if fake). */
  truth: number;
  /** Fraction of the track's hits that come from the matched truth particle. */
  purity?: number;
}

export interface Vertex {
  x: number;
  y: number;
  z: number;
  /** Indices of the tracks assigned. */
  tracks: number[];
  /** Whether it is the primary (hard-scatter) vertex, a pile-up vertex, or a secondary vertex. */
  kind: 'primary' | 'pileup' | 'secondary';
  chi2?: number;
}

export interface Cluster {
  calo: 'ecal' | 'hcal';
  energy: number;
  eta: number;
  phi: number;
  cells: number[];
}

/** The kinds of reconstructed physics object. */
export type ObjectKind = 'electron' | 'muon' | 'photon' | 'jet' | 'tau' | 'track';

export interface RecoObject {
  kind: ObjectKind;
  p: P4;
  charge?: number;
  /** Isolation: scalar sum of pT in a cone around the object, divided by its own pT. */
  isolation?: number;
  /** b-tagging score in [0, 1] (jets only). */
  btag?: number;
  /** Indices of the tracks and clusters it was built from. */
  tracks?: number[];
  clusters?: number[];
  /** Jet constituents count (jets only). */
  nConstituents?: number;
  /** Truth particle index (or −1). */
  truth: number;
}

export interface RecoEvent {
  tracks: Track[];
  vertices: Vertex[];
  clusters: Cluster[];
  objects: RecoObject[];
  /** Missing transverse momentum vector (GeV). */
  met: { x: number; y: number };
  /** Scalar sum of transverse energy (GeV). */
  sumEt: number;
}

/** A complete simulated event. With real data, `truth` and `detector` are absent. */
export interface FullEvent {
  truth?: TruthEvent;
  detector?: DetectorEvent;
  reco: RecoEvent;
  /** Trigger bits that fired, by menu item name. */
  trigger?: string[];
  /** Event weight (cross-section × luminosity normalisation for weighted samples). */
  weight: number;
}

// ── Columnar tables for analysis ──────────────────────────────────────────────────────────────

/**
 * A columnar event table: one numeric column per variable, one row per event. Jagged collections (e.g. the
 * muons in each event) are stored as a flat `values` array plus `offsets` (length n + 1), as in Awkward Array.
 */
export class EventTable {
  readonly columns: Record<string, Float64Array> = {};
  readonly jagged: Record<string, { offsets: Uint32Array; values: Float64Array }> = {};
  n: number;
  constructor(n: number) {
    this.n = n;
  }

  setColumn(name: string, values: ArrayLike<number>): this {
    if (values.length !== this.n) throw new Error(`column ${name}: expected ${this.n} rows, got ${values.length}`);
    this.columns[name] = Float64Array.from(values);
    return this;
  }
  setJagged(name: string, perEvent: ArrayLike<ArrayLike<number>>): this {
    if (perEvent.length !== this.n) throw new Error(`jagged column ${name}: expected ${this.n} rows, got ${perEvent.length}`);
    const offsets = new Uint32Array(this.n + 1);
    let total = 0;
    for (let i = 0; i < this.n; i++) {
      total += perEvent[i]!.length;
      offsets[i + 1] = total;
    }
    const values = new Float64Array(total);
    for (let i = 0; i < this.n; i++) values.set(Array.from(perEvent[i]!), offsets[i]!);
    this.jagged[name] = { offsets, values };
    return this;
  }
  col(name: string): Float64Array {
    const c = this.columns[name];
    if (!c) throw new Error(`no column ${name}`);
    return c;
  }
  /** The values of a jagged column in event i. */
  row(name: string, i: number): Float64Array {
    const j = this.jagged[name];
    if (!j) throw new Error(`no jagged column ${name}`);
    return j.values.subarray(j.offsets[i]!, j.offsets[i + 1]!);
  }
  /** Keep the rows for which `keep(i)` is true. */
  select(keep: (i: number) => boolean): EventTable {
    const idx: number[] = [];
    for (let i = 0; i < this.n; i++) if (keep(i)) idx.push(i);
    const out = new EventTable(idx.length);
    for (const [k, v] of Object.entries(this.columns)) out.columns[k] = Float64Array.from(idx, (i) => v[i]!);
    for (const k of Object.keys(this.jagged)) out.setJagged(k, idx.map((i) => this.row(k, i)));
    return out;
  }
}
