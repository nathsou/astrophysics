/**
 * Static timing analysis.
 *
 * The timing graph has one vertex per signal at a cell or block pin. Edges are either **net edges** (a driver's
 * output to a sink pin; their delay comes from placement estimates or from the routes) or **cell edges** with the
 * fixed delays of the published model (`VFPGA_DELAYS`):
 *
 * - a LUT input to the LUT output: `lut`; a carry cell's I1 or I2 to its carry output: `carryData`; carry in to
 *   carry out: `carryIn`; carry in to the LUT (through I3): `lut`;
 * - a flip-flop is cut in two: its D pin is an endpoint (set-up `ffSetup`) and its Q starts a path at `ffClkToQ`;
 * - an input pad starts a path at `padIn`; an output pad ends one at `padOut`;
 * - a block RAM starts paths at `bramClkToQ` (synchronous read) and ends them at its input pins (`bramSetup`); in
 *   asynchronous mode its read address reaches its data outputs in `bramAsync`.
 *
 * Clocks are ideal. The **critical path** is the slowest path from a start to an end; the clock period cannot be
 * shorter than it, so `fmax` = 1000 / period (MHz). A design with no registers reports the delay from inputs to
 * outputs the same way.
 */
import { VFPGA_DELAYS as D } from '../devices/vfpga-arch';
import type { Packed } from './pack';

export interface TimingEdge {
  from: number;
  to: number;
  /** Fixed delay, or the connection (index of the sink in `connections`) for net edges (−1 otherwise). */
  delay: number;
  conn: number;
  label: string;
}

export interface Connection {
  net: number;
  /** Index of the sink in `Packed.nets[net].sinks`. */
  sink: number;
}

export interface TimingGraph {
  nv: number;
  edges: TimingEdge[];
  /** Launch delay of start vertices (−1 for others). */
  launch: Float64Array;
  /** Extra delay at endpoints (set-up, output buffer), −1 for others. */
  capture: Float64Array;
  vertexName: string[];
  connections: Connection[];
  /** First connection index of each packed net. */
  netConn: Int32Array;
  order: Int32Array;
  cyclic: boolean;
}

export function buildTimingGraph(p: Packed): TimingGraph {
  const nl = p.netlist;
  const names: string[] = [];
  const v = (name: string): number => names.push(name) - 1;
  const launchL: number[] = [];
  const capL: number[] = [];
  const mk = (name: string, launch = -1, capture = -1): number => {
    const id = v(name);
    launchL[id] = launch;
    capL[id] = capture;
    return id;
  };
  const edges: TimingEdge[] = [];
  const fixed = (from: number, to: number, delay: number, label: string) => edges.push({ from, to, delay, conn: -1, label });

  // Vertices per cell.
  const vin: number[][] = [];
  const vlut: number[] = [];
  const vout: number[] = [];
  const vcout: number[] = [];
  const vce: number[] = [];
  const vsr: number[] = [];
  for (const lc of nl.lcs) {
    vin[lc.id] = lc.inputs.map((n, i) => (n >= 0 ? mk(`${lc.label}.I${i}`) : -1));
    const isFf = lc.ff !== undefined;
    vlut[lc.id] = mk(`${lc.label}.lut`, lc.inputs.some((n) => n >= 0) || lc.i3Carry ? -1 : 0, isFf ? D.ffSetup : -1);
    vout[lc.id] = isFf ? mk(`${lc.label}.q`, D.ffClkToQ) : vlut[lc.id]!;
    if (lc.chain >= 0) vcout[lc.id] = mk(`${lc.label}.cout`);
    if (lc.ff) {
      vce[lc.id] = lc.ff.ce >= 0 ? mk(`${lc.label}.ce`, -1, D.ffSetup) : -1;
      vsr[lc.id] = lc.ff.sr >= 0 ? mk(`${lc.label}.sr`, -1, D.ffSetup) : -1;
    }
  }
  const vpi: number[] = [];
  const vpo: number[] = [];
  nl.ports.forEach((port, i) => {
    if (port.dir === 'in') vpi[i] = mk(`${port.name}`, D.padIn);
    else vpo[i] = mk(`${port.name}`, -1, D.padOut);
  });
  const vramIn: number[][] = [];
  const vramOut: number[][] = [];
  nl.rams.forEach((r, i) => {
    vramIn[i] = Array.from({ length: 40 }, (_, k) => mk(`${r.name}.${k}`, -1, r.asyncRead && k < 11 ? -1 : D.bramSetup));
    vramOut[i] = Array.from({ length: 16 }, (_, b) => mk(`${r.name}.DO${b}`, r.asyncRead ? -1 : D.bramClkToQ));
    if (r.asyncRead) for (let k = 0; k < 11; k++) for (let b = 0; b < 16; b++) fixed(vramIn[i]![k]!, vramOut[i]![b]!, D.bramAsync, `${r.name} async read`);
  });

  // Cell edges.
  for (const lc of nl.lcs) {
    lc.inputs.forEach((n, i) => {
      if (n >= 0) fixed(vin[lc.id]![i]!, vlut[lc.id]!, D.lut, `${lc.label} LUT`);
    });
    if (lc.chain >= 0) {
      if (lc.fixedPins) {
        if (lc.inputs[1]! >= 0) fixed(vin[lc.id]![1]!, vcout[lc.id]!, D.carryData, `${lc.label} carry`);
        if (lc.inputs[2]! >= 0) fixed(vin[lc.id]![2]!, vcout[lc.id]!, D.carryData, `${lc.label} carry`);
      }
      if (lc.chainPos > 0 && (lc.carryChain || lc.i3Carry)) {
        const prev = nl.chains[lc.chain]![lc.chainPos - 1]!;
        if (lc.carryChain) fixed(vcout[prev]!, vcout[lc.id]!, D.carryIn, `${lc.label} carry chain`);
        if (lc.i3Carry && lc.carryChain) fixed(vcout[prev]!, vlut[lc.id]!, D.lut, `${lc.label} carry to LUT`);
      }
    }
  }

  // Net edges.
  const netConn = new Int32Array(p.nets.length + 1);
  const connections: Connection[] = [];
  p.nets.forEach((net, ni) => {
    netConn[ni] = connections.length;
    const n = nl.nets[net.net]!;
    let from = -1;
    if (n.driver.kind === 'lc') from = vout[n.driver.lc]!;
    else if (n.driver.kind === 'port') from = vpi[n.driver.port]!;
    else from = vramOut[n.driver.ram]![n.driver.bit]!;
    net.sinks.forEach((s, si) => {
      let to = -1;
      const u = p.units[s.unit]!;
      if (s.kind === 'lc') {
        const lcId = p.clusters[u.cluster]!.slots[s.slot]!;
        to = vin[lcId]![s.input]!;
      } else if (s.kind === 'ce' || s.kind === 'sr') {
        const lcId = p.clusters[u.cluster]!.slots[s.slot]!;
        to = s.kind === 'ce' ? vce[lcId]! : vsr[lcId]!;
      } else if (s.kind === 'pad') to = vpo[u.port]!;
      else to = vramIn[u.ram]![s.slot]!;
      edges.push({ from, to, delay: 0, conn: connections.length, label: net.name });
      connections.push({ net: ni, sink: si });
    });
  });
  netConn[p.nets.length] = connections.length;

  // Topological order.
  const nv = names.length;
  const indeg = new Int32Array(nv);
  const outStart = new Int32Array(nv + 1);
  for (const e of edges) {
    indeg[e.to]!++;
    outStart[e.from + 1]!++;
  }
  for (let i = 0; i < nv; i++) outStart[i + 1] = outStart[i + 1]! + outStart[i]!;
  const outEdges = new Int32Array(edges.length);
  const fill = outStart.slice(0, nv);
  edges.forEach((e, i) => (outEdges[fill[e.from]!++] = i));
  const order: number[] = [];
  for (let i = 0; i < nv; i++) if (indeg[i] === 0) order.push(i);
  for (let qi = 0; qi < order.length; qi++) {
    const x = order[qi]!;
    for (let k = outStart[x]!; k < outStart[x + 1]!; k++) {
      const t = edges[outEdges[k]!]!.to;
      if (--indeg[t]! === 0) order.push(t);
    }
  }
  return {
    nv,
    edges,
    launch: Float64Array.from({ length: nv }, (_, i) => launchL[i] ?? -1),
    capture: Float64Array.from({ length: nv }, (_, i) => capL[i] ?? -1),
    vertexName: names,
    connections,
    netConn,
    order: Int32Array.from(order),
    cyclic: order.length < nv,
  };
}

export interface PathStep {
  kind: 'launch' | 'cell' | 'net' | 'capture';
  /** Vertex name or net name. */
  name: string;
  delay: number;
  /** Arrival time at the end of this step. */
  arrival: number;
  /** For net steps: the connection. */
  conn: number;
}

export interface TimingResult {
  /** Clock period the design supports, ns (the slowest path). */
  period: number;
  fmaxMHz: number;
  arrival: Float64Array;
  required: Float64Array;
  /** Slack and criticality (1 = critical) of every connection. */
  slack: Float64Array;
  crit: Float64Array;
  path: PathStep[];
  endpoint: string;
}

/** Analyse with the given delay of every connection (ns). */
export function analyse(g: TimingGraph, connDelay: ArrayLike<number>): TimingResult {
  const { nv, edges } = g;
  const arrival = new Float64Array(nv).fill(-Infinity);
  const from = new Int32Array(nv).fill(-1);
  for (let i = 0; i < nv; i++) if (g.launch[i]! >= 0) arrival[i] = g.launch[i]!;
  // Edges by target, in topological order of the target.
  const inStart = new Int32Array(nv + 1);
  for (const e of edges) inStart[e.to + 1]!++;
  for (let i = 0; i < nv; i++) inStart[i + 1] = inStart[i + 1]! + inStart[i]!;
  const inEdges = new Int32Array(edges.length);
  const fill = inStart.slice(0, nv);
  edges.forEach((e, i) => (inEdges[fill[e.to]!++] = i));
  const delayOf = (e: TimingEdge) => (e.conn >= 0 ? (connDelay[e.conn] ?? 0) : e.delay);
  for (const x of g.order) {
    let a = arrival[x]!;
    for (let k = inStart[x]!; k < inStart[x + 1]!; k++) {
      const e = edges[inEdges[k]!]!;
      const t = arrival[e.from]! + delayOf(e);
      if (t > a) {
        a = t;
        from[x] = inEdges[k]!;
      }
    }
    arrival[x] = a;
  }
  let period = 0;
  let worst = -1;
  for (let i = 0; i < nv; i++) {
    if (g.capture[i]! >= 0 && arrival[i]! > -Infinity) {
      const t = arrival[i]! + g.capture[i]!;
      if (t > period) {
        period = t;
        worst = i;
      }
    }
  }
  // Required times.
  const required = new Float64Array(nv).fill(Infinity);
  for (let i = 0; i < nv; i++) if (g.capture[i]! >= 0) required[i] = period - g.capture[i]!;
  for (let oi = g.order.length - 1; oi >= 0; oi--) {
    const x = g.order[oi]!;
    for (let k = inStart[x]!; k < inStart[x + 1]!; k++) {
      const e = edges[inEdges[k]!]!;
      const t = required[x]! - delayOf(e);
      if (t < required[e.from]!) required[e.from] = t;
    }
  }
  const slack = new Float64Array(g.connections.length);
  const crit = new Float64Array(g.connections.length);
  for (const e of edges) {
    if (e.conn < 0) continue;
    const s = required[e.to]! - arrival[e.from]! - delayOf(e);
    slack[e.conn] = Number.isFinite(s) ? s : period;
    crit[e.conn] = period > 0 ? Math.min(1, Math.max(0, 1 - slack[e.conn]! / period)) : 0;
  }
  // Critical path.
  const path: PathStep[] = [];
  if (worst >= 0) {
    const rev: PathStep[] = [{ kind: 'capture', name: g.vertexName[worst]!, delay: g.capture[worst]!, arrival: period, conn: -1 }];
    let x = worst;
    while (from[x]! >= 0) {
      const e = edges[from[x]!]!;
      rev.push({ kind: e.conn >= 0 ? 'net' : 'cell', name: e.label, delay: delayOf(e), arrival: arrival[x]!, conn: e.conn });
      x = e.from;
    }
    rev.push({ kind: 'launch', name: g.vertexName[x]!, delay: g.launch[x]! >= 0 ? g.launch[x]! : 0, arrival: g.launch[x]! >= 0 ? g.launch[x]! : 0, conn: -1 });
    path.push(...rev.reverse());
  }
  return { period, fmaxMHz: period > 0 ? 1000 / period : Infinity, arrival, required, slack, crit, path, endpoint: worst >= 0 ? g.vertexName[worst]! : '' };
}
