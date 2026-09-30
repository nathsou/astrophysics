/**
 * A timing graph small enough to see whole, analysed by the course's own static timing analysis (`analyse` in
 * `src/lib/pld/fpga/sta.ts`, the code that produces the report of Figure 30.1). The design is two flip-flops feeding
 * four LUTs that feed two flip-flops; the delays of the cells are the vFPGA's published ones, and the delays of the
 * nets are the reader's to change.
 */
import { VFPGA_DELAYS as D } from '$lib/pld/devices/vfpga-arch';
import { analyse, type TimingEdge, type TimingGraph, type TimingResult } from '$lib/pld/fpga/sta';

export interface Net {
  id: string;
  from: string;
  to: string;
  /** Default routing delay, ns. */
  delay: number;
  /** Layout (viewBox units) of the two ends. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Box {
  id: string;
  label: string;
  kind: 'ff' | 'lut';
  x: number;
  y: number;
}

export const BOXES: Box[] = [
  { id: 'FF1', label: 'FF1', kind: 'ff', x: 0, y: 20 },
  { id: 'FF2', label: 'FF2', kind: 'ff', x: 0, y: 92 },
  { id: 'L1', label: 'L1', kind: 'lut', x: 110, y: 20 },
  { id: 'L2', label: 'L2', kind: 'lut', x: 110, y: 92 },
  { id: 'L3', label: 'L3', kind: 'lut', x: 220, y: 20 },
  { id: 'L4', label: 'L4', kind: 'lut', x: 330, y: 92 },
  { id: 'FF3', label: 'FF3', kind: 'ff', x: 330, y: 20 },
  { id: 'FF4', label: 'FF4', kind: 'ff', x: 440, y: 92 },
];

const W = 56;
const H = 30;
const out = (id: string) => {
  const b = BOXES.find((x) => x.id === id)!;
  return { x: b.x + W, y: b.y + H / 2 };
};
const inn = (id: string, k = 0) => {
  const b = BOXES.find((x) => x.id === id)!;
  return { x: b.x, y: b.y + H / 2 + (k === 0 ? -5 : 5) };
};
export const BOX = { w: W, h: H };

const net = (id: string, from: string, to: string, pin: number, delay: number): Net => {
  const a = out(from);
  const b = inn(to, pin);
  return { id, from, to, delay, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
};

/** The nets, in the order of their connection index in the timing graph. */
export const NETS: Net[] = [
  net('n0', 'FF1', 'L1', 0, 0.4),
  net('n1', 'FF2', 'L1', 1, 0.9),
  net('n2', 'FF2', 'L2', 0, 0.4),
  net('n3', 'L1', 'L3', 0, 0.4),
  net('n4', 'L2', 'L3', 1, 1.1),
  net('n5', 'L2', 'L4', 0, 0.4),
  net('n6', 'L3', 'FF3', 0, 0.1),
  net('n7', 'L3', 'L4', 1, 0.5),
  net('n8', 'L4', 'FF4', 0, 0.4),
];

export const defaultDelays = (): number[] => NETS.map((n) => n.delay);

/** Vertex numbers: flip-flop outputs, LUT input pins and outputs, flip-flop D pins. */
const V = { FF1q: 0, FF2q: 1, L1a: 2, L1b: 3, L1o: 4, L2a: 5, L2o: 6, L3a: 7, L3b: 8, L3o: 9, L4a: 10, L4b: 11, L4o: 12, FF3d: 13, FF4d: 14 };
const NAMES = ['FF1.q', 'FF2.q', 'L1.I0', 'L1.I1', 'L1.out', 'L2.I0', 'L2.out', 'L3.I0', 'L3.I1', 'L3.out', 'L4.I0', 'L4.I1', 'L4.out', 'FF3.D', 'FF4.D'];

export function buildGraph(): TimingGraph {
  const edges: TimingEdge[] = [];
  const cell = (from: number, to: number, label: string) => edges.push({ from, to, delay: D.lut, conn: -1, label });
  cell(V.L1a, V.L1o, 'L1 LUT');
  cell(V.L1b, V.L1o, 'L1 LUT');
  cell(V.L2a, V.L2o, 'L2 LUT');
  cell(V.L3a, V.L3o, 'L3 LUT');
  cell(V.L3b, V.L3o, 'L3 LUT');
  cell(V.L4a, V.L4o, 'L4 LUT');
  cell(V.L4b, V.L4o, 'L4 LUT');
  const wires: [number, number][] = [
    [V.FF1q, V.L1a],
    [V.FF2q, V.L1b],
    [V.FF2q, V.L2a],
    [V.L1o, V.L3a],
    [V.L2o, V.L3b],
    [V.L2o, V.L4a],
    [V.L3o, V.FF3d],
    [V.L3o, V.L4b],
    [V.L4o, V.FF4d],
  ];
  wires.forEach(([from, to], i) => edges.push({ from, to, delay: 0, conn: i, label: NETS[i]!.id }));
  const nv = NAMES.length;
  const launch = new Float64Array(nv).fill(-1);
  launch[V.FF1q] = D.ffClkToQ;
  launch[V.FF2q] = D.ffClkToQ;
  const capture = new Float64Array(nv).fill(-1);
  capture[V.FF3d] = D.ffSetup;
  capture[V.FF4d] = D.ffSetup;
  // Kahn's algorithm, as in buildTimingGraph.
  const indeg = new Int32Array(nv);
  for (const e of edges) indeg[e.to]!++;
  const order: number[] = [];
  for (let i = 0; i < nv; i++) if (indeg[i] === 0) order.push(i);
  for (let q = 0; q < order.length; q++) for (const e of edges) if (e.from === order[q] && --indeg[e.to]! === 0) order.push(e.to);
  return {
    nv,
    edges,
    launch,
    capture,
    vertexName: NAMES,
    connections: wires.map((_, i) => ({ net: i, sink: 0 })),
    netConn: Int32Array.from(wires.map((_, i) => i).concat(wires.length)),
    order: Int32Array.from(order),
    cyclic: order.length < nv,
  };
}

export interface Timing {
  result: TimingResult;
  /** Slack of each net against the target period, ns (negative: too slow). */
  slack: number[];
  /** Slack of each net against the slowest path (0 on the critical path). */
  slackWorst: number[];
  /** The nets on the critical path. */
  critical: string[];
  /** Nets whose slack against the slowest path is zero. */
  onCritical: boolean[];
  period: number;
  fmax: number;
  target: number;
  met: boolean;
  /** Arrival time at each end point's D pin, ns. */
  arrivals: { name: string; arrival: number; slack: number }[];
}

const graph = buildGraph();

/** Analyse the design with the given net delays against a target clock period (ns). */
export function timing(delays: readonly number[], target: number): Timing {
  const r = analyse(graph, delays);
  const slackWorst = NETS.map((_, i) => r.slack[i]!);
  const slack = slackWorst.map((s) => s + (target - r.period));
  const onCritical = slackWorst.map((s) => Math.abs(s) < 1e-9);
  const critical = r.path.filter((p) => p.kind === 'net').map((p) => p.name);
  const arrivals = [V.FF3d, V.FF4d].map((v) => ({ name: NAMES[v]!, arrival: r.arrival[v]! + D.ffSetup, slack: target - (r.arrival[v]! + D.ffSetup) }));
  return { result: r, slack, slackWorst, critical, onCritical, period: r.period, fmax: r.fmaxMHz, target, met: r.period <= target + 1e-9, arrivals };
}
