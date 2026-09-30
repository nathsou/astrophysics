/**
 * What the chip view draws, precomputed from a configuration: which cells are configured, which module each belongs
 * to, the routing, the critical path, and labels. Built once per fit (or edit), not per frame.
 */
import { LCS_PER_TILE, LC_BITS } from '../../pld/devices/vfpga-arch';
import { NK, TILE_LOGIC, type VFpgaDevice } from '../../pld/devices/vfpga';
import { lcOffset } from '../../pld/devices/vfpga-config';
import { edgesFromBits, edgesFromResult, type RouteEdges } from './routing';
import { dieGeom, type DieGeom } from './geometry';
import type { FpgaIndex } from './crossmap';
import type { FpgaResult } from './types';

export interface ChipModel {
  device: VFpgaDevice;
  g: DieGeom;
  bits: Uint8Array;
  /** Configured cells per logic tile (index `tid`): a byte per slot, 1 if any of its 25 bits is set. */
  used: Map<number, Uint8Array>;
  usedCount: number;
  /** Module index (in `modules`) of a cell, by `x,y,k`. */
  cellModule: Map<string, number>;
  modules: string[];
  routing: RouteEdges;
  /** Routed wires (and the net of each, −1 by hand). */
  wireNet: Map<number, number>;
  /** Nodes of the critical path and its cells. */
  criticalNodes: ReadonlySet<number>;
  criticalCells: ReadonlySet<string>;
  /** Port names on pads (design mode). */
  padPort: Map<number, string>;
  /** Cell labels from the flow (`value[1]`), by `x,y,k`. */
  cellLabel: Map<string, string>;
  /** Cell kind from the flow, by `x,y,k`. */
  cellKind: Map<string, string>;
}

export function buildChipModel(device: VFpgaDevice, bits: Uint8Array, result?: FpgaResult | null, index?: FpgaIndex | null): ChipModel {
  const g = dieGeom(device);
  const used = new Map<number, Uint8Array>();
  let usedCount = 0;
  for (let x = 0; x < device.width; x++) {
    for (let y = 0; y < device.height; y++) {
      const t = device.tid(x, y);
      if (device.tileKind[t] !== TILE_LOGIC) continue;
      let flags: Uint8Array | undefined;
      for (let k = 0; k < LCS_PER_TILE; k++) {
        const o = lcOffset(device, x, y, k);
        let any = false;
        for (let b = 0; b < LC_BITS && !any; b++) any = bits[o + b] === 1;
        if (any) {
          (flags ??= new Uint8Array(LCS_PER_TILE))[k] = 1;
          usedCount++;
        }
      }
      if (flags) used.set(t, flags);
    }
  }
  const modules = index?.modulePaths ?? [];
  const cellModule = new Map<string, number>();
  const cellLabel = new Map<string, string>();
  const cellKind = new Map<string, string>();
  const padPort = new Map<number, string>();
  if (result) {
    for (const c of result.cells) {
      const key = `${c.x},${c.y},${c.k}`;
      cellLabel.set(key, c.label);
      cellKind.set(key, c.kind);
      // The deepest module among the paths the cell implements.
      let best = -1;
      let depth = -1;
      for (const p of c.paths) {
        const m = modules.indexOf(p);
        const d = p.split('.').length;
        if (m >= 0 && d > depth) {
          best = m;
          depth = d;
        }
      }
      if (best >= 0) cellModule.set(key, best);
    }
    for (const p of result.ports) padPort.set(p.padIndex, p.name);
  }
  const routing = result ? edgesFromResult(result) : edgesFromBits(device, bits);
  const wireNet = new Map<number, number>();
  for (let i = 0; i < routing.count; i++) {
    const to = routing.edges[3 * i + 1]!;
    const from = routing.edges[3 * i]!;
    const net = routing.edges[3 * i + 2]!;
    if (device.nodeKind[to] === NK.WIRE) wireNet.set(to, net);
    if (device.nodeKind[from] === NK.WIRE && !wireNet.has(from)) wireNet.set(from, net);
  }
  return {
    device,
    g,
    bits,
    used,
    usedCount,
    cellModule,
    modules,
    routing,
    wireNet,
    criticalNodes: new Set(result?.critical.nodes ?? []),
    criticalCells: new Set(result?.critical.cells ?? []),
    padPort,
    cellLabel,
    cellKind,
  };
}

/** The module colour index a tile takes: the module of most of its cells, −1 if it has none. */
export function tileModule(m: ChipModel, x: number, y: number): number {
  const counts = new Map<number, number>();
  for (let k = 0; k < LCS_PER_TILE; k++) {
    const c = m.cellModule.get(`${x},${y},${k}`);
    if (c !== undefined) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = -1;
  let n = 0;
  for (const [c, v] of counts) if (v > n) {
    best = c;
    n = v;
  }
  return best;
}

/** How many cells of a logic tile are configured. */
export function tileUse(m: ChipModel, x: number, y: number): number {
  const f = m.used.get(m.device.tid(x, y));
  if (!f) return 0;
  let n = 0;
  for (const v of f) n += v;
  return n;
}

/** A colour for module `i` of `n`: well-spread hues (golden angle), same lightness so tints look alike. */
export const moduleHue = (i: number): number => (i * 137.508 + 200) % 360;
