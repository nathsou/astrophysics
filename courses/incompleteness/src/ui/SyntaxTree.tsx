// The syntax tree of a term or formula, as SVG. Nodes carry data-n, so they light up with the
// same node in every other view.

import { useMemo } from 'react';
import { children, type Node } from '../engine/syntax/ast';
import type { Analysis } from '../engine/syntax/analysis';
import { constName, fnName, predName, varName } from '../engine/syntax/language';
import { evaluate } from '../engine/numbers/nat';
import { describeNode, highlightNode, clearHighlight } from './FormulaView';
import { inspect } from './store';

function label(n: Node): string {
  switch (n.k) {
    case 'var':
      return varName(n.index).replace('_', '');
    case 'const':
      return constName(n.index);
    case 'numeral': {
      const v = evaluate(n.value, 64);
      return n.quotes !== undefined ? `⌜${n.quotes.replace(/\\[a-z]+/g, '').replace(/[{}]/g, '')}⌝` : v !== null ? `${v}̄` : 'n̄';
    }
    case 'app':
      return fnName(n.arity, n.index);
    case 'bot':
      return '⊥';
    case 'top':
      return '⊤';
    case 'eq':
      return '=';
    case 'pred':
      return predName(n.arity, n.index);
    case 'abbr':
      return n.name;
    case 'not':
      return '¬';
    case 'and':
      return '∧';
    case 'or':
      return '∨';
    case 'imp':
      return '→';
    case 'iff':
      return '↔';
    case 'forall':
      return `∀${varName(n.v.index).replace('_', '')}`;
    case 'exists':
      return `∃${varName(n.v.index).replace('_', '')}`;
  }
}

interface Laid {
  n: Node;
  x: number;
  y: number;
  kids: Laid[];
}

const DX = 44;
const DY = 52;

function layout(root: Node): { tree: Laid; width: number; depth: number } {
  let next = 0;
  let depth = 0;
  const go = (n: Node, d: number): Laid => {
    depth = Math.max(depth, d);
    // The variable after a quantifier is shown in the quantifier's label.
    const kids = (n.k === 'forall' || n.k === 'exists' ? [n.body] : children(n)).map((c) => go(c, d + 1));
    let x: number;
    if (kids.length === 0) x = next++;
    else x = (kids[0].x + kids[kids.length - 1].x) / 2;
    return { n, x, y: d, kids };
  };
  const tree = go(root, 0);
  return { tree, width: next, depth };
}

export function SyntaxTree({ node, analysis }: { node: Node; analysis: Analysis }) {
  const { tree, width, depth } = useMemo(() => layout(node), [node]);
  const W = Math.max(1, width) * DX + 20;
  const H = (depth + 1) * DY + 10;
  const nodes: Laid[] = [];
  const edges: [Laid, Laid][] = [];
  const walk = (l: Laid) => {
    nodes.push(l);
    for (const k of l.kids) {
      edges.push([l, k]);
      walk(k);
    }
  };
  walk(tree);
  const px = (l: Laid) => 10 + l.x * DX + DX / 2;
  const py = (l: Laid) => 22 + l.y * DY;
  return (
    <div className="syntax-tree" onMouseLeave={clearHighlight}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Syntax tree">
        {edges.map(([a, b]) => (
          <line key={`${a.n.id}-${b.n.id}`} x1={px(a)} y1={py(a) + 11} x2={px(b)} y2={py(b) - 12} className="tn-edge" />
        ))}
        {nodes.map((l) => {
          const text = label(l.n);
          const w = Math.max(24, text.length * 9 + 12);
          const isTerm = l.n.k === 'var' || l.n.k === 'const' || l.n.k === 'app' || l.n.k === 'numeral';
          return (
            <g
              key={l.n.id}
              data-n={l.n.id}
              className={`tn ${isTerm ? 'tn-term' : 'tn-formula'} tn-${l.n.k}`}
              onMouseEnter={() => {
                highlightNode(analysis, l.n.id);
                inspect(describeNode(analysis, l.n.id));
              }}
              onClick={() => inspect(describeNode(analysis, l.n.id), true)}
            >
              <rect className="tn-box" x={px(l) - w / 2} y={py(l) - 12} width={w} height={24} rx={12} />
              <text x={px(l)} y={py(l) + 5} textAnchor="middle">
                {text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
