// The abstract syntax tree as an indented, collapsible outline. Hovering (or
// focusing) a node marks its exact source span in the editor and lights up the
// IR lines that came from those source lines.

import { useMemo, useState, type ReactNode } from 'react';
import type { AstNode } from '../compiler/frontend/views';
import { hintStore, setHighlight, srcSpanStore } from '../ui/store';

const span = (n: AstNode) => (n.span ? `${n.span.from.line}:${n.span.from.col}` : '');

function describe(n: AstNode) {
  const what = n.group ? `${n.field} (${n.children.length} statement${n.children.length === 1 ? '' : 's'})` : n.label.map((t) => t.t).join('');
  const where = n.span ? (n.span.from.line === n.span.to.line ? `line ${n.span.from.line}, ${n.span.to.col - 1 > n.span.from.col ? `columns ${n.span.from.col}–${n.span.to.col - 1}` : `column ${n.span.from.col}`}` : `lines ${n.span.from.line}–${n.span.to.line}`) : '';
  return `${what}${where ? ` · ${where}` : ''}`;
}

function light(n: AstNode | null) {
  if (!n?.span) { srcSpanStore.set(null); setHighlight(null); hintStore.set(null); return; }
  srcSpanStore.set(n.span);
  const lines: string[] = [];
  for (let l = n.span.from.line; l <= n.span.to.line && lines.length < 80; l++) lines.push(`src:${l}`);
  setHighlight({ own: [], linkedTo: lines });
  hintStore.set({ why: 'node', text: describe(n) });
}

export function AstView({ root, height }: { root: AstNode; height?: number | string }) {
  // collapsed nodes, by path ("0.1.3")
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const paths = useMemo(() => {
    const all: string[] = [];
    const walk = (n: AstNode, p: string) => { if (n.children.length && n.kind === 'expr') all.push(p); n.children.forEach((c, k) => walk(c, `${p}.${k}`)); };
    walk(root, '0');
    return all;
  }, [root]);
  const toggle = (p: string) => setClosed((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  const rows: ReactNode[] = [];
  const walk = (n: AstNode, p: string, d: number) => {
    const open = !closed.has(p);
    const kids = n.children.length > 0;
    rows.push(
      <div key={p} className={`ast-row${n.group ? ' grp' : ''}`} style={{ paddingLeft: 10 + d * 16 }} onMouseEnter={() => light(n)} role="listitem">
        {kids ? (
          <button type="button" className="ast-tog" onClick={() => toggle(p)} onFocus={() => light(n)} onBlur={() => light(null)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${describe(n)}`}>
            {open ? '▾' : '▸'}
          </button>
        ) : <span className="ast-tog leaf" aria-hidden="true">·</span>}
        {n.field && <span className="ast-field">{n.field}{n.group ? '' : ':'}</span>}
        <span className="ast-label">
          {n.label.map((t, k) => <span key={k} className={t.c ? `t-${t.c}` : undefined}>{t.t}</span>)}
        </span>
        {!open && kids && <span className="ast-more">{n.children.length} …</span>}
        {n.span && !n.group && <span className="ast-pos">{span(n)}</span>}
      </div>,
    );
    if (open) n.children.forEach((c, k) => walk(c, `${p}.${k}`, d + 1));
  };
  walk(root, '0', 0);

  return (
    <div className="ast-wrap" style={{ maxHeight: height }}>
      <div className="ast-bar">
        <button type="button" className="mini-btn" onClick={() => setClosed(new Set())}>Expand all</button>
        <button type="button" className="mini-btn" onClick={() => setClosed(new Set(paths))}>Fold expressions</button>
        <span className="muted">hover a node to see its source span</span>
      </div>
      <div className="code inv ast" role="list" aria-label="Abstract syntax tree" onMouseLeave={() => light(null)}>
        {rows}
      </div>
    </div>
  );
}
