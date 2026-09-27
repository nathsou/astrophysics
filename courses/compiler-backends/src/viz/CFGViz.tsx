// Chapter 2 widgets: CFG explorer and depth-first search stepper.

import { useMemo, useState } from 'react';
import { irGraph, type Graph } from '../compiler/analysis/graph';
import { Figure } from '../ui/prose';
import { Check, Seg, Stepper, useStepper } from '../ui/controls';
import { GraphView, type GEdge, type GNode } from './Graph';
import { irCFG, classifyEdges, irBlockLines } from './cfgdata';
import { FnPicker, useExample } from './common';
import { CodeView } from '../ui/CodeView';
import { printFunc } from '../compiler/ir/print';

export function CFGExplorer({ example = 'sort', fn, stage = 'optimized', caption, code: code0 = true }: { example?: string; fn?: string; stage?: 'lowered' | 'ssa' | 'optimized'; caption?: React.ReactNode; code?: boolean }) {
  const [st, setSt] = useState(stage);
  const ctx = useExample(example, undefined, fn, { opt: 2 }, st);
  const [code, setCode] = useState(code0);
  const [side, setSide] = useState(false);
  const g = ctx.ir ? irCFG(ctx.ir, { code }) : undefined;
  return (
    <Figure
      title="Control-flow graph"
      caption={caption}
      controls={
        <>
          <FnPicker ctx={ctx} />
          <Seg value={st} onChange={setSt} options={[['lowered', 'lowered'], ['ssa', 'SSA'], ['optimized', 'optimised']]} />
          <Check checked={code} onChange={setCode}>show code</Check>
          <Check checked={side} onChange={setSide}>listing</Check>
        </>
      }
    >
      <div className="panes" style={{ gridTemplateColumns: side ? '1fr 1fr' : '1fr' }}>
        <div className="pane">{g && <GraphView nodes={g.nodes} edges={g.edges} maxHeight={560} />}</div>
        {side && ctx.ir && <div className="pane"><CodeView lines={printFunc(ctx.ir)} maxHeight={560} notes /></div>}
      </div>
      <div className="stat-row">
        <span><span className="pill">──▶</span> edge</span>
        <span><span className="pill accent">- - ▶</span> back edge (target dominates source)</span>
        <span><span className="pill red">━━▶</span> critical edge</span>
      </div>
    </Figure>
  );
}

// ------------------------------------------------------------------ DFS

interface DfsEvent {
  kind: 'visit' | 'edge' | 'finish';
  node: number;
  to?: number;
  edgeKind?: GEdge['kind'] | 'tree' | 'forward' | 'cross';
  pre: number[];
  post: number[];
  stack: number[];
}

function dfsTrace(g: Graph): DfsEvent[] {
  const ev: DfsEvent[] = [];
  const pre = new Array(g.n).fill(-1), post = new Array(g.n).fill(-1);
  const onStack = new Array(g.n).fill(false);
  let pc = 0, qc = 0;
  const stack: number[] = [];
  const snap = (e: Omit<DfsEvent, 'pre' | 'post' | 'stack'>) => ev.push({ ...e, pre: [...pre], post: [...post], stack: [...stack] });
  const visit = (v: number) => {
    pre[v] = pc++;
    onStack[v] = true;
    stack.push(v);
    snap({ kind: 'visit', node: v });
    for (const w of g.succs[v]) {
      let kind: DfsEvent['edgeKind'];
      if (pre[w] === -1) kind = 'tree';
      else if (onStack[w]) kind = 'back';
      else if (pre[w] > pre[v]) kind = 'forward';
      else kind = 'cross';
      snap({ kind: 'edge', node: v, to: w, edgeKind: kind });
      if (kind === 'tree') visit(w);
    }
    post[v] = qc++;
    onStack[v] = false;
    stack.pop();
    snap({ kind: 'finish', node: v });
  };
  visit(g.entry);
  return ev;
}

export function DFSStepper({ example = 'sort', fn = 'sort', caption }: { example?: string; fn?: string; caption?: React.ReactNode }) {
  const ctx = useExample(example, undefined, fn, { opt: 2 });
  const g = useMemo(() => ctx.ir && irGraph(ctx.ir), [ctx.ir]);
  const trace = useMemo(() => (g ? dfsTrace(g) : []), [g]);
  const s = useStepper(trace.length, { interval: 650 });
  if (!g || !ctx.ir) return null;
  const e = trace[s.i];
  const seenEdges = new Map<string, DfsEvent['edgeKind']>();
  for (let k = 0; k <= s.i; k++) if (trace[k].kind === 'edge') seenEdges.set(`${trace[k].node}-${trace[k].to}`, trace[k].edgeKind);
  const lines = irBlockLines(ctx.ir);
  const nodes: GNode[] = g.names.map((name, i) => ({
    id: String(i),
    title: name,
    titleText: name + '   pre 00 post 00',
    lines: lines[i].slice(-1),
    style: e.node === i || e.to === i ? 'current' : e.stack.includes(i) ? 'active' : e.post[i] >= 0 ? 'done' : e.pre[i] >= 0 ? 'active' : 'dim',
    badge: (
      <span style={{ display: 'flex', gap: 3 }}>
        {e.pre[i] >= 0 && <span className="pill violet" title="preorder number">pre {e.pre[i]}</span>}
        {e.post[i] >= 0 && <span className="pill green" title="postorder number">post {e.post[i]}</span>}
      </span>
    ),
  }));
  const kindMap: Record<string, GEdge['kind']> = { tree: 'tree', back: 'back', forward: 'dom', cross: 'hot' };
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v) => {
    const k = seenEdges.get(`${u}-${v}`);
    edges.push({ from: String(u), to: String(v), kind: k ? kindMap[k] : 'faint', label: k && k !== 'tree' ? k : undefined });
  }));
  const rpo = e.post.map((p, i) => [p, i] as const).filter(([p]) => p >= 0).sort((a, b) => b[0] - a[0]).map(([, i]) => g.names[i]);
  const done = s.i === trace.length - 1;
  let desc;
  if (e.kind === 'visit') desc = <>Visit <b>{g.names[e.node]}</b>: it gets preorder number {e.pre[e.node]} and goes on the stack.</>;
  else if (e.kind === 'finish') desc = <>All successors of <b>{g.names[e.node]}</b> explored: it finishes with postorder number {e.post[e.node]}.</>;
  else desc = <>Edge <b>{g.names[e.node]} → {g.names[e.to!]}</b> is a <b>{e.edgeKind} edge</b>{e.edgeKind === 'tree' ? ': first time we see the target, so recurse into it' : e.edgeKind === 'back' ? ': the target is still on the stack — this edge closes a cycle' : e.edgeKind === 'forward' ? ': to a descendant already visited' : ': to a node in an already finished subtree'}.</>;
  return (
    <Figure title="Depth-first search, step by step" caption={caption} controls={<span className="pill">@{ctx.fn}</span>}>
      <GraphView nodes={nodes} edges={edges} maxHeight={520} />
      <div className="step-desc">{desc}</div>
      <div className="stat-row">
        <span>stack: <b>{e.stack.map((x) => g.names[x]).join(' › ') || '∅'}</b></span>
        <span>reverse postorder{done ? '' : ' so far'}: <b>{rpo.join(', ')}</b></span>
      </div>
      <Stepper s={s} />
    </Figure>
  );
}

export function EdgeKinds({ example = 'sort', fn = 'sort' }: { example?: string; fn?: string }) {
  const ctx = useExample(example, undefined, fn);
  if (!ctx.ir) return null;
  const g = irGraph(ctx.ir);
  const k = classifyEdges(g);
  return <span>{k.flat().filter((x) => x === 'back').length} back edges</span>;
}
