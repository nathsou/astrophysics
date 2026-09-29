// The workshop: compass-and-straightedge puzzles from the Elements. You start with Postulates 1–3
// (a line through two points, a circle about a centre through a point); each construction you
// solve becomes a tool for the next ones. A solution counts only if it works for every position
// of the givens: it is re-run on random configurations, like a property-based test.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Degenerate, dist, v, type V } from '../geometry/vec';
import { check, givenPoints, intersections, primitiveCost, run, toolUses, TOOLS, type ArgKind, type Given, type Level, type Obj, type Step } from './engine';
import { LEVELS, toolsFor } from './levels';
import { persistentStore, useStore } from '../ui/store';
import { citeLabel, hrefOf } from '../text';

interface Progress {
  solved: Record<string, { uses: number; cost: number }>;
  seen: Record<string, true>;
}
export const workshopStore = persistentStore<Progress>('elements.workshop', { solved: {}, seen: {} });

const W = 640;
const H = 440;

function unlockedTools(p: Progress): Set<string> {
  const s = new Set<string>();
  for (const l of LEVELS) if (l.unlocks && (p.solved[l.id] || p.seen[l.id])) s.add(l.unlocks);
  return s;
}

function levelOpen(i: number, p: Progress) {
  return i === 0 || !!p.solved[LEVELS[i - 1].id] || !!p.seen[LEVELS[i - 1].id];
}

const SANDBOX: Level = {
  id: 'sandbox',
  prop: '1.1',
  title: 'Sandbox',
  brief: 'Free construction with every tool you have unlocked.',
  givens: [
    { name: 'A', kind: 'point', at: [v(-1, -0.3)] },
    { name: 'B', kind: 'point', at: [v(1, -0.3)] },
  ],
  requirements: [],
  reference: [],
};

export default function Workshop({ params }: { params: URLSearchParams }) {
  const progress = useStore(workshopStore);
  const firstOpen = LEVELS.findIndex((l, i) => levelOpen(i, progress) && !progress.solved[l.id] && !progress.seen[l.id]);
  const levelId = params.get('level') ?? LEVELS[Math.max(0, firstOpen)].id;
  const level = levelId === 'sandbox' ? SANDBOX : LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  const index = LEVELS.indexOf(level);
  return (
    <div className="workshop">
      <aside className="ws-levels" aria-label="Levels">
        <h2>The workshop</h2>
        <p className="ws-intro">
          You start with Euclid’s postulates only: a <b>line</b> through two points, and a <b>circle</b> about a centre through a point. Solve a
          construction and it becomes a tool.
        </p>
        <ol>
          {LEVELS.map((l, i) => {
            const open = levelOpen(i, progress);
            const st = progress.solved[l.id] ? 'solved' : progress.seen[l.id] ? 'seen' : open ? 'open' : 'locked';
            return (
              <li key={l.id} className={`${st} ${l.id === level.id ? 'current' : ''}`}>
                {open ? <a href={`#/workshop?level=${l.id}`}>{l.title}</a> : <span>{l.title}</span>}
                <span className="ws-prop">{citeLabel(l.prop)}</span>
                <span className="ws-st" aria-label={st}>
                  {st === 'solved' ? '✓' : st === 'seen' ? '◐' : st === 'locked' ? '🔒︎' : ''}
                </span>
              </li>
            );
          })}
          <li className={`open ${level.id === 'sandbox' ? 'current' : ''}`}>
            <a href="#/workshop?level=sandbox">Sandbox</a>
          </li>
        </ol>
        <button className="chip-btn" onClick={() => confirm('Forget all workshop progress?') && workshopStore.set({ solved: {}, seen: {} })}>
          Reset progress
        </button>
      </aside>
      {index >= 0 && !levelOpen(index, progress) ? (
        <div className="ws-main">
          <p>Solve the previous construction first (or look at Euclid’s solution to it).</p>
        </div>
      ) : (
        <Board key={level.id} level={level} />
      )}
    </div>
  );
}

type Pick = { kind: 'obj'; i: number } | { kind: 'cand'; x: number; y: number; which: number; p: V } | { kind: 'on'; o: number; t: number; p: V };

function Board({ level }: { level: Level }) {
  const progress = useStore(workshopStore);
  const unlocked = unlockedTools(progress);
  const tools = level.id === 'sandbox' ? toolsFor(unlocked) : toolsFor(unlocked);
  const [steps, setSteps] = useState<Step[]>([]);
  const history = useRef<Step[][]>([]);
  const [givens, setGivens] = useState<Given[]>(level.givens);
  const [tool, setTool] = useState<string | null>('circle');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [hover, setHover] = useState<Pick | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** The board shows Euclid's solution (which does not count as solving the level). */
  const [demo, setDemo] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const playing = useRef<number | null>(null);

  // the view: fixed, from the givens
  const box = useMemo(() => {
    const ps = givenPoints(level.givens);
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (W / H), 2) * 2.7;
    return { x0: cx - span / 2, x1: cx + span / 2, y0: cy - (span * H) / W / 2, y1: cy + (span * H) / W / 2 };
  }, [level]);
  const k = W / (box.x1 - box.x0);
  const S = (p: V) => v((p.x - box.x0) * k, (box.y1 - p.y) * k);
  const F = (x: number, y: number) => v(x / k + box.x0, box.y1 - y / k);

  const objs = useMemo(() => {
    try {
      return run(givens, steps);
    } catch (e) {
      if (e instanceof Degenerate) return run(level.givens, []);
      throw e;
    }
  }, [givens, steps, level]);
  const nGiven = level.givens.length;

  // names for points: givens keep theirs, constructed points get the next free letters
  const names = useMemo(() => {
    const used = new Set(level.givens.map((g) => g.name));
    const out: string[] = [];
    let next = 0;
    const letters = 'ABCDEFGHKLMNOPQRSTUVWXYZ';
    let li = 0;
    let ki = 0;
    objs.forEach((o, i) => {
      if (i < nGiven) {
        out.push(level.givens[i].hidden ? '' : level.givens[i].name);
        return;
      }
      if (o.kind === 'point') {
        while (next < letters.length && used.has(letters[next])) next++;
        const n = next < letters.length ? letters[next] : `P${i}`;
        used.add(n);
        out.push(n);
      } else if (o.kind === 'line') out.push(`l${++li}`);
      else out.push(`k${++ki}`);
    });
    return out;
  }, [objs, level, nGiven]);

  const candidates = useMemo(() => {
    const pts = objs.filter((o) => o.kind === 'point').map((o) => (o as { p: V }).p);
    const out: { x: number; y: number; which: number; p: V }[] = [];
    for (let i = 0; i < objs.length; i++)
      for (let j = i + 1; j < objs.length; j++) {
        if (objs[i].kind === 'point' || objs[j].kind === 'point') continue;
        intersections(objs[i], objs[j]).forEach((p, w) => {
          if (Math.abs(p.x) > 1e6 || pts.some((q) => dist(p, q) < 1e-7) || out.some((c) => dist(c.p, p) < 1e-7)) return;
          out.push({ x: i, y: j, which: w, p });
        });
      }
    return out;
  }, [objs]);

  const result = useMemo(() => (level.requirements.length ? check({ ...level, givens }, steps) : null), [level, givens, steps]);
  const solved = !!result && result.met.every((m) => m >= 0);
  const metObjects = new Set(result?.met.filter((m) => m >= 0) ?? []);

  useEffect(() => {
    if (!solved || level.id === 'sandbox' || demo) return;
    const prev = progress.solved[level.id];
    const uses = toolUses(steps);
    const cost = primitiveCost(steps);
    if (!prev || uses < prev.uses || (uses === prev.uses && cost < prev.cost)) workshopStore.set({ ...progress, solved: { ...progress.solved, [level.id]: { uses, cost } } });
    setMessage(level.unlocks ? `Solved. New tool: ${TOOLS[level.unlocks].label}.` : 'Solved.');
  }, [solved]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextArg: ArgKind | null = tool ? TOOLS[tool].args[picks.length] ?? null : null;

  const nearest = (sx: number, sy: number): Pick | null => {
    if (!nextArg) return null;
    const m = v(sx, sy);
    let best: Pick | null = null;
    let bd = Infinity;
    if (nextArg === 'point') {
      objs.forEach((o, i) => {
        if (o.kind !== 'point') return;
        const d = dist(S(o.p), m);
        if (d < 16 && d < bd) ((bd = d), (best = { kind: 'obj', i }));
      });
      if (best) return best;
      for (const c of candidates) {
        const d = dist(S(c.p), m);
        if (d < 16 && d < bd) ((bd = d), (best = { kind: 'cand', ...c }));
      }
      if (best) return best;
      // a point "taken at random" on a line or circle
      const f = F(sx, sy);
      objs.forEach((o, i) => {
        if (o.kind === 'line') {
          const ab = v(o.b.x - o.a.x, o.b.y - o.a.y);
          const t = ((f.x - o.a.x) * ab.x + (f.y - o.a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y);
          const p = v(o.a.x + ab.x * t, o.a.y + ab.y * t);
          const d = dist(S(p), m);
          if (d < 9 && d < bd) ((bd = d), (best = { kind: 'on', o: i, t, p }));
        } else if (o.kind === 'circle') {
          const t = Math.atan2(f.y - o.c.y, f.x - o.c.x);
          const p = v(o.c.x + o.r * Math.cos(t), o.c.y + o.r * Math.sin(t));
          const d = dist(S(p), m);
          if (d < 9 && d < bd) ((bd = d), (best = { kind: 'on', o: i, t, p }));
        }
      });
      return best;
    }
    objs.forEach((o, i) => {
      if (o.kind !== nextArg) return;
      let d = Infinity;
      if (o.kind === 'line') {
        const a = S(o.a);
        const b = S(o.b);
        d = Math.abs((b.x - a.x) * (m.y - a.y) - (b.y - a.y) * (m.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
      } else if (o.kind === 'circle') d = Math.abs(dist(S(o.c), m) - o.r * k);
      if (d < 10 && d < bd) ((bd = d), (best = { kind: 'obj', i }));
    });
    return best;
  };

  const local = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return v(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  };

  const commit = (ps: Pick[]) => {
    // materialise candidate intersections and points on objects as steps first
    const extra: Step[] = [];
    let n = objs.length;
    const args = ps.map((p) => {
      if (p.kind === 'obj') return p.i;
      extra.push(p.kind === 'cand' ? { op: 'intersect', x: p.x, y: p.y, which: p.which } : { op: 'on', o: p.o, t: p.t });
      return n++;
    });
    const t = tool!;
    const step: Step = t === 'line' ? { op: 'line', a: args[0], b: args[1] } : t === 'circle' ? { op: 'circle', c: args[0], p: args[1] } : { op: 'tool', tool: t, args };
    const next = [...steps, ...extra, step];
    try {
      run(givens, next);
      history.current.push(steps);
      setSteps(next);
      if (demo) setDemo(false);
      setMessage(null);
    } catch (e) {
      if (!(e instanceof Degenerate)) throw e;
      setMessage(`That does not work here: ${e.message.replace('degenerate: ', '')}.`);
    }
    setPicks([]);
  };

  const onDown = (e: React.PointerEvent) => {
    const m = local(e);
    // drag a given point?
    for (let i = 0; i < nGiven; i++) {
      const g = givens[i];
      const o = objs[i];
      if (o.kind === 'point' && g.at && dist(S(o.p), m) < 12 && (!tool || !nearest(m.x, m.y) || e.shiftKey)) {
        drag.current = i;
        (e.target as SVGElement).setPointerCapture?.(e.pointerId);
        return;
      }
    }
    if (!tool) return;
    const p = nearest(m.x, m.y);
    if (!p) return;
    if (p.kind === 'obj' && picks.some((q) => q.kind === 'obj' && q.i === p.i) && TOOLS[tool].args.length <= 2) return;
    const ps = [...picks, p];
    if (ps.length === TOOLS[tool].args.length) commit(ps);
    else setPicks(ps);
  };
  const onMove = (e: React.PointerEvent) => {
    const m = local(e);
    if (drag.current !== null) {
      const i = drag.current;
      const f = F(m.x, m.y);
      const next = givens.map((g, j) => (j === i ? { ...g, at: [f] } : g));
      try {
        run(next, steps);
        setGivens(next);
      } catch (err) {
        if (!(err instanceof Degenerate)) throw err;
      }
      return;
    }
    setHover(nearest(m.x, m.y));
  };
  const onUp = () => {
    drag.current = null;
  };

  const undo = () => {
    setPicks([]);
    const prev = history.current.pop();
    if (prev) setSteps(prev);
    setMessage(null);
  };
  const clear = () => {
    setDemo(false);
    history.current = [];
    setSteps([]);
    setPicks([]);
    setGivens(level.givens);
    setMessage(null);
  };
  const showEuclid = () => {
    clear();
    setDemo(true);
    const ref = level.reference;
    let i = 0;
    const tick = () => {
      i++;
      setSteps(ref.slice(0, i));
      if (i < ref.length) playing.current = window.setTimeout(tick, 650);
      else playing.current = null;
    };
    playing.current = window.setTimeout(tick, 300);
    if (level.id !== 'sandbox') workshopStore.set({ ...workshopStore.get(), seen: { ...workshopStore.get().seen, [level.id]: true } });
    setMessage(level.unlocks ? `Euclid’s solution. The tool ${TOOLS[level.unlocks].label} is now available; solve it yourself for a ✓.` : 'Euclid’s solution.');
  };
  useEffect(() => () => void (playing.current !== null && clearTimeout(playing.current)), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Escape') setPicks([]);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const drawObj = (o: Obj, i: number, cls: string) => {
    if (o.kind === 'line') {
      const d = v(o.b.x - o.a.x, o.b.y - o.a.y);
      const L = 1e3 / Math.hypot(d.x, d.y);
      const a = S(v(o.a.x - d.x * L, o.a.y - d.y * L));
      const b = S(v(o.a.x + d.x * L, o.a.y + d.y * L));
      return <line key={i} className={cls} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
    }
    if (o.kind === 'circle') {
      const c = S(o.c);
      return <circle key={i} className={cls} cx={c.x} cy={c.y} r={o.r * k} />;
    }
    return null;
  };
  const pickPos = (p: Pick): V | null => (p.kind === 'obj' ? (objs[p.i].kind === 'point' ? (objs[p.i] as { p: V }).p : null) : p.p);

  const program = steps.map((s, i) => {
    const out = names[nGiven + i] ?? '?';
    const n = (j: number) => names[j] || (j < nGiven ? level.givens[j].name : `o${j}`);
    switch (s.op) {
      case 'line':
        return `const ${out} = line(${n(s.a)}, ${n(s.b)});`;
      case 'circle':
        return `const ${out} = circle(${n(s.c)}, ${n(s.p)});`;
      case 'intersect':
        return `const ${out} = meet(${n(s.x)}, ${n(s.y)})[${s.which}];`;
      case 'on':
        return `const ${out} = anyPointOn(${n(s.o)});`;
      case 'tool':
        return `const ${out} = ${s.tool}(${s.args.map(n).join(', ')});`;
    }
  });
  // tools with several outputs name all of them; the program shows the first
  const par = level.reference.length ? { uses: toolUses(level.reference), cost: primitiveCost(level.reference) } : null;

  return (
    <div className="ws-main">
      <header className="ws-head">
        <h1>
          {level.title} {level.id !== 'sandbox' && <a className="cite" href={hrefOf(level.prop)}>{citeLabel(level.prop)}</a>}
        </h1>
        <p className="ws-brief">{level.brief}</p>
      </header>
      <div className="ws-toolbar" role="toolbar" aria-label="Tools">
        <button className={`tool ${tool === null ? 'on' : ''}`} onClick={() => (setTool(null), setPicks([]))} title="Move the given points">
          ✥ Move
        </button>
        {tools.map((t) => (
          <button key={t} className={`tool ${tool === t ? 'on' : ''} ${t === 'line' || t === 'circle' ? 'prim' : ''}`} onClick={() => (setTool(t), setPicks([]))} title={TOOLS[t].help}>
            {TOOLS[t].label}
          </button>
        ))}
        {Object.keys(TOOLS)
          .filter((t) => !tools.includes(t))
          .map((t) => (
            <span key={t} className="tool locked" title={`Unlocked by ${citeLabel(TOOLS[t].unlockedBy!)}`}>
              {TOOLS[t].label}
            </span>
          ))}
      </div>
      <div className="ws-board">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)} role="application" aria-label="Construction board">
          {objs.map((o, i) => (o.kind !== 'point' ? drawObj(o, i, `obj ${i < nGiven ? 'given' : ''} ${metObjects.has(i) ? 'met' : ''} ${hover?.kind === 'obj' && hover.i === i ? 'hover' : ''} ${picks.some((p) => p.kind === 'obj' && p.i === i) ? 'picked' : ''}`) : null))}
          {candidates.map((c, i) => {
            const p = S(c.p);
            return <circle key={`c${i}`} className={`cand ${hover?.kind === 'cand' && dist(hover.p, c.p) < 1e-9 ? 'hover' : ''}`} cx={p.x} cy={p.y} r={4} />;
          })}
          {objs.map((o, i) => {
            if (o.kind !== 'point') return null;
            const p = S(o.p);
            const isGiven = i < nGiven;
            const free = isGiven && !!level.givens[i].at;
            return (
              <g key={i} className={`pt ${isGiven ? 'given' : ''} ${free ? 'free' : ''} ${metObjects.has(i) ? 'met' : ''} ${hover?.kind === 'obj' && hover.i === i ? 'hover' : ''} ${picks.some((q) => q.kind === 'obj' && q.i === i) ? 'picked' : ''}`}>
                <circle cx={p.x} cy={p.y} r={isGiven ? 5 : 4} />
                {names[i] && (
                  <text x={p.x + 8} y={p.y - 8} className="lbl">
                    {names[i]}
                  </text>
                )}
              </g>
            );
          })}
          {hover && hover.kind === 'on' && (() => {
            const p = S(hover.p);
            return <circle className="cand on" cx={p.x} cy={p.y} r={4} />;
          })()}
          {picks.map((p, i) => {
            const q = pickPos(p);
            if (!q) return null;
            const s = S(q);
            return <circle key={`p${i}`} className="pick-ring" cx={s.x} cy={s.y} r={9} />;
          })}
        </svg>
        <div className="ws-side">
          <div className="ws-prompt" aria-live="polite">
            {tool ? (
              <>
                <b>{TOOLS[tool].label}</b>: {TOOLS[tool].prompts[picks.length]}
                {picks.length > 0 && <button className="linkish" onClick={() => setPicks([])}>cancel</button>}
              </>
            ) : (
              'Drag the red given points: your construction follows.'
            )}
          </div>
          {level.requirements.length > 0 && (
            <ul className="ws-reqs">
              {level.requirements.map((r, i) => (
                <li key={i} className={result && result.met[i] >= 0 ? 'ok' : result?.coincidental.includes(i) ? 'fake' : ''}>
                  <span className="mark">{result && result.met[i] >= 0 ? '✓' : result?.coincidental.includes(i) ? '≈' : '○'}</span> {r.text}
                  {result?.coincidental.includes(i) && <div className="why">Right here, but not in other positions of the givens: construct it, don’t place it.</div>}
                </li>
              ))}
            </ul>
          )}
          {message && <p className={`ws-msg ${solved ? 'ok' : ''}`}>{message}</p>}
          <div className="ws-stats">
            <span>
              Tool uses <b>{toolUses(steps)}</b>
              {par && <span className="par"> · Euclid {par.uses}</span>}
            </span>
            <span>
              Primitive steps <b>{primitiveCost(steps)}</b>
              {par && <span className="par"> · Euclid {par.cost}</span>}
            </span>
          </div>
          <div className="ws-buttons">
            <button className="chip-btn" onClick={undo} disabled={!steps.length}>↶ Undo</button>
            <button className="chip-btn" onClick={clear}>Clear</button>
            {level.hint && <button className="chip-btn" onClick={() => setShowHint(!showHint)}>Hint</button>}
            {level.reference.length > 0 && <button className="chip-btn" onClick={showEuclid}>Euclid’s solution</button>}
          </div>
          {showHint && level.hint && <p className="ws-hint">{level.hint}</p>}
          <details className="ws-program" open>
            <summary>Your construction, as a program</summary>
            <pre>
              {program.length ? program.join('\n') : '// pick a tool, then click points on the board'}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
