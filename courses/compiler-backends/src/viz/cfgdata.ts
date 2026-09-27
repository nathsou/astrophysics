import type { Func } from '../compiler/ir/ir';
import { printFunc } from '../compiler/ir/print';
import type { Line } from '../compiler/listing';
import { irGraph, type Graph } from '../compiler/analysis/graph';
import { dominators, dominates } from '../compiler/analysis/dom';
import type { MFunc } from '../compiler/codegen/mir';
import { printMFunc } from '../compiler/codegen/printmir';
import { mirGraph } from '../compiler/codegen/mcfg';
import type { GEdge, GNode } from './Graph';

/** Split a printed function into per-block line groups (label line removed). */
export function irBlockLines(fn: Func): Line[][] {
  const lines = printFunc(fn, { preds: false });
  const out: Line[][] = fn.blocks.map(() => []);
  let cur = -1;
  for (const l of lines) {
    if (l.kind === 'label') { cur++; continue; }
    if (l.kind === 'instr' && cur >= 0) out[cur].push({ ...l, indent: 0 });
  }
  return out;
}

export function mirBlockLines(f: MFunc, post = false): Line[][] {
  const lines = printMFunc(f, { post, comments: false });
  const out: Line[][] = f.blocks.map(() => []);
  // non-assembly printing: the function label, then one label per block (entry included)
  let cur = -1;
  let seenFn = false;
  for (const l of lines) {
    if (l.kind === 'label') {
      if (!seenFn) { seenFn = true; continue; }
      cur++;
      continue;
    }
    if (l.kind === 'instr' && cur >= 0 && out[cur]) out[cur].push({ ...l, indent: 0 });
  }
  return out;
}

export function classifyEdges(g: Graph): GEdge['kind'][][] {
  const d = dominators(g);
  return g.succs.map((ss, u) => ss.map((v) => {
    if (dominates(d, v, u)) return 'back';
    if (g.succs[u].length > 1 && g.preds[v].length > 1) return 'critical';
    return 'normal';
  }));
}

export function graphFor(g: Graph, lines: Line[][] | undefined, opts: { style?: (i: number) => GNode['style']; extra?: (i: number) => { node: React.ReactNode; lines: number } | undefined; edgeKinds?: boolean; labels?: boolean } = {}): { nodes: GNode[]; edges: GEdge[] } {
  const kinds = opts.edgeKinds !== false ? classifyEdges(g) : undefined;
  const nodes: GNode[] = g.names.map((name, i) => {
    const ex = opts.extra?.(i);
    return { id: String(i), title: name, titleText: name, lines: lines?.[i], style: opts.style?.(i), extra: ex?.node, extraLines: ex?.lines };
  });
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => {
    const kind = kinds?.[u][k] ?? 'normal';
    edges.push({ from: String(u), to: String(v), kind, label: opts.labels && ss.length === 2 ? (k === 0 ? 'T' : 'F') : undefined });
  }));
  return { nodes, edges };
}

export function irCFG(fn: Func, opts: Parameters<typeof graphFor>[2] & { code?: boolean } = {}) {
  fn.computePreds();
  return graphFor(irGraph(fn), opts.code === false ? undefined : irBlockLines(fn), { labels: true, ...opts });
}

export function mirCFG(f: MFunc, opts: Parameters<typeof graphFor>[2] & { code?: boolean; post?: boolean } = {}) {
  return graphFor(mirGraph(f), opts.code === false ? undefined : mirBlockLines(f, opts.post), opts);
}
