<!--
  The drawing surface and feedback of the diagram sketchpad, shared by the widget and by the exercise.

  The reader places vertices, joins the external particles to vertices and the vertices to each other, and chooses the particle on each
  internal line. Every vertex is checked against the Standard Model vertex rules as it is drawn; the feedback says, in words, what is
  wrong and why, the order in the couplings, and whether the diagram is one of the tree diagrams of the process. A form-based
  builder gives the same power without a pointer.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import DiagramSvg from './DiagramSvg.svelte';
  import { withSubscripts } from './fmt';
  import { renderDiagram } from './render';
  import { Curve, coilPath, wavyPath } from './geometry';
  import {
    analyse, buildKey, connectNodes, DEFAULT_CANVAS, NARROW_CANVAS, freeSpot, nodeAt, nodeName, tidyPositions, vertexNumber, legName, type Feedback,
  } from './sketch';
  import {
    addEdge, addVertex, describeDiagram, emptyDiagram, incidentEdges, isFermion, nodeById, normalizeEdge, removeEdge, removeVertex, reverseEdge, setEdgeParticle,
    symbolOf, processSymbols, type Diagram, type EnumerateOptions, type Process,
  } from '$lib/hep/diagrams';
  import { progress } from '$lib/state/progress.svelte';
  import type { Pt } from './geometry';

  let {
    process,
    options = {},
    target = 'all',
    storageId,
    onprogress,
    onsolved,
    allowKey = true,
  }: {
    process: Process;
    options?: EnumerateOptions;
    /** How many different diagrams complete the task: 'all' or a number. */
    target?: 'all' | number;
    /** Remember the diagrams found in this browser under this key. */
    storageId?: string;
    onprogress?: (found: number, total: number) => void;
    onsolved?: () => void;
    allowKey?: boolean;
  } = $props();

  let C = $state(DEFAULT_CANVAS);
  const W = $derived(C.width);
  const H = $derived(C.height);
  let wrapEl = $state<HTMLDivElement | undefined>();
  const K = $derived(buildKey(process, options));
  const need = $derived(target === 'all' ? K.key.length : Math.min(Math.max(1, Number(target)), K.key.length));

  interface Snap {
    d: Diagram;
    pos: Record<number, Pt>;
  }

  let diagram = $state.raw<Diagram>(emptyDiagram(process.initial, process.final));
  let pos = $state<Record<number, Pt>>(tidyPositions(emptyDiagram(process.initial, process.final)));
  let past = $state.raw<Snap[]>([]);
  let future = $state.raw<Snap[]>([]);
  let found = $state<number[]>([]);
  let celebrate = $state<{ idx: number } | null>(null);
  let mode = $state<'draw' | 'move'>('draw');
  let palette = $state(22);
  let selected = $state<{ type: 'edge' | 'node'; id: number } | null>(null);
  let armed = $state<number | null>(null);
  let drag = $state<{ from: number; at: Pt; moved: boolean } | null>(null);
  let moving = $state<{ id: number; dx: number; dy: number; pushed: boolean } | null>(null);
  let notice = $state('');
  let showKey = $state(false);
  let hintLevel = $state(0);
  let svgEl = $state<SVGSVGElement | undefined>();
  let solvedFired = false;

  // Form builder.
  let fFrom = $state<number | ''>('');
  let fTo = $state<number | ''>('');

  onMount(() => {
    if (wrapEl && wrapEl.clientWidth < 560) {
      C = NARROW_CANVAS;
      pos = tidyPositions(diagram, C);
    }
    if (storageId) {
      const saved = progress.draft<{ found?: number[]; key?: string } | null>(storageId, null);
      if (saved?.found && saved.key === keyId()) {
        found = saved.found.filter((i) => i >= 0 && i < K.key.length);
        if (found.length >= need) solvedFired = true;
      }
    }
  });

  const keyId = () => `${process.initial.join(',')}>${process.final.join(',')}|${K.forces.join(',')}|${K.key.length}`;

  const feedback: Feedback = $derived(celebrate ? analyse(diagram, K, found.filter((i) => i !== celebrate!.idx)) : analyse(diagram, K, found));
  const remaining = $derived(K.key.map((_, i) => i).filter((i) => !found.includes(i)));

  $effect(() => {
    onprogress?.(found.length, K.key.length);
    if (storageId) progress.saveDraft(storageId, { found: [...found], key: keyId() });
    if (!solvedFired && found.length >= need && found.length > 0) {
      solvedFired = true;
      onsolved?.();
    }
  });

  function posMap(): Map<number, Pt> {
    const m = new Map<number, Pt>();
    for (const n of diagram.nodes) if (pos[n.id]) m.set(n.id, pos[n.id]!);
    return m;
  }
  const model = $derived(renderDiagram(diagram, { width: W, height: H, pixels: posMap(), vertexRadius: 5, fontSize: 15, margin: { ...C.margin } }));

  function record() {
    past = [...past, { d: diagram, pos: { ...pos } }].slice(-100);
    future = [];
  }
  function afterChange() {
    if (selected?.type === 'edge' && !diagram.edges.some((e) => e.id === selected!.id)) selected = null;
    if (selected?.type === 'node' && !diagram.nodes.some((n) => n.id === selected!.id)) selected = null;
    if (armed !== null && !diagram.nodes.some((n) => n.id === armed)) armed = null;
    const fb = analyse(diagram, K, found);
    if (fb.isNew && fb.matchIndex >= 0) {
      found = [...found, fb.matchIndex];
      celebrate = { idx: fb.matchIndex };
      notice = '';
    } else celebrate = null;
  }
  function commit(d: Diagram, p: Record<number, Pt>) {
    record();
    diagram = d;
    pos = p;
    afterChange();
  }
  function undo() {
    const s = past[past.length - 1];
    if (!s) return;
    future = [...future, { d: diagram, pos: { ...pos } }];
    past = past.slice(0, -1);
    diagram = s.d;
    pos = s.pos;
    celebrate = null;
    selected = null;
    armed = null;
    notice = 'Undone.';
  }
  function redo() {
    const s = future[future.length - 1];
    if (!s) return;
    past = [...past, { d: diagram, pos: { ...pos } }];
    future = future.slice(0, -1);
    diagram = s.d;
    pos = s.pos;
    selected = null;
    afterChange();
    notice = 'Redone.';
  }
  function clearAll() {
    const fresh = emptyDiagram(process.initial, process.final);
    commit(fresh, tidyPositions(fresh, C));
    celebrate = null;
    notice = 'Started a new diagram.';
  }
  function tidy() {
    const p = tidyPositions(diagram, C);
    record();
    pos = p;
    notice = 'Tidied the layout.';
  }

  function toPt(ev: PointerEvent): Pt {
    const r = svgEl!.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height };
  }
  const HIT = 20;

  function addVertexAt(p: Pt): { d: Diagram; id: number } {
    const a = addVertex(diagram);
    return { d: a.diagram, id: a.id };
  }

  function connect(a: number, b: number, at?: Pt) {
    const r = connectNodes(diagram, a, b, palette);
    if ('error' in r) {
      notice = r.error;
      return;
    }
    const ne = addEdge(diagram, r.edge.from, r.edge.to, r.edge.pdg);
    commit(ne.diagram, pos);
    selected = { type: 'edge', id: ne.id };
    notice = `Joined ${nodeName(ne.diagram, a)} to ${nodeName(ne.diagram, b)}.`;
    void at;
  }

  function onDown(ev: PointerEvent) {
    if (!svgEl) return;
    const p = toPt(ev);
    const hit = nodeAt(diagram, pos, p, HIT);
    if (hit !== undefined) {
      const n = nodeById(diagram, hit)!;
      if (armed !== null && armed !== hit) {
        connect(armed, hit);
        armed = null;
        return;
      }
      selected = { type: 'node', id: hit };
      try {
        svgEl.setPointerCapture(ev.pointerId);
      } catch {
        /* synthetic or already released pointer */
      }
      if (mode === 'move' && n.kind === 'vertex') moving = { id: hit, dx: pos[hit]!.x - p.x, dy: pos[hit]!.y - p.y, pushed: false };
      else if (mode === 'draw') drag = { from: hit, at: p, moved: false };
      return;
    }
    selected = null;
    if (armed !== null) {
      armed = null;
      notice = 'Cancelled.';
      return;
    }
    if (mode === 'draw' && p.x > 20 && p.x < W - 20 && p.y > 10 && p.y < H - 10) {
      const a = addVertexAt(p);
      commit(a.d, { ...pos, [a.id]: p });
      selected = { type: 'node', id: a.id };
      notice = `Placed ${nodeName(a.d, a.id)}. Drag from it, or from an external particle, to draw a line.`;
    }
  }
  function onMove(ev: PointerEvent) {
    if (!svgEl) return;
    const p = toPt(ev);
    if (moving) {
      if (!moving.pushed) {
        record();
        moving.pushed = true;
      }
      pos = { ...pos, [moving.id]: { x: Math.min(W - 20, Math.max(20, p.x + moving.dx)), y: Math.min(H - 10, Math.max(10, p.y + moving.dy)) } };
    } else if (drag) {
      const s = pos[drag.from]!;
      drag = { ...drag, at: p, moved: drag.moved || Math.hypot(p.x - s.x, p.y - s.y) > 8 };
    }
  }
  function onUp(ev: PointerEvent) {
    if (!svgEl) return;
    const p = toPt(ev);
    if (moving) {
      moving = null;
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      // A tap: arm the point, so that the next tap on another point joins them.
      armed = d.from;
      notice = `${nodeName(diagram, d.from)} selected. Tap another point to join them, or drag.`;
      return;
    }
    const target_ = nodeAt(diagram, pos, p, HIT);
    if (target_ !== undefined && target_ !== d.from) {
      connect(d.from, target_);
      return;
    }
    if (target_ === undefined && p.x > 20 && p.x < W - 20 && p.y > 10 && p.y < H - 10) {
      // Dragged into empty space: a new vertex there, joined to where the drag began.
      const a = addVertexAt(p);
      const r = connectNodes(a.d, d.from, a.id, palette);
      if ('error' in r) {
        notice = r.error;
        return;
      }
      const ne = addEdge(a.d, r.edge.from, r.edge.to, r.edge.pdg);
      commit(ne.diagram, { ...pos, [a.id]: p });
      selected = { type: 'edge', id: ne.id };
      notice = `Placed ${nodeName(ne.diagram, a.id)} and joined it to ${nodeName(ne.diagram, d.from)}.`;
    }
  }
  function onCancel() {
    drag = null;
    moving = null;
  }

  function tapNode(id: number) {
    if (armed === null) {
      armed = id;
      selected = { type: 'node', id };
      notice = `${nodeName(diagram, id)} selected. Activate another point to join them.`;
    } else if (armed === id) {
      armed = null;
      notice = 'Cancelled.';
    } else {
      connect(armed, id);
      armed = null;
    }
  }
  function onNodeKey(ev: KeyboardEvent, id: number) {
    const n = nodeById(diagram, id)!;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      tapNode(id);
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && n.kind === 'vertex') {
      ev.preventDefault();
      removeVertexNode(id);
    } else if (n.kind === 'vertex' && ev.key.startsWith('Arrow')) {
      ev.preventDefault();
      const s = ev.shiftKey ? 30 : 10;
      const p = pos[id]!;
      const np = { x: Math.min(W - 20, Math.max(20, p.x + (ev.key === 'ArrowRight' ? s : ev.key === 'ArrowLeft' ? -s : 0))), y: Math.min(H - 10, Math.max(10, p.y + (ev.key === 'ArrowDown' ? s : ev.key === 'ArrowUp' ? -s : 0))) };
      record();
      pos = { ...pos, [id]: np };
    }
  }
  function onKey(ev: KeyboardEvent) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) redo();
      else undo();
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
      ev.preventDefault();
      redo();
    } else if (ev.key === 'Escape') {
      armed = null;
      drag = null;
      notice = 'Cancelled.';
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected && (ev.target as HTMLElement).tagName !== 'INPUT' && (ev.target as HTMLElement).tagName !== 'SELECT') {
      if (selected.type === 'edge') removeLine(selected.id);
      else removeVertexNode(selected.id);
    }
  }

  function removeLine(id: number) {
    commit(removeEdge(diagram, id), pos);
    selected = null;
    notice = 'Removed the line.';
  }
  function removeVertexNode(id: number) {
    const n = nodeById(diagram, id);
    if (!n || n.kind !== 'vertex') return;
    const nm = nodeName(diagram, id);
    const np = { ...pos };
    delete np[id];
    commit(removeVertex(diagram, id), np);
    selected = null;
    notice = `Removed ${nm}.`;
  }
  function reverseLine(id: number) {
    commit(reverseEdge(diagram, id), pos);
  }
  function retypeLine(id: number) {
    commit(setEdgeParticle(diagram, id, palette), pos);
    notice = `The line is now ${symbolOf(palette)}.`;
  }

  // ── Form builder ──
  function formAddVertex() {
    const a = addVertex(diagram);
    commit(a.diagram, { ...pos, [a.id]: freeSpot(diagram, pos, C) });
    notice = `Added ${nodeName(a.diagram, a.id)}.`;
  }
  function formAddLine() {
    if (fFrom === '' || fTo === '') {
      notice = 'Choose where the line starts and where it ends.';
      return;
    }
    connect(fFrom as number, fTo as number);
  }

  // ── Palette ──
  const BOSONS = [
    { pdg: 22, name: 'photon', kind: 'wavy' },
    { pdg: 23, name: 'Z boson', kind: 'wavy' },
    { pdg: 24, name: 'W⁺ boson', kind: 'wavy' },
    { pdg: -24, name: 'W⁻ boson', kind: 'wavy' },
    { pdg: 21, name: 'gluon', kind: 'coil' },
    { pdg: 25, name: 'Higgs boson', kind: 'dash' },
  ];
  const LEPTONS = [11, -11, 13, -13, 15, -15, 12, -12, 14, -14, 16, -16];
  const QUARKS = [2, -2, 1, -1, 4, -4, 3, -3, 6, -6, 5, -5];
  const straight = new Curve([{ x: 2, y: 7 }, { x: 40, y: 7 }]);
  const samples = { wavy: wavyPath(straight, 3, 9), coil: coilPath(straight, 3.4, 8), dash: 'M2 7L40 7', fermion: 'M2 7L40 7' };

  const selEdge = $derived(selected?.type === 'edge' ? diagram.edges.find((e) => e.id === selected!.id) : undefined);
  const selEdgeFixed = $derived(selEdge ? [selEdge.from, selEdge.to].some((id) => nodeById(diagram, id)?.kind !== 'vertex') : false);
  const nodeOptions = $derived(diagram.nodes.map((n) => ({ id: n.id, label: n.kind === 'vertex' ? `Vertex ${vertexNumber(diagram, n.id)}` : legName(n) })));
  const fromNode = $derived(typeof fFrom === 'number' ? nodeById(diagram, fFrom) : undefined);
  const toNode = $derived(typeof fTo === 'number' ? nodeById(diagram, fTo) : undefined);
  const formTyped = $derived((fromNode && fromNode.kind !== 'vertex') || (toNode && toNode.kind !== 'vertex'));

  const hintText = $derived.by(() => {
    if (!remaining.length) return 'You have found every diagram.';
    const d = K.key[remaining[0]!]!;
    const base = `One diagram you have not found yet is a ${describeDiagram(d)} diagram.`;
    if (hintLevel < 2) return base;
    const inter = [...new Set(d.edges.filter((e) => d.nodes.find((n) => n.id === e.from)?.kind === 'vertex' && d.nodes.find((n) => n.id === e.to)?.kind === 'vertex').map((e) => symbolOf(normalizeEdge(e).pdg)))];
    return `${base} It has ${d.nodes.filter((n) => n.kind === 'vertex').length} vertices${inter.length ? ` and ${inter.join(', ')} on the internal line${inter.length > 1 ? 's' : ''}` : ''}.`;
  });

  const progressText = $derived(`Found ${found.length} of ${K.key.length} tree diagram${K.key.length === 1 ? '' : 's'}${target !== 'all' ? ` (${need} needed)` : ''}.`);
</script>

<svelte:window onkeydown={(e) => { if (svgEl && svgEl.closest('.sketch')?.contains(document.activeElement)) onKey(e); }} />

<div class="sketch" bind:this={wrapEl}>
  <div class="toolbar ui" role="toolbar" aria-label="Sketchpad tools">
    <div class="group" role="radiogroup" aria-label="Mode">
      <button type="button" role="radio" aria-checked={mode === 'draw'} class:on={mode === 'draw'} onclick={() => (mode = 'draw')} title="Click empty space to place a vertex; drag between points to draw a line">Draw</button>
      <button type="button" role="radio" aria-checked={mode === 'move'} class:on={mode === 'move'} onclick={() => (mode = 'move')} title="Drag vertices to move them">Move</button>
    </div>
    <button type="button" onclick={undo} disabled={!past.length}>Undo</button>
    <button type="button" onclick={redo} disabled={!future.length}>Redo</button>
    <button type="button" onclick={tidy} disabled={!diagram.edges.length}>Tidy layout</button>
    <button type="button" onclick={clearAll} disabled={!diagram.edges.length && diagram.nodes.length === process.initial.length + process.final.length}>New diagram</button>
  </div>

  <div class="layout">
    <div class="left">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <svg
        bind:this={svgEl}
        class="canvas"
        class:drawing={mode === 'draw'}
        viewBox="0 0 {W} {H}"
        role="group"
        aria-label="Drawing area for the Feynman diagram of {processSymbols(process)}. Time runs from left to right. The external particles are fixed at the edges."
        onpointerdown={onDown}
        onpointermove={onMove}
        onpointerup={onUp}
        onpointercancel={onCancel}
      >
        <line x1={C.margin.l - 20} x2={W - C.margin.r + 20} y1={H - 12} y2={H - 12} class="time" />
        <path d="M{W - C.margin.r + 20} {H - 12}l-6 -3.5v7z" class="timehead" />
        <text x={C.margin.l - 20} y={H - 17} class="timetxt">time</text>
        {#if selEdge}
          {@const ml = model.lines.find((l) => l.id === selEdge.id)}
          {#if ml}<path d={ml.path} class="halo" fill="none" />{/if}
        {/if}
        <DiagramSvg {model} bare highlight={{ nodes: feedback.badNodes, edges: feedback.badEdges }} />
        {#each model.lines as l (l.id)}
          <path d={l.path} class="linehit" fill="none" role="presentation" onpointerdown={(e) => { e.stopPropagation(); selected = { type: 'edge', id: l.id }; armed = null; }} />
        {/each}
        {#each diagram.nodes.filter((n) => n.kind === 'vertex') as v (v.id)}
          {#if pos[v.id]}<text x={pos[v.id]!.x + 8} y={pos[v.id]!.y - 8} class="vnum" aria-hidden="true">{vertexNumber(diagram, v.id)}</text>{/if}
        {/each}
        {#if drag?.moved}
          <line x1={pos[drag.from]!.x} y1={pos[drag.from]!.y} x2={drag.at.x} y2={drag.at.y} class="rubber" />
        {/if}
        {#each diagram.nodes as n (n.id)}
          {#if pos[n.id]}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              cx={pos[n.id]!.x}
              cy={pos[n.id]!.y}
              r={n.kind === 'vertex' ? 13 : 15}
              class="nodehit"
              class:armed={armed === n.id}
              class:sel={selected?.type === 'node' && selected.id === n.id}
              class:bad={feedback.badNodes.includes(n.id)}
              tabindex="0"
              role="button"
              aria-label="{n.kind === 'vertex' ? `Vertex ${vertexNumber(diagram, n.id)}` : `External ${legName(n)}`}, {incidentEdges(diagram, n.id).length} line{incidentEdges(diagram, n.id).length === 1 ? '' : 's'}.{armed === n.id ? ' Selected to join.' : ''} Press Enter to select, then Enter on another point to join them.{n.kind === 'vertex' ? ' Arrow keys move it, Delete removes it.' : ''}"
              onkeydown={(e) => onNodeKey(e, n.id)}
            />
          {/if}
        {/each}
      </svg>
      <p class="notice ui" aria-live="polite">{@html withSubscripts(notice)}&nbsp;</p>

      <div class="palette ui" role="group" aria-label="Particle for the next internal line">
        <span class="plabel">Line to draw</span>
        {#each BOSONS as b (b.pdg)}
          <button type="button" class="pbtn" aria-pressed={palette === b.pdg} class:on={palette === b.pdg} title={b.name} aria-label={b.name} onclick={() => (palette = b.pdg)}>
            <svg viewBox="0 0 42 14" width="42" height="14" aria-hidden="true"><path d={samples[b.kind as 'wavy' | 'coil' | 'dash']} fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray={b.kind === 'dash' ? '5 4' : undefined} /></svg>
            <span>{symbolOf(b.pdg)}</span>
          </button>
        {/each}
        <label class="fsel">
          <span class="pbtn" class:on={isFermion(palette)}>
            <svg viewBox="0 0 42 14" width="42" height="14" aria-hidden="true"><path d={samples.fermion} fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M21 3.5l5 3.5l-5 3.5z" fill="currentColor" /></svg>
          </span>
          <span class="sr">Fermion</span>
          <select aria-label="Fermion line" value={isFermion(palette) ? palette : ''} onchange={(e) => (palette = Number((e.currentTarget as HTMLSelectElement).value))}>
            <option value="" disabled>fermion…</option>
            <optgroup label="Leptons">{#each LEPTONS as p (p)}<option value={p}>{symbolOf(p)}</option>{/each}</optgroup>
            <optgroup label="Quarks">{#each QUARKS as p (p)}<option value={p}>{symbolOf(p)}</option>{/each}</optgroup>
          </select>
        </label>
      </div>
      <p class="hint ui">The arrow of a fermion points the way you draw the line, from the first point to the second. Lines at the external particles take their particle from it automatically.</p>

      {#if selEdge}
        <div class="sel ui" role="group" aria-label="Selected line">
          <span>{@html withSubscripts(`Selected: ${symbolOf(normalizeEdge(selEdge).pdg)} from ${nodeName(diagram, selEdge.from)} to ${nodeName(diagram, selEdge.to)}`)}</span>
          {#if !selEdgeFixed}
            <button type="button" onclick={() => retypeLine(selEdge.id)} disabled={selEdge.pdg === palette}>Change to {symbolOf(palette)}</button>
            <button type="button" onclick={() => reverseLine(selEdge.id)}>Reverse direction</button>
          {:else}<span class="mute">Its particle is fixed by the external particle.</span>{/if}
          <button type="button" onclick={() => removeLine(selEdge.id)}>Delete line</button>
        </div>
      {:else if selected?.type === 'node' && nodeById(diagram, selected.id)?.kind === 'vertex'}
        <div class="sel ui" role="group" aria-label="Selected vertex">
          <span>Selected: <strong>{nodeName(diagram, selected.id)}</strong></span>
          <button type="button" onclick={() => removeVertexNode(selected!.id)}>Delete vertex</button>
        </div>
      {/if}
    </div>

    <div class="right">
      <div class="fb ui {feedback.tone}" aria-live="polite" aria-atomic="true">
        <p class="headline">{@html withSubscripts(feedback.headline)}</p>
        {#if feedback.details.length}
          <ul class="details">
            {#each feedback.details as dl, i (i)}
              <li class={dl.tone}><span class="mark" aria-hidden="true">{dl.tone === 'bad' ? '✗' : dl.tone === 'ok' ? '✓' : dl.tone === 'todo' ? '…' : 'ℹ'}</span> {@html withSubscripts(dl.text)}</li>
            {/each}
          </ul>
        {/if}
        {#if feedback.order}<p class="order"><strong>Coupling order.</strong> {@html withSubscripts(feedback.order.text)}</p>{/if}
      </div>

      <div class="found ui">
        <p class="progress" aria-live="polite"><strong>{progressText}</strong></p>
        <ul class="thumbs">
          {#each K.key as kd, i (i)}
            <li class:got={found.includes(i)}>
              {#if found.includes(i)}
                <DiagramSvg model={renderDiagram(kd, { width: 190, height: 120, fontSize: 12, margin: { l: 28, r: 28, t: 14, b: 14 } })} title="Found: {describeDiagram(kd)}" />
                <span class="cap">{@html withSubscripts(describeDiagram(kd))}</span>
              {:else}
                <span class="blank" aria-label="Diagram {i + 1}, not found yet">?</span>
              {/if}
            </li>
          {/each}
        </ul>
        <div class="row">
          <button type="button" onclick={() => { hintLevel = Math.min(2, hintLevel + 1); }} disabled={!remaining.length}>Hint</button>
          {#if allowKey}
            <button type="button" onclick={() => (showKey = !showKey)} aria-expanded={showKey}>{showKey ? 'Hide the answer key' : 'Show the answer key'}</button>
          {/if}
        </div>
        {#if hintLevel > 0}<p class="hinttext">{@html withSubscripts(hintText)}</p>{/if}
      </div>
    </div>
  </div>

  {#if showKey}
    <div class="key ui">
      <p><strong>Answer key: the {K.key.length} tree diagram{K.key.length === 1 ? '' : 's'} of {processSymbols(process)}</strong> with the {K.forces.map((f) => ({ qed: 'electromagnetic', qcd: 'strong', weak: 'weak', higgs: 'Higgs', fermi: 'Fermi contact' })[f]).join(', ')} interaction{K.forces.length > 1 ? 's' : ''}.</p>
      <ol class="keygrid">
        {#each K.key as kd, i (i)}
          <li class:got={found.includes(i)}>
            <DiagramSvg model={renderDiagram(kd, { width: 230, height: 150, fontSize: 13 })} title="Diagram {i + 1}: {describeDiagram(kd)}" />
            <span class="cap">{@html withSubscripts(`${i + 1}. ${describeDiagram(kd)}${found.includes(i) ? ' ✓ found' : ''}`)}</span>
          </li>
        {/each}
      </ol>
    </div>
  {/if}

  <details class="builder ui">
    <summary>Build with forms instead (keyboard and screen reader)</summary>
    <div class="form">
      <p class="mute">Add vertices and lines without a pointer. Each external particle must be joined to a vertex; a line at an external particle takes its particle from it.</p>
      <div class="frow">
        <button type="button" onclick={formAddVertex}>Add a vertex</button>
      </div>
      <div class="frow">
        <label>From
          <select bind:value={fFrom}>
            <option value="" disabled>choose…</option>
            {#each nodeOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
          </select>
        </label>
        <label>To
          <select bind:value={fTo}>
            <option value="" disabled>choose…</option>
            {#each nodeOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
          </select>
        </label>
        <label>Particle
          <select value={palette} disabled={!!formTyped} onchange={(e) => (palette = Number((e.currentTarget as HTMLSelectElement).value))}>
            {#each BOSONS as b (b.pdg)}<option value={b.pdg}>{symbolOf(b.pdg)} ({b.name})</option>{/each}
            <optgroup label="Leptons">{#each LEPTONS as p (p)}<option value={p}>{symbolOf(p)}</option>{/each}</optgroup>
            <optgroup label="Quarks">{#each QUARKS as p (p)}<option value={p}>{symbolOf(p)}</option>{/each}</optgroup>
          </select>
        </label>
        <button type="button" onclick={formAddLine}>Add the line</button>
      </div>
      {#if formTyped}<p class="mute">One end is an external particle, so the line is that particle.</p>{/if}
      <h4>Your diagram</h4>
      {#if !diagram.edges.length && diagram.nodes.length === process.initial.length + process.final.length}
        <p class="mute">Nothing drawn yet.</p>
      {/if}
      <ul class="lines">
        {#each diagram.nodes.filter((n) => n.kind === 'vertex') as v (v.id)}
          <li>Vertex {vertexNumber(diagram, v.id)} <button type="button" onclick={() => removeVertexNode(v.id)}>Remove</button></li>
        {/each}
        {#each diagram.edges as e (e.id)}
          <li>
            {@html withSubscripts(`${symbolOf(normalizeEdge(e).pdg)}: ${nodeName(diagram, e.from)} to ${nodeName(diagram, e.to)}`)}
            {#if ![e.from, e.to].some((id) => nodeById(diagram, id)?.kind !== 'vertex')}<button type="button" onclick={() => reverseLine(e.id)}>Reverse</button>{/if}
            <button type="button" onclick={() => removeLine(e.id)}>Remove</button>
          </li>
        {/each}
      </ul>
    </div>
  </details>
</div>

<style>
  .sketch {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .toolbar .group {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    overflow: hidden;
  }
  button,
  select {
    font: inherit;
    font-size: 0.82rem;
    color: var(--ink, inherit);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    padding: 0.3rem 0.7rem;
    min-height: 2.1rem;
    cursor: pointer;
  }
  .toolbar .group button {
    border: 0;
    border-radius: 0;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:hover:not(:disabled) {
    border-color: var(--track);
  }
  button.on,
  .pbtn.on {
    background: var(--accent-soft, var(--track-soft));
    border-color: var(--track);
    color: var(--track-ink);
    font-weight: 600;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 900px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .canvas {
    width: 100%;
    height: auto;
    display: block;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .canvas.drawing {
    cursor: crosshair;
  }
  .time {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .timehead {
    fill: var(--line-strong);
  }
  .timetxt {
    font-size: 10px;
    fill: var(--mute);
    font-family: var(--font-mono);
  }
  .halo {
    stroke: var(--track);
    stroke-opacity: 0.28;
    stroke-width: 12;
    stroke-linecap: round;
  }
  .linehit {
    stroke: transparent;
    stroke-width: 14;
    pointer-events: stroke;
    cursor: pointer;
  }
  .vnum {
    font-size: 11px;
    fill: var(--mute);
    font-family: var(--font-mono);
    pointer-events: none;
  }
  .rubber {
    stroke: var(--track);
    stroke-width: 1.6;
    stroke-dasharray: 5 4;
    pointer-events: none;
  }
  .nodehit {
    fill: transparent;
    stroke: transparent;
    stroke-width: 2;
    outline: none;
  }
  .nodehit:hover {
    stroke: var(--track);
    stroke-opacity: 0.45;
  }
  .nodehit:focus-visible,
  .nodehit.armed {
    stroke: var(--track);
    stroke-opacity: 1;
    stroke-dasharray: 4 3;
  }
  .nodehit.sel {
    stroke: var(--track);
    stroke-opacity: 0.7;
  }
  .nodehit.bad {
    stroke: var(--bad);
    stroke-opacity: 0.9;
  }
  .notice {
    min-height: 1.3rem;
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }
  .plabel {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    margin-right: 0.2rem;
  }
  .pbtn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 0.15rem 0.45rem;
    min-width: 3.2rem;
    line-height: 1.15;
  }
  .pbtn span {
    font-size: 0.8rem;
  }
  span.pbtn {
    cursor: default;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: var(--panel);
  }
  .fsel {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .hint {
    font-size: 0.78rem;
    color: var(--mute);
    margin: 0.4rem 0 0;
  }
  .sel {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.4rem;
    font-size: 0.82rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface-2, var(--panel));
  }
  .mute {
    color: var(--mute);
  }
  .fb {
    border: 1px solid var(--line-strong);
    border-left-width: 4px;
    border-radius: 7px;
    padding: 0.6rem 0.8rem;
    background: var(--panel);
    font-size: 0.88rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .fb.ok {
    border-left-color: var(--ok);
    background: var(--ok-soft);
  }
  .fb.bad {
    border-left-color: var(--bad);
    background: var(--bad-soft);
  }
  .fb.todo,
  .fb.empty,
  .fb.note,
  .fb.dup {
    border-left-color: var(--track);
  }
  .headline {
    margin: 0 0 0.3rem;
    font-weight: 600;
    line-height: 1.4;
  }
  .details {
    list-style: none;
    margin: 0.3rem 0;
    padding: 0;
    font-size: 0.82rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .details .bad {
    color: var(--bad);
  }
  .details .ok {
    color: var(--ok);
  }
  .details .todo,
  .details .note {
    color: var(--ink-2);
  }
  .mark {
    display: inline-block;
    width: 1.1em;
    font-weight: 700;
  }
  .order {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
  }
  .found {
    margin-top: 0.7rem;
  }
  .progress {
    margin: 0 0 0.4rem;
    font-size: 0.86rem;
  }
  .thumbs,
  .keygrid {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .thumbs li {
    width: 130px;
    border: 1px dashed var(--line-strong);
    border-radius: 7px;
    padding: 0.25rem;
    text-align: center;
    background: var(--panel);
  }
  .thumbs li.got {
    border-style: solid;
    border-color: var(--ok);
  }
  .thumbs .blank {
    display: block;
    line-height: 4.6rem;
    color: var(--mute);
    font-size: 1.4rem;
  }
  .cap {
    display: block;
    font-size: 0.72rem;
    color: var(--ink-2);
    line-height: 1.25;
  }
  .row {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .hinttext {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .key {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .keygrid li {
    width: min(100%, 235px);
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 0.3rem;
    background: var(--panel);
  }
  .keygrid li.got {
    border-color: var(--ok);
  }
  .builder {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 0.4rem 0.7rem;
    font-size: 0.85rem;
  }
  .builder summary {
    cursor: pointer;
    font-weight: 600;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.5rem;
  }
  .frow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: end;
  }
  .frow label {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.75rem;
    color: var(--mute);
  }
  .form h4 {
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .lines li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .lines button {
    padding: 0.1rem 0.5rem;
    min-height: 1.7rem;
  }
</style>
