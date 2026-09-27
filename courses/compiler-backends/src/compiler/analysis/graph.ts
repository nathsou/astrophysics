// Generic directed-graph utilities shared by IR and machine-IR analyses.
// Nodes are dense integers 0..n-1, entry is usually 0.

import type { Func } from '../ir/ir';

export interface Graph {
  n: number;
  entry: number;
  succs: number[][];
  preds: number[][];
  names: string[];
}

export function irGraph(fn: Func): Graph {
  const idx = new Map(fn.blocks.map((b, i) => [b, i]));
  return {
    n: fn.blocks.length,
    entry: 0,
    succs: fn.blocks.map((b) => b.succs.map((s) => idx.get(s)!)),
    preds: fn.blocks.map((b) => b.preds.map((p) => idx.get(p)!)),
    names: fn.blocks.map((b) => b.name),
  };
}

export type EdgeKind = 'tree' | 'back' | 'forward' | 'cross';

export interface DFSResult {
  pre: number[]; // preorder number per node (-1 = unreachable)
  post: number[]; // postorder number per node
  preorder: number[]; // nodes in preorder
  postorder: number[]; // nodes in postorder
  rpo: number[]; // nodes in reverse postorder
  rpoIndex: number[]; // node -> position in rpo
  parent: number[];
  edges: { from: number; to: number; kind: EdgeKind }[];
}

/** Iterative DFS (explicit stack, so deep CFGs don't blow the JS stack). */
export function dfs(g: Graph): DFSResult {
  const pre = new Array(g.n).fill(-1), post = new Array(g.n).fill(-1), parent = new Array(g.n).fill(-1);
  const preorder: number[] = [], postorder: number[] = [];
  const edges: DFSResult['edges'] = [];
  const onStack = new Array(g.n).fill(false);
  const stack: { node: number; i: number }[] = [];
  const visit = (v: number) => {
    pre[v] = preorder.length;
    preorder.push(v);
    onStack[v] = true;
    stack.push({ node: v, i: 0 });
  };
  visit(g.entry);
  while (stack.length) {
    const top = stack[stack.length - 1];
    const ss = g.succs[top.node];
    if (top.i < ss.length) {
      const w = ss[top.i++];
      if (pre[w] === -1) {
        edges.push({ from: top.node, to: w, kind: 'tree' });
        parent[w] = top.node;
        visit(w);
      } else if (onStack[w]) edges.push({ from: top.node, to: w, kind: 'back' });
      else if (pre[w] > pre[top.node]) edges.push({ from: top.node, to: w, kind: 'forward' });
      else edges.push({ from: top.node, to: w, kind: 'cross' });
    } else {
      stack.pop();
      onStack[top.node] = false;
      post[top.node] = postorder.length;
      postorder.push(top.node);
    }
  }
  const rpo = [...postorder].reverse();
  const rpoIndex = new Array(g.n).fill(-1);
  rpo.forEach((v, i) => (rpoIndex[v] = i));
  return { pre, post, preorder, postorder, rpo, rpoIndex, parent, edges };
}

/** An edge is critical if its source has several successors and its target several predecessors. */
export function criticalEdges(g: Graph): [number, number][] {
  const out: [number, number][] = [];
  for (let u = 0; u < g.n; u++) {
    if (g.succs[u].length < 2) continue;
    for (const v of g.succs[u]) if (g.preds[v].length > 1) out.push([u, v]);
  }
  return out;
}

/** Tarjan's strongly connected components (iterative). Returns component id per node. */
export function tarjanSCC(g: Graph): { comp: number[]; comps: number[][] } {
  let index = 0;
  const idx = new Array(g.n).fill(-1), low = new Array(g.n).fill(0), on = new Array(g.n).fill(false);
  const st: number[] = [], comp = new Array(g.n).fill(-1), comps: number[][] = [];
  for (let s = 0; s < g.n; s++) {
    if (idx[s] !== -1) continue;
    const work: { v: number; i: number }[] = [{ v: s, i: 0 }];
    idx[s] = low[s] = index++;
    st.push(s);
    on[s] = true;
    while (work.length) {
      const top = work[work.length - 1];
      const ss = g.succs[top.v];
      if (top.i < ss.length) {
        const w = ss[top.i++];
        if (idx[w] === -1) {
          idx[w] = low[w] = index++;
          st.push(w);
          on[w] = true;
          work.push({ v: w, i: 0 });
        } else if (on[w]) low[top.v] = Math.min(low[top.v], idx[w]);
      } else {
        work.pop();
        if (work.length) low[work[work.length - 1].v] = Math.min(low[work[work.length - 1].v], low[top.v]);
        if (low[top.v] === idx[top.v]) {
          const c: number[] = [];
          let w: number;
          do {
            w = st.pop()!;
            on[w] = false;
            comp[w] = comps.length;
            c.push(w);
          } while (w !== top.v);
          comps.push(c);
        }
      }
    }
  }
  return { comp, comps };
}
