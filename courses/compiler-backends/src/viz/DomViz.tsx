// Chapter 3 widgets: Cooper-Harvey-Kennedy stepper, dominator tree, frontiers.

import { useMemo, useState, type ReactNode } from 'react';
import { irGraph } from '../compiler/analysis/graph';
import { dominanceFrontiers, dominators, dominates, iteratedDF } from '../compiler/analysis/dom';
import { Figure } from '../ui/prose';
import { Stepper, useStepper } from '../ui/controls';
import { GraphView, type GEdge, type GNode } from './Graph';
import { classifyEdges, irBlockLines } from './cfgdata';
import { FnPicker, useExample } from './common';

export function DominanceStepper({ example = 'sort', fn = 'sort', caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn, { opt: 2 });
  const data = useMemo(() => {
    if (!ctx.ir) return undefined;
    const g = irGraph(ctx.ir);
    return { g, d: dominators(g, true), kinds: classifyEdges(g) };
  }, [ctx.ir]);
  const s = useStepper(data?.d.steps.length ?? 0, { interval: 900 });
  if (!data) return null;
  const { g, d, kinds } = data;
  const st = d.steps[s.i];
  if (!st) return null;
  const idom = st.idom;
  const walkNodes = new Set(st.walk.flat());
  const nodes: GNode[] = g.names.map((name, i) => ({
    id: String(i),
    title: name,
    titleText: name + '  rpo 00',
    style: i === st.node ? 'current' : st.preds.some((p) => p.pred === i && p.processed) ? 'focus' : walkNodes.has(i) ? 'active' : idom[i] === -1 ? 'dim' : 'default',
    badge: <span className="pill" title="reverse postorder index">rpo {d.rpoIndex[i]}</span>,
  }));
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => edges.push({ from: String(u), to: String(v), kind: kinds[u][k] === 'back' ? 'back' : 'faint' })));
  const tnodes: GNode[] = g.names.map((name, i) => ({ id: String(i), title: name, titleText: name, style: i === st.node ? 'current' : idom[i] === -1 ? 'dim' : 'default' }));
  const tedges: GEdge[] = [];
  idom.forEach((p, i) => { if (p >= 0 && p !== i) tedges.push({ from: String(p), to: String(i), kind: i === st.node ? 'hot' : 'dom' }); });
  const nm = (x: number) => g.names[x];
  const processed = st.preds.filter((p) => p.processed).map((p) => nm(p.pred));
  const skipped = st.preds.filter((p) => !p.processed).map((p) => nm(p.pred));
  return (
    <Figure title="Cooper–Harvey–Kennedy dominators" caption={caption} controls={<FnPicker ctx={ctx} />}>
      <div className="panes" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="pane"><div className="pane-head">CFG (nodes labelled with RPO index)</div><GraphView nodes={nodes} edges={edges} compact maxHeight={440} /></div>
        <div className="pane"><div className="pane-head">dominator tree so far</div><GraphView nodes={tnodes} edges={tedges} compact maxHeight={440} /></div>
      </div>
      <div className="step-desc">
        <b>Pass {st.pass}</b>, node <b>{nm(st.node)}</b>:{' '}
        {processed.length ? <>intersect the dominators of its processed predecessors <b>{processed.join(', ')}</b></> : 'no processed predecessor yet'}
        {skipped.length ? <> (skipping {skipped.join(', ')}: no idom yet)</> : null}.{' '}
        {st.walk.length > 0 && <>Two-finger walk: {st.walk.map(([a, b]) => `(${nm(a)}, ${nm(b)})`).join(' → ')}. </>}
        New idom = <b>{st.newIdom >= 0 ? nm(st.newIdom) : '?'}</b>
        {st.changed ? <span className="badge accent" style={{ marginLeft: 8 }}>changed</span> : <span className="badge" style={{ marginLeft: 8 }}>unchanged</span>}
        {s.i === d.steps.length - 1 && <> — converged after {d.passes} passes ({d.passes - 1} to compute, 1 to confirm nothing changes).</>}
      </div>
      <Stepper s={s} />
    </Figure>
  );
}

export function DominanceExplorer({ example = 'sort', fn = 'sort', caption, initial }: { example?: string; fn?: string; caption?: ReactNode; initial?: string }) {
  const ctx = useExample(example, undefined, fn, { opt: 2 });
  const data = useMemo(() => {
    if (!ctx.ir) return undefined;
    const g = irGraph(ctx.ir);
    const d = dominators(g);
    return { g, d, df: dominanceFrontiers(g, d).df, kinds: classifyEdges(g), lines: irBlockLines(ctx.ir) };
  }, [ctx.ir]);
  const [sel, setSel] = useState<number>(-1);
  if (!data) return null;
  const { g, d, df, kinds } = data;
  const x = sel >= 0 ? sel : Math.max(0, g.names.indexOf(initial ?? ''));
  const doms = new Set<number>();
  for (let v = x; ; v = d.idom[v]) { doms.add(v); if (d.idom[v] === v || d.idom[v] < 0) break; }
  const idf = iteratedDF(df, [x]);
  const nodes: GNode[] = g.names.map((name, i) => {
    let style: GNode['style'] = 'default';
    if (i === x) style = 'current';
    else if (df[x].has(i)) style = 'warn';
    else if (doms.has(i)) style = 'active';
    else if (dominates(d, x, i)) style = 'focus';
    return { id: String(i), title: name, titleText: name + ' DF', style, badge: df[x].has(i) ? <span className="pill red">DF</span> : idf.has(i) ? <span className="pill red">DF⁺</span> : undefined };
  });
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => edges.push({ from: String(u), to: String(v), kind: kinds[u][k] === 'back' ? 'back' : 'normal' })));
  const tnodes: GNode[] = nodes.map((n) => ({ ...n, badge: undefined }));
  const tedges: GEdge[] = [];
  d.idom.forEach((p, i) => { if (p >= 0 && p !== i) tedges.push({ from: String(p), to: String(i), kind: 'dom' }); });
  const nm = (i: number) => g.names[i];
  return (
    <Figure title="Dominators and dominance frontiers — click a block" caption={caption} controls={<FnPicker ctx={ctx} />}>
      <div className="panes" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="pane"><div className="pane-head">CFG</div><GraphView nodes={nodes} edges={edges} compact maxHeight={440} onNodeClick={(id) => setSel(Number(id))} /></div>
        <div className="pane"><div className="pane-head">dominator tree</div><GraphView nodes={tnodes} edges={tedges} compact maxHeight={440} onNodeClick={(id) => setSel(Number(id))} /></div>
      </div>
      <div className="step-desc">
        Selected <b>{nm(x)}</b>. Its dominators: <b>{[...doms].map(nm).join(' ← ')}</b> (violet).
        It dominates <b>{g.names.filter((_, i) => i !== x && dominates(d, x, i)).join(', ') || 'nothing else'}</b> (teal).
        Dominance frontier DF({nm(x)}) = <b>{`{${[...df[x]].map(nm).join(', ')}}`}</b>
        {idf.size !== df[x].size && <>; iterated DF⁺ = <b>{`{${[...idf].map(nm).join(', ')}}`}</b></>} (red):
        the first blocks reachable from {nm(x)} that it does <i>not</i> strictly dominate — where a definition in {nm(x)} may need a φ.
      </div>
    </Figure>
  );
}
