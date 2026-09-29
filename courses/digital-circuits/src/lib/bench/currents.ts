/**
 * Currents along wires, for the moving-dots view.
 *
 * Engines report the current into each pin of each element. The wires of a net form a graph whose
 * vertices are wire corners, T-junctions and pins; the pins inject or draw current. On a tree the
 * current in every wire section follows from Kirchhoff's current law by accumulating from the
 * leaves. For a net whose wires form a loop, a spanning tree carries the current and the remaining
 * sections carry none (arbitrary, but consistent from frame to frame).
 *
 * `buildWireGraph` runs once per circuit; `solveEdgeCurrents` runs every frame in O(edges).
 */
import type { Wire } from '../sim/netlist/types';

export interface PinRef {
  /** "componentId.pinName". */
  key: string;
  x: number;
  y: number;
  net: number;
}

export interface CurrentEdge {
  net: number;
  /** The wire this section belongs to. */
  wire: number;
  /** Grid points from node a to node b (corners included). Positive current flows a → b. */
  points: [number, number][];
  a: number;
  b: number;
}

export interface WireGraph {
  nodes: { x: number; y: number; net: number }[];
  edges: CurrentEdge[];
  /** Pins that sit on a node of the graph, in the order solveEdgeCurrents expects their currents. */
  pins: { key: string; node: number }[];
  /** Nodes in BFS order per tree (roots first), with the edge to their parent (-1 for roots). */
  order: Int32Array;
  parentEdge: Int32Array;
  parent: Int32Array;
}

const keyOf = (net: number, x: number, y: number) => `${net}:${x},${y}`;

/** Is (x, y) on the closed axis-aligned segment a–b? */
function onSegment(x: number, y: number, a: [number, number], b: [number, number]): boolean {
  if (a[0] === b[0]) return x === a[0] && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1]);
  if (a[1] === b[1]) return y === a[1] && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]);
  return false;
}

/**
 * Build the wire graph of a circuit. `rootPins` are pin keys preferred as tree roots: pins of pure
 * wiring (ground symbols, labels, ports), where a net's wires connect to the rest of the net
 * without a wire, so any imbalance flows there.
 */
export function buildWireGraph(wires: Wire[], wireNet: number[], pins: PinRef[], rootPins: Set<string> = new Set()): WireGraph {
  const nodes: { x: number; y: number; net: number }[] = [];
  const nodeIndex = new Map<string, number>();
  const node = (net: number, x: number, y: number) => {
    const k = keyOf(net, x, y);
    let i = nodeIndex.get(k);
    if (i === undefined) {
      i = nodes.push({ x, y, net }) - 1;
      nodeIndex.set(k, i);
    }
    return i;
  };

  // Points that can split a segment, per net: every wire vertex and every pin.
  const splitPoints = new Map<number, [number, number][]>();
  const addSplit = (net: number, x: number, y: number) => {
    let l = splitPoints.get(net);
    if (!l) splitPoints.set(net, (l = []));
    l.push([x, y]);
  };
  wires.forEach((w, i) => w.points.forEach(([x, y]) => addSplit(wireNet[i]!, x, y)));
  for (const p of pins) addSplit(p.net, p.x, p.y);

  // Elementary edges between consecutive split points along each segment.
  type Elem = { a: number; b: number; wire: number; net: number };
  const elems: Elem[] = [];
  const seen = new Set<string>();
  wires.forEach((w, wi) => {
    const net = wireNet[wi]!;
    const splits = splitPoints.get(net) ?? [];
    for (let j = 1; j < w.points.length; j++) {
      const a = w.points[j - 1]!;
      const b = w.points[j]!;
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const along = splits
        .filter(([x, y]) => onSegment(x, y, a, b))
        .map(([x, y]) => ({ x, y, t: Math.abs(x - a[0]) + Math.abs(y - a[1]) }))
        .sort((p, q) => p.t - q.t);
      for (let k = 1; k < along.length; k++) {
        const p = along[k - 1]!;
        const q = along[k]!;
        if (p.t === q.t) continue;
        const na = node(net, p.x, p.y);
        const nb = node(net, q.x, q.y);
        const key = na < nb ? `${na}-${nb}` : `${nb}-${na}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elems.push({ a: na, b: nb, wire: wi, net });
      }
    }
  });

  // Pins on nodes; they and branch points are "terminals" that sections run between.
  const graphPins: { key: string; node: number }[] = [];
  const terminal = new Set<number>();
  for (const p of pins) {
    const i = nodeIndex.get(keyOf(p.net, p.x, p.y));
    if (i === undefined) continue;
    graphPins.push({ key: p.key, node: i });
    terminal.add(i);
  }
  const adj: number[][] = nodes.map(() => []);
  elems.forEach((e, i) => {
    adj[e.a]!.push(i);
    adj[e.b]!.push(i);
  });
  adj.forEach((l, i) => {
    if (l.length !== 2) terminal.add(i);
  });

  // Contract chains of degree-2 corners into polyline sections.
  const edges: CurrentEdge[] = [];
  const used = new Uint8Array(elems.length);
  const walk = (start: number, first: number) => {
    const pts: [number, number][] = [[nodes[start]!.x, nodes[start]!.y]];
    let at = start;
    let e = first;
    const wire = elems[first]!.wire;
    for (;;) {
      used[e] = 1;
      const el = elems[e]!;
      const next = el.a === at ? el.b : el.a;
      pts.push([nodes[next]!.x, nodes[next]!.y]);
      at = next;
      if (terminal.has(at)) break;
      const cont = adj[at]!.find((x) => !used[x]);
      if (cont === undefined) break;
      e = cont;
    }
    edges.push({ net: elems[first]!.net, wire, points: pts, a: start, b: at });
  };
  for (const t of [...terminal].sort((p, q) => p - q)) for (const e of adj[t]!) if (!used[e]) walk(t, e);
  // Pure loops without any terminal.
  elems.forEach((el, i) => {
    if (!used[i]) {
      terminal.add(el.a);
      walk(el.a, i);
    }
  });

  // Spanning forest by BFS, roots preferring wiring pins.
  const eAdj: number[][] = nodes.map(() => []);
  edges.forEach((e, i) => {
    eAdj[e.a]!.push(i);
    if (e.b !== e.a) eAdj[e.b]!.push(i);
  });
  const preferred = graphPins.filter((p) => rootPins.has(p.key)).map((p) => p.node);
  const candidates = [...preferred, ...nodes.map((_, i) => i)];
  const order = new Int32Array(nodes.length);
  const parentEdge = new Int32Array(nodes.length).fill(-1);
  const parent = new Int32Array(nodes.length).fill(-1);
  const visited = new Uint8Array(nodes.length);
  let n = 0;
  for (const root of candidates) {
    if (visited[root]) continue;
    visited[root] = 1;
    let head = n;
    order[n++] = root;
    while (head < n) {
      const u = order[head++]!;
      for (const ei of eAdj[u]!) {
        const e = edges[ei]!;
        const v = e.a === u ? e.b : e.a;
        if (visited[v]) continue;
        visited[v] = 1;
        parentEdge[v] = ei;
        parent[v] = u;
        order[n++] = v;
      }
    }
  }
  return { nodes, edges, pins: graphPins, order, parentEdge, parent };
}

/**
 * Current in each section (amperes, positive from `a` to `b`), given the current flowing *into*
 * each pin of graph.pins (from the wire into the component, as engines report it).
 */
export function solveEdgeCurrents(graph: WireGraph, pinCurrents: ArrayLike<number>, out = new Float64Array(graph.edges.length)): Float64Array {
  out.fill(0);
  // acc[node]: current that enters the wires in the node's subtree and must leave through its parent edge.
  const acc = new Float64Array(graph.nodes.length);
  graph.pins.forEach((p, i) => {
    const c = pinCurrents[i] ?? 0;
    if (Number.isFinite(c)) acc[p.node]! -= c;
  });
  for (let k = graph.order.length - 1; k >= 0; k--) {
    const v = graph.order[k]!;
    const ei = graph.parentEdge[v]!;
    if (ei < 0) continue;
    const e = graph.edges[ei]!;
    out[ei] = e.a === v ? acc[v]! : -acc[v]!;
    acc[graph.parent[v]!]! += acc[v]!;
  }
  return out;
}

/**
 * Dot speed (px per real second) for a current: log-compressed so that microamps and amps both
 * move visibly (Falstad's convention). Zero below 10 nA.
 */
export function dotSpeed(current: number): number {
  const a = Math.abs(current);
  if (!(a > 1e-8)) return 0;
  const s = Math.min(1.25, (Math.log10(a) + 8) / 8);
  return Math.sign(current) * (14 + 110 * s);
}
