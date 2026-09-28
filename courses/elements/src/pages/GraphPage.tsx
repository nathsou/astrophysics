// The dependency graph: every citation Heath prints, as a graph of the whole Elements.

import { useMemo, useState } from 'react';
import { ancestors, cites, citedBy, depth, descendants, forwardCitations, longestChain, orderOf, PARALLEL_POSTULATE, usesParallelPostulate } from '../graph/deps';
import { byId, citeLabel, hrefOf, index, longLabel, parseRef, ROMAN } from '../text';
import { modernTitle } from '../content/modern';
import { BOOKS } from '../content/books';

type Colouring = 'p5' | 'depth' | 'book';

export default function GraphPage({ params }: { params: URLSearchParams }) {
  const focus = params.get('focus') && byId.has(params.get('focus')!) ? params.get('focus')! : '1.47';
  const [dir, setDir] = useState<'down' | 'up'>(params.get('dir') === 'up' || byId.get(focus)?.kind !== 'prop' ? 'up' : 'down');
  const [colouring, setColouring] = useState<Colouring>('p5');
  const [q, setQ] = useState('');
  const setFocus = (id: string) => {
    window.location.hash = `#/graph?focus=${id}`;
  };
  const related = useMemo(() => (dir === 'down' ? ancestors(focus) : descendants(focus)), [focus, dir]);
  const props = index.filter((e) => e.kind === 'prop');
  const maxDepth = Math.max(...props.map((e) => depth(e.id)));
  const p5count = props.filter((e) => usesParallelPostulate(e.id)).length;
  const mostCited = [...props].sort((a, b) => (citedBy.get(b.id)?.length ?? 0) - (citedBy.get(a.id)?.length ?? 0)).slice(0, 10);
  const deepest = props.reduce((a, b) => (depth(b.id) > depth(a.id) ? b : a));
  const forward = forwardCitations();
  const chain = longestChain(focus);

  const colourOf = (id: string) => {
    if (colouring === 'p5') return usesParallelPostulate(id) ? 'var(--gap)' : 'var(--ok)';
    if (colouring === 'depth') {
      const t = depth(id) / maxDepth;
      return `color-mix(in srgb, var(--byrne-red) ${Math.round(t * 100)}%, var(--byrne-yellow))`;
    }
    const th = BOOKS[byId.get(id)!.book - 1].theme;
    return th === 'plane' ? 'var(--byrne-red)' : th === 'proportion' ? 'var(--byrne-yellow)' : th === 'number' ? 'var(--byrne-blue)' : th === 'solid' ? 'var(--accent)' : 'var(--ink-2)';
  };

  const jump = parseRef(q);
  return (
    <div className="page graph-page">
      <h1>The dependency graph</h1>
      <p className="lede">
        Heath prints Euclid’s justifications in brackets: [I. 4], [Post. 1], [C.N. 1]. Read together, they form a graph of the whole Elements: {props.length}{' '}
        propositions, {[...cites.values()].reduce((s, c) => s + c.length, 0)} citations. Every citation points backwards, so the order of the book is a
        valid deductive order{forward.length === 0 ? '.' : (
          <>
            , with {forward.length === 1 ? 'one exception' : `${forward.length} exceptions`}:{' '}
            {forward.map(([a, b], i) => (
              <span key={a + b}>
                {i > 0 && ', '}
                <a href={hrefOf(a)}>{citeLabel(a)}</a> cites <a href={hrefOf(b)}>{citeLabel(b)}</a>
              </span>
            ))}
            , which comes after it.
          </>
        )}
      </p>

      <section className="graph-controls">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (jump) setFocus(jump);
          }}
        >
          <label>
            Focus <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={citeLabel(focus)} aria-label="Focus on an item" />
          </label>
          {jump && <button className="chip-btn">{citeLabel(jump)}</button>}
        </form>
        <div className="seg">
          <button className={dir === 'down' ? 'on' : ''} onClick={() => setDir('down')}>What it rests on</button>
          <button className={dir === 'up' ? 'on' : ''} onClick={() => setDir('up')}>What rests on it</button>
        </div>
        <div className="seg">
          <button className={colouring === 'p5' ? 'on' : ''} onClick={() => setColouring('p5')}>Parallel postulate</button>
          <button className={colouring === 'depth' ? 'on' : ''} onClick={() => setColouring('depth')}>Depth</button>
          <button className={colouring === 'book' ? 'on' : ''} onClick={() => setColouring('book')}>Subject</button>
        </div>
      </section>

      <div className="graph-focus">
        <h2>
          <a href={hrefOf(focus)}>{longLabel(focus)}</a>
          {modernTitle(focus) && <span className="muted"> · {modernTitle(focus)}</span>}
        </h2>
        <p className="muted">{byId.get(focus)!.text}</p>
        <p>
          {dir === 'down' ? (
            <>
              Rests on <b>{[...related].filter((x) => byId.get(x)?.kind === 'prop').length}</b> propositions and{' '}
              <b>{[...related].filter((x) => byId.get(x)?.kind !== 'prop').length}</b> first principles
              {usesParallelPostulate(focus) ? ', including the parallel postulate.' : ', not including the parallel postulate.'}
            </>
          ) : (
            <>
              <b>{related.size}</b> propositions rest on it, directly or not.
            </>
          )}
        </p>
        {dir === 'down' && chain.length > 1 && (
          <p className="chain">
            A longest chain:{' '}
            {chain.map((c, i) => (
              <span key={c}>
                {i > 0 && ' ← '}
                <a href={`#/graph?focus=${c}`}>{citeLabel(c)}</a>
              </span>
            ))}
          </p>
        )}
      </div>

      <Layered focus={focus} related={related} dir={dir} colourOf={colourOf} onFocus={setFocus} />

      <h2>All 465 propositions</h2>
      <p className="muted">
        One cell per proposition, one row per book. {colouring === 'p5' ? `Green: proved without the parallel postulate (${props.length - p5count}). Amber: relies on it (${p5count}).` : colouring === 'depth' ? `Colour: length of the longest chain of citations below (up to ${maxDepth}).` : 'Colour: subject.'} Cells outlined in black are related to the focus.
      </p>
      <div className="grid-overview" role="grid" aria-label="Propositions by book">
        {BOOKS.map((_, bi) => {
          const b = bi + 1;
          const row = props.filter((e) => e.book === b);
          return (
            <div key={b} className="grid-row" role="row">
              <span className="grid-book">{ROMAN[b]}</span>
              <div className="grid-cells">
                {row.map((e) => (
                  <a
                    key={e.id}
                    role="gridcell"
                    href={`#/graph?focus=${e.id}`}
                    className={`cell ${related.has(e.id) ? 'rel' : ''} ${e.id === focus ? 'focus' : ''}`}
                    style={{ background: colourOf(e.id) }}
                    title={`${citeLabel(e.id)}${modernTitle(e.id) ? ' · ' + modernTitle(e.id) : ''}`}
                    aria-label={citeLabel(e.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <section className="graph-stats">
        <div>
          <h3>Most cited</h3>
          <ol>
            {mostCited.map((e) => (
              <li key={e.id}>
                <a href={`#/graph?focus=${e.id}&dir=up`}>{citeLabel(e.id)}</a> {modernTitle(e.id) && <span className="muted">{modernTitle(e.id)}</span>} — {citedBy.get(e.id)?.length}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Facts</h3>
          <ul>
            <li>
              The deepest proposition is <a href={`#/graph?focus=${deepest.id}`}>{citeLabel(deepest.id)}</a>, with a chain of {depth(deepest.id)} propositions below it.
            </li>
            <li>
              {p5count} of {props.length} propositions depend on the <a href={`#/graph?focus=${PARALLEL_POSTULATE}&dir=up`}>parallel postulate</a>. The first to use it is{' '}
              <a href="#/1.29">I.29</a>.
            </li>
            <li>
              Books VII–IX (numbers) cite no geometry at all:{' '}
              {props.filter((e) => e.book >= 7 && e.book <= 9).some((e) => [...ancestors(e.id)].some((a) => byId.get(a)!.book <= 6 && byId.get(a)!.kind === 'prop')) ? 'almost.' : 'they form an independent treatise.'}
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Layered({ focus, related, dir, colourOf, onFocus }: { focus: string; related: Set<string>; dir: 'down' | 'up'; colourOf: (id: string) => string; onFocus: (id: string) => void }) {
  const nodes = [focus, ...related];
  const [hover, setHover] = useState<string | null>(null);
  if (nodes.length > 160)
    return <p className="muted">Too many related items ({nodes.length}) to draw legibly. They are outlined in the overview below.</p>;
  // layers: for "rests on", by depth below the focus; for "rests on it", by depth above it
  const set = new Set(nodes);
  const level = new Map<string, number>();
  const lv = (id: string): number => {
    const hit = level.get(id);
    if (hit !== undefined) return hit;
    level.set(id, 0);
    const next = (dir === 'down' ? cites.get(id) : citedBy.get(id)) ?? [];
    const l = 1 + Math.max(-1, ...next.filter((n) => set.has(n)).map(lv));
    level.set(id, l);
    return l;
  };
  nodes.forEach(lv);
  const maxL = Math.max(...nodes.map((n) => level.get(n)!));
  const layers: string[][] = Array.from({ length: maxL + 1 }, () => []);
  for (const n of nodes) layers[dir === 'down' ? maxL - level.get(n)! : level.get(n)!].push(n);
  for (const l of layers) l.sort((a, b) => orderOf(a) - orderOf(b));
  const W = 1000;
  const rowH = 64;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((l, i) => l.forEach((n, j) => pos.set(n, { x: ((j + 0.5) * W) / l.length, y: 30 + i * rowH })));
  const H = 30 + layers.length * rowH;
  const edges: [string, string][] = [];
  for (const n of nodes) for (const c of cites.get(n) ?? []) if (set.has(c)) edges.push([n, c]);
  const near = hover ? new Set([hover, ...(cites.get(hover) ?? []), ...(citedBy.get(hover) ?? [])]) : null;
  return (
    <div className="layered">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dependency graph around the focus">
        {edges.map(([a, b], i) => {
          const p = pos.get(a)!;
          const q = pos.get(b)!;
          const on = near && (a === hover || b === hover);
          return <path key={i} className={`edge ${on ? 'on' : near ? 'dim' : ''}`} d={`M${p.x},${p.y} C${p.x},${(p.y + q.y) / 2} ${q.x},${(p.y + q.y) / 2} ${q.x},${q.y}`} />;
        })}
        {nodes.map((n) => {
          const p = pos.get(n)!;
          const e = byId.get(n)!;
          const isProp = e.kind === 'prop';
          return (
            <g key={n} className={`node ${n === focus ? 'focus' : ''} ${near && !near.has(n) ? 'dim' : ''}`} transform={`translate(${p.x},${p.y})`} onPointerEnter={() => setHover(n)} onPointerLeave={() => setHover(null)} onClick={() => onFocus(n)} style={{ cursor: 'pointer' }}>
              <title>{`${longLabel(n)}${modernTitle(n) ? ' · ' + modernTitle(n) : ''}\n${e.text}`}</title>
              {isProp ? <circle r={n === focus ? 9 : 6} style={{ fill: colourOf(n) }} /> : <rect x={-6} y={-6} width={12} height={12} className="axiom" />}
              <text y={-11} textAnchor="middle">{citeLabel(n, false)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
