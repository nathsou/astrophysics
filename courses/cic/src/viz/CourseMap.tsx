// The road from the untyped λ-calculus to CIC, as a clickable map.

import { For } from 'solid-js';

interface MapNode {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  ch: string;
}

const nodes: MapNode[] = [
  { id: 'l', label: 'λ', sub: 'untyped', x: 60, y: 150, ch: 'lambda' },
  { id: 'stlc', label: 'λ→', sub: 'simple types', x: 190, y: 150, ch: 'stlc' },
  { id: 'f', label: 'λ2', sub: 'System F', x: 330, y: 70, ch: 'system-f' },
  { id: 'w', label: 'λω', sub: 'Fω', x: 470, y: 70, ch: 'fomega' },
  { id: 'p', label: 'λP', sub: 'LF', x: 330, y: 230, ch: 'dependent' },
  { id: 'c', label: 'λC', sub: 'CoC', x: 610, y: 150, ch: 'coc' },
  { id: 'ecc', label: 'ECC', sub: '+ universes', x: 740, y: 150, ch: 'universes' },
  { id: 'cic', label: 'CIC', sub: '+ inductives', x: 870, y: 150, ch: 'inductive' },
  { id: 'lean', label: 'Lean 4', sub: 'the real thing', x: 1000, y: 150, ch: 'lean' },
];

const edges: [string, string, string][] = [
  ['l', 'stlc', 'types'],
  ['stlc', 'f', 'polymorphism'],
  ['f', 'w', 'type operators'],
  ['stlc', 'p', 'dependency'],
  ['w', 'c', ''],
  ['p', 'c', ''],
  ['c', 'ecc', 'universes'],
  ['ecc', 'cic', 'inductives'],
  ['cic', 'lean', 'quotients, …'],
];

export function CourseMap() {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <div class="coursemap wide">
      <svg viewBox="0 0 1060 300" role="img" aria-label="Map of the calculi in this course">
        <defs>
          <marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--rule-strong)" />
          </marker>
        </defs>
        <For each={edges}>
          {([a, b, label]) => {
            const A1 = byId.get(a)!;
            const B1 = byId.get(b)!;
            const dx = B1.x - A1.x;
            const dy = B1.y - A1.y;
            const d = Math.hypot(dx, dy);
            const r = 34;
            const x1 = A1.x + (dx / d) * r;
            const y1 = A1.y + (dy / d) * r;
            const x2 = B1.x - (dx / d) * (r + 4);
            const y2 = B1.y - (dy / d) * (r + 4);
            return (
              <g>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--rule-strong)" stroke-width="1.6" marker-end="url(#cm-arrow)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} text-anchor="middle" class="cm-edge">
                  {label}
                </text>
              </g>
            );
          }}
        </For>
        <For each={nodes}>
          {(n) => (
            <g
              class={`cm-node ${n.id === 'cic' ? 'goal' : ''}`}
              role="link"
              tabindex="0"
              onClick={() => (location.hash = `#/ch/${n.ch}`)}
              onKeyDown={(e) => e.key === 'Enter' && (location.hash = `#/ch/${n.ch}`)}
            >
                <circle cx={n.x} cy={n.y} r={32} />
                <text x={n.x} y={n.y + 1} text-anchor="middle" dominant-baseline="central" class="cm-label">
                  {n.label}
                </text>
                <text x={n.x} y={n.y + 50} text-anchor="middle" class="cm-sub">
                  {n.sub}
                </text>
            </g>
          )}
        </For>
      </svg>
    </div>
  );
}
