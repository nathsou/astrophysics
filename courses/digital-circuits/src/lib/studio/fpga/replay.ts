/**
 * Replay of the toolchain's traces: the placer's snapshots interpolated into frames (so cells slide from one
 * snapshot to the next), the annealing schedule as series to plot, and the router's overuse per iteration with a
 * congestion heat map from the overused nodes.
 */
import type { VFpgaDevice } from '../../pld/devices/vfpga';
import type { FpgaPlacement, FpgaRouting, PlaceStep } from './types';

export interface PlaceFrame {
  /** Position of every unit (tile coordinates, fractional between snapshots). */
  x: Float32Array;
  y: Float32Array;
  /** Pad index of I/O units (the nearer snapshot's; −1 for others). */
  pad: Int16Array;
  /** The snapshot pair and the blend between them. */
  from: number;
  to: number;
  blend: number;
  /** Interpolated wirelength cost at this moment. */
  bb: number;
  /** The annealing step (temperature) the moment falls in, and its data. */
  stepIndex: number;
  step: PlaceStep | undefined;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * The placement at `t` ∈ [0, 1] of the replay (0: random start, 1: final). Positions blend between the two nearest
 * snapshots with an ease-in-out, so a scrubber or an animation shows cells sliding rather than jumping.
 */
export function placeFrame(pl: FpgaPlacement, t: number): PlaceFrame {
  const n = pl.snapshots.length;
  const tt = Math.max(0, Math.min(1, t));
  const s = tt * (n - 1);
  const a = Math.min(n - 1, Math.floor(s));
  const b = Math.min(n - 1, a + 1);
  const blend = a === b ? 0 : s - a;
  const e = smooth(blend);
  const A = pl.snapshots[a]!;
  const B = pl.snapshots[b]!;
  const units = A.x.length;
  const x = new Float32Array(units);
  const y = new Float32Array(units);
  for (let u = 0; u < units; u++) {
    x[u] = A.x[u]! + (B.x[u]! - A.x[u]!) * e;
    y[u] = A.y[u]! + (B.y[u]! - A.y[u]!) * e;
  }
  const iter = A.iter + (B.iter - A.iter) * blend;
  const stepIndex = Math.max(0, Math.min(pl.steps.length - 1, Math.round(iter)));
  return { x, y, pad: blend < 0.5 ? A.pad : B.pad, from: a, to: b, blend, bb: A.bb + (B.bb - A.bb) * blend, stepIndex, step: pl.steps[stepIndex] };
}

/** The replay position (0…1) at which a given annealing step is reached, from the snapshots' iterations. */
export function positionOfStep(pl: FpgaPlacement, step: number): number {
  const snaps = pl.snapshots;
  if (snaps.length < 2) return 0;
  for (let i = 1; i < snaps.length; i++) {
    if (step <= snaps[i]!.iter) {
      const a = snaps[i - 1]!.iter;
      const b = snaps[i]!.iter;
      const f = b === a ? 0 : (step - a) / (b - a);
      return (i - 1 + Math.max(0, Math.min(1, f))) / (snaps.length - 1);
    }
  }
  return 1;
}

export interface Series {
  label: string;
  unit?: string;
  values: number[];
  log?: boolean;
}

/** The annealing schedule as series over the temperature steps. */
export function placeSeries(pl: FpgaPlacement): { temperature: Series; cost: Series; wirelength: Series; timing: Series; acceptance: Series } {
  return {
    temperature: { label: 'Temperature', values: pl.steps.map((s) => s.temp), log: true },
    cost: { label: 'Cost (normalised)', values: pl.steps.map((s) => s.cost) },
    wirelength: { label: 'Wirelength', unit: 'tiles', values: pl.steps.map((s) => s.bb) },
    timing: { label: 'Timing cost', values: pl.steps.map((s) => s.timing) },
    acceptance: { label: 'Acceptance', unit: '%', values: pl.steps.map((s) => s.acceptRate * 100) },
  };
}

/** Overuse (nodes used by more than one net) after each router iteration. */
export function routeSeries(r: FpgaRouting): Series {
  return { label: 'Overused nodes', values: r.iterations.map((i) => i.overused) };
}

/** The overused nodes to show at router iteration index `i`: the latest recorded at or before it. */
export function overusedAt(r: FpgaRouting, i: number): number[] {
  const iter = r.iterations[Math.max(0, Math.min(r.iterations.length - 1, i))]?.iter ?? 0;
  let best: { iter: number; nodes: number[] } | undefined;
  for (const o of r.overusedNodes) if (o.iter <= iter && (!best || o.iter > best.iter)) best = o;
  // Before the first record there is no data: the first record is the nearest.
  return (best ?? r.overusedNodes[0])?.nodes ?? [];
}

/** Congestion by tile: how many overused routing nodes start in each tile, and the maximum. */
export function congestionMap(nodes: readonly number[], dev: VFpgaDevice): { tiles: Map<string, number>; max: number } {
  const tiles = new Map<string, number>();
  let max = 0;
  for (const n of nodes) {
    const key = `${dev.nodeX[n]},${dev.nodeY[n]}`;
    const v = (tiles.get(key) ?? 0) + 1;
    tiles.set(key, v);
    if (v > max) max = v;
  }
  return { tiles, max };
}

/** Round-robin helper for the scrubber's play button: the next position after `dt` seconds at `speed` (of the whole trace per second). */
export const advance = (pos: number, dt: number, speed: number): number => Math.min(1, pos + dt * speed);
