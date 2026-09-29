/**
 * Routing by PathFinder (McMurchie and Ebeling, 1995): negotiated congestion on the routing-resource graph.
 *
 * Every net is routed as a tree from its source pin to all its sinks with A* search. Routing nodes have capacity
 * 1, but nets may share them at first: the cost of a node is
 *
 *     base × history × present,   present = 1 + max(0, occupancy + 1 − 1) × presFac,
 *
 * where the *history* term grows every iteration a node stays overused and `presFac` grows by `presMult` each
 * iteration, so contested nodes become expensive and nets negotiate for them. After the first iteration only
 * nets that touch an overused node are ripped up and re-routed. With `timing` on, each connection weighs a
 * node's delay against its congestion cost by its criticality (from static timing analysis).
 *
 * The four inputs of an ordinary LUT are interchangeable: a connection to such a cell may end at any of its four
 * pins, and the router picks (the truth table is permuted to match when the bitstream is generated).
 *
 * ## Trace
 *
 * `iterations[i]` records: overused nodes at the end of iteration i, nets re-routed, routing nodes in use,
 * `presFac`, and the time. `overusedNodes` lists (for the last few iterations) the overused nodes for a congestion
 * map.
 */
import type { VFpgaDevice } from '../devices/vfpga';
import { NK } from '../devices/vfpga';
import { FlowError } from './design';
import type { Packed } from './pack';
import type { Placement } from './place';
import { analyse, buildTimingGraph, type TimingGraph } from './sta';

export interface RouteOptions {
  maxIterations?: number;
  presFac0?: number;
  presMult?: number;
  accFac?: number;
  astarFac?: number;
  bboxMargin?: number;
  timing?: boolean;
  /** Reuse a timing graph. */
  graph?: TimingGraph;
  /** Called after every iteration. */
  onIteration?: (it: RouteIteration) => void;
}

export interface RouteIteration {
  iter: number;
  overused: number;
  rerouted: number;
  nodesUsed: number;
  presFac: number;
  ms: number;
}

export interface RoutedNet {
  /** Index in `Packed.nets`. */
  net: number;
  source: number;
  /** Route tree: nodes[0] is the source, parents[i] is the index in `nodes` of node i's driver (−1 for the source). */
  nodes: number[];
  parents: number[];
  /** RR node each sink of the packed net ends at (aligned with `Packed.nets[net].sinks`). */
  sinkNodes: number[];
}

export interface RouteResult {
  success: boolean;
  nets: RoutedNet[];
  iterations: RouteIteration[];
  overused: number;
  overusedNodes: { iter: number; nodes: number[] }[];
  /** Owner (index in `nets`) of each RR node, −1 if unused. */
  nodeOwner: Int32Array;
  /** Delay of every connection of the timing graph (ns), and the graph. */
  connDelay: Float64Array;
  graph: TimingGraph;
  /** LUT pin (0…3) chosen for every sink that is a cell input: pinOf[net][sink], −1 for other sinks. */
  pinOf: Int8Array[];
  stats: { nodesUsed: number; heapPops: number; wire: number };
}

interface Conn {
  net: number;
  /** Sink indices of the packed net that share this connection. */
  sinks: number[];
  targets: number[];
  tx: number;
  ty: number;
}

class Heap {
  key = new Float64Array(1024);
  val = new Int32Array(1024);
  size = 0;
  clear() {
    this.size = 0;
  }
  push(k: number, v: number) {
    if (this.size === this.key.length) {
      const nk = new Float64Array(this.size * 2);
      nk.set(this.key);
      this.key = nk;
      const nv = new Int32Array(this.size * 2);
      nv.set(this.val);
      this.val = nv;
    }
    let i = this.size++;
    const key = this.key;
    const val = this.val;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (key[p]! <= k) break;
      key[i] = key[p]!;
      val[i] = val[p]!;
      i = p;
    }
    key[i] = k;
    val[i] = v;
  }
  /** Removes the minimum; its key and value are left in popKey / popVal. */
  popKey = 0;
  popVal = 0;
  pop() {
    const key = this.key;
    const val = this.val;
    this.popKey = key[0]!;
    this.popVal = val[0]!;
    const n = --this.size;
    if (n > 0) {
      const k = key[n]!;
      const v = val[n]!;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && key[c + 1]! < key[c]!) c++;
        if (key[c]! >= k) break;
        key[i] = key[c]!;
        val[i] = val[c]!;
        i = c;
      }
      key[i] = k;
      val[i] = v;
    }
  }
}

export function route(p: Packed, pl: Placement, dev: VFpgaDevice, opts: RouteOptions = {}): RouteResult {
  const N = dev.nodeCount;
  const maxIter = opts.maxIterations ?? 60;
  let presFac = opts.presFac0 ?? 0.5;
  const presMult = opts.presMult ?? 1.4;
  const accFac = opts.accFac ?? 1;
  const astar = opts.astarFac ?? 1.2;
  const margin0 = opts.bboxMargin ?? 3;
  const timing = opts.timing !== false;
  const nl = p.netlist;
  const tg = opts.graph ?? buildTimingGraph(p);

  // Sources and connections.
  const source = new Int32Array(p.nets.length);
  const conns: Conn[] = [];
  const connsOfNet: number[][] = p.nets.map(() => []);
  const tileOf = (u: number) => [pl.unitX[u]!, pl.unitY[u]!] as const;
  p.nets.forEach((net, ni) => {
    const [dx, dy] = tileOf(net.driverUnit);
    const du = p.units[net.driverUnit]!;
    source[ni] = du.kind === 'logic' ? dev.lcOut(dx, dy, net.driverSlot) : du.kind === 'io' ? dev.padIn(pl.unitPad[net.driverUnit]!) : dev.ramOut(dx, dy, net.driverSlot);
    const byKey = new Map<string, Conn>();
    net.sinks.forEach((s, si) => {
      const [x, y] = tileOf(s.unit);
      const u = p.units[s.unit]!;
      let targets: number[];
      let key: string;
      if (s.kind === 'lc') {
        const lcId = p.clusters[u.cluster]!.slots[s.slot]!;
        const lc = nl.lcs[lcId]!;
        // The operands of a carry cell are interchangeable (its LUT is symmetric in I1 and I2), and so are all inputs of a
        // free LUT; other fixed pins have one target.
        targets = !lc.fixedPins ? [0, 1, 2, 3].map((i) => dev.lcIn(x, y, s.slot, i)) : lc.chain >= 0 && (s.input === 1 || s.input === 2) ? [dev.lcIn(x, y, s.slot, 1), dev.lcIn(x, y, s.slot, 2)] : [dev.lcIn(x, y, s.slot, s.input)];
        key = `lc${s.unit}.${s.slot}.${s.input}`;
      } else if (s.kind === 'ce') {
        targets = [dev.ce(x, y)];
        key = `ce${s.unit}`;
      } else if (s.kind === 'sr') {
        targets = [dev.sr(x, y)];
        key = `sr${s.unit}`;
      } else if (s.kind === 'pad') {
        targets = [dev.padOut(pl.unitPad[s.unit]!)];
        key = `pad${s.unit}`;
      } else {
        targets = [dev.ramIn(x, y, s.slot)];
        key = `ram${s.unit}.${s.slot}`;
      }
      let c = byKey.get(key);
      if (!c) {
        c = { net: ni, sinks: [], targets, tx: x, ty: y };
        byKey.set(key, c);
        connsOfNet[ni]!.push(conns.length);
        conns.push(c);
      }
      c.sinks.push(si);
    });
  });

  // Search state.
  const nodeX = dev.nodeX;
  const nodeY = dev.nodeY;
  const baseCost = new Float32Array(N);
  for (let n = 0; n < N; n++) baseCost[n] = dev.nodeDelay[n]! + 0.01;
  const occ = new Int32Array(N);
  const acc = new Float32Array(N).fill(1);
  const best = new Float64Array(N);
  const prevN = new Int32Array(N);
  const seen = new Int32Array(N);
  let seenId = 0;
  const targetMark = new Int32Array(N);
  let targetId = 0;
  const inTree = new Int32Array(N);
  let treeId = 0;
  const heap = new Heap();
  let heapPops = 0;
  const minPerTile = 0.9 / 12;

  const trees: RoutedNet[] = p.nets.map((net, ni) => ({ net: ni, source: source[ni]!, nodes: [], parents: [], sinkNodes: new Array(net.sinks.length).fill(-1) }));
  const connNode = new Int32Array(conns.length).fill(-1);
  const crit = new Float64Array(conns.length);
  const connCrit = new Float64Array(tg.connections.length);

  /**
   * Partial rip-up: keep the branches of the tree whose sinks do not go through an overused node, remove the rest
   * (their connections are routed again). A net without overuse is untouched.
   */
  const ripUpCongested = (ni: number) => {
    const t = trees[ni]!;
    const nn = t.nodes.length;
    const tainted = new Uint8Array(nn);
    for (let i = 0; i < nn; i++) tainted[i] = occ[t.nodes[i]!]! > 1 || (t.parents[i]! >= 0 && tainted[t.parents[i]!]! === 1) ? 1 : 0;
    const keep = new Uint8Array(nn);
    keep[0] = 1;
    for (const ci of connsOfNet[ni]!) {
      const node = connNode[ci]!;
      if (node < 0) continue;
      const idx = t.nodes.indexOf(node);
      if (idx < 0 || tainted[idx]) {
        connNode[ci] = -1;
        for (const si of conns[ci]!.sinks) t.sinkNodes[si] = -1;
      } else for (let i = idx; i >= 0 && !keep[i]; i = t.parents[i]!) keep[i] = 1;
    }
    const remap = new Int32Array(nn).fill(-1);
    const nodes: number[] = [];
    const parents: number[] = [];
    for (let i = 0; i < nn; i++) {
      if (keep[i]) {
        remap[i] = nodes.length;
        nodes.push(t.nodes[i]!);
        parents.push(t.parents[i]! >= 0 ? remap[t.parents[i]!]! : -1);
      } else occ[t.nodes[i]!]!--;
    }
    t.nodes = nodes;
    t.parents = parents;
  };

  const routeNet = (ni: number, iter: number): boolean => {
    const t = trees[ni]!;
    const cs = connsOfNet[ni]!;
    // Bounding box of the net.
    let xmin = nodeX[source[ni]!]!;
    let xmax = xmin;
    let ymin = nodeY[source[ni]!]!;
    let ymax = ymin;
    for (const ci of cs) {
      const c = conns[ci]!;
      xmin = Math.min(xmin, c.tx);
      xmax = Math.max(xmax, c.tx);
      ymin = Math.min(ymin, c.ty);
      ymax = Math.max(ymax, c.ty);
    }
    if (t.nodes.length === 0) {
      t.nodes = [source[ni]!];
      t.parents = [-1];
      occ[source[ni]!]!++;
    }
    treeId++;
    const treeIndex = new Map<number, number>();
    t.nodes.forEach((n, i) => {
      inTree[n] = treeId;
      treeIndex.set(n, i);
    });
    // Timing matters less as negotiation goes on: the weight fades out so congestion always gets resolved.
    const fade = iter <= 8 ? 1 : Math.max(0, 1 - (iter - 8) / 12);
    const order = cs.filter((ci) => connNode[ci]! < 0).sort((a, b) => crit[b]! - crit[a]! || a - b);
    for (const ci of order) {
      const c = conns[ci]!;
      const w = timing ? Math.min(0.99, crit[ci]!) * fade : 0;
      let found = -1;
      for (let margin = margin0; found < 0; margin *= 2) {
        const bx0 = xmin - margin;
        const bx1 = xmax + margin;
        const by0 = ymin - margin;
        const by1 = ymax + margin;
        // Start from the tree nodes near the sink (all of them if none is near).
        const near = 8 * (margin / margin0);
        seenId++;
        targetId++;
        for (const tn of c.targets) targetMark[tn] = targetId;
        heap.clear();
        let pushed = 0;
        for (let pass = 0; pass < 2 && pushed === 0; pass++) {
          for (const n of t.nodes) {
            const nx = nodeX[n]!;
            const ny = nodeY[n]!;
            if (nx < bx0 || nx > bx1 || ny < by0 || ny > by1) continue;
            if (pass === 0 && (Math.abs(nx - c.tx) > near || Math.abs(ny - c.ty) > near)) continue;
            seen[n] = seenId;
            best[n] = 0;
            prevN[n] = -1;
            pushed++;
            heap.push(astar * minPerTile * (Math.abs(nx - c.tx) + Math.abs(ny - c.ty)), n);
          }
        }
        while (heap.size > 0) {
          heap.pop();
          heapPops++;
          const n = heap.popVal;
          const g = best[n]!;
          if (heap.popKey > g + astar * minPerTile * (Math.abs(nodeX[n]! - c.tx) + Math.abs(nodeY[n]! - c.ty)) + 1e-9) continue;
          if (targetMark[n] === targetId && inTree[n] !== treeId) {
            found = n;
            break;
          }
          for (let e = dev.outStart[n]!; e < dev.outStart[n + 1]!; e++) {
            const m = dev.outList[e]!;
            const x = nodeX[m]!;
            const y = nodeY[m]!;
            if (x < bx0 || x > bx1 || y < by0 || y > by1) continue;
            if (inTree[m] === treeId) continue;
            const kind = dev.nodeKind[m]!;
            // Sinks are only entered when they are this connection's targets.
            if ((kind === NK.LCI || kind === NK.CE || kind === NK.SR || kind === NK.PADO || kind === NK.RAMI) && targetMark[m] !== targetId) continue;
            const o = occ[m]!;
            const pres = 1 + (o >= 1 ? o : 0) * presFac;
            const cong = baseCost[m]! * acc[m]! * pres;
            const cost = g + (w > 0 ? w * baseCost[m]! + (1 - w) * cong : cong);
            if (seen[m] !== seenId || cost < best[m]!) {
              seen[m] = seenId;
              best[m] = cost;
              prevN[m] = n;
              heap.push(cost + astar * minPerTile * (Math.abs(x - c.tx) + Math.abs(y - c.ty)), m);
            }
          }
        }
        if (margin > Math.max(dev.width, dev.height)) break;
      }
      if (found < 0) return false;
      // Add the path to the tree.
      const path: number[] = [];
      for (let n = found; n !== -1 && inTree[n] !== treeId; n = prevN[n]!) path.push(n);
      const attach = prevN[path[path.length - 1]!]!;
      let parentIdx = treeIndex.get(attach)!;
      for (let i = path.length - 1; i >= 0; i--) {
        const n = path[i]!;
        t.nodes.push(n);
        t.parents.push(parentIdx);
        parentIdx = t.nodes.length - 1;
        treeIndex.set(n, parentIdx);
        occ[n]!++;
        inTree[n] = treeId;
      }
      connNode[ci] = found;
      for (const si of c.sinks) t.sinkNodes[si] = found;
    }
    return true;
  };

  const iterations: RouteIteration[] = [];
  const overusedNodes: { iter: number; nodes: number[] }[] = [];
  const netTouches = (ni: number): boolean => {
    for (const n of trees[ni]!.nodes) if (occ[n]! > 1) return true;
    return false;
  };
  // Criticality: from the timing graph with estimated delays first, then routed delays.
  const setCrit = (delays: Float64Array) => {
    const r = analyse(tg, delays);
    for (let i = 0; i < connCrit.length; i++) connCrit[i] = r.crit[i]!;
    conns.forEach((c, ci) => {
      let m = 0;
      for (const si of c.sinks) m = Math.max(m, connCrit[tg.netConn[c.net]! + si]!);
      crit[ci] = m;
    });
  };
  const connDelay = new Float64Array(tg.connections.length);
  const idxOf = new Int32Array(N);
  const routedDelays = () => {
    for (const t of trees) {
      const arr = new Float64Array(t.nodes.length);
      for (let i = 0; i < t.nodes.length; i++) {
        idxOf[t.nodes[i]!] = i;
        if (i > 0) arr[i] = arr[t.parents[i]!]! + dev.nodeDelay[t.nodes[i]!]!;
      }
      const base = tg.netConn[t.net]!;
      t.sinkNodes.forEach((sn, si) => {
        connDelay[base + si] = sn >= 0 && t.nodes.length ? arr[idxOf[sn]!]! : 0;
      });
    }
  };
  if (timing) {
    // Estimated delays from the placement.
    p.nets.forEach((net, ni) => {
      const base = tg.netConn[ni]!;
      net.sinks.forEach((s, si) => {
        const dx = Math.abs(pl.unitX[s.unit]! - pl.unitX[net.driverUnit]!);
        const dy = Math.abs(pl.unitY[s.unit]! - pl.unitY[net.driverUnit]!);
        connDelay[base + si] = 0.3 * (dx + dy) + 0.2;
      });
    });
    setCrit(connDelay);
  }

  const t0 = Date.now();
  let success = false;
  let lastOver = 0;
  for (let iter = 1; iter <= maxIter; iter++) {
    const ti = Date.now();
    let rerouted = 0;
    // Nets to (re)route: all in the first iteration, then those on overused nodes.
    const todo: number[] = [];
    for (let ni = 0; ni < p.nets.length; ni++) if (iter === 1 || netTouches(ni)) todo.push(ni);
    // Larger nets first.
    todo.sort((a, b) => p.nets[b]!.sinks.length - p.nets[a]!.sinks.length || a - b);
    for (const ni of todo) {
      if (trees[ni]!.nodes.length) ripUpCongested(ni);
      if (!routeNet(ni, iter)) {
        // The net could not reach a sink in the graph at all.
        const net = p.nets[ni]!;
        throw new FlowError(`Net ${net.name} cannot be routed: no path in the routing graph from its driver to a sink.`, 'routing', [net.name]);
      }
      rerouted++;
    }
    let over = 0;
    let used = 0;
    const list: number[] = [];
    for (let n = 0; n < N; n++) {
      if (occ[n]! > 0) used++;
      if (occ[n]! > 1) {
        over++;
        acc[n] = acc[n]! + accFac * (occ[n]! - 1);
        if (list.length < 2000) list.push(n);
      }
    }
    lastOver = over;
    iterations.push({ iter, overused: over, rerouted, nodesUsed: used, presFac, ms: Date.now() - ti });
    opts.onIteration?.(iterations[iterations.length - 1]!);
    if (iter <= 3 || iter % 5 === 0 || over === 0) overusedNodes.push({ iter, nodes: list });
    if (over === 0) {
      success = true;
      break;
    }
    presFac *= presMult;
    if (timing) {
      routedDelays();
      setCrit(connDelay);
    }
  }
  void t0;
  routedDelays();

  const nodeOwner = new Int32Array(N).fill(-1);
  let wire = 0;
  for (const t of trees) {
    for (const n of t.nodes) {
      nodeOwner[n] = t.net;
      if (dev.nodeKind[n] === NK.WIRE) wire++;
    }
  }
  // Pin choice of cell inputs.
  const pinOf = p.nets.map((net) => new Int8Array(net.sinks.length).fill(-1));
  p.nets.forEach((net, ni) => {
    net.sinks.forEach((s, si) => {
      if (s.kind === 'lc') {
        const n = trees[ni]!.sinkNodes[si]!;
        if (n >= 0) pinOf[ni]![si] = dev.nodeIdx[n]! & 3;
      }
    });
  });
  return {
    success,
    nets: trees,
    iterations,
    overused: lastOver,
    overusedNodes,
    nodeOwner,
    connDelay,
    graph: tg,
    pinOf,
    stats: { nodesUsed: iterations.length ? iterations[iterations.length - 1]!.nodesUsed : 0, heapPops, wire },
  };
}

/** Checks a routing: every sink reached through legal edges, every node used by at most one net, sinks distinct. */
export function checkRouting(p: Packed, r: RouteResult, dev: VFpgaDevice): string[] {
  const errors: string[] = [];
  const owner = new Map<number, number>();
  for (const t of r.nets) {
    const net = p.nets[t.net]!;
    t.nodes.forEach((n, i) => {
      const prev = owner.get(n);
      if (prev !== undefined && prev !== t.net) errors.push(`routing node ${dev.nodeName(n)} is used by nets ${p.nets[prev]!.name} and ${net.name}`);
      owner.set(n, t.net);
      if (i > 0) {
        const par = t.nodes[t.parents[i]!]!;
        if (dev.selectFor(n, par) === 0) errors.push(`${dev.nodeName(par)} does not feed ${dev.nodeName(n)}`);
      }
    });
    net.sinks.forEach((_, si) => {
      if (t.sinkNodes[si]! < 0 || !t.nodes.includes(t.sinkNodes[si]!)) errors.push(`net ${net.name}: sink ${si} is not routed`);
    });
  }
  return errors;
}
