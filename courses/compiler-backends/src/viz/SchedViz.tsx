// Chapter 16 widgets: dependence DAG, list scheduling and pipeline timelines.

import { useMemo, useState, type ReactNode } from 'react';
import { mirLine } from '../compiler/codegen/printmir';
import type { SchedRegion } from '../compiler/codegen/sched';
import { lineText } from '../compiler/listing';
import { Figure } from '../ui/prose';
import { Select, Stepper, useStepper } from '../ui/controls';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { GraphView, type GEdge, type GNode } from './Graph';
import { FnPicker, useExample } from './common';

function Timeline({ region, issue, order, title, text }: { region: SchedRegion; issue: number[]; order: number[]; title: string; text: (i: number) => string }) {
  const W = 34, rowH = 17;
  const cycles = Math.max(...order.map((i, k) => issue[k] + region.lat[i]), 1);
  const width = 190 + cycles * W, height = 22 + order.length * rowH;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="pane-head">{title}<span className="spacer" /><span className="pill accent">{Math.max(...issue) + 1} issue cycles</span></div>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {Array.from({ length: cycles + 1 }, (_, c) => (
          <g key={c}><line x1={190 + c * W} x2={190 + c * W} y1={14} y2={height} stroke="var(--rule)" /><text x={190 + c * W + W / 2} y={11} fontSize={9.5} textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)">{c}</text></g>
        ))}
        {order.map((i, k) => {
          const y = 18 + k * rowH;
          const lat = region.lat[i];
          return (
            <g key={k}>
              <text x={184} y={y + 11} fontSize={10} textAnchor="end" fontFamily="var(--mono)" fill="var(--ink-2)">{text(i).slice(0, 28)}</text>
              <rect x={190 + issue[k] * W + 1} y={y + 2} width={W - 2} height={rowH - 4} rx={3} fill="var(--accent)" />
              {lat > 1 && <rect x={190 + (issue[k] + 1) * W + 1} y={y + 5} width={(lat - 1) * W - 2} height={rowH - 10} rx={2} fill="color-mix(in srgb, var(--accent) 25%, transparent)" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SchedExplorer({ example = 'collatz', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target: 'rv64', sched: 'pre', run: false, asmOnly: true });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const regions = fs?.sched?.regions ?? [];
  // default to the region where scheduling saves the most cycles (ties: the larger region)
  const best = useMemo(() => {
    const gain = (x: (typeof regions)[number]) => x.beforeCycles - x.afterCycles;
    return regions.reduce((b, x, i) => (gain(x) > gain(regions[b]) || (gain(x) === gain(regions[b]) && x.instrs.length > regions[b].instrs.length) ? i : b), 0);
  }, [regions]);
  const [sel, setSel] = useState<number | null>(null);
  const k = sel !== null && sel < regions.length ? sel : best;
  const region = regions[k];
  const s = useStepper(region?.steps.length ?? 0, { interval: 700 });
  if (!fs || !region) return <Figure title="Instruction scheduling"><div className="output-box muted">No schedulable region in this function.</div></Figure>;
  const mf = fs.ssaDestroyed;
  const text = (i: number) => lineText(mirLine(mf, mf.target, region.instrs[i], { comments: false })).trim();
  const step = region.steps[s.i];
  const issued = new Set(region.steps.slice(0, s.i + 1).flatMap((x) => x.issued));
  const nodes: GNode[] = region.instrs.map((mi, i) => {
    const l = mirLine(mf, mf.target, mi, { comments: false });
    return {
      id: String(i), title: <span className="mono" style={{ fontWeight: 500 }}>{i}</span>, titleText: text(i),
      lines: [{ ...l, indent: 0 }],
      style: step.issued.includes(i) ? 'current' : issued.has(i) ? 'done' : step.ready.includes(i) ? 'focus' : 'dim',
      badge: <span className="pill" title="critical path from here to the end">h={region.height[i]}</span>,
    };
  });
  const edges: GEdge[] = region.edges.map((e) => ({ from: String(e.from), to: String(e.to), kind: e.kind, label: e.lat ? String(e.lat) : undefined }));
  return (
    <Figure title="List scheduling a basic block" caption={caption} controls={
      <>
        <FnPicker ctx={ctx} />
        <Select value={String(k)} options={regions.map((x, i) => [String(i), `${x.block} (${x.instrs.length} instrs: ${x.beforeCycles}→${x.afterCycles} cycles)`] as [string, string])} onChange={(v) => { setSel(Number(v)); s.set(0); }} />
      </>
    }>
      <div className="panes" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <div className="pane"><div className="pane-head">dependence DAG (edge label = latency)</div><GraphView nodes={nodes} edges={edges} maxHeight={460} ranksep={30} /></div>
        <div className="pane" style={{ overflow: 'auto', maxHeight: 500 }}>
          <Timeline region={region} issue={region.beforeIssue} order={region.instrs.map((_, i) => i)} title="original order" text={text} />
          <Timeline region={region} issue={region.afterIssue} order={region.order} title="scheduled" text={text} />
        </div>
      </div>
      <div className="step-desc">
        Cycle <b>{step.cycle}</b>: ready = {'{'}{step.ready.join(', ')}{'}'} (all predecessors issued and their latencies elapsed), sorted by critical-path height. Issue{' '}
        <b>{step.issued.length ? step.issued.map((i) => `${i}: ${text(i)}`).join(', ') : 'nothing (stall)'}</b>{step.issued.length === 2 ? ' — dual issue' : ''}.
      </div>
      <Stepper s={s} />
      <div className="stat-row">
        <span><span className="pill" style={{ color: 'var(--blue)' }}>RAW</span> true dependence</span>
        <span><span className="pill" style={{ color: 'var(--amber)' }}>WAR</span> anti</span>
        <span><span className="pill" style={{ color: 'var(--violet)' }}>WAW</span> output</span>
        <span><span className="pill" style={{ color: 'var(--red)' }}>MEM</span> memory order</span>
        <span>model: 2-wide in-order; load 3, mul 3, div 20 cycles</span>
      </div>
    </Figure>
  );
}
