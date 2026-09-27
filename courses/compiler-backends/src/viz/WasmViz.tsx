// Chapter 21 widgets: structured control flow recovery and the Wasm module.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { irGraph } from '../compiler/analysis/graph';
import { lowerModule, runWasm } from '../compiler/wasm/wasm';
import type { Line } from '../compiler/listing';
import { Figure } from '../ui/prose';
import { Check, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { GraphView, type GEdge, type GNode } from './Graph';
import { classifyEdges } from './cfgdata';
import { FnPicker, useExample } from './common';

export function WasmExplorer({ example = 'collatz', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn);
  const [stackify, setStackify] = useState(true);
  const w = useMemo(() => {
    if (!ctx.r.optimized) return undefined;
    try { return lowerModule(ctx.r.optimized, { stackify }); } catch (e) { return { error: (e as Error).message }; }
  }, [ctx.r.optimized, stackify]);
  const [out, setOut] = useState<string | null>(null);
  useEffect(() => {
    setOut(null);
    if (!w || 'error' in w) return;
    let live = true;
    runWasm(w.bytes).then((o) => live && setOut(o.error ? `error: ${o.error}` : o.output + `[exit ${o.exitCode}]`));
    return () => { live = false; };
  }, [w]);
  const wf = w && !('error' in w) ? w.funcs.find((f) => f.name === ctx.fn) : undefined;
  const steps = wf?.structure ?? [];
  const s = useStepper(steps.length, { interval: 900 });
  if (!w || 'error' in w) return <Figure title="WebAssembly"><div className="error-box">{w && 'error' in w ? w.error : 'compile error'}</div></Figure>;
  if (!wf || !ctx.ir) return null;
  const g = irGraph(ctx.ir);
  const kinds = classifyEdges(g);
  const st = steps[s.i];
  const involved = new Set(steps.slice(0, s.i + 1).map((x) => x.node));
  const nodes: GNode[] = g.names.map((n, i) => ({
    id: String(i), title: n, titleText: n + ' loop',
    style: st && n === st.node ? 'current' : st && n === st.target ? 'focus' : involved.has(n) ? 'done' : 'dim',
    badge: steps.slice(0, s.i + 1).some((x) => x.kind === 'loop' && x.node === n) ? <span className="pill violet">loop</span> : steps.slice(0, s.i + 1).some((x) => x.kind === 'block' && x.node === n) ? <span className="pill teal">block end</span> : undefined,
  }));
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => edges.push({ from: String(u), to: String(v), kind: kinds[u][k] === 'back' ? 'back' : 'normal' })));
  // only this function's part of the WAT
  const all = w.wat;
  const start = all.findIndex((l) => l.toks.some((t) => t.t === `$${ctx.fn}`) && l.toks[0]?.t === '(func ');
  let end = start + 1;
  while (end < all.length && !(all[end].toks[0]?.t === '(func ' || all[end].toks[0]?.t.startsWith('(export'))) end++;
  const lines: Line[] = all.slice(Math.max(0, start), end);
  return (
    <Figure title="From a CFG to structured WebAssembly" caption={caption} controls={<><FnPicker ctx={ctx} /><Check checked={stackify} onChange={setStackify}>stackify expressions</Check><span className="pill accent">{w.bytes.length} bytes</span><span className="pill">{wf.locals.length} locals</span></>}>
      <div className="panes" style={{ gridTemplateColumns: '0.9fr 1.2fr' }}>
        <div className="pane"><div className="pane-head">CFG (after optimisation)</div><GraphView nodes={nodes} edges={edges} compact maxHeight={480} /></div>
        <div className="pane"><div className="pane-head">WAT</div><CodeView lines={lines} target="wasm" maxHeight={480} notes /></div>
      </div>
      <div className="step-desc">{st ? <><span className="badge accent">{st.kind}</span> {st.why}</> : 'No structure steps.'}</div>
      <Stepper s={s} />
      <div className="stat-row"><span>output from your browser’s Wasm engine:</span><span className="mono">{out ?? '…'}</span></div>
    </Figure>
  );
}
