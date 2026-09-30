/**
 * From an and-inverter graph to lookup tables, on graphs small enough to draw: the course's own balancer
 * (`rebuild`) and LUT mapper (`mapLuts`), and an enumeration of every cut of a node so the reader can see what the
 * mapper chose between.
 *
 * A **cut** of a node is a set of at most K nodes (its leaves) that every path from the inputs to the node passes
 * through; the node is then a function of the leaves alone, and a K-input LUT holding that function can replace
 * everything between them. The mapper labels each node with the fewest LUT levels it can be reached in
 * (`label`), and covers the graph from the outputs.
 */
import { Aig, rebuild } from '$lib/pld/fpga/aig';
import { dominates, mergeCuts, type Cut } from '$lib/pld/fpga/cuts';
import { mapLuts, type MapResult } from '$lib/pld/fpga/map';

export interface Preset {
  id: string;
  label: string;
  story: string;
  /** Names of the primary inputs, in order. */
  inputs: string[];
  build(a: Aig, pis: number[]): number[];
}

const chain = (a: Aig, lits: number[]) => lits.reduce((acc, l) => a.and(acc, l));

export const PRESETS: Preset[] = [
  {
    id: 'wrapped',
    label: 'Counter: wrapped',
    story: 'The `wrapped` output of the counter of Chapter 29: enable, and every bit of the count is 1. Written as a chain of two-input ANDs, the way a simple compiler builds it.',
    inputs: ['en', 'v0', 'v1', 'v2', 'v3'],
    build: (a, p) => [chain(a, p)],
  },
  {
    id: 'and8',
    label: '8-input AND',
    story: 'Eight inputs ANDed in a chain, ((((a·b)·c)·d)·…): seven AND nodes, seven levels deep. Balance it and the same seven nodes are three deep.',
    inputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    build: (a, p) => [chain(a, p)],
  },
  {
    id: 'mux4',
    label: '4-way multiplexer',
    story: 'Y = one of d0…d3, chosen by s1 and s0: three 2:1 multiplexers, six inputs.',
    inputs: ['d0', 'd1', 'd2', 'd3', 's0', 's1'],
    build: (a, p) => [a.mux(p[5]!, a.mux(p[4]!, p[0]!, p[1]!), a.mux(p[4]!, p[2]!, p[3]!))],
  },
  {
    id: 'parity8',
    label: 'Parity of 8 bits',
    story: 'The XOR of eight inputs, written as a tree of XORs: each XOR is three AND nodes in the graph. (The balancer works on chains of ANDs only; an XOR chain would stay a chain.)',
    inputs: ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'],
    build: (a, p) => [a.xorN(p)],
  },
  {
    id: 'carry4',
    label: 'Carry out of a 4-bit adder',
    story: 'The carry that comes out of four full adders in a ripple chain: eight inputs, and every stage waits for the one before.',
    inputs: ['a0', 'b0', 'a1', 'b1', 'a2', 'b2', 'a3', 'b3'],
    build: (a, p) => {
      let c = a.and(p[0]!, p[1]!);
      for (let i = 1; i < 4; i++) c = a.maj(p[2 * i]!, p[2 * i + 1]!, c);
      return [c];
    },
  },
];

export interface Graph {
  aig: Aig;
  roots: number[];
  /** Node number of each primary input and its name. */
  inputs: { node: number; name: string }[];
}

export function buildGraph(id: string, balance: boolean): Graph {
  const p = PRESETS.find((x) => x.id === id)!;
  let aig = new Aig(64);
  const pis = p.inputs.map(() => aig.addPi());
  let roots = p.build(aig, pis);
  let inputs = pis.map((l, i) => ({ node: l >> 1, name: p.inputs[i]! }));
  if (balance) {
    const r = rebuild(aig, roots, true);
    aig = r.aig;
    roots = r.roots;
    inputs = pis.map((l, i) => ({ node: r.map(l) >> 1, name: p.inputs[i]! }));
  }
  return { aig, roots, inputs };
}

export interface NodeInfo {
  node: number;
  kind: 'input' | 'and';
  name: string;
  level: number;
  /** LUT levels needed to reach this node (0 for inputs). */
  label: number;
  /** Index in `mapped.luts` if the node is the output of a LUT, else −1. */
  lut: number;
  /** LUTs whose cone contains the node (the first is its colour). */
  covers: number[];
}

export interface Mapping {
  graph: Graph;
  k: number;
  mapped: MapResult;
  nodes: NodeInfo[];
  /** Nodes needed by the roots. */
  needed: number[];
  luts: number;
  depth: number;
  andNodes: number;
  aigDepth: number;
}

/** The nodes of the cone of `root` above the leaves (root included, leaves excluded). */
export function cone(aig: Aig, root: number, leaves: readonly number[]): number[] {
  const stop = new Set(leaves);
  const out: number[] = [];
  const seen = new Set<number>();
  const walk = (v: number) => {
    if (seen.has(v) || stop.has(v) || !aig.isAnd(v)) return;
    seen.add(v);
    out.push(v);
    walk(aig.fan0[v]! >> 1);
    walk(aig.fan1[v]! >> 1);
  };
  walk(root);
  return out;
}

/** All cuts of `node` with at most `k` leaves (no pruning, dominated cuts dropped), each with its truth table. */
export function allCuts(aig: Aig, node: number, k: number): Cut[] {
  const memo = new Map<number, Cut[]>();
  const rec = (v: number): Cut[] => {
    const hit = memo.get(v);
    if (hit) return hit;
    let out: Cut[];
    if (!aig.isAnd(v)) out = [{ leaves: [v], tt: 2 }];
    else {
      const f0 = aig.fan0[v]!;
      const f1 = aig.fan1[v]!;
      const list: Cut[] = [];
      const options = (c: Cut[], u: number) => [...c, { leaves: [u], tt: 2 } as Cut];
      for (const x of options(rec(f0 >> 1), f0 >> 1)) {
        for (const y of options(rec(f1 >> 1), f1 >> 1)) {
          const m = mergeCuts(x, f0 & 1, y, f1 & 1, k);
          if (!m) continue;
          if (list.some((e) => dominates(e.leaves, m.leaves))) continue;
          for (let i = list.length - 1; i >= 0; i--) if (dominates(m.leaves, list[i]!.leaves)) list.splice(i, 1);
          list.push(m);
        }
      }
      out = list;
    }
    memo.set(v, out);
    return out;
  };
  const cuts = rec(node);
  return cuts.filter((c) => !(c.leaves.length === 1 && c.leaves[0] === node) || !aig.isAnd(node));
}

/** LUT levels of every node: 1 + the best cut's largest leaf label, as in the mapper's labelling. */
export function labels(aig: Aig, k: number, nodes: readonly number[]): Map<number, number> {
  const label = new Map<number, number>();
  for (const v of [...nodes].sort((a, b) => a - b)) {
    if (!aig.isAnd(v)) {
      label.set(v, 0);
      continue;
    }
    let best = Infinity;
    for (const c of allCuts(aig, v, k)) {
      if (c.leaves.length === 1 && c.leaves[0] === v) continue;
      let d = 0;
      for (const l of c.leaves) d = Math.max(d, label.get(l) ?? 0);
      best = Math.min(best, d + 1);
    }
    label.set(v, best);
  }
  return label;
}

export function map(g: Graph, k: number): Mapping {
  const mapped = mapLuts(g.aig, g.roots, undefined, { k });
  const needed: number[] = [];
  const mark = g.aig.reachable(g.roots);
  for (let v = 1; v < g.aig.n; v++) if (mark[v]) needed.push(v);
  const label = labels(g.aig, k, needed);
  const names = new Map(g.inputs.map((i) => [i.node, i.name]));
  const covers = new Map<number, number[]>();
  mapped.luts.forEach((l, i) => {
    for (const v of cone(g.aig, l.node, l.leaves)) covers.set(v, [...(covers.get(v) ?? []), i]);
  });
  const nodes: NodeInfo[] = needed.map((v) => ({
    node: v,
    kind: g.aig.isAnd(v) ? 'and' : 'input',
    name: names.get(v) ?? `n${v}`,
    level: g.aig.level[v]!,
    label: label.get(v) ?? 0,
    lut: mapped.lutOf[v]!,
    covers: covers.get(v) ?? [],
  }));
  return { graph: g, k, mapped, nodes, needed, luts: mapped.luts.length, depth: mapped.depth, andNodes: g.aig.andCount(g.roots), aigDepth: g.aig.depth(g.roots) };
}

/** Hexadecimal truth table over `m` leaves (2^m bits, most significant row first). */
export const ttHex = (tt: number, m: number): string => (tt & ((1 << (1 << m)) - 1)).toString(16).padStart(Math.max(1, (1 << m) >> 2), '0');

/** Check by simulation that the LUT cover computes what the graph computes, for every input vector (up to 10 inputs). */
export function coverAgrees(m: Mapping): boolean {
  const { aig, roots, inputs } = m.graph;
  const luts = m.mapped.luts;
  const byNode = new Map(luts.map((l) => [l.node, l]));
  for (let vec = 0; vec < 1 << inputs.length; vec++) {
    const pi = new Map(inputs.map((x, i) => [x.node, (vec >> i) & 1]));
    const want = aig.evaluate(roots, (n) => pi.get(n) ?? 0);
    const memo = new Map<number, number>();
    const val = (v: number): number => {
      if (!aig.isAnd(v)) return pi.get(v) ?? 0;
      const hit = memo.get(v);
      if (hit !== undefined) return hit;
      const l = byNode.get(v);
      if (!l) throw new Error(`node ${v} is used but has no LUT`);
      let row = 0;
      l.leaves.forEach((leaf, i) => (row |= val(leaf) << i));
      const out = (l.tt >> row) & 1;
      memo.set(v, out);
      return out;
    };
    const got = roots.map((r) => val(r >> 1) ^ (r & 1));
    if (got.some((g, i) => g !== want[i])) return false;
  }
  return true;
}
