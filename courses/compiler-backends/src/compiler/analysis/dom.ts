// Dominators, dominator trees and dominance frontiers.
//
// We use the iterative algorithm of Cooper, Harvey & Kennedy, "A Simple, Fast
// Dominance Algorithm" (2001). It processes nodes in reverse postorder and
// intersects the dominator sets of already-processed predecessors by walking
// up the partially built dominator tree ("two-finger" intersection).
// On reducible CFGs it converges in two passes; in practice it competes with
// Lengauer-Tarjan (1979) while being ~30 lines of code.

import { dfs, type Graph } from './graph';

export interface DomStep {
  pass: number;
  node: number;
  /** predecessor contributions considered, in order */
  preds: { pred: number; processed: boolean }[];
  /** intersection walk: pairs of fingers visited */
  walk: [number, number][];
  newIdom: number;
  changed: boolean;
  idom: number[];
}

export interface DomInfo {
  idom: number[]; // idom[entry] = entry; unreachable = -1
  children: number[][];
  rpo: number[];
  rpoIndex: number[];
  depth: number[];
  steps: DomStep[];
  passes: number;
  /** preorder/postorder numbering of the dominator tree, for O(1) dominance queries */
  tin: number[];
  tout: number[];
}

export function dominators(g: Graph, record = false): DomInfo {
  const { rpo, rpoIndex } = dfs(g);
  const idom = new Array(g.n).fill(-1);
  idom[g.entry] = g.entry;
  const steps: DomStep[] = [];
  const intersect = (a: number, b: number, walk: [number, number][]) => {
    let f1 = a, f2 = b;
    while (f1 !== f2) {
      walk.push([f1, f2]);
      while (rpoIndex[f1] > rpoIndex[f2]) { f1 = idom[f1]; walk.push([f1, f2]); }
      while (rpoIndex[f2] > rpoIndex[f1]) { f2 = idom[f2]; walk.push([f1, f2]); }
    }
    return f1;
  };
  let changed = true, pass = 0;
  while (changed) {
    changed = false;
    pass++;
    for (const b of rpo) {
      if (b === g.entry) continue;
      const walk: [number, number][] = [];
      const preds = g.preds[b].filter((p) => rpoIndex[p] !== -1);
      const contrib = preds.map((p) => ({ pred: p, processed: idom[p] !== -1 }));
      let nu = -1;
      for (const p of preds) {
        if (idom[p] === -1) continue;
        nu = nu === -1 ? p : intersect(p, nu, walk);
      }
      const ch = idom[b] !== nu;
      if (ch) {
        idom[b] = nu;
        changed = true;
      }
      if (record) steps.push({ pass, node: b, preds: contrib, walk, newIdom: nu, changed: ch, idom: [...idom] });
    }
  }
  const children: number[][] = Array.from({ length: g.n }, () => []);
  for (const b of rpo) if (b !== g.entry && idom[b] >= 0) children[idom[b]].push(b);
  const depth = new Array(g.n).fill(0);
  const tin = new Array(g.n).fill(-1), tout = new Array(g.n).fill(-1);
  let t = 0;
  const st: [number, number][] = [[g.entry, 0]];
  while (st.length) {
    const top = st[st.length - 1];
    if (top[1] === 0) tin[top[0]] = t++;
    if (top[1] < children[top[0]].length) {
      const c = children[top[0]][top[1]++];
      depth[c] = depth[top[0]] + 1;
      st.push([c, 0]);
    } else {
      tout[top[0]] = t++;
      st.pop();
    }
  }
  return { idom, children, rpo, rpoIndex, depth, steps, passes: pass, tin, tout };
}

/** a dominates b (reflexive) */
export function dominates(d: DomInfo, a: number, b: number): boolean {
  if (d.tin[a] < 0 || d.tin[b] < 0) return false;
  return d.tin[a] <= d.tin[b] && d.tout[b] <= d.tout[a];
}

/** All dominators of b, from b up to the entry. */
export function dominatorsOf(d: DomInfo, b: number): number[] {
  const out = [b];
  while (d.idom[b] !== b && d.idom[b] >= 0) {
    b = d.idom[b];
    out.push(b);
  }
  return out;
}

export interface DFStep {
  join: number;
  pred: number;
  runner: number[];
}

/**
 * Dominance frontier: DF(x) = { y | x dominates a predecessor of y, but not strictly y }.
 * The "runner" formulation from Cooper-Harvey-Kennedy: only join points (>= 2 preds)
 * can be in any frontier; walk up from each predecessor until reaching idom(join).
 */
export function dominanceFrontiers(g: Graph, d: DomInfo): { df: Set<number>[]; steps: DFStep[] } {
  const df: Set<number>[] = Array.from({ length: g.n }, () => new Set());
  const steps: DFStep[] = [];
  for (let b = 0; b < g.n; b++) {
    const preds = g.preds[b].filter((p) => d.idom[p] !== -1);
    if (preds.length < 2 || d.idom[b] === -1) continue;
    for (const p of preds) {
      let r = p;
      const path: number[] = [];
      while (r !== d.idom[b]) {
        df[r].add(b);
        path.push(r);
        if (r === d.idom[r]) break;
        r = d.idom[r];
      }
      steps.push({ join: b, pred: p, runner: path });
    }
  }
  return { df, steps };
}

/** Iterated dominance frontier DF+(S): the phi-placement set for definitions in S. */
export function iteratedDF(df: Set<number>[], S: Iterable<number>): Set<number> {
  const out = new Set<number>();
  const work = [...S];
  const seen = new Set(work);
  while (work.length) {
    const x = work.pop()!;
    for (const y of df[x]) {
      if (!out.has(y)) {
        out.add(y);
        if (!seen.has(y)) {
          seen.add(y);
          work.push(y);
        }
      }
    }
  }
  return out;
}

/** Post-dominators: dominators of the reversed graph with a virtual exit. */
export function postDominators(g: Graph): DomInfo {
  const exits: number[] = [];
  for (let i = 0; i < g.n; i++) if (g.succs[i].length === 0) exits.push(i);
  const n = g.n + 1;
  const rev: Graph = {
    n,
    entry: g.n,
    succs: [...g.preds.map((p) => [...p]), exits],
    preds: [...g.succs.map((s, i) => [...s, ...(exits.includes(i) ? [g.n] : [])])],
    names: [...g.names, 'exit'],
  };
  rev.preds.push([]);
  return dominators(rev);
}
