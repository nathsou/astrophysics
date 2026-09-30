/**
 * Cross-probing for the vFPGA: one selection ({@link FpgaRef}) expands to everything it touches ({@link FpgaProbe}).
 *
 * The maps come from the flow (`FpgaResult.cells`, `nets`, `sources`, each cell's source elements and paths) and,
 * for the gate view, from the lowered netlist (`LogicLink`): a gate knows the RTL cell it implements, and the
 * FPGA's source ids name the same RTL cells (`Counter/add#4` is cell 4 of `Counter`).
 *
 *   source line ─┬─ RTL cells (sources) ── logic cells ── configuration bits
 *   module path ─┘        │                     └─ nets ── routing nodes ── mux select bits
 *   gate (element) ───────┘
 */
import type { Lowered } from '../../hdl/lower/types';
import { describeBit, lcOffset } from '../../pld/devices/vfpga-config';
import { NK, type VFpgaDevice } from '../../pld/devices/vfpga';
import { LC_BITS } from '../../pld/devices/vfpga-arch';
import { nodeNets } from './result';
import { EMPTY_FPGA_PROBE, type FpgaProbe, type FpgaRef, type FpgaResult } from './types';

/** What the gate view knows about its elements, for linking them to the flow's source elements. */
export interface LogicLink {
  elements: Map<string, { cell: number; kind: string; path: string; line?: number }>;
  /** RTL cell id → gate ids. */
  cellElements: Map<number, string[]>;
  /** Gate id of a port bit → its name. */
  ports: Map<string, string>;
  /** Port name → gate id. */
  portElement: Map<string, string>;
}

export function logicLinkOf(l: Lowered): LogicLink {
  const elements = new Map<string, { cell: number; kind: string; path: string; line?: number }>();
  for (const [id, e] of Object.entries(l.elements)) elements.set(id, { cell: e.cell, kind: e.kind, path: e.path, line: e.src?.line });
  const cellElements = new Map<number, string[]>();
  for (const [c, ids] of Object.entries(l.cells)) cellElements.set(Number(c), ids);
  const ports = new Map<string, string>();
  const portElement = new Map<string, string>();
  for (const p of l.ports) {
    p.elements.forEach((id, i) => {
      const name = p.width > 1 ? `${p.name}[${i}]` : p.name;
      ports.set(id, name);
      portElement.set(name, id);
    });
  }
  return { elements, cellElements, ports, portElement };
}

/** The RTL cell id in a source id (`Counter/add#4` → 4), or −1. */
export const cellIdOfSource = (id: string): number => {
  const m = /#(\d+)$/.exec(id);
  return m ? Number(m[1]) : -1;
};

/** The source id of an RTL cell (`path/kind#id`), the way `fromRtl` names them. */
export const sourceIdOf = (path: string, kind: string, cell: number): string => `${path}/${kind}#${cell}`;

export const cellKey = (x: number, y: number, k: number): string => `${x},${y},${k}`;
export const tileKey = (x: number, y: number): string => `${x},${y}`;

export interface FpgaIndex {
  result: FpgaResult;
  device: VFpgaDevice;
  logic?: LogicLink;
  /** Routed net (index in `result.nets`) using each routing node, −1 if none. */
  nodeNet: Int32Array;
  /** Index in `result.sources` by id. */
  sourceByIndex: Map<string, number>;
  /** Cells (indices in `result.cells`) by RTL source id. */
  cellsBySource: Map<string, number[]>;
  /** Cells by tile key. */
  cellsByTile: Map<string, number[]>;
  /** Source ids on a source line. */
  sourcesByLine: Map<number, string[]>;
  /** Source ids by module path, and the module paths in order. */
  sourcesByPath: Map<string, string[]>;
  modulePaths: string[];
  /** Nets by source id of their driver. */
  netsBySource: Map<string, number[]>;
  /** The net driven by a cell (index), if it is routed. */
  netOfCell: Map<string, number>;
  portByName: Map<string, number>;
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
};

export function buildIndex(result: FpgaResult, device: VFpgaDevice, logic?: LogicLink): FpgaIndex {
  const sourceByIndex = new Map<string, number>();
  const sourcesByLine = new Map<number, string[]>();
  const sourcesByPath = new Map<string, string[]>();
  result.sources.forEach((s, i) => {
    sourceByIndex.set(s.id, i);
    if (s.line !== undefined) push(sourcesByLine, s.line, s.id);
    if (s.type !== 'port') push(sourcesByPath, s.path, s.id);
  });
  const cellsBySource = new Map<string, number[]>();
  const cellsByTile = new Map<string, number[]>();
  result.cells.forEach((c, i) => {
    for (const id of c.sourceIds) push(cellsBySource, id, i);
    push(cellsByTile, tileKey(c.x, c.y), i);
  });
  const netsBySource = new Map<string, number[]>();
  const netOfCell = new Map<string, number>();
  const nodeNet = nodeNets(result, device);
  result.nets.forEach((n, i) => {
    for (const id of n.sourceIds) push(netsBySource, id, i);
    const d = n.nodes[0];
    if (d !== undefined && device.nodeKind[d] === NK.LCO) netOfCell.set(cellKey(device.nodeX[d]!, device.nodeY[d]!, device.nodeIdx[d]!), i);
  });
  const portByName = new Map(result.ports.map((p, i) => [p.name, i]));
  return { result, device, logic, nodeNet, sourceByIndex, cellsBySource, cellsByTile, sourcesByLine, sourcesByPath, modulePaths: [...sourcesByPath.keys()].sort(), netsBySource, netOfCell, portByName };
}

/** True when `path` is `root` or below it (`Cpu.alu` is below `Cpu`). */
export const isBelow = (path: string, root: string): boolean => path === root || path.startsWith(`${root}.`);

class Acc {
  cells = new Set<string>();
  tiles = new Set<string>();
  nets = new Set<number>();
  bits = new Set<number>();
  lines = new Set<number>();
  modules = new Set<string>();
  elements = new Set<string>();
  sources = new Set<string>();
  ports = new Set<string>();
  probe(): FpgaProbe {
    return this;
  }
}

/** The configuration bits of a cell (25) and of the routing multiplexers of a net. */
function cellBits(ix: FpgaIndex, x: number, y: number, k: number, into: Set<number>): void {
  const o = lcOffset(ix.device, x, y, k);
  for (let b = 0; b < LC_BITS; b++) into.add(o + b);
}
function netBits(ix: FpgaIndex, net: number, into: Set<number>): void {
  const d = ix.device;
  for (const n of ix.result.nets[net]!.nodes) {
    const off = d.cfgOffset[n]!;
    if (off < 0) continue;
    for (let b = 0; b < d.cfgWidth[n]!; b++) into.add(off + b);
  }
}

/** Adds a source element and everything that follows from it. */
function addSource(ix: FpgaIndex, a: Acc, id: string): void {
  a.sources.add(id);
  const si = ix.sourceByIndex.get(id);
  const s = si === undefined ? undefined : ix.result.sources[si];
  if (s) {
    if (s.line !== undefined) a.lines.add(s.line);
    if (s.type !== 'port') a.modules.add(s.path);
    else a.ports.add(s.id);
  }
  for (const ci of ix.cellsBySource.get(id) ?? []) {
    const c = ix.result.cells[ci]!;
    a.cells.add(cellKey(c.x, c.y, c.k));
    a.tiles.add(tileKey(c.x, c.y));
    cellBits(ix, c.x, c.y, c.k, a.bits);
  }
  for (const n of ix.netsBySource.get(id) ?? []) {
    a.nets.add(n);
    netBits(ix, n, a.bits);
  }
  const cell = cellIdOfSource(id);
  if (ix.logic && cell >= 0) for (const e of ix.logic.cellElements.get(cell) ?? []) a.elements.add(e);
}

/** Adds the cells a net's route ends at (its driver and its sinks). */
function addNetCells(ix: FpgaIndex, a: Acc, net: number): void {
  const d = ix.device;
  a.nets.add(net);
  netBits(ix, net, a.bits);
  const n = ix.result.nets[net]!;
  for (const node of n.nodes) {
    const kind = d.nodeKind[node]!;
    let k = -1;
    if (kind === NK.LCO) k = d.nodeIdx[node]!;
    else if (kind === NK.LCI) k = d.nodeIdx[node]! >> 2;
    if (k >= 0) {
      a.cells.add(cellKey(d.nodeX[node]!, d.nodeY[node]!, k));
      a.tiles.add(tileKey(d.nodeX[node]!, d.nodeY[node]!));
    } else if (kind === NK.CE || kind === NK.SR) a.tiles.add(tileKey(d.nodeX[node]!, d.nodeY[node]!));
  }
  for (const id of n.sourceIds) addSource(ix, a, id);
}

/** Everything related to a selection. */
export function resolveFpga(ix: FpgaIndex | null | undefined, ref: FpgaRef | null | undefined): FpgaProbe {
  if (!ix || !ref) return EMPTY_FPGA_PROBE;
  const a = new Acc();
  const r = ix.result;
  switch (ref.kind) {
    case 'line': {
      a.lines.add(ref.line);
      for (const id of ix.sourcesByLine.get(ref.line) ?? []) addSource(ix, a, id);
      if (ix.logic) for (const [id, e] of ix.logic.elements) if (e.line === ref.line) a.elements.add(id);
      break;
    }
    case 'module': {
      a.modules.add(ref.path);
      for (const [path, ids] of ix.sourcesByPath) if (isBelow(path, ref.path)) for (const id of ids) addSource(ix, a, id);
      break;
    }
    case 'source':
      addSource(ix, a, ref.id);
      break;
    case 'element': {
      a.elements.add(ref.id);
      const e = ix.logic?.elements.get(ref.id);
      if (e && e.cell >= 0) {
        addSource(ix, a, sourceIdOf(e.path, e.kind, e.cell));
      } else if (ix.logic?.ports.has(ref.id)) {
        const name = ix.logic.ports.get(ref.id)!;
        a.ports.add(name);
        const pi = ix.portByName.get(name);
        if (pi !== undefined) a.tiles.add(tileKey(r.ports[pi]!.x, r.ports[pi]!.y));
        for (const n of ix.result.nets) if (n.name === name) addNetCells(ix, a, ix.result.nets.indexOf(n));
      }
      break;
    }
    case 'cell': {
      const ci = r.cellIndex[cellKey(ref.x, ref.y, ref.k)];
      a.cells.add(cellKey(ref.x, ref.y, ref.k));
      a.tiles.add(tileKey(ref.x, ref.y));
      cellBits(ix, ref.x, ref.y, ref.k, a.bits);
      if (ci !== undefined) {
        for (const id of r.cells[ci]!.sourceIds) addSource(ix, a, id);
        const out = ix.netOfCell.get(cellKey(ref.x, ref.y, ref.k));
        if (out !== undefined) {
          a.nets.add(out);
          netBits(ix, out, a.bits);
        }
        // The nets feeding its pins.
        for (let i = 0; i < 4; i++) {
          const n = ix.nodeNet[ix.device.lcIn(ref.x, ref.y, ref.k, i)]!;
          if (n >= 0) {
            a.nets.add(n);
            netBits(ix, n, a.bits);
          }
        }
      }
      break;
    }
    case 'tile': {
      a.tiles.add(tileKey(ref.x, ref.y));
      for (const ci of ix.cellsByTile.get(tileKey(ref.x, ref.y)) ?? []) {
        const c = r.cells[ci]!;
        a.cells.add(cellKey(c.x, c.y, c.k));
        for (const id of c.sourceIds) addSource(ix, a, id);
      }
      break;
    }
    case 'net':
      if (r.nets[ref.net]) addNetCells(ix, a, ref.net);
      break;
    case 'bit': {
      a.bits.add(ref.index);
      if (ref.index < 0 || ref.index >= ix.device.totalBits) break;
      const d = describeBit(ix.device, ref.index);
      a.tiles.add(tileKey(d.tile.x, d.tile.y));
      if ((d.category === 'lut' || d.category === 'lc-flag') && d.cell !== undefined) {
        const key = cellKey(d.tile.x, d.tile.y, d.cell);
        a.cells.add(key);
        const ci = r.cellIndex[key];
        if (ci !== undefined) for (const id of r.cells[ci]!.sourceIds) addSource(ix, a, id);
      } else if (d.category === 'mux' && d.node !== undefined) {
        const n = ix.nodeNet[d.node]!;
        if (n >= 0) addNetCells(ix, a, n);
      }
      break;
    }
    case 'port': {
      a.ports.add(ref.name);
      const pi = ix.portByName.get(ref.name);
      if (pi !== undefined) a.tiles.add(tileKey(r.ports[pi]!.x, r.ports[pi]!.y));
      const el = ix.logic?.portElement.get(ref.name);
      if (el) a.elements.add(el);
      r.nets.forEach((n, i) => {
        if (n.name === ref.name) addNetCells(ix, a, i);
      });
      break;
    }
  }
  return a.probe();
}

/** Where the flow put the things a source id implements (for the details panel). */
export function whereIs(ix: FpgaIndex, id: string): { cells: number; nets: number; pads: string[] } {
  const t = ix.result.bySource[id];
  return { cells: (ix.cellsBySource.get(id) ?? []).length, nets: (ix.netsBySource.get(id) ?? []).length, pads: t?.pads ?? [] };
}
