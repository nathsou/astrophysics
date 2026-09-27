// Natural loop detection. A back edge t -> h is an edge whose target dominates
// its source; the natural loop of that edge is h plus every node that can reach
// t without passing through h. Loops sharing a header are merged.

import { dominates, type DomInfo } from './dom';
import type { Graph } from './graph';

export interface Loop {
  header: number;
  latches: number[];
  body: Set<number>;
  parent?: Loop;
  depth: number;
  exits: number[];
}

export interface LoopInfo {
  loops: Loop[];
  depth: number[]; // loop nesting depth per node
  innermost: (Loop | undefined)[];
  backEdges: [number, number][];
  irreducible: boolean;
}

export function findLoops(g: Graph, d: DomInfo): LoopInfo {
  const byHeader = new Map<number, Loop>();
  const backEdges: [number, number][] = [];
  let irreducible = false;
  for (let t = 0; t < g.n; t++) {
    if (d.idom[t] === -1) continue;
    for (const h of g.succs[t]) {
      if (dominates(d, h, t)) {
        backEdges.push([t, h]);
        let L = byHeader.get(h);
        if (!L) byHeader.set(h, (L = { header: h, latches: [], body: new Set([h]), depth: 0, exits: [] }));
        L.latches.push(t);
        const work = [t];
        while (work.length) {
          const x = work.pop()!;
          if (L.body.has(x)) continue;
          L.body.add(x);
          for (const p of g.preds[x]) work.push(p);
        }
      } else if (d.rpoIndex[h] <= d.rpoIndex[t] && d.rpoIndex[h] >= 0) {
        // retreating edge whose target does not dominate its source
        irreducible = true;
      }
    }
  }
  const loops = [...byHeader.values()].sort((a, b) => b.body.size - a.body.size);
  for (const L of loops) {
    for (const M of loops) {
      if (M === L || M.body.size <= L.body.size) continue;
      if (M.body.has(L.header) && (!L.parent || L.parent.body.size > M.body.size)) L.parent = M;
    }
    for (const b of L.body) for (const s of g.succs[b]) if (!L.body.has(s) && !L.exits.includes(s)) L.exits.push(s);
  }
  for (const L of loops) {
    let k = 1;
    for (let p = L.parent; p; p = p.parent) k++;
    L.depth = k;
  }
  const depth = new Array(g.n).fill(0);
  const innermost: (Loop | undefined)[] = new Array(g.n).fill(undefined);
  for (const L of loops) {
    for (const b of L.body) {
      if (L.depth > depth[b]) {
        depth[b] = L.depth;
        innermost[b] = L;
      }
    }
  }
  return { loops, depth, innermost, backEdges, irreducible };
}
