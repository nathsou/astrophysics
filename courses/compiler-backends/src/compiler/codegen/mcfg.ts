import { dominators } from '../analysis/dom';
import type { Graph } from '../analysis/graph';
import { findLoops } from '../analysis/loops';
import type { MFunc } from './mir';

export function mirGraph(f: MFunc): Graph {
  f.computeCFG();
  const idx = new Map(f.blocks.map((b, i) => [b, i]));
  return {
    n: f.blocks.length,
    entry: 0,
    succs: f.blocks.map((b) => b.succs.map((s) => idx.get(s)!)),
    preds: f.blocks.map((b) => b.preds.map((p) => idx.get(p)!)),
    names: f.blocks.map((b) => b.name),
  };
}

/** Annotate machine blocks with loop nesting depth (used for spill costs and layout). */
export function computeLoopDepth(f: MFunc) {
  const g = mirGraph(f);
  const li = findLoops(g, dominators(g));
  f.blocks.forEach((b, i) => (b.loopDepth = li.depth[i]));
  return li;
}
