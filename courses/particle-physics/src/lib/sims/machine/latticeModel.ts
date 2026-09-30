/** The editable lattice behind the lattice designer and the lattice exercise: rows, presets and the analysis of a periodic cell. */
import {
  LHC, chromaticity, isStable, lhcArcCellDesign, opticsAlong, oneTurnMatrix, periodicTwiss, repeat, trackThroughLattice, tuneFromTurns,
  type Element, type OpticsTable, type PeriodicSolution, type Plane,
} from '$lib/hep/machine';

export type RowKind = 'drift' | 'dipole' | 'qf' | 'qd' | 'sext';
export interface Row {
  id: number;
  kind: RowKind;
  /** Length in m (ignored for the thin sextupole). */
  length: number;
  /** Dipole: bend angle in mrad. Quadrupole: strength k in m⁻² (a positive number; QF focuses in x, QD defocuses). Sextupole: k₂l in m⁻². */
  strength: number;
}

export const KIND_LABEL: Record<RowKind, string> = { drift: 'Drift', dipole: 'Dipole', qf: 'Focusing quad (QF)', qd: 'Defocusing quad (QD)', sext: 'Sextupole' };
export const KIND_SHORT: Record<RowKind, string> = { drift: 'O', dipole: 'B', qf: 'F', qd: 'D', sext: 'S' };

let nextId = 1;
export const makeRow = (kind: RowKind, length: number, strength = 0): Row => ({ id: nextId++, kind, length, strength });

const num = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
const len = (x: unknown): number => Math.max(0, num(x));

export function toElements(rows: readonly Row[]): Element[] {
  return rows.map((r): Element => {
    switch (r.kind) {
      case 'drift': return { kind: 'drift', length: len(r.length) };
      case 'dipole': return { kind: 'dipole', length: len(r.length), angle: num(r.strength) / 1000 };
      case 'qf': return { kind: 'quad', length: len(r.length), k: Math.abs(num(r.strength)), name: 'QF' };
      case 'qd': return { kind: 'quad', length: len(r.length), k: -Math.abs(num(r.strength)), name: 'QD' };
      case 'sext': return { kind: 'sextupole', k2l: num(r.strength) };
    }
  });
}

export interface Preset { key: string; label: string; note: string; nCells: number; rows: () => Row[] }

const fodoRows = (kF: number, kD: number, angle: number): Row[] => [
  makeRow('qf', 0.5, kF), makeRow('drift', 1.5), makeRow('dipole', 2, angle), makeRow('drift', 1.5),
  makeRow('qd', 0.5, kD), makeRow('drift', 1.5), makeRow('dipole', 2, angle), makeRow('drift', 1.5),
];
const ANGLE16 = (Math.PI / 16) * 1000; // mrad: 16 cells × 2 dipoles close the ring

const LHC_DESIGN = lhcArcCellDesign(90, 7000);
const lhcRows = (): Row[] => {
  const gap = (LHC.arcCell.length_m / 2 - LHC.quadLength_m - 3 * LHC.dipoleLength_m) / 4;
  const angle = ((2 * Math.PI) / (205 * 6)) * 1000; // 205 cells of six dipoles close the ring (the real ring has 1232 dipoles: the last two are in the dispersion suppressors)
  const half = (kind: 'qf' | 'qd'): Row[] => [
    makeRow(kind, LHC.quadLength_m, Number(LHC_DESIGN.k.toPrecision(4))), makeRow('drift', Number(gap.toFixed(4))),
    makeRow('dipole', LHC.dipoleLength_m, Number(angle.toFixed(4))), makeRow('drift', Number(gap.toFixed(4))),
    makeRow('dipole', LHC.dipoleLength_m, Number(angle.toFixed(4))), makeRow('drift', Number(gap.toFixed(4))),
    makeRow('dipole', LHC.dipoleLength_m, Number(angle.toFixed(4))), makeRow('drift', Number(gap.toFixed(4))),
  ];
  return [...half('qf'), ...half('qd')];
};

export const PRESETS: Preset[] = [
  { key: 'fodo', label: 'FODO cell', note: 'Focusing quad, bend, defocusing quad, bend: the textbook stable cell, 16 cells make a small ring.', nCells: 16, rows: () => fodoRows(0.4, 0.4, ANGLE16) },
  { key: 'broken', label: 'Broken cell', note: 'Both quadrupoles wired as defocusing: nothing holds the beam in x.', nCells: 16, rows: () => fodoRows(0.4, 0.4, ANGLE16).map((r, i) => (i === 0 ? { ...r, kind: 'qd' as const } : r)) },
  { key: 'lhc', label: 'LHC arc cell', note: 'The 106.9 m arc cell: six 14.3 m dipoles and two 3.1 m quadrupoles, tuned to 90° per cell. 205 cells (1,230 dipoles) close the ring; the real ring has 1,232 dipoles because of the dispersion suppressors.', nCells: 205, rows: lhcRows },
  { key: 'sext', label: 'FODO + sextupole', note: 'A weak nonlinear kick once per cell: large amplitudes leave the ellipses.', nCells: 16, rows: () => [...fodoRows(0.4, 0.4, ANGLE16), makeRow('sext', 0, 6)] },
];
export const presetRows = (key: string): { rows: Row[]; nCells: number } => {
  const p = PRESETS.find((x) => x.key === key) ?? PRESETS[0]!;
  return { rows: p.rows(), nCells: p.nCells };
};

export interface PlaneResult {
  plane: Plane;
  stable: boolean;
  trace: number;
  twiss: PeriodicSolution;
  /** β(s) along one cell, if stable. */
  table: OpticsTable | null;
  betaMax: number;
  betaMin: number;
  /** Ring tune with its integer part. */
  tune: number;
}
export interface Analysis {
  cell: Element[];
  length: number;
  bend: number;
  x: PlaneResult;
  y: PlaneResult;
  chromX: number;
}

function planeResult(cell: Element[], nCells: number, plane: Plane): PlaneResult {
  const M = oneTurnMatrix(cell, plane);
  const twiss = periodicTwiss(M);
  const stable = isStable(M);
  let table: OpticsTable | null = null;
  let bmax = NaN, bmin = NaN;
  if (stable) {
    table = opticsAlong(cell, plane, { maxStep: Math.max(0.05, cell.reduce((s, e) => s + ('length' in e ? e.length : 0), 0) / 400) });
    bmax = Math.max(...table.beta);
    bmin = Math.min(...table.beta);
  }
  return { plane, stable, trace: twiss.trace, twiss, table, betaMax: bmax, betaMin: bmin, tune: stable && table ? (nCells * table.tune) : NaN };
}

export function analyse(cell: Element[], nCells: number): Analysis {
  const x = planeResult(cell, nCells, 'x');
  const y = planeResult(cell, nCells, 'y');
  const length = cell.reduce((s, e) => s + ('length' in e ? e.length : 0), 0);
  const bend = cell.reduce((s, e) => s + (e.kind === 'dipole' ? e.angle : 0), 0) * nCells;
  let chromX = NaN;
  if (x.stable && nCells <= 64) chromX = nCells * chromaticity(cell, 'x');
  return { cell, length, bend, x, y, chromX };
}

export interface TrackedParticle {
  /** Start amplitude label (emittance multiple). */
  label: string;
  x: number[];
  xp: number[];
  lost: boolean;
  lostTurn: number;
}
export interface Tracking {
  particles: TrackedParticle[];
  /** The tune measured from the smallest-amplitude particle's x and x′, fractional. */
  measuredTune: number;
  maxX: number;
  maxXp: number;
}
const LIMIT = 1; // m: beyond this a particle is counted as lost

/** Track five particles on nested ellipses through `nCells` copies of the cell for `turns` turns. Goes through the reader's hook. */
export function trackFive(cell: Element[], nCells: number, a: Analysis, turns: number): Tracking {
  const ring = repeat(cell, nCells);
  const p = a.x.twiss;
  const particles: TrackedParticle[] = [];
  let maxX = 0, maxXp = 0, measured = NaN;
  if (!a.x.stable) {
    // Show the blow-up cell by cell (one pass through a single cell per step), from 1, 2 and 3 mm.
    for (let k = 1; k <= 3; k++) {
      const { x, xp } = trackThroughLattice(cell, 1e-3 * k, 0, 30);
      const cut = x.findIndex((v) => !Number.isFinite(v) || Math.abs(v) > LIMIT);
      const n = cut < 0 ? x.length : cut;
      particles.push({ label: `${k} mm`, x: x.slice(0, n), xp: xp.slice(0, n), lost: cut >= 0, lostTurn: cut });
    }
    let mx = 1e-3, mp = 1e-4;
    for (const p of particles) for (let i = 0; i < p.x.length; i++) { mx = Math.max(mx, Math.abs(p.x[i]!)); mp = Math.max(mp, Math.abs(p.xp[i]!)); }
    return { particles, measuredTune: NaN, maxX: mx, maxXp: mp };
  }
  const x0max = 8e-3; // the largest start amplitude, 8 mm, sets the emittance unit
  const eps0 = (x0max * x0max) / (5 * p.beta);
  for (let k = 1; k <= 5; k++) {
    const eps = k * eps0;
    const x0 = Math.sqrt(eps * p.beta);
    const xp0 = -p.alpha * Math.sqrt(eps / p.beta);
    const { x, xp } = trackThroughLattice(ring, x0, xp0, turns);
    const cut = x.findIndex((v) => !Number.isFinite(v) || Math.abs(v) > LIMIT);
    const n = cut < 0 ? x.length : cut;
    const xs = x.slice(0, n), xps = xp.slice(0, n);
    for (let i = 0; i < n; i++) { maxX = Math.max(maxX, Math.abs(xs[i]!)); maxXp = Math.max(maxXp, Math.abs(xps[i]!)); }
    if (k === 1 && n >= 16) measured = tuneFromTurns(xs, xps);
    particles.push({ label: `${(x0 * 1e3).toFixed(1)} mm`, x: xs, xp: xps, lost: cut >= 0, lostTurn: cut });
  }
  return { particles, measuredTune: measured, maxX, maxXp };
}

/** The fractional part of a tune. */
export const frac = (q: number): number => q - Math.floor(q);
