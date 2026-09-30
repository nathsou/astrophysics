// Animated syntax trees of untyped λ-terms (SVG).

import { For, createMemo } from 'solid-js';
import type { Path, Redex, U } from '@kernel/untyped/lambda.ts';

interface LNode {
  id: number;
  x: number;
  y: number;
  label: string;
  kind: U['k'];
  path: Path;
  parent?: number;
  binderId?: number;
}

/** tidy-ish layout: leaves get consecutive x positions, parents are centred */
function layout(t: U): { nodes: LNode[]; width: number; height: number } {
  const nodes: LNode[] = [];
  let nextX = 0;
  let maxDepth = 0;
  const go = (t: U, depth: number, path: Path, parent: number | undefined, binders: Map<string, number>): number => {
    maxDepth = Math.max(maxDepth, depth);
    if (t.k === 'var' || t.k === 'def') {
      const x = nextX++;
      nodes.push({ id: t.id, x, y: depth, label: t.name, kind: t.k, path, parent, binderId: t.k === 'var' ? binders.get(t.name) : undefined });
      return x;
    }
    if (t.k === 'lam') {
      const b = new Map(binders);
      b.set(t.name, t.id);
      const idx = nodes.length;
      nodes.push({ id: t.id, x: 0, y: depth, label: `λ${t.name}`, kind: 'lam', path, parent });
      const cx = go(t.body, depth + 1, [...path, 0], t.id, b);
      nodes[idx].x = cx;
      return cx;
    }
    const idx = nodes.length;
    nodes.push({ id: t.id, x: 0, y: depth, label: '@', kind: 'app', path, parent });
    const a = go(t.fn, depth + 1, [...path, 0], t.id, binders);
    const b = go(t.arg, depth + 1, [...path, 1], t.id, binders);
    nodes[idx].x = (a + b) / 2;
    return nodes[idx].x;
  };
  go(t, 0, [], undefined, new Map());
  return { nodes, width: Math.max(1, nextX), height: maxDepth + 1 };
}

const isPrefix = (p: Path, q: Path) => p.length <= q.length && p.every((x, i) => x === q[i]);

export function SyntaxTreeView(props: { term: U; next?: Redex; showBinders?: boolean; maxHeight?: number }) {
  const L = createMemo(() => layout(props.term));
  const DX = 46;
  const DY = 54;
  const pad = 28;
  const byId = createMemo(() => new Map(L().nodes.map((n) => [n.id, n])));
  const pos = (n: LNode) => ({ x: pad + n.x * DX, y: pad + n.y * DY });
  const w = () => pad * 2 + (L().width - 1) * DX;
  const h = () => pad * 2 + (L().height - 1) * DY;
  const inRedex = (n: LNode) => !!props.next && isPrefix(props.next.path, n.path);
  const inArg = (n: LNode) => props.next?.kind === 'beta' && isPrefix([...props.next.path, 1], n.path);
  return (
    <div class="stree" style={{ 'max-height': `${props.maxHeight ?? 420}px` }}>
      <svg width={w()} height={h()} viewBox={`0 0 ${w()} ${h()}`} class="stree-svg">
        <g class="stree-edges">
          <For each={L().nodes.filter((n) => n.parent !== undefined)}>
            {(n) => {
              const p = () => byId().get(n.parent!);
              return (
                <line
                  class={`stree-edge ${inRedex(n) && p() && inRedex(p()!) ? 'hot' : ''}`}
                  x1={pos(p()!).x}
                  y1={pos(p()!).y}
                  x2={pos(n).x}
                  y2={pos(n).y}
                />
              );
            }}
          </For>
        </g>
        <g class="stree-binders">
          <For each={props.showBinders !== false ? L().nodes.filter((n) => n.binderId !== undefined) : []}>
            {(n) => {
              const b = () => byId().get(n.binderId!);
              return (
                <path
                  class="stree-bind"
                  d={(() => {
                    const a = pos(n);
                    const c = pos(b()!);
                    const mx = Math.max(a.x, c.x) + 24 + Math.abs(a.y - c.y) * 0.15;
                    return `M ${a.x + 6} ${a.y} C ${mx} ${a.y}, ${mx} ${c.y}, ${c.x + 14} ${c.y}`;
                  })()}
                />
              );
            }}
          </For>
        </g>
        <For each={L().nodes}>
          {(n) => (
            <g class={`stree-node k-${n.kind} ${inRedex(n) ? 'redex' : ''} ${inArg(n) ? 'arg' : ''}`} style={{ transform: `translate(${pos(n).x}px, ${pos(n).y}px)` }}>
              <rect x={-(n.label.length * 4.6 + 9)} y={-12} width={n.label.length * 9.2 + 18} height={24} rx={n.kind === 'app' ? 12 : 6} />
              <text text-anchor="middle" dominant-baseline="central">
                {n.label}
              </text>
            </g>
          )}
        </For>
      </svg>
    </div>
  );
}
