import { useState, type ReactNode } from 'react';
import { printFunc } from '../compiler/ir/print';
import { Figure } from '../ui/prose';
import { Seg } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { FnPicker, useExample } from './common';

export function OptExplorer({ example = 'max', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const [opt, setOpt] = useState<1 | 2>(2);
  const ctx = useExample(example, undefined, fn, { opt });
  const before = ctx.r.ssa?.funcs.find((f) => f.name === ctx.fn);
  const after = ctx.r.optimized?.funcs.find((f) => f.name === ctx.fn);
  if (!before || !after) return null;
  const log = ctx.r.optLog;
  const count = (f: typeof before) => f.blocks.reduce((s, b) => s + b.instrs.length, 0);
  return (
    <Figure title="Mid-level clean-up before the backend" caption={caption} controls={<><FnPicker ctx={ctx} /><Seg value={opt} onChange={setOpt} options={[[1, '-O1'], [2, '-O2 (+CSE, if-conversion)']]} /></>}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="pane"><div className="pane-head">after mem2reg <span className="spacer" /><span className="pill">{count(before)} instrs · {before.blocks.length} blocks</span></div><CodeView lines={printFunc(before)} maxHeight={420} /></div>
        <div className="pane"><div className="pane-head">optimised <span className="spacer" /><span className="pill accent">{count(after)} instrs · {after.blocks.length} blocks</span></div><CodeView lines={printFunc(after)} maxHeight={420} notes /></div>
      </div>
      <div style={{ maxHeight: 180, overflow: 'auto', borderTop: '1px solid var(--rule)', padding: '6px 14px', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
        <div className="muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 650, marginBottom: 4 }}>pass log (whole module)</div>
        {log.length ? log.map((m, i) => <div key={i} style={{ padding: '1px 0' }}><span className="mono muted" style={{ fontSize: 11 }}>{String(i + 1).padStart(2, ' ')}.</span> {m}</div>) : <span className="muted">nothing to do</span>}
      </div>
    </Figure>
  );
}
