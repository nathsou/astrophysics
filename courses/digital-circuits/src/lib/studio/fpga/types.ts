/**
 * The vFPGA in the Device Studio: the data shared by the worker, the panes and the chip view.
 *
 * The flow runs in a Web Worker (`worker.ts`) and answers with an {@link FpgaResult}: plain data (typed arrays and
 * objects, no class instances or functions), which the page combines with `getVFpga(size)` (built on the page: the
 * routing-resource graph is code-generated, so it is not sent).
 *
 * Selections are {@link FpgaRef}s and their meaning in every pane is a {@link FpgaProbe} (`crossmap.ts`).
 */
import type { RtlDesign } from '../../hdl/rtl';
import type { CellProbe, NetProbe } from '../../pld/fpga/crossprobe';
import type { PlaceStep } from '../../pld/fpga/place';
import type { FlowReport, PathReportStep } from '../../pld/fpga/report';
import type { RouteIteration } from '../../pld/fpga/route';
import type { VFpgaSize } from '../../pld/devices/vfpga-arch';

export type { CellProbe, NetProbe, PlaceStep, FlowReport, PathReportStep, RouteIteration, VFpgaSize };

// ── Selection ─────────────────────────────────────────────────────────────────────────────────────

/** A selectable item of the FPGA views. */
export type FpgaRef =
  /** A source line (1-based). */
  | { kind: 'line'; line: number }
  /** A module instance path (`Cpu.alu`): its cells and everything below it. */
  | { kind: 'module'; path: string }
  /** A gate of the logic view (its element id in the lowered netlist). */
  | { kind: 'element'; id: string }
  /** A source element of the RTL (`Counter/add#4`). */
  | { kind: 'source'; id: string }
  /** A logic cell of the chip: tile and slot. */
  | { kind: 'cell'; x: number; y: number; k: number }
  /** A tile. */
  | { kind: 'tile'; x: number; y: number }
  /** A routed net, by index in `FpgaResult.nets`. */
  | { kind: 'net'; net: number }
  /** A configuration bit. */
  | { kind: 'bit'; index: number }
  /** A port of the top module by name (`count[2]`, `clk`). */
  | { kind: 'port'; name: string };

export const fpgaRefKey = (r: FpgaRef | null | undefined): string => {
  if (!r) return '';
  switch (r.kind) {
    case 'line':
      return `line:${r.line}`;
    case 'module':
      return `module:${r.path}`;
    case 'element':
    case 'source':
      return `${r.kind}:${r.id}`;
    case 'cell':
      return `cell:${r.x},${r.y},${r.k}`;
    case 'tile':
      return `tile:${r.x},${r.y}`;
    case 'net':
      return `net:${r.net}`;
    case 'bit':
      return `bit:${r.index}`;
    case 'port':
      return `port:${r.name}`;
  }
};

export const sameFpgaRef = (a: FpgaRef | null | undefined, b: FpgaRef | null | undefined): boolean => fpgaRefKey(a) === fpgaRefKey(b);

/** Everything a selection touches, in every view. */
export interface FpgaProbe {
  /** Cells as `x,y,k`. */
  cells: ReadonlySet<string>;
  /** Tiles as `x,y` (the tiles of the cells, and the tile selected). */
  tiles: ReadonlySet<string>;
  /** Indices in `FpgaResult.nets`. */
  nets: ReadonlySet<number>;
  /** Configuration bits. */
  bits: ReadonlySet<number>;
  /** Source lines (1-based). */
  lines: ReadonlySet<number>;
  /** Module paths. */
  modules: ReadonlySet<string>;
  /** Gate ids of the logic view. */
  elements: ReadonlySet<string>;
  /** RTL source elements. */
  sources: ReadonlySet<string>;
  /** Ports of the top module. */
  ports: ReadonlySet<string>;
}

export const EMPTY_FPGA_PROBE: FpgaProbe = Object.freeze({
  cells: new Set<string>(),
  tiles: new Set<string>(),
  nets: new Set<number>(),
  bits: new Set<number>(),
  lines: new Set<number>(),
  modules: new Set<string>(),
  elements: new Set<string>(),
  sources: new Set<string>(),
  ports: new Set<string>(),
});

export const isEmptyFpgaProbe = (p: FpgaProbe): boolean =>
  p.cells.size === 0 && p.tiles.size === 0 && p.nets.size === 0 && p.bits.size === 0 && p.lines.size === 0 && p.modules.size === 0 && p.elements.size === 0 && p.sources.size === 0 && p.ports.size === 0;

// ── The flow's result, as plain data ──────────────────────────────────────────────────────────────

export interface FpgaSource {
  id: string;
  path: string;
  type: string;
  line?: number;
  col?: number;
}

export interface FpgaPort {
  /** `count[2]`, `clk`. */
  name: string;
  dir: 'in' | 'out';
  clock: boolean;
  /** The pad the place-and-route tool assigned (`P12`), its index and tile. */
  pad: string;
  padIndex: number;
  x: number;
  y: number;
}

/** A placeable block, for the replay: a logic tile, a pad or a block RAM. */
export interface FpgaUnit {
  kind: 'logic' | 'io' | 'bram';
  label: string;
  /** Cells the tile holds (logic units). */
  cells: number;
}

export interface FpgaSnapshot {
  iter: number;
  bb: number;
  x: Int16Array;
  y: Int16Array;
  pad: Int16Array;
}

export interface FpgaPlacement {
  units: FpgaUnit[];
  unitX: Int16Array;
  unitY: Int16Array;
  unitPad: Int16Array;
  steps: PlaceStep[];
  snapshots: FpgaSnapshot[];
  initial: { bb: number; timing: number };
  bb: number;
  timing: number;
  estPeriod: number;
  seed: number;
  /** Connections between units, for drawing the placement's wiring: [driver unit, sink unit, net]. */
  links: Int32Array;
}

export interface FpgaRoutedNet {
  /** Index in `FpgaResult.nets`. */
  index: number;
  name: string;
  nodes: number[];
  parents: number[];
}

export interface FpgaRouting {
  success: boolean;
  iterations: RouteIteration[];
  /** Routing nodes still overused after each iteration (the router keeps a sample per iteration). */
  overusedNodes: { iter: number; nodes: number[] }[];
  nets: FpgaRoutedNet[];
}

export interface FpgaCritical {
  periodNs: number;
  fmaxMHz: number;
  endpoint: string;
  /** The path as the report lists it, with the routing nodes of every net step. */
  steps: (PathReportStep & { nodes: number[] })[];
  /** Routing nodes of the whole path. */
  nodes: number[];
  /** Cells on the path as `x,y,k`. */
  cells: string[];
}

export interface FpgaResult {
  size: VFpgaSize;
  deviceName: string;
  bits: Uint8Array;
  bitstream: Uint8Array;
  report: FlowReport;
  times: Record<string, number>;
  log: string[];
  sources: FpgaSource[];
  cells: CellProbe[];
  cellIndex: Record<string, number>;
  nets: NetProbe[];
  ports: FpgaPort[];
  place: FpgaPlacement;
  route: FpgaRouting;
  critical: FpgaCritical;
  /** Source ids (`Counter/add#4`) → nets and pads, from the flow's cross-probing. */
  bySource: Record<string, { nets: string[]; pads: string[]; rams: string[] }>;
  designName: string;
}

// ── The worker protocol ───────────────────────────────────────────────────────────────────────────

export interface FlowRequest {
  id: number;
  design: RtlDesign;
  device?: VFpgaSize;
  seed?: number;
  /** Port name → pad name. */
  pins?: Record<string, string>;
}

export type FlowMessage =
  | { id: number; type: 'progress'; stage: string; phase: 'start' | 'end'; ms?: number }
  | { id: number; type: 'result'; result: FpgaResult }
  | { id: number; type: 'error'; message: string; stage?: string; elements?: string[] };

/** The stages `runFlow` reports, in order, with the share of the progress bar each takes. */
export const FLOW_STAGES: { name: string; weight: number; label: string }[] = [
  { name: 'check', weight: 2, label: 'Check' },
  { name: 'elaborate', weight: 2, label: 'Elaborate' },
  { name: 'front end', weight: 3, label: 'Front end' },
  { name: 'synthesis', weight: 6, label: 'Synthesis' },
  { name: 'carry chains', weight: 3, label: 'Carry chains' },
  { name: 'lut mapping', weight: 8, label: 'LUT mapping' },
  { name: 'cell netlist', weight: 2, label: 'Cell netlist' },
  { name: 'packing', weight: 4, label: 'Packing' },
  { name: 'placement', weight: 30, label: 'Placement' },
  { name: 'routing', weight: 30, label: 'Routing' },
  { name: 'timing analysis', weight: 3, label: 'Timing' },
  { name: 'bitstream', weight: 4, label: 'Bitstream' },
  { name: 'cross-probing', weight: 3, label: 'Cross-probing' },
];

/** The progress (0…1) after the stages in `done` have ended and `running` has started. */
export function flowProgress(done: ReadonlySet<string>, running?: string): number {
  const total = FLOW_STAGES.reduce((s, x) => s + x.weight, 0);
  let acc = 0;
  for (const s of FLOW_STAGES) {
    if (done.has(s.name)) acc += s.weight;
    else if (s.name === running) acc += s.weight * 0.5;
  }
  return Math.min(1, acc / total);
}
