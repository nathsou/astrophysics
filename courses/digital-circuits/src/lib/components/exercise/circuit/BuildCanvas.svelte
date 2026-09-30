<!--
  The exercise canvas: the schematic (Schematic.svelte, through a movable viewBox) under an editing overlay.
  It uses the bench editor's hit-testing, routing and operations (through EditorState), with a compact set of
  gestures: click a palette part and click the canvas to place it; drag a part to move it; drag from a pin to a
  pin to wire them; click a wire or part to select; drag the background to pan; Delete, R and the arrow keys
  work on the selection; everything can also be done from the lists under the canvas, without a pointer.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import Glyph from '$lib/bench/editor/Glyph.svelte';
  import { symbolFor } from '$lib/bench/symbols';
  import { boundsOf, getDef, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
  import type { Engine } from '$lib/sim/engine';
  import type { SubResolver } from '$lib/sim/netlist/connect';
  import { componentTransform, G, roundedPath, type Box } from '$lib/bench/geometry';
  import { hitTest, type Hit } from '$lib/bench/editor/hit';
  import { layoutOf, type Pt } from '$lib/bench/editor/layout';
  import { moveSelection, type Selection } from '$lib/bench/editor/ops';
  import { MAX_ZOOM, MIN_ZOOM, panBy, toGrid, toWorld, viewBox, zoomAt } from '$lib/bench/editor/view';
  import { routeL } from '$lib/bench/editor/route';
  import type { EditorState } from './editor.svelte';

  let { editor, parts, engine = null, label = 'Circuit editor', height = 340 }: { editor: EditorState; parts?: SubResolver; engine?: Engine | null; label?: string; height?: number } = $props();

  let board: HTMLDivElement | undefined = $state();
  let schematic: Schematic | undefined = $state();
  let width = $state(600);
  let hgt = $state(340);
  const vb = $derived(viewBox(editor.view, width, hgt));
  const resolve = $derived(editor.core.resolver());
  const layout = $derived(layoutOf(editor.shown, resolve));
  const pxPerGrid = $derived(editor.view.zoom * G);
  const sel = $derived(editor.selection);

  type Op =
    | { kind: 'move'; origin: Pt; downPx: Pt; id: string; moved: boolean }
    | { kind: 'wire'; from: Extract<Hit, { kind: 'pin' }>; downPx: Pt; moved: boolean }
    | { kind: 'pan'; last: Pt; downPx: Pt; moved: boolean };
  let op: Op | null = null;
  let hover = $state.raw<Hit | undefined>(undefined);
  let wireFrom = $state.raw<Extract<Hit, { kind: 'pin' }> | null>(null);
  let cursor = $state.raw<Pt | null>(null);
  let touchLast = false;

  const eventPoint = (ev: { clientX: number; clientY: number }): Pt => {
    const r = board!.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };
  const gridAt = (ev: { clientX: number; clientY: number }): Pt => {
    const [sx, sy] = eventPoint(ev);
    return toGrid(editor.view, sx, sy);
  };
  const snapPt = (g: Pt): Pt => [Math.round(g[0]), Math.round(g[1])];

  function hitAt(g: Pt): Hit | undefined {
    const k = touchLast ? 1.7 : 1;
    return hitTest(editor.shown, layout, g[0], g[1], { pinRadius: Math.max(0.5, (11 * k) / pxPerGrid), wireTolerance: Math.max(0.3, (6 * k) / pxPerGrid) });
  }

  // The part being placed: a ghost under the pointer.
  const ghost = $derived.by(() => {
    const type = editor.placing;
    const def = type ? getDef(type) : undefined;
    if (!type) return undefined;
    if (!def) return { type, sub: true as const, def: undefined, params: {}, pins: [], anchor: [3, 0] as Pt };
    const params = withDefaults(def, undefined);
    const b = boundsOf(def, params);
    return { type, sub: false as const, def, params, pins: pinsOf(def, params), anchor: [Math.round((b.x0 + b.x1) / 2), Math.round((b.y0 + b.y1) / 2)] as Pt };
  });
  let ghostPx = $state.raw<Pt | null>(null);

  function placeAt(s: Pt): void {
    const t = editor.placing;
    if (!t || !ghost) return;
    editor.place(t, [s[0] - ghost.anchor[0], s[1] - ghost.anchor[1]]);
  }

  function finishWire(from: Extract<Hit, { kind: 'pin' }>, to: Hit | undefined, g: Pt): void {
    wireFrom = null;
    if (to?.kind === 'pin') {
      if (to.comp === from.comp && to.pin === from.pin) return;
      editor.connect(`${from.comp}.${from.pin}`, `${to.comp}.${to.pin}`);
    } else if (to?.kind === 'wire') {
      editor.edit((c) => c.addWirePath(routeL([from.x, from.y], [to.x, to.y], 'h')));
    } else {
      const s = snapPt(g);
      if (s[0] !== from.x || s[1] !== from.y) editor.edit((c) => c.addWirePath(routeL([from.x, from.y], s, 'h')));
    }
  }

  function onPointerDown(ev: PointerEvent): void {
    touchLast = ev.pointerType === 'touch';
    board?.focus({ preventScroll: true });
    if (ev.button !== 0) return;
    const g = gridAt(ev);
    const downPx = eventPoint(ev);
    if (editor.placing) {
      placeAt(snapPt(g));
      if (!ev.shiftKey) editor.placing = null;
      return;
    }
    const hit = hitAt(g);
    board?.setPointerCapture(ev.pointerId);
    if (wireFrom) {
      // Second click of a click-click wire.
      const from = wireFrom;
      board?.releasePointerCapture(ev.pointerId);
      finishWire(from, hit, g);
      return;
    }
    if (hit?.kind === 'pin') {
      op = { kind: 'wire', from: hit, downPx, moved: false };
    } else if (hit?.kind === 'comp') {
      editor.select([hit.id]);
      op = { kind: 'move', origin: snapPt(g), downPx, id: hit.id, moved: false };
    } else if (hit?.kind === 'wire') {
      editor.select([], [hit.wire]);
    } else {
      editor.clearSelection();
      op = { kind: 'pan', last: downPx, downPx, moved: false };
    }
  }

  function onPointerMove(ev: PointerEvent): void {
    touchLast = ev.pointerType === 'touch';
    const p = eventPoint(ev);
    const g = gridAt(ev);
    ghostPx = p;
    cursor = snapPt(g);
    if (!op) {
      hover = editor.placing ? undefined : hitAt(g);
      return;
    }
    const dist = Math.hypot(p[0] - op.downPx[0], p[1] - op.downPx[1]);
    if (!op.moved && dist < 4) return;
    op.moved = true;
    if (op.kind === 'pan') {
      editor.view = panBy(editor.view, p[0] - op.last[0], p[1] - op.last[1]);
      op.last = p;
    } else if (op.kind === 'move') {
      const s = snapPt(g);
      const dx = s[0] - op.origin[0];
      const dy = s[1] - op.origin[1];
      const next = dx || dy ? moveSelection(editor.circuit, editor.selection, dx, dy, resolve) : editor.circuit;
      editor.draft = next === editor.circuit ? null : next;
    } else if (op.kind === 'wire') {
      wireFrom = op.from;
    }
  }

  function onPointerUp(ev: PointerEvent): void {
    try {
      board?.releasePointerCapture(ev.pointerId);
    } catch {
      /* not captured */
    }
    const o = op;
    op = null;
    if (!o) return;
    const g = gridAt(ev);
    if (o.kind === 'move') {
      if (o.moved && editor.draft) {
        const s = snapPt(g);
        editor.edit((c) => c.nudgeSelectionTo(s[0] - o.origin[0], s[1] - o.origin[1]));
      } else editor.draft = null;
    } else if (o.kind === 'wire') {
      if (o.moved) finishWire(o.from, hitAt(g), g);
      else wireFrom = o.from; // a click on a pin: the wire follows the pointer until the next click
    }
  }

  function onLeave(): void {
    hover = undefined;
    ghostPx = null;
    cursor = null;
  }

  function cancel(): boolean {
    if (editor.placing) editor.placing = null;
    else if (wireFrom) wireFrom = null;
    else if (op) {
      op = null;
      editor.draft = null;
    } else if (editor.selection.ids.size || editor.selection.wires.size) editor.clearSelection();
    else return false;
    return true;
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.defaultPrevented) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const n = ev.shiftKey ? 4 : 1;
    const eat = () => ev.preventDefault();
    if (mod && key === 'z') return (eat(), ev.shiftKey ? editor.redo() : editor.undo());
    if (mod && key === 'y') return (eat(), editor.redo());
    if (mod) return;
    if (key === 'Escape') {
      if (cancel()) eat();
    } else if (key === 'Delete' || key === 'Backspace') (eat(), editor.remove());
    else if (key === 'r') (eat(), editor.rotate());
    else if (key === 'f') (eat(), editor.mirror());
    else if (key === '+' || key === '=') (eat(), zoom(1.25));
    else if (key === '-') (eat(), zoom(1 / 1.25));
    else if (key === '0') (eat(), editor.fit());
    else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
      eat();
      const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
      const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
      if (editor.selection.ids.size || editor.selection.wires.size) editor.nudge(dx * n, dy * n);
      else editor.view = panBy(editor.view, -dx * 60 * n, -dy * 60 * n);
    }
  }

  function zoom(f: number): void {
    editor.view = zoomAt(editor.view, width / 2, hgt / 2, f);
  }
  function onWheel(ev: WheelEvent): void {
    // Only with Ctrl (or a pinch): a plain wheel scrolls the page, as readers expect in a chapter.
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    const [sx, sy] = eventPoint(ev);
    editor.view = zoomAt(editor.view, sx, sy, Math.exp(-ev.deltaY * 0.01));
  }

  onMount(() => {
    const el = board!;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      width = entry.contentRect.width;
      hgt = entry.contentRect.height;
      editor.resized(width, hgt);
    });
    ro.observe(el);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  });

  const boxPx = (b: Box, m = 0) => ({ x: b.x0 * G - m, y: b.y0 * G - m, w: (b.x1 - b.x0) * G + 2 * m, h: (b.y1 - b.y0) * G + 2 * m });
  const selectedComps = $derived(layout.comps.filter((l) => sel.ids.has(l.c.id)));
  const hoverComp = $derived(hover?.kind === 'comp' ? layout.byId.get(hover.id) : hover?.kind === 'pin' ? layout.byId.get(hover.comp) : undefined);
  const pinShown = $derived(wireFrom || editor.tool === 'wire' ? layout.comps : layout.comps.filter((l) => sel.ids.has(l.c.id) || l === hoverComp));
  const preview = $derived.by(() => {
    const from = wireFrom;
    if (!from) return '';
    const to = cursor ?? [from.x, from.y];
    return roundedPath(routeL([from.x, from.y], to as Pt, 'h'));
  });
  const hint = $derived(editor.placing ? 'Click to place. Esc cancels, Shift keeps placing.' : wireFrom ? 'Click another pin to finish the wire. Esc cancels.' : '');
  const cursorStyle = $derived(editor.placing || wireFrom ? 'crosshair' : hover?.kind === 'comp' ? 'move' : hover?.kind === 'pin' ? 'crosshair' : hover?.kind === 'wire' ? 'pointer' : 'default');
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="board"
  bind:this={board}
  style:height="{height}px"
  style:cursor={cursorStyle}
  tabindex="0"
  role="application"
  aria-label="{label}. Arrow keys move the selection or pan the view; R rotates, Delete removes, Escape cancels. The lists below the canvas do the same without a pointer."
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={() => ((op = null), (editor.draft = null))}
  onpointerleave={onLeave}
  onkeydown={onKeyDown}
  oncontextmenu={(ev) => ev.preventDefault()}
>
  <svg class="grid" aria-hidden="true" viewBox="{vb.x0} {vb.y0} {vb.x1 - vb.x0} {vb.y1 - vb.y0}" preserveAspectRatio="none">
    <defs>
      <pattern id="bc-dots" width={G} height={G} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r={pxPerGrid > 9 ? 0.9 : 0.6} class="dot" /></pattern>
    </defs>
    {#if pxPerGrid >= 6}<rect x={vb.x0} y={vb.y0} width={vb.x1 - vb.x0} height={vb.y1 - vb.y0} fill="url(#bc-dots)" />{/if}
  </svg>

  <Schematic bind:this={schematic} circuit={editor.shown} {engine} {parts} mode="logic" interactive={false} live={!!engine} fill viewBox={vb} {label} />

  <svg class="overlay" viewBox="{vb.x0} {vb.y0} {vb.x1 - vb.x0} {vb.y1 - vb.y0}" preserveAspectRatio="none" aria-hidden="true">
    {#each sel.wires as wi (wi)}
      {@const w = editor.shown.wires[wi]}
      {#if w}<path class="sel-wire" d={roundedPath(w.points as Pt[])} />{/if}
    {/each}
    {#each selectedComps as l (l.c.id)}
      {@const b = boxPx(l.box, 4)}
      <rect class="sel" x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
    {/each}
    {#if hoverComp && !selectedComps.includes(hoverComp) && !editor.placing}
      {@const b = boxPx(hoverComp.box, 3)}
      <rect class="hover-box" x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
    {/if}
    {#each pinShown as l (l.c.id)}
      {#each l.pins as p (p.pin)}<circle class="pin" cx={p.x * G} cy={p.y * G} r="3" />{/each}
    {/each}
    {#if hover?.kind === 'pin'}<circle class="pin-hover" cx={hover.x * G} cy={hover.y * G} r="7" />{/if}
    {#if wireFrom}
      <path class="draft" d={preview} />
      <circle class="draft-dot" cx={wireFrom.x * G} cy={wireFrom.y * G} r="3.2" />
      {#if hover?.kind === 'pin'}<circle class="pin-hover" cx={hover.x * G} cy={hover.y * G} r="7" />{/if}
    {/if}
    {#if ghost && ghostPx}
      {@const gw = toWorld(editor.view, ghostPx[0], ghostPx[1])}
      {@const s = snapPt([gw[0] / G, gw[1] / G])}
      {#if ghost.def}
        {@const Sym = symbolFor(ghost.type)}
        <g class="ghost" transform={componentTransform({ x: s[0] - ghost.anchor[0], y: s[1] - ghost.anchor[1] })}>
          <Sym id="" type={ghost.type} def={ghost.def} params={ghost.params} pins={ghost.pins} state={{}} rot={0} flip={false} uid="ghost" />
        </g>
      {:else}
        <circle class="pin-hover" cx={s[0] * G} cy={s[1] * G} r="9" />
      {/if}
    {/if}
  </svg>

  {#if hint}<div class="banner ui" role="status">{hint}</div>{/if}

  <div class="zoom ui" role="group" aria-label="View">
    <button type="button" onclick={() => zoom(1 / 1.25)} aria-label="Zoom out" title="Zoom out (−)"><Glyph name="minus" size={15} /></button>
    <button type="button" onclick={() => zoom(1.25)} aria-label="Zoom in" title="Zoom in (+)"><Glyph name="plus" size={15} /></button>
    <button type="button" onclick={() => editor.fit()} aria-label="Fit the circuit to the view" title="Fit (0)"><Glyph name="fit" size={15} /></button>
  </div>
</div>

<style>
  .board {
    position: relative;
    overflow: hidden;
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  .board:focus-visible {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 60%, transparent);
  }
  .grid,
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }
  .dot {
    fill: color-mix(in srgb, var(--fg) 26%, transparent);
  }
  .overlay {
    --_edit: var(--focus);
  }
  .sel {
    fill: color-mix(in srgb, var(--_edit) 9%, transparent);
    stroke: var(--_edit);
    stroke-width: 1.4;
  }
  .hover-box {
    fill: none;
    stroke: color-mix(in srgb, var(--_edit) 55%, transparent);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .sel-wire {
    fill: none;
    stroke: var(--_edit);
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.32;
  }
  .pin {
    fill: var(--panel);
    stroke: var(--_edit);
    stroke-width: 1.4;
  }
  .pin-hover {
    fill: color-mix(in srgb, var(--_edit) 18%, transparent);
    stroke: var(--_edit);
    stroke-width: 1.6;
  }
  .draft {
    fill: none;
    stroke: var(--_edit);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 5 3;
  }
  .draft-dot {
    fill: var(--_edit);
  }
  .ghost {
    opacity: 0.6;
  }
  .banner {
    position: absolute;
    left: 50%;
    top: 0.5rem;
    transform: translateX(-50%);
    max-width: calc(100% - 1rem);
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow);
    font-size: 0.78rem;
    color: var(--ink-2);
    pointer-events: none;
    text-align: center;
  }
  .zoom {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    display: flex;
    gap: 0.1rem;
    padding: 0.15rem;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }
  .zoom button {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    background: none;
    border-radius: 6px;
    color: var(--ink-2);
    cursor: pointer;
  }
  .zoom button:hover {
    background: var(--pn);
    color: var(--fg);
  }
</style>
