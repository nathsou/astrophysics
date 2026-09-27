// Generic layered graph renderer (dagre layout, SVG edges, HTML node bodies).

import { useMemo, type ReactNode } from 'react';
import dagre from '@dagrejs/dagre';
import type { Line } from '../compiler/listing';
import { CodeView } from '../ui/CodeView';

export interface GNode {
  id: string;
  title: ReactNode;
  /** plain-text width hint for the title */
  titleText?: string;
  lines?: Line[];
  extra?: ReactNode;
  extraLines?: number;
  className?: string;
  style?: 'default' | 'current' | 'active' | 'dim' | 'done' | 'focus' | 'warn';
  width?: number;
  badge?: ReactNode;
  /** tile/colour tint */
  tint?: string;
  dashed?: boolean;
}

export interface GEdge {
  from: string;
  to: string;
  kind?: 'normal' | 'back' | 'critical' | 'dom' | 'tree' | 'faint' | 'hot' | 'raw' | 'war' | 'waw' | 'mem';
  label?: string;
}

const CHAR = 6.45; // JetBrains Mono at 10.5px
const LINE_H = 16.5;

function textWidth(l: Line) {
  return (l.indent ?? 0) + l.toks.reduce((s, t) => s + t.t.length, 0);
}

export function layout(nodes: GNode[], edges: GEdge[], opts: { rankdir?: 'TB' | 'LR'; nodesep?: number; ranksep?: number; compact?: boolean } = {}) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: opts.rankdir ?? 'TB', nodesep: opts.nodesep ?? 28, ranksep: opts.ranksep ?? 36, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));
  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of nodes) {
    const maxChars = Math.max(n.titleText?.length ?? 8, ...(n.lines ?? []).map(textWidth));
    const w = n.width ?? Math.max(opts.compact ? 64 : 110, Math.min(560, maxChars * CHAR + 30));
    const h = (opts.compact ? 30 : 30) + (n.lines?.length ?? 0) * LINE_H + (n.lines?.length ? 12 : 0) + (n.extraLines ?? 0) * 18;
    sizes.set(n.id, { w, h });
    g.setNode(n.id, { width: w, height: h });
  }
  edges.forEach((e, k) => { if (sizes.has(e.from) && sizes.has(e.to)) g.setEdge(e.from, e.to, { weight: e.kind === 'back' ? 0 : 1, minlen: 1 }, `e${k}`); });
  dagre.layout(g);
  const gl = g.graph();
  const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of nodes) {
    const v = g.node(n.id);
    pos.set(n.id, { x: v.x - v.width / 2, y: v.y - v.height / 2, w: v.width, h: v.height });
  }
  const paths = edges.map((e, k) => {
    const ed = g.edge({ v: e.from, w: e.to, name: `e${k}` });
    return ed ? (ed.points as { x: number; y: number }[]) : [];
  });
  return { pos, paths, width: gl.width ?? 100, height: gl.height ?? 100 };
}

function pathD(pts: { x: number; y: number }[]) {
  if (!pts.length) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return d + ` L${pts[1].x},${pts[1].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${pts[i].x},${pts[i].y} ${i === pts.length - 2 ? pts[i + 1].x : mx},${i === pts.length - 2 ? pts[i + 1].y : my}`;
  }
  return d;
}

const EDGE_COLORS: Record<string, string> = {
  normal: 'var(--muted)', back: 'var(--accent)', critical: 'var(--red)', dom: 'var(--violet)', tree: 'var(--teal)', faint: 'var(--rule-2)', hot: 'var(--accent)',
  raw: 'var(--blue)', war: 'var(--amber)', waw: 'var(--violet)', mem: 'var(--red)',
};

export interface GraphViewProps {
  nodes: GNode[];
  edges: GEdge[];
  rankdir?: 'TB' | 'LR';
  target?: string;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  compact?: boolean;
  maxHeight?: number;
  nodesep?: number;
  ranksep?: number;
  /** extra SVG drawn over the graph, given node positions */
  overlay?: (pos: Map<string, { x: number; y: number; w: number; h: number }>) => ReactNode;
}

export function GraphView({ nodes, edges, rankdir, target, onNodeClick, onNodeHover, compact, maxHeight, nodesep, ranksep, overlay }: GraphViewProps) {
  const key = JSON.stringify([nodes.map((n) => [n.id, n.lines?.length, n.titleText, n.width, n.extraLines, n.lines?.map((l) => textWidth(l))]), edges.map((e) => [e.from, e.to]), rankdir, compact, nodesep, ranksep]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const L = useMemo(() => layout(nodes, edges, { rankdir, compact, nodesep, ranksep }), [key]);
  const colors = [...new Set(edges.map((e) => e.kind ?? 'normal'))];
  return (
    <div style={{ overflow: 'auto', maxHeight, padding: 4 }}>
      <svg className="graph" width={L.width} height={L.height} viewBox={`0 0 ${L.width} ${L.height}`} style={{ minWidth: L.width, margin: '0 auto' }}>
        <defs>
          {colors.map((c) => (
            <marker key={c} id={`arr-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLORS[c]} />
            </marker>
          ))}
        </defs>
        {edges.map((e, k) => {
          const pts = L.paths[k];
          if (!pts?.length) return null;
          const kind = e.kind ?? 'normal';
          const mid = pts[Math.floor(pts.length / 2)];
          return (
            <g key={k}>
              <path d={pathD(pts)} fill="none" stroke={EDGE_COLORS[kind]} strokeWidth={kind === 'critical' || kind === 'hot' ? 2.2 : kind === 'faint' ? 1 : 1.5} strokeDasharray={kind === 'back' ? '6 3' : kind === 'war' || kind === 'waw' ? '3 3' : undefined} markerEnd={`url(#arr-${kind})`} opacity={kind === 'faint' ? 0.6 : 1} />
              {e.label && (
                <text x={mid.x + 4} y={mid.y - 3} fontSize={10} fontFamily="var(--sans)" fill={EDGE_COLORS[kind]} style={{ paintOrder: 'stroke', stroke: 'var(--panel)', strokeWidth: 3 }}>{e.label}</text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = L.pos.get(n.id)!;
          return (
            <foreignObject key={n.id} x={p.x} y={p.y} width={p.w} height={p.h} style={{ overflow: 'visible' }}>
              <div
                className={`gnode gnode-${n.style ?? 'default'} ${n.className ?? ''} ${onNodeClick ? 'clickable' : ''}`}
                style={{ width: p.w, height: p.h, ...(n.tint ? { borderColor: n.tint, background: `color-mix(in srgb, ${n.tint} 14%, var(--panel))` } : {}), ...(n.dashed ? { borderStyle: 'dashed' } : {}) }}
                onClick={() => onNodeClick?.(n.id)}
                onMouseEnter={() => onNodeHover?.(n.id)}
                onMouseLeave={() => onNodeHover?.(null)}
              >
                <div className="gnode-title">
                  <span>{n.title}</span>
                  {n.badge}
                </div>
                {n.lines && n.lines.length > 0 && <CodeView lines={n.lines} target={target} className="gnode-code" />}
                {n.extra && <div className="gnode-extra">{n.extra}</div>}
              </div>
            </foreignObject>
          );
        })}
        {overlay?.(L.pos)}
      </svg>
    </div>
  );
}
