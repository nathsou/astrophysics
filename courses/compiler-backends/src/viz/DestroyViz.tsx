// Chapter 10 widgets: parallel-copy sequentialisation and phi elimination.

import { useMemo, useState, type ReactNode } from 'react';
import { sequentialize, type PCopy, type SeqStep } from '../compiler/codegen/ssadestroy';
import { Figure } from '../ui/prose';
import { Seg, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { printMFunc } from '../compiler/codegen/printmir';
import { GraphView, type GEdge, type GNode } from './Graph';
import { mirCFG } from './cfgdata';
import { FnPicker, useExample } from './common';

const PRESETS: Record<string, string> = {
  swap: 'a←b, b←a',
  rotate: 'a←b, b←c, c←a',
  'cycle + tree': 'a←b, b←c, c←a, d←a, e←d',
  'two cycles': 'a←b, b←a, c←d, d←c',
  chain: 'a←b, b←c, c←d',
  fanout: 'b←a, c←a, d←a',
};

function parse(s: string): { copies: PCopy[]; names: string[] } | undefined {
  const names: string[] = [];
  const id = (n: string) => { let k = names.indexOf(n); if (k < 0) { k = names.length; names.push(n); } return k; };
  const copies: PCopy[] = [];
  for (const part of s.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\w+)\s*(?:←|<-|=)\s*(\w+)$/.exec(part);
    if (!m) return undefined;
    copies.push({ dst: id(m[1]), src: id(m[2]) });
  }
  if (new Set(copies.map((c) => c.dst)).size !== copies.length) return undefined;
  return { copies, names };
}

export function ParallelCopyStepper({ initial = 'cycle + tree', caption }: { initial?: string; caption?: ReactNode }) {
  const [txt, setTxt] = useState(PRESETS[initial] ?? initial);
  const parsed = parse(txt);
  const run = useMemo(() => {
    if (!parsed) return undefined;
    const names = [...parsed.names];
    const trace: SeqStep[] = [];
    const seq = sequentialize(parsed.copies, () => { names.push(`tmp${names.length - parsed.names.length || ''}`); return names.length - 1; }, trace);
    return { seq, trace, names };
  }, [txt]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useStepper((run?.trace.length ?? 0) + 1, { interval: 900 });
  if (!parsed || !run) return <Figure title="Sequentialising a parallel copy"><div className="error-box">Write copies like: a←b, b←a (each destination at most once)</div></Figure>;
  const step = s.i === 0 ? undefined : run.trace[s.i - 1];
  const pending = step ? step.pending : parsed.copies;
  const emitted = run.trace.slice(0, s.i).map((t) => t.emitted);
  const nm = (k: number) => run.names[k];
  const used = new Set<number>();
  pending.forEach((c) => { used.add(c.dst); used.add(c.src); });
  parsed.copies.forEach((c) => { used.add(c.dst); used.add(c.src); });
  if (step?.usedTemp) used.add(step.emitted.dst);
  emitted.forEach((c) => { used.add(c.dst); used.add(c.src); });
  const nodes: GNode[] = [...used].map((k) => ({ id: String(k), title: nm(k), titleText: nm(k), width: 60, style: step && (step.emitted.dst === k) ? 'current' : k >= parsed.names.length ? 'warn' : 'default' }));
  const edges: GEdge[] = pending.map((c) => ({ from: String(c.src), to: String(c.dst), kind: 'normal' }));
  return (
    <Figure title="Sequentialising a parallel copy" caption={caption} controls={
      <>
        <input className="select mono" value={txt} onChange={(e) => { setTxt(e.target.value); s.set(0); }} style={{ width: 230 }} />
        {Object.entries(PRESETS).map(([k, v]) => <button key={k} className="chip-btn" onClick={() => { setTxt(v); s.set(0); }}>{k}</button>)}
      </>
    }>
      <div className="panes" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="pane">
          <div className="pane-head">pending copies (edge = value flows src → dst)</div>
          <GraphView nodes={nodes} edges={edges} compact rankdir="LR" maxHeight={300} />
        </div>
        <div className="pane">
          <div className="pane-head">emitted sequence</div>
          <div style={{ padding: 10, fontFamily: 'var(--mono)', fontSize: 13 }}>
            {emitted.length ? emitted.map((c, i) => <div key={i} style={{ color: c.dst >= parsed.names.length || c.src >= parsed.names.length ? 'var(--red)' : undefined }}>{i + 1}. {nm(c.dst)} ← {nm(c.src)}</div>) : <span className="muted sans">(nothing yet)</span>}
          </div>
        </div>
      </div>
      <div className="step-desc">
        {!step ? <>Parallel semantics: all right-hand sides are read <i>before</i> any left-hand side is written. Emitting the copies naively, in order, would clobber values that are still needed.</>
          : <><b>{nm(step.emitted.dst)} ← {nm(step.emitted.src)}</b>: {step.why.replace(/\b(\d+)\b/g, (_, k) => nm(Number(k)))}.</>}
        {s.i === s.n - 1 && <> Done: {run.seq.length} copies{run.seq.length > parsed.copies.filter((c) => c.dst !== c.src).length ? `, one extra per cycle` : ''}.</>}
      </div>
      <Stepper s={s} />
    </Figure>
  );
}

export function PhiElimExplorer({ example = 'rotate', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn);
  const [view, setView] = useState<'code' | 'cfg'>('code');
  const fs = ctx.fs;
  if (!fs) return null;
  const tr = fs.destroy;
  const splitNames = new Set(tr.splitEdges.map((e) => e.block));
  const before = mirCFG(fs.isel, { code: true });
  const after = mirCFG(fs.ssaDestroyed, { code: true, style: (i) => (splitNames.has(fs.ssaDestroyed.blocks[i].name) ? 'warn' : undefined) });
  return (
    <Figure title="Phi elimination in machine IR" caption={caption} controls={<><FnPicker ctx={ctx} /><Seg value={view} onChange={setView} options={[['code', 'listing'], ['cfg', 'CFG']]} /></>}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="pane"><div className="pane-head">with PHIs (SSA machine IR)</div>
          {view === 'code' ? <CodeView lines={printMFunc(fs.isel, { comments: false })} maxHeight={460} notes mark={(l) => (l.toks[0]?.t === 'PHI' ? 'focus' : undefined)} /> : <GraphView nodes={before.nodes} edges={before.edges} maxHeight={460} />}
        </div>
        <div className="pane"><div className="pane-head">after: copies on edges</div>
          {view === 'code' ? <CodeView lines={printMFunc(fs.ssaDestroyed, { comments: false })} maxHeight={460} notes /> : <GraphView nodes={after.nodes} edges={after.edges} maxHeight={460} />}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--rule)', maxHeight: 200, overflow: 'auto' }}>
        <table className="dtable">
          <thead><tr><th>edge</th><th>parallel copy</th><th>sequential copies</th></tr></thead>
          <tbody>
            {tr.edges.map((e, i) => (
              <tr key={i}><td>{e.from} → {e.to}</td><td>({e.parallel.map((c) => c.dst).join(', ')}) := ({e.parallel.map((c) => c.src).join(', ')})</td><td>{e.sequence.map((c) => `${c.dst} ← ${c.src}`).join(';  ')}</td></tr>
            ))}
          </tbody>
        </table>
        {tr.splitEdges.length > 0 && <div className="stat-row">split critical edges: {tr.splitEdges.map((e) => <span key={e.block} className="pill red">{e.from} → {e.to}</span>)}</div>}
      </div>
    </Figure>
  );
}
