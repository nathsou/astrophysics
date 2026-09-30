/**
 * Level-1: the hardware trigger. It sees only coarse information, because it must decide within a fixed latency while every
 * event waits in a pipeline: calorimeter *towers* (energy summed over 0.1 × 0.1 in η–φ, transverse energy ET) and muon-chamber
 * *stubs* (short track segments with a rough pT). No tracking, no vertices.
 *
 * At the LHC bunches cross every 25 ns (40 MHz at most) and the Level-1 decision must come back within about 4 µs (CMS and
 * ATLAS differ by a fraction of a µs; 4 µs is 160 crossings held in the pipeline). The design output is 100 kHz, and in Run 3 the
 * Level-1 accept rate is about 100 kHz. Approximate public values.
 */
import { hook } from '../hooks.ts';
import type { Rng } from '../random/index.ts';
import type { DetectorEvent, RecoEvent, RecoObject } from '../event/index.ts';
import { eta as etaOf, phi as phiOf, pt as ptOf } from '../kinematics/index.ts';

/** The fixed Level-1 latency budget in µs: about 4 µs at the LHC. */
export const L1_LATENCY_US = 4;
/** The bunch-crossing spacing in ns, and the maximum crossing rate (40 MHz). */
export const BUNCH_SPACING_NS = 25;
export const L1_INPUT_RATE_HZ = 40e6;
/** The design Level-1 output rate (100 kHz): what the readout electronics and the HLT farm can take. */
export const L1_OUTPUT_RATE_HZ = 100e3;
/** The HLT output a storage system can take: about 1 kHz (Run 3: 1–2 kHz at about 1 MB per event). */
export const HLT_OUTPUT_RATE_HZ = 1000;
/** Approximate full event size in MB. */
export const EVENT_SIZE_MB = 1;

export interface Tower { eta: number; phi: number; et: number }
export interface MuonStub { eta: number; phi: number; pt: number }
export interface Level1Input { towers: Tower[]; muonStubs: MuonStub[] }

/** Towers are 0.1 wide in η and 2π/64 (0.098) in φ. */
export const TOWER_DETA = 0.1;
export const TOWER_NPHI = 64;
export const TOWER_DPHI = (2 * Math.PI) / TOWER_NPHI;
/** Level-1 tower energies are coded in steps of 0.5 GeV and towers below 0.5 GeV are suppressed. */
export const TOWER_STEP = 0.5;

export const towerIEta = (eta: number): number => Math.floor(eta / TOWER_DETA);
export const towerIPhi = (phi: number): number => ((Math.floor((phi + Math.PI) / TOWER_DPHI) % TOWER_NPHI) + TOWER_NPHI) % TOWER_NPHI;
export const towerEta = (iEta: number): number => (iEta + 0.5) * TOWER_DETA;
export const towerPhi = (iPhi: number): number => -Math.PI + (iPhi + 0.5) * TOWER_DPHI;
const key = (iEta: number, iPhi: number): number => (iEta + 512) * TOWER_NPHI + iPhi;
const wrapPhi = (i: number): number => ((i % TOWER_NPHI) + TOWER_NPHI) % TOWER_NPHI;

/** The L1 objects built from towers. */
export interface L1Object { eta: number; phi: number; et: number }

interface Cell { iEta: number; iPhi: number; et: number }
function cellsOf(towers: readonly Tower[]): { cells: Cell[]; grid: Map<number, number> } {
  const grid = new Map<number, number>();
  for (const t of towers) {
    const k = key(towerIEta(t.eta), towerIPhi(t.phi));
    grid.set(k, (grid.get(k) ?? 0) + t.et);
  }
  const cells: Cell[] = [];
  for (const [k, et] of grid) cells.push({ iEta: Math.floor(k / TOWER_NPHI) - 512, iPhi: k % TOWER_NPHI, et });
  cells.sort((a, b) => b.et - a.et || a.iEta - b.iEta || a.iPhi - b.iPhi);
  return { cells, grid };
}
const at = (grid: Map<number, number>, iEta: number, iPhi: number): number => grid.get(key(iEta, wrapPhi(iPhi))) ?? 0;

/** Seed threshold for jet and EG clusters (GeV). */
const SEED_MIN = 2;
/** Jets: a 5 × 5 window (0.5 × 0.5) around the highest unused tower, built greedily so that no tower is counted twice. */
export function l1Jets(towers: readonly Tower[]): L1Object[] {
  const { cells, grid } = cellsOf(towers);
  const used = new Set<number>();
  const out: L1Object[] = [];
  for (const c of cells) {
    if (c.et < SEED_MIN) break;
    if (used.has(key(c.iEta, c.iPhi))) continue;
    let sum = 0;
    for (let de = -2; de <= 2; de++) {
      for (let dp = -2; dp <= 2; dp++) {
        const k = key(c.iEta + de, wrapPhi(c.iPhi + dp));
        if (used.has(k)) continue;
        used.add(k);
        sum += grid.get(k) ?? 0;
      }
    }
    out.push({ eta: towerEta(c.iEta), phi: towerPhi(c.iPhi), et: sum });
  }
  return out.sort((a, b) => b.et - a.et);
}
/**
 * Electron/photon candidates: a seed tower plus its hottest neighbour, kept only if they hold at least 85% of the 3 × 3 sum
 * (electrons and photons shower narrowly; jets are wide). The narrowness cut is how L1 tells an EG from a jet with only towers.
 */
export function l1EgCandidates(towers: readonly Tower[]): L1Object[] {
  const { cells, grid } = cellsOf(towers);
  const used = new Set<number>();
  const out: L1Object[] = [];
  for (const c of cells) {
    if (c.et < SEED_MIN) break;
    if (used.has(key(c.iEta, c.iPhi))) continue;
    let sum3 = 0;
    let best = 0;
    for (let de = -1; de <= 1; de++) {
      for (let dp = -1; dp <= 1; dp++) {
        const v = at(grid, c.iEta + de, c.iPhi + dp);
        sum3 += v;
        if ((de !== 0 || dp !== 0) && v > best) best = v;
        used.add(key(c.iEta + de, wrapPhi(c.iPhi + dp)));
      }
    }
    const pair = c.et + best;
    if (pair >= 0.85 * sum3) out.push({ eta: towerEta(c.iEta), phi: towerPhi(c.iPhi), et: pair });
  }
  return out.sort((a, b) => b.et - a.et);
}
/** Missing ET at L1: the magnitude of the vector sum of all tower ET (the calorimeter sees neither muons nor neutrinos). */
export function l1Met(towers: readonly Tower[]): { met: number; phi: number } {
  let x = 0;
  let y = 0;
  for (const t of towers) {
    x -= t.et * Math.cos(t.phi);
    y -= t.et * Math.sin(t.phi);
  }
  return { met: Math.hypot(x, y), phi: Math.atan2(y, x) };
}

/** Muon stubs are kept inside the muon system's acceptance. */
export const L1_MUON_ETA_MAX = 2.4;
/** Jets and their sum HT use objects above 30 GeV and |η| < 2.4. */
export const L1_HT_MIN_ET = 30;

/** The kinds of Level-1 item. A name like `DoubleMu_Low` is the kind `DoubleMu` with its own threshold. */
export const L1_KINDS = ['SingleMu', 'DoubleMu', 'SingleEG', 'DoubleEG', 'SingleJet', 'DoubleJet', 'HT', 'MET'] as const;
export type L1Kind = (typeof L1_KINDS)[number];
export type L1Variables = Record<L1Kind, number>;
/** The kind an L1 item name refers to (the part before an underscore). */
export const l1KindOf = (name: string): string => name.split('_')[0]!;

/**
 * The quantity each L1 item thresholds: the pT of the leading muon stub (SingleMu), of the second (DoubleMu: both legs at least
 * this), the ET of the leading and second EG candidates, jets, the scalar sum HT of jets above 30 GeV, and MET.
 */
export function l1Variables(ev: Level1Input): L1Variables {
  const mu = ev.muonStubs.filter((m) => Math.abs(m.eta) < L1_MUON_ETA_MAX).map((m) => m.pt).sort((a, b) => b - a);
  const eg = l1EgCandidates(ev.towers);
  const jets = l1Jets(ev.towers);
  let ht = 0;
  for (const j of jets) if (j.et >= L1_HT_MIN_ET && Math.abs(j.eta) < 2.4) ht += j.et;
  return {
    SingleMu: mu[0] ?? 0,
    DoubleMu: mu[1] ?? 0,
    SingleEG: eg[0]?.et ?? 0,
    DoubleEG: eg[1]?.et ?? 0,
    SingleJet: jets[0]?.et ?? 0,
    DoubleJet: jets[1]?.et ?? 0,
    HT: ht,
    MET: l1Met(ev.towers).met,
  };
}

/**
 * The reference Level-1 decision: the names of the items whose variable reaches its threshold. `thresholds` maps an item name
 * (`SingleMu`, `DoubleEG`, `DoubleMu_Low`, …) to its threshold in GeV; items absent from the map are not evaluated.
 */
export function referenceL1Decision(ev: Level1Input, thresholds: Record<string, number>): string[] {
  const v = l1Variables(ev);
  const fired: string[] = [];
  for (const [name, thr] of Object.entries(thresholds)) {
    const x = v[l1KindOf(name) as L1Kind];
    if (x !== undefined && x > 0 && x >= thr) fired.push(name);
  }
  return fired;
}
/** The Level-1 decision, through the reader's hook `trigger.l1Decision` if one is installed. */
export function l1Decision(ev: Level1Input, thresholds: Record<string, number>): string[] {
  return hook('trigger.l1Decision', referenceL1Decision)(ev, thresholds);
}

// ── Building the coarse input ────────────────────────────────────────────────────────────────────────

export interface L1BuildOptions {
  /** With an Rng the coarse input is smeared (energy scale, a few narrow jets, soft towers, stub efficiency); without, it is deterministic and noiseless. */
  rng?: Rng;
  /** Extra deposits not in the object list, such as the hadronic recoil. */
  extra?: { et: number; eta: number; phi: number }[];
  /** Mean number of soft towers added (with an Rng). */
  softTowers?: number;
  /** Mean ET of a soft tower (GeV). */
  softMeanEt?: number;
  /** Probability that a jet deposits most of its energy in one or two towers (a fake EG). */
  narrowJetFraction?: number;
}

function gaussian(r: Rng): number {
  let u = 0, v = 0, s = 0;
  do { u = 2 * r() - 1; v = 2 * r() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
}

/** Add a wide (jet-like) deposit: a 2D Gaussian of width 0.12 sampled on the tower grid (normalised over 7 × 7 towers). */
function addJet(grid: Map<number, number>, et: number, eta: number, phi: number): void {
  const iE = towerIEta(eta);
  const iP = towerIPhi(phi);
  const sigma = 0.12;
  const w: [number, number, number][] = [];
  let norm = 0;
  for (let de = -3; de <= 3; de++) {
    for (let dp = -3; dp <= 3; dp++) {
      const dEta = towerEta(iE + de) - eta;
      let dPhi = towerPhi(wrapPhi(iP + dp)) - phi;
      dPhi = Math.atan2(Math.sin(dPhi), Math.cos(dPhi));
      const wt = Math.exp(-(dEta * dEta + dPhi * dPhi) / (2 * sigma * sigma));
      w.push([de, dp, wt]);
      norm += wt;
    }
  }
  for (const [de, dp, wt] of w) {
    const k = key(iE + de, wrapPhi(iP + dp));
    grid.set(k, (grid.get(k) ?? 0) + (et * wt) / norm);
  }
}
/** Add a narrow deposit (electron, photon): 85% in the seed tower, 13% in its hottest neighbour side, 2% spread over the rest. */
function addNarrow(grid: Map<number, number>, et: number, eta: number, phi: number): void {
  const iE = towerIEta(eta);
  const iP = towerIPhi(phi);
  const add = (de: number, dp: number, f: number) => {
    const k = key(iE + de, wrapPhi(iP + dp));
    grid.set(k, (grid.get(k) ?? 0) + et * f);
  };
  // the neighbour on the side of the impact point
  const fracE = eta / TOWER_DETA - Math.floor(eta / TOWER_DETA) - 0.5;
  add(0, 0, 0.85);
  add(fracE >= 0 ? 1 : -1, 0, 0.13);
  add(0, 1, 0.01);
  add(0, -1, 0.01);
}

/** Coarse Level-1 input from reconstructed objects. Muons give a stub (and a minimum-ionising tower), everything else towers. */
export function l1InputFromReco(reco: Pick<RecoEvent, 'objects'>, opts: L1BuildOptions = {}): Level1Input {
  const grid = new Map<number, number>();
  const stubs: MuonStub[] = [];
  const r = opts.rng;
  const narrowFrac = opts.narrowJetFraction ?? 0.04;
  for (const o of reco.objects as readonly RecoObject[]) {
    const pt = ptOf(o.p);
    const eta = etaOf(o.p);
    const phi = phiOf(o.p);
    switch (o.kind) {
      case 'muon': {
        if (r && r() > 0.95) break; // stub efficiency
        const spt = r ? pt * (1 + 0.2 * gaussian(r)) : pt;
        stubs.push({ eta, phi, pt: Math.max(0, Math.round(spt * 2) / 2) });
        addNarrow(grid, 0.5, eta, phi);
        break;
      }
      case 'electron':
      case 'photon':
        addNarrow(grid, r ? pt * (1 + 0.03 * gaussian(r)) : pt, eta, phi);
        break;
      case 'jet':
      case 'tau': {
        const e = r ? pt * (1 + 0.12 * gaussian(r)) : pt;
        if (r && r() < narrowFrac) addNarrow(grid, 0.7 * e, eta, phi);
        else addJet(grid, e, eta, phi);
        break;
      }
      default:
        break;
    }
  }
  for (const x of opts.extra ?? []) addJet(grid, x.et, x.eta, x.phi);
  if (r) {
    const n = opts.softTowers ?? 30;
    const mean = opts.softMeanEt ?? 0.4;
    for (let i = 0; i < n; i++) {
      const k = key(towerIEta(6 * r() - 3), Math.floor(r() * TOWER_NPHI));
      grid.set(k, (grid.get(k) ?? 0) - mean * Math.log(1 - r()));
    }
  }
  const towers: Tower[] = [];
  for (const [k, et] of grid) {
    const q = Math.round(et / TOWER_STEP) * TOWER_STEP;
    if (q <= 0) continue;
    towers.push({ eta: towerEta(Math.floor(k / TOWER_NPHI) - 512), phi: towerPhi(k % TOWER_NPHI), et: q });
  }
  return { towers, muonStubs: stubs };
}

/** Coarse Level-1 input from the detector output: calorimeter cells summed into towers (ET = E/cosh η) and muon-chamber hits paired into stubs. */
export function l1InputFromDetector(det: Pick<DetectorEvent, 'cells' | 'muonHits'>, bField = 3.8): Level1Input {
  const grid = new Map<number, number>();
  for (const c of det.cells) {
    const k = key(towerIEta(c.eta), towerIPhi(c.phi));
    grid.set(k, (grid.get(k) ?? 0) + c.energy / Math.cosh(c.eta));
  }
  const towers: Tower[] = [];
  for (const [k, et] of grid) {
    const q = Math.round(et / TOWER_STEP) * TOWER_STEP;
    if (q > 0) towers.push({ eta: towerEta(Math.floor(k / TOWER_NPHI) - 512), phi: towerPhi(k % TOWER_NPHI), et: q });
  }
  // Stubs: pair each hit of the innermost muon station with the nearest hit of the outermost one; the bend between them gives pT.
  const polar = det.muonHits.map((h) => {
    const r = Math.hypot(h.x, h.y);
    return { st: h.station, r, phi: Math.atan2(h.y, h.x), eta: -Math.log(Math.tan(Math.atan2(r, h.z) / 2)) };
  });
  const stations = [...new Set(polar.map((h) => h.st))].sort((a, b) => a - b);
  const stubs: MuonStub[] = [];
  if (stations.length >= 2) {
    const inner = polar.filter((h) => h.st === stations[0]);
    const outer = polar.filter((h) => h.st === stations[stations.length - 1]);
    const taken = new Set<number>();
    for (const a of inner) {
      let bestJ = -1;
      let bestD = Infinity;
      outer.forEach((b, j) => {
        if (taken.has(j)) return;
        const dphi = Math.atan2(Math.sin(b.phi - a.phi), Math.cos(b.phi - a.phi));
        const d = Math.hypot(b.eta - a.eta, dphi / 2);
        if (d < bestD) { bestD = d; bestJ = j; }
      });
      if (bestJ < 0 || bestD > 0.4) continue;
      taken.add(bestJ);
      const b = outer[bestJ]!;
      const dphi = Math.abs(Math.atan2(Math.sin(b.phi - a.phi), Math.cos(b.phi - a.phi)));
      const lever = (b.r - a.r) / 1000; // m
      const pt = dphi < 1e-4 ? 1000 : Math.min(1000, (0.3 * bField * lever) / (2 * dphi));
      stubs.push({ eta: b.eta, phi: b.phi, pt: Math.round(pt * 2) / 2 });
    }
  }
  return { towers, muonStubs: stubs };
}

// ── The latency budget ───────────────────────────────────────────────────────────────────────────────

export interface LatencyStage { name: string; us: number }
/** An illustrative split of the 4 µs: the real numbers depend on the experiment, but the sum is fixed by the pipeline length. */
export const L1_LATENCY_STAGES: LatencyStage[] = [
  { name: 'front-end electronics and cables to the counting room', us: 1.6 },
  { name: 'calorimeter and muon regional processing', us: 1.2 },
  { name: 'global decision (thresholds, prescales)', us: 0.4 },
  { name: 'distribution of the accept back to the detector', us: 0.8 },
];
/** Sum the stages and compare with the budget: the slack, and how many 25 ns crossings the pipeline must hold. */
export function l1LatencyBudget(stages: readonly LatencyStage[] = L1_LATENCY_STAGES, budgetUs = L1_LATENCY_US): { totalUs: number; slackUs: number; ok: boolean; pipelineDepth: number } {
  const total = stages.reduce((s, x) => s + x.us, 0);
  return { totalUs: total, slackUs: budgetUs - total, ok: total <= budgetUs + 1e-12, pipelineDepth: Math.ceil((budgetUs * 1000) / BUNCH_SPACING_NS) };
}
