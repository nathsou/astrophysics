// Chapters 13 & 14 widgets: linear scan, and the effect of register pressure (spilling).

import { useState, type ReactNode } from 'react';
import type { LSEvent } from '../compiler/regalloc/linearscan';
import { keyIsPreg, keyPreg } from '../compiler/codegen/mir';
import { printMFunc } from '../compiler/codegen/printmir';
import { Figure } from '../ui/prose';
import { Check, Seg, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { setHighlight } from '../ui/store';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { FnPicker, useExample } from './common';
import { regColor } from './RAViz';

export function LinearScanStepper({ example = 'pressure', fn, caption, maxRegs: k0 = 6 }: { example?: string; fn?: string; caption?: ReactNode; maxRegs?: number }) {
  const [K, setK] = useState(k0);
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target: 'rv64', maxRegs: K, regalloc: 'linear', run: false, asmOnly: true });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const [roundSel, setRound] = useState(0);
  const round = fs?.ra.rounds[Math.min(roundSel, (fs?.ra.rounds.length ?? 1) - 1)];
  const events = (round?.events ?? []) as LSEvent[];
  const s = useStepper(events.length + 1, { interval: 500 });
  if (r.error) return <Figure title="Linear scan"><div className="error-box">{r.error.msg}</div></Figure>;
  if (!fs || !round) return null;
  const f = round.fn, t = f.target, L = round.live;
  const vivs = [...L.intervals.values()].filter((x) => x.key >= 0).sort((a, b) => a.start - b.start || a.key - b.key);
  const fixed = [...L.intervals.values()].filter((x) => keyIsPreg(x.key) && t.allocOrder.includes(keyPreg(x.key)));
  const shown = events.slice(0, s.i);
  const assign = new Map<number, number>(), spilled = new Set<number>();
  let active: number[] = [], pos = -1;
  for (const e of shown) {
    if (e.k === 'start') { active = e.active; pos = e.pos; }
    else if (e.k === 'assign') { assign.set(e.iv, e.reg); active = [...active.filter((a) => a !== e.iv), e.iv]; }
    else if (e.k === 'expire') active = active.filter((a) => a !== e.iv);
    else if (e.k === 'spill') { spilled.add(e.iv); assign.delete(e.iv); active = active.filter((a) => a !== e.iv); }
  }
  const cur = shown[shown.length - 1];
  const W = 12, rowH = 17, left = 92, top = 20;
  const nPos = L.order.length;
  const rows = [...fixed.map((x) => ({ iv: x, fixed: true })), ...vivs.map((x) => ({ iv: x, fixed: false }))];
  const width = left + nPos * W + 16, height = top + rows.length * rowH + 8;
  const used = new Set(active.map((a) => assign.get(a)).filter((x) => x !== undefined));
  let desc: ReactNode = <>Intervals sorted by start point. Sweep left to right; at each start, expire intervals that have ended, then take a free register or spill.</>;
  if (cur) {
    const nm = (k: number) => f.vregName(k);
    if (cur.k === 'start') desc = <>Position {cur.pos}: interval <b>{nm(cur.iv)}</b> starts.</>;
    else if (cur.k === 'expire') desc = <><b>{nm(cur.iv)}</b> has ended: its register <b>{t.regs[cur.reg].name}</b> is free again.</>;
    else if (cur.k === 'assign') desc = <><b>{nm(cur.iv)}</b> gets <b>{t.regs[cur.reg].name}</b>{cur.hint ? ' (copy hint: same register as the other side of a move, so the copy disappears)' : ''}{cur.blockedByFixed.length ? <>; {cur.blockedByFixed.map((x) => t.regs[x].name).join(', ')} unavailable (fixed uses, e.g. call clobbers overlap this interval)</> : ''}.</>;
    else desc = <>Spill <b>{nm(cur.iv)}</b>: {cur.reason}.</>;
  }
  return (
    <Figure title="Linear-scan register allocation" caption={caption} controls={
      <>
        <FnPicker ctx={ctx} />
        <span className="row">K = <input type="range" className="range" min={3} max={12} value={K} onChange={(e) => { setK(Number(e.target.value)); s.set(0); setRound(0); }} /><b className="mono">{K}</b></span>
        {fs.ra.rounds.length > 1 && <Seg value={Math.min(roundSel, fs.ra.rounds.length - 1)} onChange={(v) => { setRound(v); s.set(0); }} options={fs.ra.rounds.map((_, i) => [i, `round ${i + 1}`] as [number, string])} />}
      </>
    }>
      <div style={{ overflow: 'auto', maxHeight: 520 }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {L.blockRange.map((br, b) => <g key={b}><line x1={left + (br.from / 2) * W} x2={left + (br.from / 2) * W} y1={0} y2={height} stroke="var(--rule-2)" strokeDasharray="3 3" /><text x={left + (br.from / 2) * W + 3} y={12} fontSize={9.5} fill="var(--t-label)" fontFamily="var(--sans)">{f.blocks[b].name}</text></g>)}
          {rows.map(({ iv, fixed: fx }, row) => {
            const y = top + row * rowH;
            const reg = fx ? keyPreg(iv.key) : assign.get(iv.key);
            const isActive = active.includes(iv.key);
            const started = fx || iv.start <= pos;
            const key = fx ? `r:${t.name}:${keyPreg(iv.key)}` : `v:${f.name}:${iv.key}`;
            return (
              <g key={iv.key} onMouseEnter={() => setHighlight({ own: [key] })} onMouseLeave={() => setHighlight(null)}>
                <text x={left - 6} y={y + 12} fontSize={10} textAnchor="end" fontFamily="var(--mono)" fill={fx ? 'var(--t-preg)' : 'var(--t-vreg)'}>{fx ? t.regs[keyPreg(iv.key)].name : f.vregName(iv.key)}</text>
                {iv.ranges.map((rg, k) => (
                  <rect key={k} x={left + (rg.from / 2) * W} y={y + 3} width={Math.max(3, ((rg.to - rg.from) / 2) * W)} height={rowH - 6} rx={3}
                    fill={fx ? 'color-mix(in srgb, var(--ink) 18%, transparent)' : spilled.has(iv.key) ? 'var(--red-soft)' : reg !== undefined ? regColor(reg) : started ? 'color-mix(in srgb, var(--amber) 45%, var(--panel))' : 'color-mix(in srgb, var(--ink) 12%, transparent)'}
                    stroke={isActive ? 'var(--ink)' : spilled.has(iv.key) ? 'var(--red)' : 'none'} strokeWidth={isActive ? 1.5 : 1} strokeDasharray={spilled.has(iv.key) ? '3 2' : undefined} />
                ))}
                {!fx && reg !== undefined && <text x={left + (iv.end / 2) * W + 4} y={y + 12} fontSize={9.5} fontFamily="var(--mono)" fill="var(--ink-2)">{t.regs[reg].name}</text>}
                {!fx && spilled.has(iv.key) && <text x={left + (iv.end / 2) * W + 4} y={y + 12} fontSize={9.5} fontFamily="var(--sans)" fill="var(--red)" fontWeight={700}>spill</text>}
              </g>
            );
          })}
          {pos >= 0 && <line x1={left + (pos / 2) * W} x2={left + (pos / 2) * W} y1={0} y2={height} stroke="var(--accent)" strokeWidth={2} />}
        </svg>
      </div>
      <div className="stat-row">
        <span>active: {active.map((a) => <span key={a} className="set-chip">{f.vregName(a)}→{t.regs[assign.get(a)!]?.name}</span>)}</span>
        <span>free: {t.allocOrder.filter((x) => !used.has(x)).map((x) => <span key={x} className="set-chip preg">{t.regs[x].name}</span>)}</span>
      </div>
      <div className="step-desc">{desc}</div>
      <Stepper s={s} />
    </Figure>
  );
}

export function SpillExplorer({ example = 'pressure', fn, caption, maxRegs: k0 = 5 }: { example?: string; fn?: string; caption?: ReactNode; maxRegs?: number }) {
  const [K, setK] = useState(k0);
  const [remat, setRemat] = useState(true);
  const [algo, setAlgo] = useState<'irc' | 'linear'>('irc');
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(exampleById(example).src, { target: 'rv64', maxRegs: K, remat, regalloc: algo });
  const full = useCompile(exampleById(example).src, { target: 'rv64', regalloc: algo });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  if (r.error) return <Figure title="Spilling"><div className="error-box">{r.error.msg}</div></Figure>;
  if (!fs) return null;
  const all = fs.final.blocks.flatMap((b) => b.instrs);
  const cnt = (tag: string) => all.filter((m) => m.tag === tag).length;
  const rewrites = fs.ra.rounds.flatMap((x) => x.rewrites);
  return (
    <Figure title="Register pressure and spilling" caption={caption} controls={
      <>
        <FnPicker ctx={ctx} />
        <span className="row">registers = <input type="range" className="range" min={3} max={26} value={K} onChange={(e) => setK(Number(e.target.value))} /><b className="mono">{K}</b></span>
        <Seg value={algo} onChange={setAlgo} options={[['irc', 'graph colouring'], ['linear', 'linear scan']]} />
        <Check checked={remat} onChange={setRemat}>rematerialise constants</Check>
      </>
    }>
      <div className="stat-row" style={{ borderTop: 'none', borderBottom: '1px solid var(--rule)' }}>
        <span>allocation rounds <b>{fs.ra.rounds.length}</b></span>
        <span>spill stores <b>{cnt('spill')}</b></span>
        <span>reloads <b>{cnt('reload')}</b></span>
        <span>remats <b>{cnt('remat')}</b></span>
        <span>frame <b>{fs.final.frame.size} B</b></span>
        <span>static size <b>{all.length}</b> instrs</span>
        {r.emu && full.emu && <span>executed <b>{r.emu.steps.toLocaleString()}</b> instructions (vs {full.emu.steps.toLocaleString()} with all {full.target?.allocOrder.length} registers)</span>}
      </div>
      <CodeView lines={printMFunc(fs.final, { post: true, comments: false })} maxHeight={440} notes target="rv64" />
      {rewrites.length > 0 && (
        <div className="stat-row">{rewrites.map((w, i) => <span key={i} className={`pill ${w.kind === 'remat' ? 'green' : 'red'}`}>{w.kind} {w.vreg}: {w.loads} {w.kind === 'remat' ? 'recomputes' : 'reloads'}{w.stores ? `, ${w.stores} store` : ''}</span>)}</div>
      )}
    </Figure>
  );
}
