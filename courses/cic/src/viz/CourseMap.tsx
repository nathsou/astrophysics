// The road from the untyped λ-calculus to CIC, as a clickable map.
//
// Two layouts of the same graph (see courseMapData.ts): a horizontal one for
// wide containers and a vertical one for narrow ones.  A container query in
// layout.css shows exactly one of them (the other is display:none, so it is
// also out of the accessibility tree).

import { For } from 'solid-js';
import { edgeSegment, horizontal, mapEdges, mapNodes, vertical, type MapLayout } from './courseMapData.ts';

function go(ch: string) {
  location.hash = `#/ch/${ch}`;
}

function MapSvg(props: { layout: MapLayout }) {
  const L = props.layout;
  const arrow = `cm-arrow-${L.name}`;
  return (
    <svg
      class={`cm-svg cm-${L.name}`}
      viewBox={`0 0 ${L.width} ${L.height}`}
      role="group"
      aria-label="Map of the calculi in this course"
      style={{ '--cm-label': `${L.labelSize}px`, '--cm-text': `${L.textSize}px` }}
    >
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" class="cm-arrowhead" />
        </marker>
      </defs>
      <For each={mapEdges}>
        {([a, b]) => {
          const s = edgeSegment(L, a, b);
          return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} class="cm-line" marker-end={`url(#${arrow})`} />;
        }}
      </For>
      <For each={mapEdges.filter(([, , label]) => label)}>
        {([a, b, label]) => {
          const p = L.edgeLabels[`${a}-${b}`];
          return (
            <text x={p.x} y={p.y} text-anchor={p.anchor} class="cm-edge">
              {label}
            </text>
          );
        }}
      </For>
      <For each={mapNodes}>
        {(n) => {
          const p = L.nodes[n.id];
          return (
            <g
              class={`cm-node ${n.id === 'cic' ? 'goal' : ''}`}
              role="link"
              tabindex="0"
              aria-label={`${n.label}, ${n.sub}: open the chapter`}
              onClick={() => go(n.ch)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  go(n.ch);
                }
              }}
            >
              <circle cx={p.x} cy={p.y} r={p.r} />
              <text x={p.x} y={p.y + 1} text-anchor="middle" dominant-baseline="central" class="cm-label">
                {n.label}
              </text>
              <text x={p.sub.x} y={p.sub.y} text-anchor={p.sub.anchor} class="cm-sub">
                {n.sub}
              </text>
            </g>
          );
        }}
      </For>
    </svg>
  );
}

export function CourseMap() {
  return (
    <div class="coursemap wide">
      <MapSvg layout={horizontal} />
      <MapSvg layout={vertical} />
    </div>
  );
}
