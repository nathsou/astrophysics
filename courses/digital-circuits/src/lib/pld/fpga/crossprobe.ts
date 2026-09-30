/**
 * Hierarchy and cross-probing data.
 *
 * Synthesis keeps, for every AIG node, the source elements it came from; the mapper and packer carry that to
 * cells; the router knows each net's route. `crossProbe` puts it together so a selection in any view can be found
 * in the others:
 *
 * - `cells`: for every configured cell (LUT and/or flip-flop, chain cell, constant, inverter), its tile and slot, the
 *   source elements and hierarchical paths it implements, and where its 25 configuration bits are;
 * - `nets`: for every routed net, its routing nodes and the source elements it comes from;
 * - `nodeNet`: for every routing node, the net using it (−1 if unused);
 * - `bySource`: for every source element, where it ended up: cells, nets, pads and block RAMs (an element that
 *   optimisation removed has empty lists).
 */
import { lcOffset, padOffset } from '../devices/vfpga-config';
import type { VFpgaDevice } from '../devices/vfpga';
import type { BitgenResult } from './bitgen';
import type { Design } from './design';
import type { LcKind, LcNetlist } from './lcnet';
import type { Packed } from './pack';
import type { Placement } from './place';
import type { RouteResult } from './route';

export interface CellProbe {
  /** Index in the cell netlist. */
  lc: number;
  x: number;
  y: number;
  k: number;
  kind: LcKind;
  label: string;
  sources: number[];
  sourceIds: string[];
  paths: string[];
  /** Offset of the cell's first configuration bit (the LUT truth table); the cell has 25 bits. */
  bitOffset: number;
  truth: number;
}

export interface NetProbe {
  net: number;
  name: string;
  /** Routing nodes of the route tree (source first). */
  nodes: number[];
  sources: number[];
  sourceIds: string[];
}

export interface PlacedThing {
  cells: { x: number; y: number; k: number }[];
  nets: string[];
  pads: string[];
  rams: string[];
}

export interface CrossProbe {
  cells: CellProbe[];
  cellIndex: Record<string, number>;
  nets: NetProbe[];
  nodeNet: Int32Array;
  bySource: Record<string, PlacedThing>;
}

export function crossProbe(d: Design, nl: LcNetlist, p: Packed, pl: Placement, r: RouteResult, bg: BitgenResult, dev: VFpgaDevice): CrossProbe {
  const ids = (srcs: number[]) => srcs.map((s) => d.sources[s]?.id ?? `#${s}`);
  const cells: CellProbe[] = [];
  const cellIndex: Record<string, number> = {};
  const bySource: Record<string, PlacedThing> = {};
  const thing = (id: string): PlacedThing => (bySource[id] ??= { cells: [], nets: [], pads: [], rams: [] });
  for (const s of d.sources) thing(s.id);
  nl.lcs.forEach((lc, i) => {
    const at = bg.cellAt[i];
    if (!at) return;
    const sources = [...new Set(lc.origins)].sort((a, b) => a - b);
    const sourceIds = ids(sources);
    const paths = [...new Set(sources.map((s) => d.sources[s]?.path ?? ''))];
    cellIndex[`${at.x},${at.y},${at.k}`] = cells.length;
    cells.push({ lc: i, x: at.x, y: at.y, k: at.k, kind: lc.kind, label: lc.label, sources, sourceIds, paths, bitOffset: lcOffset(dev, at.x, at.y, at.k), truth: 0 });
    for (const id of sourceIds) thing(id).cells.push({ x: at.x, y: at.y, k: at.k });
  });
  for (const c of cells) {
    let t = 0;
    const o = c.bitOffset;
    for (let b = 0; b < 16; b++) t |= bg.bits[o + b]! << b;
    c.truth = t;
  }

  const nets: NetProbe[] = [];
  const nodeNet = new Int32Array(dev.nodeCount).fill(-1);
  for (const t of r.nets) {
    const pn = p.nets[t.net]!;
    const n = nl.nets[pn.net]!;
    let sources: number[] = [];
    if (n.driver.kind === 'lc') sources = nl.lcs[n.driver.lc]!.origins;
    else if (n.driver.kind === 'port') sources = [nl.ports[n.driver.port]!.src];
    else sources = nl.rams[n.driver.ram]!.origins;
    const np: NetProbe = { net: pn.net, name: pn.name, nodes: t.nodes.slice(), sources: [...new Set(sources)], sourceIds: ids([...new Set(sources)]) };
    t.nodes.forEach((node) => (nodeNet[node] = nets.length));
    nets.push(np);
    for (const id of np.sourceIds) thing(id).nets.push(pn.name);
  }
  nl.ports.forEach((port, i) => {
    const pad = pl.unitPad[p.portUnit[i]!]!;
    thing(d.sources[port.src]?.id ?? port.name).pads.push(`${dev.pads[pad]!.name} (${port.name}) bit ${padOffset(dev, pad)}`);
  });
  nl.rams.forEach((ram, i) => {
    const u = p.ramUnit[i]!;
    for (const s of ram.origins) thing(d.sources[s]!.id).rams.push(`RAM(${pl.unitX[u]},${pl.unitY[u]})`);
  });
  return { cells, cellIndex, nets, nodeNet, bySource };
}

/** The cell at a slot, if configured. */
export const probeCell = (pr: CrossProbe, x: number, y: number, k: number): CellProbe | undefined => {
  const i = pr.cellIndex[`${x},${y},${k}`];
  return i === undefined ? undefined : pr.cells[i];
};

/** The net that uses a routing node, if any. */
export const probeNode = (pr: CrossProbe, node: number): NetProbe | undefined => {
  const i = pr.nodeNet[node]!;
  return i < 0 ? undefined : pr.nets[i];
};
