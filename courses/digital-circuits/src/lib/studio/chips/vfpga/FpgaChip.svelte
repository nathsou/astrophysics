<!--
  The vFPGA chip view: the die on a Canvas 2D, with semantic zoom (chip → tile → logic cell, and the routing
  channels between tiles). Pan with the pointer, zoom with the wheel, two fingers or the buttons; the arrow keys
  move between tiles. A click selects a cell, a wire (its net) or a tile; the selection is shared with every pane.
  In the replay modes the same canvas shows the placer's blocks sliding into place, or the routers's congestion.
-->
<script lang="ts">
  import '../chip.css';
  import { onMount, untrack } from 'svelte';
  import { TILE_BRAM, TILE_IO, TILE_LOGIC } from '../../../pld/devices/vfpga';
  import { LCS_PER_TILE } from '../../../pld/devices/vfpga-arch';
  import { onThemeChange, readSignals, type Signals } from '../../../theme/signals';
  import { render, moduleColour } from '../../fpga/draw';
  import { TILE, cellAt, cellRect, center, dieGeom, fitRect, lutBitAt, neighbourTile, pinAt, switchBoxRect, tileAt, tileRect, toWorld, visibleRect, wireAt, zoomAt, zoomFor, zoomLevel, type View } from '../../fpga/geometry';
  import { placeFrame } from '../../fpga/replay';
  import { hex4 } from '../../fpga/lut';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import type { FpgaRef } from '../../fpga/types';
  import Icon from '../../../components/ui/Icon.svelte';

  let {
    session,
    view: kind = 'design',
    compact = false,
    handEdits = false,
  }: {
    session: FpgaSession;
    /** `design`: the configured chip; `place`, `route`: the replays. */
    view?: 'design' | 'place' | 'route';
    compact?: boolean;
    /** Clicking LUT bits and pins edits the configuration (by hand). */
    handEdits?: boolean;
  } = $props();

  const model = $derived(session.chipModel);
  const g = $derived(model ? dieGeom(model.device) : null);
  let box: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(600);
  let height = $state(400);
  let view = $state<View>({ k: 0.2, tx: 0, ty: 0 });
  let moved = false;
  let fitted = false;
  let sig: Signals | undefined;
  let themeTick = $state(0);
  let cursor = $state<{ x: number; y: number } | null>(null);
  let focused = $state(false);
  let tip = $state<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  let layers = $state({ wires: true, modules: true, critical: true });
  let raf = 0;

  let routingFocus = $state(false);
  const level = $derived(zoomLevel(view.k));
  const levelName = $derived(routingFocus ? 'routing' : level === 'chip' ? 'chip' : level === 'tile' ? 'tile' : 'logic cell');
  const sim = $derived(kind === 'design' && session.mode === 'design' ? session.run.sim : null);
  const replay = $derived.by(() => {
    const r = session.result;
    if (kind !== 'place' || !r) return null;
    return { frame: placeFrame(r.place, session.replay.pos), place: r.place, showLinks: session.replay.links };
  });
  const congestion = $derived(kind === 'route' ? session.routeCongestion() : null);
  const wheelNeedsModifier = $derived(compact);

  // ── Fitting and zooming ─────────────────────────────────────────────
  function fitAll() {
    if (!g) return;
    const k = zoomFor('chip', g, width, height);
    view = { k, tx: (width - g.width * k) / 2 + 4 * k, ty: (height - g.height * k) / 2 + g.ch * k * 0.4 };
    moved = false;
    routingFocus = false;
  }
  function focusRect(r: { x: number; y: number; w: number; h: number }, pad = 16, maxK = 30) {
    view = fitRect(r, width, height, pad, maxK);
    moved = true;
  }
  /** The tile to zoom into: the cursor, the selected tile or cell, or the first configured cell. */
  function subject(): { x: number; y: number; k?: number } | null {
    const m = model;
    if (!m) return null;
    if (cursor) return cursor;
    const sel = session.selected;
    if (sel?.kind === 'cell') return { x: sel.x, y: sel.y, k: sel.k };
    if (sel?.kind === 'tile') return sel;
    const c = [...session.probe.cells][0];
    if (c) {
      const [x, y, k] = c.split(',').map(Number) as [number, number, number];
      return { x, y, k };
    }
    const first = m.used.entries().next().value;
    if (first) return { x: m.device.tileX(first[0]), y: m.device.tileY(first[0]), k: first[1].findIndex((v) => v === 1) };
    return { x: 1, y: 1 };
  }
  function goto(l: 'chip' | 'tile' | 'cell' | 'routing') {
    if (!g) return;
    routingFocus = false;
    if (l === 'chip') return fitAll();
    const s = subject();
    if (!s) return;
    if (l === 'tile') return focusRect(tileRect(g, s.x, s.y), 24);
    if (l === 'cell') {
      const k = s.k !== undefined && s.k >= 0 ? s.k : 0;
      if (handEdits) session.selected = { kind: 'cell', x: s.x, y: s.y, k };
      return focusRect(cellRect(g, s.x, s.y, k), 18, 30);
    }
    const sb = switchBoxRect(g, s.x, s.y);
    routingFocus = true;
    focusRect({ x: sb.x - g.ch * 0.8, y: sb.y - g.ch * 0.8, w: sb.w + g.ch * 1.6, h: sb.h + g.ch * 1.6 }, 12, 30);
  }
  function zoomBy(f: number, cx = width / 2, cy = height / 2) {
    view = zoomAt(view, f, cx, cy);
    moved = true;
    routingFocus = false;
  }

  // ── Painting ────────────────────────────────────────────────────────
  function paint() {
    raf = 0;
    const c = canvas;
    const m = model;
    if (!c || !m) return;
    sig ??= readSignals(c);
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.floor(width * dpr) || c.height !== Math.floor(height * dpr)) {
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    render(ctx, {
      model: m,
      view,
      width,
      height,
      dpr,
      sig,
      probe: session.probe,
      hover: session.hoverProbe,
      cursor: focused ? cursor : null,
      sim,
      layers,
      replay,
      congestion,
      node: handEdits ? session.hand.node : null,
      editable: handEdits,
    });
  }
  $effect(() => {
    // Everything the painter reads, so a change repaints.
    void [model, view, width, height, session.probe, session.hoverProbe, cursor, focused, sim, session.run.tick, layers.wires, layers.modules, layers.critical, replay, congestion, themeTick, handEdits ? session.hand.node : 0];
    if (!raf) raf = requestAnimationFrame(paint);
  });

  // A new device or configuration: start from the whole chip (unless the reader has moved it).
  $effect(() => {
    const m = model;
    void [width, height];
    if (!m || width < 10) return;
    untrack(() => {
      if (!fitted || !moved) {
        fitAll();
        fitted = true;
      }
    });
  });
  let lastDevice: unknown;
  $effect(() => {
    const d = model?.device;
    if (d !== lastDevice) {
      lastDevice = d;
      moved = false;
      cursor = null;
    }
  });

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (!box) return;
      const r = box.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        width = r.width;
        height = r.height;
      }
    });
    if (box) ro.observe(box);
    const off = onThemeChange(() => {
      sig = undefined;
      themeTick++;
    });
    return () => {
      ro.disconnect();
      off();
      cancelAnimationFrame(raf);
    };
  });

  // ── Hit testing ─────────────────────────────────────────────────────
  interface Hit {
    ref: FpgaRef | null;
    title: string;
    lines: string[];
    node?: number;
    bit?: { x: number; y: number; k: number; row: number };
    tile?: { x: number; y: number };
    cell?: { x: number; y: number; k: number };
  }

  function hitAt(sx: number, sy: number): Hit | null {
    const m = model;
    const gg = g;
    if (!m || !gg) return null;
    const w = toWorld(view, sx, sy);
    const d = m.device;
    const tile = tileAt(gg, w.x, w.y);
    if (tile) {
      const kindHere = d.tileKind[d.tid(tile.x, tile.y)]!;
      if (kind !== 'design') return { ref: null, title: `Tile (${tile.x}, ${tile.y})`, lines: [], tile };
      if (kindHere === TILE_LOGIC && level !== 'chip') {
        const k = cellAt(gg, tile.x, tile.y, w.x, w.y);
        if (handEdits && level === 'cell') {
          const pin = pinAt(gg, tile.x, tile.y, w.x, w.y, 3 + 5 / view.k);
          if (pin >= 0) return { ref: null, title: d.nodeName(pin), lines: ['Click to choose what drives it'], node: pin, tile };
        }
        if (k >= 0) {
          const key = `${tile.x},${tile.y},${k}`;
          const used = m.used.get(d.tid(tile.x, tile.y))?.[k] === 1;
          const r = cellRect(gg, tile.x, tile.y, k);
          const bitRow = level === 'cell' && used ? lutBitAt(r, w.x, w.y) : -1;
          const lines: string[] = [];
          const ci = session.result?.cellIndex[key];
          const c = ci === undefined ? undefined : session.result!.cells[ci];
          if (c) lines.push(`${c.kind} · ${c.label}`, `LUT ${hex4(c.truth)}`, ...c.sourceIds.slice(0, 3));
          else lines.push(used ? 'configured' : 'unused');
          if (bitRow >= 0) lines.unshift(`LUT bit ${bitRow}${handEdits ? ' (click to flip)' : ''}`);
          return { ref: { kind: 'cell', x: tile.x, y: tile.y, k }, title: `LC(${key})`, lines, cell: { x: tile.x, y: tile.y, k }, bit: bitRow >= 0 ? { x: tile.x, y: tile.y, k, row: bitRow } : undefined, tile };
        }
      }
      if (handEdits && (kindHere === TILE_IO) && level !== 'chip') {
        const pin = pinAt(gg, tile.x, tile.y, w.x, w.y, 12 + 6 / view.k);
        if (pin >= 0) return { ref: null, title: d.nodeName(pin), lines: ['Click to set the pad or choose its driver'], node: pin, tile };
      }
      const label = kindHere === TILE_LOGIC ? 'Logic tile' : kindHere === TILE_IO ? 'I/O tile' : kindHere === TILE_BRAM ? 'Block RAM' : 'Tile';
      const ports = kindHere === TILE_IO ? [...Array(d.spec.padsPerTile).keys()].map((s) => m.padPort.get(d.padAt(tile.x, tile.y, s))).filter(Boolean) : [];
      const use = m.used.get(d.tid(tile.x, tile.y))?.reduce((a, v) => a + v, 0) ?? 0;
      return { ref: { kind: 'tile', x: tile.x, y: tile.y }, title: `${label} (${tile.x}, ${tile.y})`, lines: kindHere === TILE_LOGIC ? [`${use} of ${LCS_PER_TILE} cells configured`] : ports.map(String), tile };
    }
    {
      const n = wireAt(gg, w.x, w.y, 2.5 / view.k, (x) => m.wireNet.has(x));
      if (n >= 0) {
        const net = m.wireNet.get(n);
        if (net !== undefined && net >= 0 && session.result) {
          const np = session.result.nets[net]!;
          return { ref: { kind: 'net', net }, title: `Net ${np.name}`, lines: [`${np.nodes.length} routing nodes`, d.nodeName(n)], node: n };
        }
        return { ref: null, title: d.nodeName(n), lines: [m.wireNet.has(n) ? 'routed' : 'unused wire'], node: n };
      }
    }
    return null;
  }

  // ── Pointer ─────────────────────────────────────────────────────────
  const pointers = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; id: number } | null = null;
  let pinch: { d: number; k: number } | null = null;

  function local(ev: PointerEvent | WheelEvent | MouseEvent) {
    const r = canvas!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  function onpointerdown(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    pointers.set(ev.pointerId, local(ev));
    if (pointers.size === 1) {
      down = { ...local(ev), id: ev.pointerId };
      moved2 = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), k: view.k };
      moved2 = true;
    }
    canvas?.focus({ preventScroll: true });
  }
  let moved2 = false;
  function onpointermove(ev: PointerEvent) {
    const p = local(ev);
    const prev = pointers.get(ev.pointerId);
    if (!prev) {
      const h = hitAt(p.x, p.y);
      session.hover(h?.ref ?? null);
      tip = h ? { x: p.x, y: p.y, title: h.title, lines: h.lines } : null;
      return;
    }
    if (pointers.size === 2 && pinch) {
      pointers.set(ev.pointerId, p);
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const target = pinch.k * (dist / pinch.d);
      zoomBy(target / view.k, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      return;
    }
    if (down && !moved2 && Math.hypot(p.x - down.x, p.y - down.y) > 5) {
      moved2 = true;
      try {
        canvas?.setPointerCapture(ev.pointerId);
      } catch {
        /* the pointer is gone */
      }
    }
    if (moved2 && pointers.size === 1) {
      view = { ...view, tx: view.tx + (p.x - prev.x), ty: view.ty + (p.y - prev.y) };
      moved = true;
      routingFocus = false;
      tip = null;
    }
    pointers.set(ev.pointerId, p);
  }
  function onpointerup(ev: PointerEvent) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (down && down.id === ev.pointerId) {
      if (!moved2) click(local(ev));
      down = null;
    }
  }
  function onpointerleave() {
    session.hover(null);
    tip = null;
  }
  function onwheel(ev: WheelEvent) {
    if (wheelNeedsModifier && !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const p = local(ev);
    zoomBy(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016)), p.x, p.y);
  }
  $effect(() => {
    const c = canvas;
    if (!c) return;
    c.addEventListener('wheel', onwheel, { passive: false });
    return () => c.removeEventListener('wheel', onwheel);
  });

  function click(p: { x: number; y: number }) {
    const h = hitAt(p.x, p.y);
    if (!h) {
      session.select(null);
      return;
    }
    if (handEdits) {
      if (h.bit) {
        session.hand.edit((d) => d.toggleLutBit(h.bit!.x, h.bit!.y, h.bit!.k, h.bit!.row));
        session.selected = { kind: 'cell', x: h.bit.x, y: h.bit.y, k: h.bit.k };
        return;
      }
      if (h.node !== undefined) {
        session.hand.node = h.node;
        return;
      }
      if (h.cell) {
        session.selected = { kind: 'cell', ...h.cell };
        return;
      }
    }
    if (h.ref) session.select(h.ref);
    if (h.tile) cursor = h.tile;
  }

  // ── Keyboard ────────────────────────────────────────────────────────
  let live = $state('');
  function onkeydown(ev: KeyboardEvent) {
    const gg = g;
    if (!gg || !model) return;
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const dir = dirs[ev.key];
    if (dir && !ev.shiftKey) {
      const from = cursor ?? subject() ?? { x: 1, y: 1 };
      const next = neighbourTile(gg, from.x, from.y, dir[0], dir[1]);
      cursor = next;
      // Keep it in view.
      const r = tileRect(gg, next.x, next.y);
      const vis = visibleRect(view, width, height);
      if (r.x < vis.x || r.y < vis.y || r.x + r.w > vis.x + vis.w || r.y + r.h > vis.y + vis.h) {
        const c = center(r);
        view = { ...view, tx: width / 2 - c.x * view.k, ty: height / 2 - c.y * view.k };
        moved = true;
      }
      const d = model.device;
      const use = model.used.get(d.tid(next.x, next.y))?.reduce((a, v) => a + v, 0) ?? 0;
      live = `Tile ${next.x}, ${next.y}: ${['empty', 'logic', 'I/O', 'block RAM'][d.tileKind[d.tid(next.x, next.y)]!]}${use ? `, ${use} cells configured` : ''}`;
      ev.preventDefault();
      return;
    }
    switch (ev.key) {
      case 'Enter':
      case ' ':
        if (cursor) session.select({ kind: 'tile', x: cursor.x, y: cursor.y });
        break;
      case '+':
      case '=':
        zoomBy(1.3);
        break;
      case '-':
      case '_':
        zoomBy(1 / 1.3);
        break;
      case '0':
        fitAll();
        break;
      case '1':
        goto('chip');
        break;
      case '2':
        goto('tile');
        break;
      case '3':
        goto('cell');
        break;
      case '4':
        goto('routing');
        break;
      case 'Escape':
        session.select(null);
        break;
      default:
        if (ev.shiftKey && dir) {
          view = { ...view, tx: view.tx - dir[0] * 60, ty: view.ty + dir[1] * 60 };
          moved = true;
          break;
        }
        return;
    }
    ev.preventDefault();
  }

  const modules = $derived(model?.modules ?? []);
  const showLegend = $derived(kind === 'design' && modules.length > 1 && layers.modules);
</script>

<div class="fc">
  <div class="bar ui" role="toolbar" aria-label="Chip view controls">
    {#if kind === 'design'}
      <div class="seg" role="group" aria-label="Zoom to">
        {#each [['chip', 'Chip'], ['tile', 'Tile'], ['cell', 'Logic cell'], ['routing', 'Routing']] as [id, label] (id)}
          <button type="button" class:on={routingFocus ? id === 'routing' : (id === 'chip' && level === 'chip') || (id === 'tile' && level === 'tile') || (id === 'cell' && level === 'cell')} onclick={() => goto(id as 'chip')}>{label}</button>
        {/each}
      </div>
      <span class="grow"></span>
      <label title="Draw every wire lane of the channels"><input type="checkbox" bind:checked={layers.wires} /> wires</label>
      {#if modules.length > 1}<label title="Tint cells by the module they implement"><input type="checkbox" bind:checked={layers.modules} /> modules</label>{/if}
      <label title="Highlight the critical path"><input type="checkbox" bind:checked={layers.critical} /> critical path</label>
    {:else}
      <span class="lvl">{kind === 'place' ? 'Placement' : 'Routing congestion'}</span>
      <span class="grow"></span>
    {/if}
    <span class="zl" aria-live="polite">zoom: {levelName}</span>
  </div>
  <div class="die screen stage" bind:this={box}>
    {#if model}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_no_interactive_element_to_noninteractive_role -->
      <canvas
        bind:this={canvas}
        tabindex="0"
        role="application"
        aria-label="vFPGA chip view. Drag to pan, scroll or plus and minus to zoom, arrow keys move between tiles, 1 to 4 zoom to chip, tile, logic cell and routing."
        {onpointerdown}
        {onpointermove}
        {onpointerup}
        onpointercancel={onpointerup}
        {onpointerleave}
        {onkeydown}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
      ></canvas>
      <div class="ctl" role="group" aria-label="Zoom">
        <button type="button" onclick={() => zoomBy(1.4)} aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button type="button" onclick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out (−)">−</button>
        <button type="button" onclick={fitAll} aria-label="Fit the whole chip" title="Fit (0)"><Icon name="fullscreen" size={13} /></button>
      </div>
      {#if showLegend}
        <ul class="legend">
          {#each modules as mod, i (mod)}
            <li><button type="button" onclick={() => session.select({ kind: 'module', path: mod })} class:sel={session.probe.modules.has(mod) && session.selected?.kind === 'module'}><i style:background={moduleColour(i)}></i>{mod}</button></li>
          {/each}
        </ul>
      {/if}
      {#if tip}
        <div class="tip" style:left="{Math.min(tip.x + 14, width - 190)}px" style:top="{Math.min(tip.y + 16, height - 24 - tip.lines.length * 15)}px" role="tooltip">
          <strong>{tip.title}</strong>
          {#each tip.lines as l, i (i)}<span>{l}</span>{/each}
        </div>
      {/if}
      <p class="sr" aria-live="polite">{live}</p>
    {:else}
      <p class="empty ui">{session.status === 'running' ? 'Fitting the design…' : session.error ? 'The design did not fit: see the source pane.' : 'Fit a design to see it on the chip.'}</p>
    {/if}
  </div>
</div>

<style>
  .fc {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--panel);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.6rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .bar label {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    cursor: pointer;
  }
  .grow {
    flex: 1;
  }
  .lvl {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--copper-ink);
  }
  .zl {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .seg {
    display: inline-flex;
    gap: 2px;
  }
  .seg button {
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.72rem;
    padding: 0.12rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
  }
  .seg button.on {
    border-color: var(--copper);
    color: var(--copper-ink);
    font-weight: 600;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 12rem;
    border-radius: 0;
    touch-action: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    display: block;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  canvas:active {
    cursor: grabbing;
  }
  canvas:focus-visible {
    box-shadow: inset 0 0 0 2px var(--focus);
  }
  .ctl {
    position: absolute;
    right: 0.6rem;
    bottom: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 5;
  }
  .ctl button {
    width: 1.9rem;
    height: 1.9rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--metal-dim);
    border-radius: 6px;
    background: color-mix(in srgb, #05070d 80%, transparent);
    color: var(--die-ink);
    font-family: var(--font-mono);
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
  }
  .ctl button:hover {
    border-color: var(--metal);
    color: var(--metal);
  }
  .legend {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    margin: 0;
    padding: 0.25rem 0.4rem;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 0.6rem;
    max-width: calc(100% - 4rem);
    background: color-mix(in srgb, #05070d 78%, transparent);
    border: 1px solid var(--metal-dim);
    border-radius: 6px;
    font-size: 0.68rem;
  }
  .legend button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 0;
    background: transparent;
    color: var(--die-ink);
    font: inherit;
    cursor: pointer;
    padding: 0.05rem 0.15rem;
  }
  .legend button.sel {
    outline: 1px solid var(--sel);
    border-radius: 3px;
  }
  .legend i {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 2px;
    display: inline-block;
  }
  .tip {
    position: absolute;
    z-index: 6;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 0.3rem 0.5rem;
    max-width: 18rem;
    background: color-mix(in srgb, #05070d 90%, transparent);
    border: 1px solid var(--metal-dim);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--die-ink);
  }
  .tip strong {
    color: var(--metal);
    font-weight: 600;
  }
  .tip span {
    color: var(--die-ink-2);
    overflow-wrap: anywhere;
  }
  .empty {
    margin: 1rem;
    color: var(--die-ink-2);
    font-size: 0.85rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
