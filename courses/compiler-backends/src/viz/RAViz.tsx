// Chapter 12 widgets: iterated register coalescing on the interference graph.

import { useMemo, useState, type ReactNode } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { RAEvent, GraphSnapshot } from '../compiler/regalloc/irc';
import { keyIsPreg, keyPreg, type MFunc } from '../compiler/codegen/mir';
import { printMFunc } from '../compiler/codegen/printmir';
import { Figure } from '../ui/prose';
import { Check, Seg, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { hideTip, setHighlight, showTip } from '../ui/store';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { useExample, FnPicker } from './common';

export function regColor(r: number) {
  const h = (r * 137.508) % 360;
  return `hsl(${h} 62% 52%)`;
}

interface Pos { x: number; y: number }

function layoutIG(g: GraphSnapshot, showPregs: boolean): Map<number, Pos> {
  const keep = g.nodes.filter((n) => showPregs || !n.precolored);
  const ids = new Set(keep.map((n) => n.key));
  const nodes: (SimulationNodeDatum & { id: number })[] = keep.map((n, i) => ({ id: n.key, x: Math.cos(i) * 100, y: Math.sin(i) * 100 }));
  const links = [...g.edges, ...g.moves.map((m) => [m.dst, m.src] as [number, number])].filter(([a, b]) => ids.has(a) && ids.has(b)).map(([a, b]) => ({ source: a, target: b }));
  const sim = forceSimulation(nodes)
    .force('link', forceLink(links).id((d) => (d as { id: number }).id).distance(58).strength(0.35))
    .force('charge', forceManyBody().strength(-210))
    .force('center', forceCenter(0, 0))
    .force('x', forceX(0).strength(0.07))
    .force('y', forceY(0).strength(0.11))
    .force('collide', forceCollide(24))
    .stop();
  for (let i = 0; i < 320; i++) sim.tick();
  return new Map(nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]));
}

function describe(e: RAEvent, name: (k: number) => string, regName: (r: number) => string, K: number): ReactNode {
  switch (e.k) {
    case 'simplify': return <><b>Simplify</b> {name(e.node)}: degree {e.degree} &lt; K = {K}, so whatever its neighbours get, a colour will be left for it. Remove it and push it on the stack.</>;
    case 'coalesce': return <><b>Coalesce</b> {name(e.v)} into {name(e.u)} ({e.test === 'trivial' ? 'already the same node' : e.test === 'briggs' ? 'Briggs test: the merged node has fewer than K neighbours of significant degree' : 'George test: every neighbour of ' + name(e.v) + ' already interferes with ' + name(e.u) + ' or has low degree'}). The copy between them will vanish.</>;
    case 'constrained': return <><b>Constrained</b> move {name(e.u)} ↔ {name(e.v)}: the two interfere, so they can never share a register; the copy stays.</>;
    case 'freeze': return <><b>Freeze</b> {name(e.node)}: nothing can be simplified or coalesced, so give up on coalescing its moves and treat it as an ordinary node.</>;
    case 'potential-spill': return <><b>Potential spill</b> {name(e.node)}: every remaining node has degree ≥ K. Pick the one with the lowest spill cost / degree (cost {e.cost}, degree {e.degree}) and push it optimistically — it may still get a colour (Briggs).</>;
    case 'select': return <><b>Select</b> {name(e.node)}: pop it and give it the first register its already-coloured neighbours don’t use{e.forbidden.length ? <> (taken: {e.forbidden.map(regName).join(', ')})</> : ''} → <b>{regName(e.color)}</b>.</>;
    case 'actual-spill': return <><b>Actual spill</b> {name(e.node)}: all K registers are taken by its neighbours. It will live in memory; spill code is inserted and allocation restarts.</>;
  }
}

export function IRCStepper({ example = 'pressure', fn, caption, maxRegs: k0, target = 'rv64' }: { example?: string; fn?: string; caption?: ReactNode; maxRegs?: number; target?: 'rv64' | 'aarch64' | 'x86_64' }) {
  const [K, setK] = useState<number>(k0 ?? 6);
  const [showPregs, setShowPregs] = useState(false);
  const [coalesce, setCoalesce] = useState(true);
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target, maxRegs: K, coalesce, run: false, asmOnly: true });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const [roundSel, setRound] = useState(0);
  const round = fs?.ra.rounds[Math.min(roundSel, (fs?.ra.rounds.length ?? 1) - 1)];
  const pos = useMemo(() => (round?.graph ? layoutIG(round.graph, showPregs) : new Map()), [round, showPregs]);
  const s = useStepper((round?.events.length ?? 0) + 1, { interval: 550 });
  if (r.error) return <Figure title="Graph colouring"><div className="error-box">{r.error.msg}</div></Figure>;
  if (!fs || !round || !round.graph) return null;
  const f: MFunc = round.fn;
  const t = f.target;
  const name = (k: number) => (keyIsPreg(k) ? t.regs[keyPreg(k)].name : f.vregName(k));
  const regName = (r: number) => t.regs[r].name;
  const events = round.events as RAEvent[];
  const shown = events.slice(0, s.i);
  const removed = new Set<number>(), stack: { n: number; spill: boolean }[] = [], merged = new Map<number, number>(), constrained = new Set<number>(), frozen = new Set<number>();
  const color = new Map<number, number>(), spilled = new Set<number>();
  for (const e of shown) {
    if (e.k === 'simplify') { removed.add(e.node); stack.push({ n: e.node, spill: false }); }
    else if (e.k === 'potential-spill') { removed.add(e.node); stack.push({ n: e.node, spill: true }); }
    else if (e.k === 'coalesce') { merged.set(e.v, e.u); constrained.add(e.move); }
    else if (e.k === 'constrained') constrained.add(e.move);
    else if (e.k === 'freeze') frozen.add(e.node);
    else if (e.k === 'select') { stack.pop(); color.set(e.node, e.color); }
    else if (e.k === 'actual-spill') { stack.pop(); spilled.add(e.node); }
  }
  const alias = (k: number): number => (merged.has(k) ? alias(merged.get(k)!) : k);
  const cur = s.i > 0 ? events[s.i - 1] : undefined;
  const curNodes = new Set(cur ? ('node' in cur ? [cur.node] : 'u' in cur ? [cur.u, cur.v] : []) : []);
  const g = round.graph;
  const visible = g.nodes.filter((n) => (showPregs || !n.precolored) && pos.has(n.key));
  const xs = visible.map((n) => pos.get(n.key)!.x), ys = visible.map((n) => pos.get(n.key)!.y);
  const minX = Math.min(...xs, 0) - 40, maxX = Math.max(...xs, 0) + 40, minY = Math.min(...ys, 0) - 30, maxY = Math.max(...ys, 0) + 30;
  const colorOf = (k: number) => (keyIsPreg(k) ? keyPreg(k) : color.get(alias(k)) ?? color.get(k));
  const degreeNow = (k: number) => g.edges.filter(([a, b]) => (a === k || b === k)).map(([a, b]) => (a === k ? b : a)).filter((o) => !removed.has(o) && !merged.has(o) && (showPregs || true)).length;
  const finalRound = roundSel >= fs.ra.rounds.length - 1;
  return (
    <Figure title="Iterated register coalescing" caption={caption} controls={
      <>
        <FnPicker ctx={ctx} />
        <span className="row">K = <input type="range" className="range" min={3} max={16} value={K} onChange={(e) => { setK(Number(e.target.value)); s.set(0); setRound(0); }} /><b className="mono">{K}</b></span>
        {fs.ra.rounds.length > 1 && <Seg value={Math.min(roundSel, fs.ra.rounds.length - 1)} onChange={(v) => { setRound(v); s.set(0); }} options={fs.ra.rounds.map((_, i) => [i, `round ${i + 1}`] as [number, string])} />}
        <Check checked={coalesce} onChange={(v) => { setCoalesce(v); s.set(0); }}>coalesce</Check>
        <Check checked={showPregs} onChange={setShowPregs}>physical regs</Check>
      </>
    }>
      <div className="ig-wrap">
        <div style={{ overflow: 'auto', maxHeight: 520 }}>
          <svg width="100%" height={Math.min(500, Math.max(340, (maxY - minY) * 1.1))} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            {g.edges.map(([a, b], i) => {
              if (!pos.has(a) || !pos.has(b)) return null;
              const A = pos.get(a)!, B = pos.get(b)!;
              const gone = removed.has(a) || removed.has(b) || merged.has(a) || merged.has(b);
              return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--muted)" strokeWidth={1.2} opacity={gone ? 0.12 : 0.55} />;
            })}
            {g.moves.map((m) => {
              if (!pos.has(m.dst) || !pos.has(m.src)) return null;
              const A = pos.get(m.dst)!, B = pos.get(m.src)!;
              const done = merged.has(m.dst) || merged.has(m.src);
              return <line key={`m${m.id}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={done ? 'var(--green)' : constrained.has(m.id) ? 'var(--red)' : 'var(--accent)'} strokeWidth={2} strokeDasharray="5 4" opacity={done ? 0.5 : 0.9} />;
            })}
            {visible.map((n) => {
              const p = pos.get(n.key)!;
              const c = colorOf(n.key);
              const isRemoved = removed.has(n.key) && c === undefined;
              const isMerged = merged.has(n.key);
              const isCur = curNodes.has(n.key);
              const label = name(n.key);
              const key = keyIsPreg(n.key) ? `r:${t.name}:${keyPreg(n.key)}` : `v:${f.name}:${n.key}`;
              return (
                <g key={n.key} transform={`translate(${p.x},${p.y})`} opacity={isMerged ? 0.25 : isRemoved ? 0.35 : 1}
                  onMouseEnter={(e) => { setHighlight({ own: [key] }); showTip(e.currentTarget as unknown as Element, { info: { kind: 'text', title: label, body: `${n.precolored ? 'physical register (pre-coloured)' : `spill cost ${n.cost}`}; ${degreeNow(n.key)} live neighbours${c !== undefined ? `; assigned ${regName(c)}` : ''}${isMerged ? `; coalesced into ${name(alias(n.key))}` : ''}` } }); }}
                  onMouseLeave={() => { setHighlight(null); hideTip(); }}>
                  {n.precolored
                    ? <rect x={-17} y={-11} width={34} height={22} rx={5} fill={regColor(keyPreg(n.key))} opacity={0.9} />
                    : <circle r={16} fill={c !== undefined ? regColor(c) : 'var(--panel)'} stroke={isCur ? 'var(--accent)' : spilled.has(n.key) ? 'var(--red)' : 'var(--ink-2)'} strokeWidth={isCur ? 3.5 : 1.4} strokeDasharray={spilled.has(n.key) ? '3 2' : undefined} />}
                  <text textAnchor="middle" y={4} fontSize={label.length > 5 ? 8.5 : 10} fontFamily="var(--mono)" fill={c !== undefined || n.precolored ? 'white' : 'var(--ink)'} fontWeight={600}>{label.replace('%', '')}</text>
                  {c !== undefined && !n.precolored && <text textAnchor="middle" y={28} fontSize={9} fontFamily="var(--mono)" fill="var(--ink-2)">{regName(c)}</text>}
                  {spilled.has(n.key) && <text textAnchor="middle" y={28} fontSize={9} fontFamily="var(--sans)" fill="var(--red)" fontWeight={700}>spill</text>}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="ig-side">
          <h4>select stack (top ↑)</h4>
          <div className="ig-stack">{stack.map((x, i) => <span key={i} className={`it ${x.spill ? 'spill' : ''}`}>{name(x.n)}{x.spill ? ' (potential spill)' : ''}</span>)}</div>
          <h4>events</h4>
          <div className="ig-events">
            {events.map((e, i) => (
              <div key={i} className={`ev ${i === s.i - 1 ? 'cur' : ''}`} onClick={() => s.set(i + 1)} style={{ opacity: i < s.i ? 1 : 0.45 }}>
                {i + 1}. {e.k} {'node' in e ? name(e.node) : 'u' in e ? `${name(e.u)} ← ${name(e.v)}` : ''}{e.k === 'select' ? ` → ${regName(e.color)}` : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="step-desc">
        {cur ? describe(cur, name, regName, K) : <>The interference graph of <b>@{ctx.fn}</b>: an edge joins two values that are live at the same time; dashed orange edges are copies we would like to eliminate by <i>coalescing</i> their endpoints. We have K = {K} registers.</>}
        {s.i === s.n - 1 && (round.spilled.length ? <> Round {roundSel + 1} ends with {round.spilled.length} spill(s): {round.spilled.map((v) => f.vregName(v)).join(', ')}.{!finalRound && ' See the next round.'}</> : <> Every node has a register. Done.</>)}
      </div>
      <Stepper s={s} />
      {s.i === s.n - 1 && finalRound && <CodeView lines={printMFunc(fs.allocated, { post: true, comments: false })} target={target} maxHeight={260} notes />}
    </Figure>
  );
}
