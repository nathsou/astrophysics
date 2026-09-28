// The reduction graph of a small term: every term reachable by one-step β-reductions (up to
// α-equivalence), drawn in layers by distance from the start. Computed by the engine
// (reductionGraph); bounded, and it says when the bound was hit.

import { useId, useMemo, useState } from 'react';
import { print, reductionGraph, type LambdaPrintOptions, type ReductionGraph, type Term } from '../../engine/lambda/lambda';
import { NotAProof, Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import { TermInput, useParsedLambda } from './shared';
import { TermInline } from './TermView';
import './lambda.css';

const COL = 92;
const ROW = 56;
const R = 16;

function layout(g: ReductionGraph) {
  const layers = new Map<number, number[]>();
  for (const n of g.nodes) layers.set(n.depth, [...(layers.get(n.depth) ?? []), n.index]);
  const pos = new Map<number, { x: number; y: number }>();
  let maxRows = 1;
  for (const [d, ids] of layers) {
    maxRows = Math.max(maxRows, ids.length);
    ids.forEach((id, i) => pos.set(id, { x: 34 + d * COL, y: 30 + i * ROW }));
  }
  const width = 34 * 2 + (layers.size - 1) * COL;
  const height = 30 * 2 + (maxRows - 1) * ROW;
  // centre each layer vertically
  for (const [, ids] of layers) {
    const off = ((maxRows - ids.length) * ROW) / 2;
    for (const id of ids) pos.get(id)!.y += off;
  }
  return { pos, width, height };
}

export function GraphView({ term, opts, onPick, maxNodes = 30 }: { term: Term; opts?: LambdaPrintOptions; onPick?: (t: Term) => void; maxNodes?: number }) {
  const g = useMemo(() => reductionGraph(term, { maxNodes, maxSize: 300 }), [term, maxNodes]);
  const { pos, width, height } = useMemo(() => layout(g), [g]);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrow = `lam-arrow-${uid}`;
  const arrowLo = `lam-arrow-lo-${uid}`;
  // merge parallel edges (several redexes giving the same reduct)
  const edges = useMemo(() => {
    const m = new Map<string, { from: number; to: number; count: number; lo: boolean }>();
    for (const e of g.edges) {
      const k = `${e.from}>${e.to}`;
      const cur = m.get(k);
      if (cur) {
        cur.count++;
        cur.lo ||= e.leftmostOutermost;
      } else m.set(k, { from: e.from, to: e.to, count: 1, lo: e.leftmostOutermost });
    }
    return [...m.values()];
  }, [g]);
  const nfs = g.normalForms;
  const summary = `${g.nodes.length} term${g.nodes.length === 1 ? '' : 's'}, ${g.edges.length} one-step reduction${g.edges.length === 1 ? '' : 's'}; ${
    nfs.length === 0 ? 'no normal form among them' : nfs.length === 1 ? `one normal form (term ${nfs[0]! + 1})` : `${nfs.length} normal forms`
  }.`;
  const path = (e: { from: number; to: number }) => {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    if (e.from === e.to) return `M ${a.x - 8} ${a.y - R + 2} C ${a.x - 30} ${a.y - 52}, ${a.x + 30} ${a.y - 52}, ${a.x + 8} ${a.y - R + 2}`;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = a.x + (dx / len) * R;
    const sy = a.y + (dy / len) * R;
    const ex = b.x - (dx / len) * (R + 4);
    const ey = b.y - (dy / len) * (R + 4);
    if (dx > 0) return `M ${sx} ${sy} L ${ex} ${ey}`;
    // backwards or sideways: curve
    const mx = (sx + ex) / 2 + dy * 0.3;
    const my = (sy + ey) / 2 - 40;
    return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
  };
  return (
    <div className="lam-graph">
      <p className="wb-note" aria-live="polite">
        <Prov kind="computed" /> {summary} {g.complete ? 'The graph is complete: these are all the terms the start term reduces to.' : `Only part of the graph is shown (at most ${maxNodes} terms, each at most 300 symbols); nodes with a dashed ring have reducts that are not drawn.`}
      </p>
      <svg viewBox={`0 ${-24} ${Math.max(width, 120)} ${height + 24}`} width={Math.max(width, 120) * 1.15} style={{ maxWidth: '100%' }} role={onPick ? 'group' : 'img'} aria-label={`Reduction graph: ${summary}`}>
        <defs>
          <marker id={arrow} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
          <marker id={arrowLo} className="lo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        {edges.map((e, i) => (
          <path key={i} d={path(e)} className={`g-edge ${e.lo ? 'lo' : ''}`} markerEnd={`url(#${e.lo ? arrowLo : arrow})`} opacity={hover === null || hover === e.from || hover === e.to ? 1 : 0.25}>
            <title>{`${e.from + 1} → ${e.to + 1}${e.count > 1 ? ` (${e.count} different redexes)` : ''}${e.lo ? ' — the normal-order step' : ''}`}</title>
          </path>
        ))}
        {g.nodes.map((n) => {
          const p = pos.get(n.index)!;
          return (
            <g
              key={n.index}
              className={`g-node ${n.index === 0 ? 'start' : ''} ${n.normal ? 'normal' : ''} ${n.expanded ? '' : 'unexpanded'}`}
              transform={`translate(${p.x} ${p.y})`}
              tabIndex={onPick ? 0 : undefined}
              role={onPick ? 'button' : undefined}
              aria-label={`Term ${n.index + 1}${n.normal ? ', normal form' : ''}: ${print(n.term, opts)}`}
              onMouseEnter={() => setHover(n.index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick?.(n.term)}
              onKeyDown={(e) => {
                if (onPick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onPick(n.term);
                }
              }}
            >
              <circle r={R} />
              <text>{n.index + 1}</text>
              <title>{print(n.term, opts)}</title>
            </g>
          );
        })}
      </svg>
      <div className="lam-legend">
        <span>
          <i style={{ border: '2.5px solid var(--accent)', borderRadius: '50%' }} /> start
        </span>
        <span>
          <i style={{ background: 'var(--checked-soft)', border: '2.5px solid var(--checked)', borderRadius: '50%' }} /> normal form
        </span>
        <span>
          <i style={{ borderBottom: '2px solid var(--accent)', borderRadius: 0 }} /> the step normal order takes
        </span>
        {onPick && <span>Click a node to load that term.</span>}
      </div>
      <ol className="lam-graph-list">
        {g.nodes.map((n) => (
          <li key={n.index} className={n.normal ? 'normal' : ''} onMouseEnter={() => setHover(n.index)} onMouseLeave={() => setHover(null)}>
            <span className="g-n">{n.index + 1}</span>
            <span className="g-t">
              <TermInline term={n.term} opts={opts} />
              {n.normal && <span className="lam-tag strong"> normal form</span>}
            </span>
          </li>
        ))}
      </ol>
      {nfs.length === 1 && g.complete && (
        <NotAProof>
          This graph is complete and contains exactly one normal form, so every reduction sequence from the start term that ends at all ends there — as the corollary to the Church–Rosser theorem says it must. The graph checks one term; the theorem is about all of them.
        </NotAProof>
      )}
    </div>
  );
}

const GRAPH_PRESETS = [
  { src: '(λx.(λy.y x) z) v', label: 'the book’s example (λx.(λy.yx)z)v' },
  { src: '(λx.x x) ((λy.y) z)', label: '(λx.xx)((λy.y)z) — a duplicated redex' },
  { src: '(λx.y) Ω', label: '(λx.y)Ω — a loop and a normal form' },
  { src: 'K I ((λx.x) z)', label: 'K I ((λx.x)z)' },
  { src: '(λx.x x) (λx.x x)', label: 'Ω — a single loop' },
  { src: '(λx.x x x) (λx.x x x)', label: '(λx.xxx)(λx.xxx) — it keeps growing (bounded)' },
];

/** A term input with presets, and its reduction graph. */
export function GraphPanel() {
  const [src, setSrc] = useState(GRAPH_PRESETS[0]!.src);
  const parsed = useParsedLambda(src);
  return (
    <Panel n="G" title="Reduction graphs" prov={<Prov kind="computed" />}>
      <TermInput value={src} onChange={setSrc} label="Term" parsed={parsed} presets={[{ group: 'Examples', items: GRAPH_PRESETS }]} />
      {parsed.ok && <GraphView term={parsed.value} opts={{ labels: true, numerals: true }} onPick={(t) => setSrc(print(t))} />}
    </Panel>
  );
}
