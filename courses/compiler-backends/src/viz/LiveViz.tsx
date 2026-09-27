// Chapter 11 widgets: liveness fixpoint stepper and live-interval chart.

import { useMemo, useState, type ReactNode } from 'react';
import { liveness, type Liveness } from '../compiler/codegen/liveness';
import { keyIsPreg, keyPreg, type MFunc } from '../compiler/codegen/mir';
import { mirGraph } from '../compiler/codegen/mcfg';
import { printMFunc } from '../compiler/codegen/printmir';
import { Figure } from '../ui/prose';
import { Check, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { setHighlight } from '../ui/store';
import { GraphView, type GEdge, type GNode } from './Graph';
import { classifyEdges } from './cfgdata';
import { FnPicker, useExample } from './common';

export function keyName(f: MFunc, k: number) {
  return keyIsPreg(k) ? f.target.regs[keyPreg(k)].name : f.vregName(k);
}
function keyKey(f: MFunc, k: number) {
  return keyIsPreg(k) ? `r:${f.target.name}:${keyPreg(k)}` : `v:${f.name}:${k}`;
}

export function SetChips({ f, keys, fresh, pregs = true }: { f: MFunc; keys: Iterable<number>; fresh?: Set<number>; pregs?: boolean }) {
  const list = [...keys].filter((k) => pregs || !keyIsPreg(k)).sort((a, b) => a - b);
  if (!list.length) return <span className="muted">∅</span>;
  return (
    <>
      {list.map((k) => (
        <span key={k} className={`set-chip ${keyIsPreg(k) ? 'preg' : ''} ${fresh?.has(k) ? 'new' : ''}`} data-k={keyKey(f, k)} onMouseEnter={() => setHighlight({ own: [keyKey(f, k)] })} onMouseLeave={() => setHighlight(null)}>
          {keyName(f, k)}
        </span>
      ))}
    </>
  );
}

export function LivenessStepper({ example = 'sum', fn, caption }: { example?: string; fn?: string; caption?: ReactNode }) {
  const ctx = useExample(example, undefined, fn);
  const f = ctx.fs?.ssaDestroyed;
  const [pregs, setPregs] = useState(false);
  const data = useMemo(() => {
    if (!f) return undefined;
    const L = liveness(f, f.target);
    const g = mirGraph(f);
    return { L, g, kinds: classifyEdges(g) };
  }, [f]);
  const s = useStepper(data?.L.iterations.length ?? 0, { interval: 600 });
  if (!f || !data) return null;
  const { L, g, kinds } = data;
  const it = L.iterations[s.i];
  // state after step i: last record per block
  const state = f.blocks.map((_, b) => ({ in: new Set(L.blocks[b].use), out: new Set<number>(), touched: false }));
  let prev: { in: Set<number>; out: Set<number> } | undefined;
  for (let k = 0; k <= s.i; k++) {
    const r = L.iterations[k];
    if (k === s.i) prev = { in: new Set(state[r.block].in), out: new Set(state[r.block].out) };
    state[r.block] = { in: new Set(r.liveIn), out: new Set(r.liveOut), touched: true };
  }
  const freshIn = new Set([...state[it.block].in].filter((x) => !prev!.in.has(x)));
  const freshOut = new Set([...state[it.block].out].filter((x) => !prev!.out.has(x)));
  const nodes: GNode[] = f.blocks.map((b, i) => ({
    id: String(i), title: b.name, titleText: b.name, width: 170,
    style: i === it.block ? 'current' : state[i].touched ? 'default' : 'dim',
    extra: <div style={{ lineHeight: '17px' }}><div><span className="muted">in </span><SetChips f={f} keys={state[i].in} pregs={pregs} fresh={i === it.block ? freshIn : undefined} /></div><div><span className="muted">out </span><SetChips f={f} keys={state[i].out} pregs={pregs} fresh={i === it.block ? freshOut : undefined} /></div></div>,
    extraLines: 3,
  }));
  const edges: GEdge[] = [];
  g.succs.forEach((ss, u) => ss.forEach((v, k) => edges.push({ from: String(u), to: String(v), kind: kinds[u][k] === 'back' ? 'back' : 'normal' })));
  const last = s.i === L.iterations.length - 1;
  return (
    <Figure title="Liveness: iterating to a fixed point" caption={caption} controls={<><FnPicker ctx={ctx} /><Check checked={pregs} onChange={setPregs}>show physical registers</Check></>}>
      <div className="panes" style={{ gridTemplateColumns: '1fr 1.1fr' }}>
        <div className="pane"><GraphView nodes={nodes} edges={edges} maxHeight={500} /></div>
        <div className="pane" style={{ overflow: 'auto', maxHeight: 520 }}>
          <table className="dtable">
            <thead><tr><th>block</th><th>Use</th><th>Def</th><th>LiveIn</th><th>LiveOut</th></tr></thead>
            <tbody>
              {f.blocks.map((b, i) => (
                <tr key={i} className={i === it.block ? 'cur' : ''}>
                  <td>{b.name}</td>
                  <td><SetChips f={f} keys={L.blocks[i].use} pregs={pregs} /></td>
                  <td><SetChips f={f} keys={L.blocks[i].def} pregs={pregs} /></td>
                  <td><SetChips f={f} keys={state[i].in} pregs={pregs} fresh={i === it.block ? freshIn : undefined} /></td>
                  <td><SetChips f={f} keys={state[i].out} pregs={pregs} fresh={i === it.block ? freshOut : undefined} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <CodeView lines={printMFunc(f, { comments: false })} maxHeight={220} notes />
        </div>
      </div>
      <div className="step-desc">
        Round <b>{it.round}</b>, block <b>{f.blocks[it.block].name}</b>: LiveOut = ∪ LiveIn(successors); LiveIn = Use ∪ (LiveOut − Def).{' '}
        {it.changed ? <span className="badge accent">changed</span> : <span className="badge">no change</span>}
        {last && <> — round {it.round} changed nothing, so this is the fixed point ({L.rounds} rounds; visiting blocks in postorder makes backward problems converge fast).</>}
      </div>
      <Stepper s={s} />
    </Figure>
  );
}

export function LiveRanges({ example = 'pressure', fn, caption, stage = 'destroy' }: { example?: string; fn?: string; caption?: ReactNode; stage?: 'destroy' | 'sched' }) {
  const ctx = useExample(example, undefined, fn);
  const f = stage === 'sched' ? ctx.fs?.scheduled ?? ctx.fs?.ssaDestroyed : ctx.fs?.ssaDestroyed;
  const L: Liveness | undefined = useMemo(() => (f ? liveness(f, f.target) : undefined), [f]);
  const [hov, setHov] = useState<number | null>(null);
  if (!f || !L) return null;
  const ivs = [...L.intervals.values()].filter((x) => x.key >= 0).sort((a, b) => a.start - b.start || a.end - b.end);
  const nPos = L.order.length * 2;
  const W = 14, rowH = 18, left = 96, top = 22;
  const width = left + (nPos / 2) * W + 20;
  const height = top + ivs.length * rowH + 40;
  const pressure = Array.from({ length: L.order.length }, (_, i) => ivs.filter((x) => x.ranges.some((r) => r.from <= 2 * i + 1 && 2 * i + 1 < r.to)).length);
  const maxP = Math.max(...pressure, 1);
  const K = f.target.allocOrder.length;
  return (
    <Figure title="Live intervals" caption={caption} controls={<><FnPicker ctx={ctx} /><span className="pill accent">max pressure {maxP}</span><span className="pill">{K} allocatable registers</span></>}>
      <div className="panes" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div className="pane lr-wrap" style={{ maxHeight: 520 }}>
          <svg width={width} height={height} style={{ display: 'block' }}>
            {L.blockRange.map((r, b) => (
              <g key={b}>
                <line x1={left + (r.from / 2) * W} x2={left + (r.from / 2) * W} y1={0} y2={height} stroke="var(--rule-2)" strokeDasharray="3 3" />
                <text x={left + (r.from / 2) * W + 3} y={12} fontSize={10} fill="var(--t-label)" fontFamily="var(--sans)">{f.blocks[b].name}</text>
              </g>
            ))}
            {ivs.map((iv, row) => {
              const y = top + row * rowH;
              const key = `v:${f.name}:${iv.key}`;
              return (
                <g key={iv.key} onMouseEnter={() => { setHov(iv.key); setHighlight({ own: [key] }); }} onMouseLeave={() => { setHov(null); setHighlight(null); }} style={{ cursor: 'default' }}>
                  <text x={left - 6} y={y + 12} fontSize={10.5} textAnchor="end" fill="var(--t-vreg)" fontFamily="var(--mono)">{f.vregName(iv.key)}</text>
                  {iv.ranges.map((r, k) => (
                    <rect key={k} x={left + (r.from / 2) * W} y={y + 3} width={Math.max(3, ((r.to - r.from) / 2) * W)} height={rowH - 6} rx={4} fill={hov === iv.key ? 'var(--accent)' : 'color-mix(in srgb, var(--amber) 55%, var(--panel))'} />
                  ))}
                  {iv.uses.map((u, k) => <circle key={`u${k}`} cx={left + (u / 2) * W + W / 2} cy={y + rowH / 2} r={2.6} fill="var(--ink)" />)}
                  {iv.defs.map((d, k) => <rect key={`d${k}`} x={left + ((d - 1) / 2) * W + W / 2 - 3} y={y + rowH / 2 - 3} width={6} height={6} fill="var(--blue)" />)}
                </g>
              );
            })}
            {pressure.map((p, i) => (
              <rect key={i} x={left + i * W + 1} y={height - 16 - (p / maxP) * 12} width={W - 2} height={(p / maxP) * 12} fill={p > K ? 'var(--red)' : 'var(--teal)'} opacity={0.7}><title>{p} live</title></rect>
            ))}
          </svg>
        </div>
        <div className="pane"><CodeView lines={printMFunc(f, { comments: false })} maxHeight={520} gutter="num" notes /></div>
      </div>
      <div className="stat-row"><span><b>■</b> definition</span><span><b>●</b> use</span><span>bars at the bottom: number of values live at each instruction</span></div>
    </Figure>
  );
}
