// Chapter 4 widgets: mem2reg (phi placement + renaming) step by step.

import { useMemo, useState, type ReactNode } from 'react';
import { irGraph } from '../compiler/analysis/graph';
import { printFunc } from '../compiler/ir/print';
import { Figure } from '../ui/prose';
import { Seg, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { GraphView, type GEdge, type GNode } from './Graph';
import { classifyEdges } from './cfgdata';
import { FnPicker, useExample } from './common';

export function Mem2RegStepper({ example = 'gcd', fn = 'gcd', caption, pruned = true }: { example?: string; fn?: string; caption?: ReactNode; pruned?: boolean }) {
  const ctx = useExample(example, undefined, fn, { opt: 1, pruned }, 'lowered');
  const trace = ctx.r.mem2reg[ctx.fn];
  const lowered = ctx.r.lowered?.funcs.find((f) => f.name === ctx.fn);
  const ssa = ctx.r.ssa?.funcs.find((f) => f.name === ctx.fn);
  const [phase, setPhase] = useState<'place' | 'rename' | 'result'>('place');
  const sPlace = useStepper(trace?.phiSteps.length ?? 0, { interval: 900 });
  const sRename = useStepper(trace?.renameSteps.length ?? 0, { interval: 700 });
  const g = useMemo(() => lowered && irGraph(lowered), [lowered]);
  const kinds = useMemo(() => g && classifyEdges(g), [g]);
  if (!trace || !lowered || !g || !ssa) return null;
  const name = (i: number) => g.names[i];
  const idx = (n: string) => g.names.indexOf(n);

  let nodes: GNode[];
  let desc: ReactNode;
  let right: ReactNode;
  if (phase === 'place') {
    const st = trace.phiSteps[sPlace.i];
    const placed = new Map<string, string[]>();
    const skipped = new Map<string, string[]>();
    for (let k = 0; k <= sPlace.i; k++) {
      const p = trace.phiSteps[k];
      if (!p) continue;
      if (p.placed) placed.set(p.placed, [...(placed.get(p.placed) ?? []), p.variable]);
      if (p.skipped) skipped.set(p.skipped, [...(skipped.get(p.skipped) ?? []), p.variable]);
    }
    const v = trace.variables.find((x) => x.name === st?.variable);
    nodes = g.names.map((n, i) => ({
      id: String(i), title: n, titleText: n + ' φ x, y',
      style: st && n === st.from ? 'current' : st && (n === st.placed || n === st.skipped) ? 'warn' : v?.defs.includes(n) ? 'focus' : 'default',
      badge: (
        <span style={{ display: 'flex', gap: 3 }}>
          {placed.get(n)?.map((x) => <span key={x} className="pill accent">φ {x}</span>)}
          {skipped.get(n)?.map((x) => <span key={x} className="pill" style={{ textDecoration: 'line-through' }}>φ {x}</span>)}
        </span>
      ),
    }));
    desc = st ? (
      <>
        Variable <b>{st.variable}</b> (defined in <b>{v?.defs.join(', ')}</b>, teal). Processing <b>{st.from}</b>: DF = {`{${st.frontier.join(', ')}}`}.{' '}
        {st.placed && <>Insert <b>φ</b> for {st.variable} at <b>{st.placed}</b>; the φ is itself a new definition, so {st.placed} joins the worklist.</>}
        {st.skipped && <>A φ would go at <b>{st.skipped}</b>, but {st.variable} is not live there — <b>pruned SSA</b> skips it.</>}
        {' '}Worklist: [{st.worklist.join(', ')}]
      </>
    ) : <>No promotable variables.</>;
    right = (
      <table className="dtable">
        <thead><tr><th>variable</th><th>stored in</th><th>loaded in</th><th>promote?</th></tr></thead>
        <tbody>
          {trace.variables.map((x) => (
            <tr key={x.slot} className={x.name === st?.variable ? 'cur' : ''}>
              <td>{x.name}</td><td>{x.defs.join(', ')}</td><td>{x.uses.join(', ')}</td>
              <td className="sans" style={{ fontSize: 11.5 }}>{x.promoted ? '✓' : `✗ ${x.reason}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (phase === 'rename') {
    const st = trace.renameSteps[sRename.i];
    const visited = new Set<string>();
    for (let k = 0; k <= sRename.i; k++) if (trace.renameSteps[k].action === 'enter') visited.add(trace.renameSteps[k].block);
    nodes = g.names.map((n, i) => ({ id: String(i), title: n, titleText: n, style: n === st.block ? 'current' : visited.has(n) ? 'done' : 'dim' }));
    desc = <><b>{st.block}</b>: {st.detail}</>;
    const lines = printFunc(lowered);
    const cur = st.instrId !== undefined ? `i:${lowered.name}:${st.instrId}` : `b:${lowered.name}:${lowered.blocks[idx(st.block)]?.id}`;
    right = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <table className="dtable">
          <thead><tr><th>variable</th><th>definition stack (top at right)</th></tr></thead>
          <tbody>{Object.entries(st.stacks).map(([v, stack]) => (
            <tr key={v} className={v === st.variable ? 'cur' : ''}><td>{v}</td><td>{stack.map((x, k) => <span key={k} className={`set-chip ${k === stack.length - 1 ? 'new' : ''}`}>{x}</span>)}</td></tr>
          ))}</tbody>
        </table>
        <CodeView lines={lines} maxHeight={300} mark={(l) => (l.key === cur ? 'current' : undefined)} scrollTo={lines.findIndex((l) => l.key === cur)} />
      </div>
    );
  } else {
    nodes = g.names.map((n, i) => ({ id: String(i), title: n, titleText: n }));
    desc = <>The final SSA form: loads became uses of the current definition, stores disappeared, and φs merge values at join points. Hover a value to see all its uses.</>;
    right = <CodeView lines={printFunc(ssa)} maxHeight={420} notes />;
  }
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => edges.push({ from: String(u), to: String(v), kind: kinds![u][k] === 'back' ? 'back' : 'normal' })));
  if (phase === 'rename') {
    // show the dominator-tree walk order hint
  }
  void name;
  const s = phase === 'place' ? sPlace : sRename;
  return (
    <Figure
      title="mem2reg: constructing SSA"
      caption={caption}
      controls={
        <>
          <FnPicker ctx={ctx} />
          <Seg value={phase} onChange={setPhase} options={[['place', '1 · place φs'], ['rename', '2 · rename'], ['result', 'result']]} />
        </>
      }
    >
      <div className="panes" style={{ gridTemplateColumns: '1fr 1.1fr' }}>
        <div className="pane"><GraphView nodes={nodes} edges={edges} compact maxHeight={440} /></div>
        <div className="pane" style={{ maxHeight: 460, overflow: 'auto' }}>{right}</div>
      </div>
      <div className="step-desc">{desc}</div>
      {phase !== 'result' && <Stepper s={s} />}
    </Figure>
  );
}
