// Graph-colouring register allocation with iterated register coalescing.
//
// Chaitin (1981) framed register allocation as graph colouring: nodes are
// live ranges, edges connect ranges that are simultaneously live, colours are
// machine registers. Briggs, Cooper & Torczon (1994) made the spill decision
// optimistic. George & Appel, "Iterated Register Coalescing" (TOPLAS 1996)
// interleave conservative coalescing of copies with simplification. This is a
// direct transcription of their algorithm (also Appel, "Modern Compiler
// Implementation", ch. 11), with every decision recorded for visualisation.

import type { Target } from '../target/target';
import { defsOf, liveness, usesOf, tracked, type Liveness } from '../codegen/liveness';
import { isCopy, keyIsPreg, keyPreg, regKey, type MFunc, type MInstr, type RegOp } from '../codegen/mir';

export type RAEvent =
  | { k: 'simplify'; node: number; degree: number }
  | { k: 'coalesce'; u: number; v: number; test: 'trivial' | 'briggs' | 'george'; move: number }
  | { k: 'constrained'; u: number; v: number; move: number }
  | { k: 'freeze'; node: number }
  | { k: 'potential-spill'; node: number; cost: number; degree: number }
  | { k: 'select'; node: number; color: number; forbidden: number[] }
  | { k: 'actual-spill'; node: number; forbidden: number[] };

export interface GraphSnapshot {
  nodes: { key: number; precolored: boolean; cost: number; degree: number }[];
  edges: [number, number][];
  moves: { id: number; dst: number; src: number }[];
}

export interface IRCResult {
  color: Map<number, number>;
  spilled: number[];
  coalesced: Map<number, number>;
  events: RAEvent[];
  graph: GraphSnapshot;
  live: Liveness;
}

export interface IRCOptions {
  coalesce?: boolean;
  /** nodes that must not be spilled (temporaries introduced by spill code) */
  noSpill?: Set<number>;
}

export function spillCosts(f: MFunc, t: Target): Map<number, number> {
  const track = tracked(t);
  const cost = new Map<number, number>();
  for (const b of f.blocks) {
    const w = Math.pow(10, b.loopDepth);
    for (const mi of b.instrs) {
      for (const k of [...defsOf(mi, track), ...usesOf(mi, track)]) if (k >= 0) cost.set(k, (cost.get(k) ?? 0) + w);
    }
  }
  return cost;
}

export function irc(f: MFunc, t: Target, opts: IRCOptions = {}): IRCResult {
  const live = liveness(f, t);
  const track = tracked(t);
  const colors = t.allocOrder;
  const K = colors.length;
  const events: RAEvent[] = [];
  const noSpill = opts.noSpill ?? new Set<number>();
  const doCoalesce = opts.coalesce !== false;

  // ---- node sets
  const precolored = new Set<number>([...track].map((r) => -(r + 1)));
  const initial = new Set<number>();
  const adjSet = new Set<string>();
  const adjList = new Map<number, Set<number>>();
  const degree = new Map<number, number>();
  const moveList = new Map<number, Set<number>>();
  const alias = new Map<number, number>();
  const color = new Map<number, number>();
  for (const p of precolored) color.set(p, keyPreg(p));

  const moves: { id: number; dst: number; src: number; mi: MInstr }[] = [];
  const worklistMoves = new Set<number>(), activeMoves = new Set<number>(), coalescedMoves = new Set<number>(), constrainedMoves = new Set<number>(), frozenMoves = new Set<number>();

  const node = (n: number) => {
    if (!precolored.has(n)) initial.add(n);
    if (!adjList.has(n)) adjList.set(n, new Set());
    if (!degree.has(n)) degree.set(n, precolored.has(n) ? Infinity : 0);
    if (!moveList.has(n)) moveList.set(n, new Set());
  };
  const addEdge = (u: number, v: number) => {
    if (u === v) return;
    const key = u < v ? `${u},${v}` : `${v},${u}`;
    if (adjSet.has(key)) return;
    adjSet.add(key);
    node(u); node(v);
    if (!precolored.has(u)) { adjList.get(u)!.add(v); degree.set(u, degree.get(u)! + 1); }
    if (!precolored.has(v)) { adjList.get(v)!.add(u); degree.set(v, degree.get(v)! + 1); }
  };
  const interferes = (u: number, v: number) => adjSet.has(u < v ? `${u},${v}` : `${v},${u}`);

  // ---- build
  f.blocks.forEach((b, bi) => {
    const liveNow = new Set(live.blocks[bi].liveOut);
    for (let k = b.instrs.length - 1; k >= 0; k--) {
      const mi = b.instrs[k];
      const defs = defsOf(mi, track), uses = usesOf(mi, track);
      for (const x of [...defs, ...uses]) node(x);
      if (doCoalesce && isCopy(mi) && defs.length === 1 && uses.length === 1) {
        for (const u of uses) liveNow.delete(u);
        const id = moves.length;
        moves.push({ id, dst: defs[0], src: uses[0], mi });
        moveList.get(defs[0])!.add(id);
        moveList.get(uses[0])!.add(id);
        worklistMoves.add(id);
      }
      for (const d of defs) liveNow.add(d);
      for (const d of defs) for (const l of liveNow) addEdge(l, d);
      for (const d of defs) liveNow.delete(d);
      for (const u of uses) liveNow.add(u);
    }
  });
  for (const n of initial) node(n);

  const cost = spillCosts(f, t);
  const snapshot: GraphSnapshot = {
    nodes: [...adjList.keys()].filter((n) => !precolored.has(n) || [...adjList.values()].some((s) => s.has(n))).map((n) => ({ key: n, precolored: precolored.has(n), cost: cost.get(n) ?? 0, degree: precolored.has(n) ? -1 : degree.get(n)! })),
    edges: [...adjSet].map((s) => s.split(',').map(Number) as [number, number]),
    moves: moves.map((m) => ({ id: m.id, dst: m.dst, src: m.src })),
  };

  // ---- worklists
  const simplifyWL = new Set<number>(), freezeWL = new Set<number>(), spillWL = new Set<number>();
  const spilledNodes: number[] = [], coalescedNodes = new Set<number>(), coloredNodes = new Set<number>();
  const selectStack: number[] = [];
  const onStack = new Set<number>();

  const nodeMoves = (n: number) => [...moveList.get(n)!].filter((m) => activeMoves.has(m) || worklistMoves.has(m));
  const moveRelated = (n: number) => nodeMoves(n).length > 0;
  const adjacent = (n: number) => [...adjList.get(n)!].filter((x) => !onStack.has(x) && !coalescedNodes.has(x));
  const getAlias = (n: number): number => (coalescedNodes.has(n) ? getAlias(alias.get(n)!) : n);

  for (const n of initial) {
    if (degree.get(n)! >= K) spillWL.add(n);
    else if (moveRelated(n)) freezeWL.add(n);
    else simplifyWL.add(n);
  }

  const enableMoves = (ns: number[]) => {
    for (const n of ns) for (const m of nodeMoves(n)) if (activeMoves.has(m)) { activeMoves.delete(m); worklistMoves.add(m); }
  };
  const decrementDegree = (m: number) => {
    if (precolored.has(m)) return;
    const d = degree.get(m)!;
    degree.set(m, d - 1);
    if (d === K) {
      enableMoves([m, ...adjacent(m)]);
      spillWL.delete(m);
      if (moveRelated(m)) freezeWL.add(m);
      else simplifyWL.add(m);
    }
  };
  const addWorkList = (u: number) => {
    if (!precolored.has(u) && !moveRelated(u) && degree.get(u)! < K) { freezeWL.delete(u); simplifyWL.add(u); }
  };
  const OK = (tt: number, r: number) => degree.get(tt)! < K || precolored.has(tt) || interferes(tt, r);
  const conservative = (nodes: number[]) => {
    let k = 0;
    for (const n of new Set(nodes)) if (degree.get(n)! >= K) k++;
    return k < K;
  };
  const combine = (u: number, v: number) => {
    if (freezeWL.has(v)) freezeWL.delete(v);
    else spillWL.delete(v);
    coalescedNodes.add(v);
    alias.set(v, u);
    for (const m of moveList.get(v)!) moveList.get(u)!.add(m);
    enableMoves([v]);
    for (const tt of adjacent(v)) { addEdge(tt, u); decrementDegree(tt); }
    if (degree.get(u)! >= K && freezeWL.has(u)) { freezeWL.delete(u); spillWL.add(u); }
  };
  const freezeMoves = (u: number) => {
    for (const m of nodeMoves(u)) {
      const { dst: x, src: y } = moves[m];
      const v = getAlias(y) === getAlias(u) ? getAlias(x) : getAlias(y);
      activeMoves.delete(m);
      frozenMoves.add(m);
      if (!precolored.has(v) && nodeMoves(v).length === 0 && degree.get(v)! < K) { freezeWL.delete(v); simplifyWL.add(v); }
    }
  };

  for (let guard = 0; guard < 100000; guard++) {
    if (simplifyWL.size) {
      const n = simplifyWL.values().next().value!;
      simplifyWL.delete(n);
      events.push({ k: 'simplify', node: n, degree: degree.get(n)! });
      selectStack.push(n);
      onStack.add(n);
      for (const m of adjacent(n)) decrementDegree(m);
    } else if (worklistMoves.size) {
      const m = worklistMoves.values().next().value!;
      worklistMoves.delete(m);
      const x = getAlias(moves[m].dst), y = getAlias(moves[m].src);
      const [u, v] = precolored.has(y) ? [y, x] : [x, y];
      if (u === v) {
        coalescedMoves.add(m);
        addWorkList(u);
        events.push({ k: 'coalesce', u, v, test: 'trivial', move: m });
      } else if (precolored.has(v) || interferes(u, v)) {
        constrainedMoves.add(m);
        addWorkList(u);
        addWorkList(v);
        events.push({ k: 'constrained', u, v, move: m });
      } else {
        const george = precolored.has(u) && adjacent(v).every((tt) => OK(tt, u));
        const briggs = !precolored.has(u) && conservative([...adjacent(u), ...adjacent(v)]);
        if (george || briggs) {
          coalescedMoves.add(m);
          combine(u, v);
          addWorkList(u);
          events.push({ k: 'coalesce', u, v, test: george ? 'george' : 'briggs', move: m });
        } else activeMoves.add(m);
      }
    } else if (freezeWL.size) {
      const u = freezeWL.values().next().value!;
      freezeWL.delete(u);
      simplifyWL.add(u);
      events.push({ k: 'freeze', node: u });
      freezeMoves(u);
    } else if (spillWL.size) {
      // Chaitin's heuristic: cheapest (cost / degree) first; never spill spill temporaries
      let best = -1, bestScore = Infinity;
      for (const n of spillWL) {
        const score = noSpill.has(n) ? Infinity : (cost.get(n) ?? 0) / Math.max(1, degree.get(n)!);
        if (best === -1 || score < bestScore) { best = n; bestScore = score; }
      }
      spillWL.delete(best);
      simplifyWL.add(best);
      events.push({ k: 'potential-spill', node: best, cost: cost.get(best) ?? 0, degree: degree.get(best)! });
      freezeMoves(best);
    } else break;
  }

  // ---- select
  while (selectStack.length) {
    const n = selectStack.pop()!;
    onStack.delete(n);
    const forbidden = new Set<number>();
    for (const w of adjList.get(n)!) {
      const a = getAlias(w);
      if (coloredNodes.has(a) || precolored.has(a)) forbidden.add(color.get(a)!);
    }
    // registers outside the allocatable set may still be used by a value that is
    // copied to/from them (e.g. an argument register when the demo shrinks the file)
    const partners: number[] = [];
    for (const m of moveList.get(n)!) {
      for (const x of [moves[m].dst, moves[m].src]) if (precolored.has(x) && !colors.includes(keyPreg(x))) partners.push(keyPreg(x));
    }
    const ok = [...colors, ...partners].filter((c) => !forbidden.has(c));
    if (!ok.length) {
      spilledNodes.push(n);
      events.push({ k: 'actual-spill', node: n, forbidden: [...forbidden] });
    } else {
      // prefer a colour that makes a frozen/constrained move trivial
      let pick = ok[0];
      for (const m of moveList.get(n)!) {
        const other = getAlias(moves[m].dst) === n ? getAlias(moves[m].src) : getAlias(moves[m].dst);
        const c = color.get(other);
        if (c !== undefined && ok.includes(c)) { pick = c; break; }
      }
      coloredNodes.add(n);
      color.set(n, pick);
      events.push({ k: 'select', node: n, color: pick, forbidden: [...forbidden] });
    }
  }
  const coalesced = new Map<number, number>();
  for (const n of coalescedNodes) {
    coalesced.set(n, getAlias(n));
    const c = color.get(getAlias(n));
    if (c !== undefined) color.set(n, c);
  }
  // vregs that never interfered with anything and never got into the graph
  return { color, spilled: spilledNodes, coalesced, events, graph: snapshot, live };
}

export const keyOf = (r: RegOp) => regKey(r);
export { keyIsPreg };
