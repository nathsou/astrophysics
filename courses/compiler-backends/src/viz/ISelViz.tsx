// Chapter 7 widgets: tree tiling (BURS dynamic programming) and the rule grammar.

import { useMemo, useState, type ReactNode } from 'react';
import { Figure } from '../ui/prose';
import { Seg, Select, Stepper, useStepper } from '../ui/controls';
import { CodeView } from '../ui/CodeView';
import { mirLine } from '../compiler/codegen/printmir';
import type { INode, SelTree } from '../compiler/codegen/isel';
import type { TargetName } from '../compiler/target/target';
import { targetFor } from '../ui/explain';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { GraphView, type GEdge, type GNode } from './Graph';
import { FnPicker, useExample } from './common';
import type { Line } from '../compiler/listing';

const TILE_COLORS = Array.from({ length: 10 }, (_, i) => `var(--tile-${i})`);

function nodeLabel(n: INode, vname: (id: number) => string): string {
  switch (n.op) {
    case 'reg': return vname(n.vreg!);
    case 'const': return `#${n.c}`;
    case 'frame': return `frame ${n.fi}`;
    case 'gaddr': return `@${n.sym}`;
    default: return n.op;
  }
}

function postorder(n: INode, out: INode[] = []): INode[] {
  n.kids.forEach((k) => postorder(k, out));
  out.push(n);
  return out;
}

export function TilingExplorer({ example = 'sieve', fn, target: t0 = 'rv64', tree: tree0, caption, options }: { example?: string; fn?: string; target?: TargetName; tree?: string; caption?: ReactNode; options?: Record<string, unknown> }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const src = exampleById(example).src;
  const ctx = useExample(example, undefined, fn);
  const r = useCompile(src, { target, run: false, asmOnly: true, ...options });
  const fs = r.funcs.find((f) => f.name === ctx.fn);
  const trees = fs?.trees ?? [];
  const interesting = trees.filter((t) => t.nodes.length > 1);
  const [sel, setSel] = useState<string>(tree0 ?? '');
  const tree: SelTree | undefined = interesting.find((t) => `${t.irId}` === sel) ?? interesting.find((t) => t.label.includes(tree0 ?? '\u0000')) ?? interesting.slice().sort((a, b) => b.nodes.length - a.nodes.length)[0];
  const order = useMemo(() => (tree ? postorder(tree.root) : []), [tree]);
  const steps = order.length + (tree?.tiles.length ?? 0);
  const s = useStepper(steps, { interval: 800, initial: 0 });
  const [hover, setHover] = useState<number | null>(null);
  if (!fs || !tree) return <Figure title="Instruction selection">{r.error ? <div className="error-box">{r.error.msg}</div> : <div className="output-box">No tree.</div>}</Figure>;
  const mf = fs.isel;
  const vname = (id: number) => mf.vregName(id);
  const labelPhase = s.i < order.length;
  const labelled = new Set(order.slice(0, labelPhase ? s.i + 1 : order.length).map((n) => n.id));
  const tilesShown = labelPhase ? 0 : s.i - order.length + 1;
  const tileOf = new Map<number, number>();
  tree.tiles.slice(0, tilesShown).forEach((t, k) => t.nodes.forEach((n) => { if (!tileOf.has(n)) tileOf.set(n, k); }));
  const cur = labelPhase ? order[s.i] : undefined;
  const curTile = labelPhase ? undefined : tree.tiles[tilesShown - 1];
  const focus = tree.nodes.find((n) => n.id === (hover ?? cur?.id ?? curTile?.root)) ?? tree.root;

  const nodes: GNode[] = tree.nodes.map((n) => {
    const tk = tileOf.get(n.id);
    const bestTxt = labelled.has(n.id) ? Object.entries(n.best).map(([nt, b]) => `${nt}:${Number.isFinite(b.cost) ? +b.cost.toFixed(1) : '∞'}`).join(' ') : '';
    return {
      id: String(n.id),
      title: <span style={{ fontFamily: 'var(--mono)' }}>{nodeLabel(n, vname)}</span>,
      titleText: `${nodeLabel(n, vname)}  ${bestTxt}`.slice(0, 44),
      extra: labelled.has(n.id) ? <span className="mono" style={{ fontSize: 10.5 }}>{bestTxt}</span> : <span className="muted">?</span>,
      extraLines: 1,
      tint: tk !== undefined ? TILE_COLORS[tk % TILE_COLORS.length] : undefined,
      style: cur?.id === n.id ? 'current' : undefined,
      dashed: n.op === 'reg' || n.op === 'const',
    };
  });
  const edges: GEdge[] = [];
  for (const n of tree.nodes) for (const k of n.kids) edges.push({ from: String(n.id), to: String(k.id), kind: tileOf.has(k.id) && tileOf.get(k.id) === tileOf.get(n.id) ? 'hot' : 'normal' });

  const flat = mf.blocks.flatMap((b) => b.instrs);
  const pos = new Map(flat.map((mi, i) => [mi.id, i]));
  const tileOfInstr = new Map<number, number>();
  tree.tiles.forEach((t, k) => t.instrs.forEach((id) => tileOfInstr.set(id, k)));
  // program order, coloured by the tile that emitted each instruction
  const instrLines: Line[] = [...tileOfInstr.keys()].filter((id) => pos.has(id)).sort((a, b) => pos.get(a)! - pos.get(b)!).map((id) => {
    const k = tileOfInstr.get(id)!;
    return { ...mirLine(mf, mf.target, flat[pos.get(id)!], { comments: false }), indent: 1, color: TILE_COLORS[k % TILE_COLORS.length], mark: k < tilesShown ? undefined : 'dim' };
  });

  let desc: ReactNode;
  if (labelPhase && cur) {
    const entries = Object.entries(cur.best);
    desc = entries.length
      ? <>Label <b className="mono">{nodeLabel(cur, vname)}</b> (bottom-up): cheapest way to produce it as {entries.map(([nt, b], i) => <span key={nt}>{i ? ', ' : ''}<b>{nt}</b> = {+b.cost.toFixed(2)} via <code>{b.rule.pattern}</code></span>)}.</>
      : <>No rule matches <b>{nodeLabel(cur, vname)}</b> on its own; it can only be covered as part of its parent’s tile.</>;
  } else if (curTile) {
    desc = <>Reduce (top-down): cover with tile <b style={{ color: TILE_COLORS[(tilesShown - 1) % TILE_COLORS.length] }}>{curTile.rule.nt} ← {curTile.rule.pattern}</b> → <code>{curTile.rule.asm}</code>{curTile.leaves.length ? <>; its leaves are reduced as separate subtrees.</> : '.'}</>;
  }

  return (
    <Figure
      title="Instruction selection by tree tiling"
      caption={caption}
      controls={
        <>
          <FnPicker ctx={ctx} />
          <Select value={`${tree.irId}`} options={interesting.map((t) => [`${t.irId}`, `${t.block}: ${t.label}`] as [string, string])} onChange={(v) => { setSel(v); s.set(0); }} />
          <Seg value={target} onChange={(v) => { setTarget(v); s.set(0); }} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']]} />
        </>
      }
    >
      <div className="panes" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
        <div className="pane">
          <div className="pane-head">expression tree <span className="spacer" /><span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>dashed = leaf in a register / constant</span></div>
          <GraphView nodes={nodes} edges={edges} compact maxHeight={420} onNodeHover={(id) => setHover(id === null ? null : Number(id))} ranksep={26} />
        </div>
        <div className="pane" style={{ minWidth: 0 }}>
          <div className="pane-head">DP table for <span className="mono" style={{ textTransform: 'none' }}>{nodeLabel(focus, vname)}</span></div>
          <table className="dtable">
            <thead><tr><th>nonterminal</th><th>cost</th><th>best rule</th></tr></thead>
            <tbody>
              {labelled.has(focus.id) && Object.entries(focus.best).map(([nt, b]) => (
                <tr key={nt}><td>{nt}</td><td>{+b.cost.toFixed(2)}</td><td>{b.rule.pattern}<div className="muted sans" style={{ fontSize: 11 }}>{b.rule.asm}</div></td></tr>
              ))}
            </tbody>
          </table>
          <div className="pane-head" style={{ marginTop: 8 }}>emitted machine instructions</div>
          <CodeView lines={instrLines} target={target} notes />
        </div>
      </div>
      <div className="step-desc">{desc}</div>
      <Stepper s={s} label={<span className="badge">{labelPhase ? 'phase 1 · label bottom-up' : 'phase 2 · reduce top-down'}</span>} />
      <div className="tile-legend">
        {tree.tiles.map((t, k) => (
          <span key={k} className="tl" style={{ opacity: k < tilesShown ? 1 : 0.35 }}>
            <span className="sw" style={{ background: TILE_COLORS[k % TILE_COLORS.length] }} />
            <span className="mono">{t.rule.pattern}</span>
            <span className="muted">→ {t.rule.asm}</span>
          </span>
        ))}
      </div>
    </Figure>
  );
}

export function RuleTable({ target: t0 = 'rv64', filter, caption }: { target?: TargetName; filter?: string; caption?: ReactNode }) {
  const [target, setTarget] = useState<TargetName>(t0);
  const t = targetFor(target)!;
  const [q, setQ] = useState(filter ?? '');
  const rules = t.rules.filter((r) => !q || r.pattern.includes(q) || r.asm.includes(q) || r.nt === q);
  const seen = new Set<string>();
  return (
    <Figure title="The tree grammar" caption={caption} controls={
      <>
        <input className="select" placeholder="filter (e.g. add, cc, load)" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} />
        <Seg value={target} onChange={setTarget} options={[['rv64', 'RISC-V'], ['aarch64', 'AArch64'], ['x86_64', 'x86-64']]} />
      </>
    }>
      <div style={{ maxHeight: 360, overflow: 'auto' }}>
        <table className="dtable">
          <thead><tr><th>result</th><th>pattern</th><th>cost</th><th>emits</th></tr></thead>
          <tbody>
            {rules.filter((r) => { const k = r.asm + r.nt; if (seen.has(k + r.pattern)) return false; seen.add(k + r.pattern); return true; }).map((r) => (
              <tr key={r.id}><td>{r.nt}</td><td>{r.pattern}</td><td>{typeof r.cost === 'number' ? (Number.isFinite(r.cost) ? r.cost : '—') : 'f(n)'}</td><td className="sans" style={{ fontSize: 11.5 }}>{r.asm}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stat-row"><span>nonterminals: <b>{t.nonterminals.join(', ')}</b></span><span>rules: <b>{t.rules.length}</b></span></div>
    </Figure>
  );
}
