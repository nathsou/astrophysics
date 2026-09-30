<!--
  The bench canvas: the running schematic (Schematic.svelte, drawn through a movable viewBox) under an
  editing overlay. Pointer, keyboard and touch handling live here; every change goes through the Bench.

  Pointer: drag a part to move it (wires follow); drag from a pin, or with the wire tool click, to draw a
  wire (L-shaped routing, click to add corners, click a pin or wire to finish, double-click or Enter to
  end in the open); drag a wire segment sideways to adjust it; drag on the background to select several
  parts; space-drag, middle-drag or a two-finger drag pans; wheel or pinch zooms.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Schematic from '../Schematic.svelte';
  import { symbolFor } from '../symbols';
  import { boundsOf, getDef, pinsOf, withDefaults } from '../../sim/netlist/catalog';
  import type { Rot } from '../../sim/netlist/types';
  import { componentTransform, G, roundedPath, type Box } from '../geometry';
  import { hitTest, type Hit } from './hit';
  import { layoutOf, type Pt } from './layout';
  import { autoRoute, lastAxis, pinAxis, type Axis } from './route';
  import { freeOffset, moveSegment, moveSelection, selectInBox, type Selection } from './ops';
  import { MAX_ZOOM, MIN_ZOOM, panBy, toGrid, toWorld, viewBox, zoomAt } from './view';
  import { probeFromHit, probePoint } from '../instruments/probes';
  import { EXAMPLES } from './examples';
  import Glyph from './Glyph.svelte';
  import type { Bench } from './bench.svelte';

  let { bench, onhelp }: { bench: Bench; onhelp?: () => void } = $props();

  let board: HTMLDivElement | undefined = $state();
  let schematic: Schematic | undefined = $state();
  let width = $state(900);
  let height = $state(600);

  const vb = $derived(viewBox(bench.view, width, height));
  const layout = $derived(layoutOf(bench.shown));
  const sel = $derived(bench.selection);
  const pxPerGrid = $derived(bench.view.zoom * G);

  // ── Pointer state ────────────────────────────────────────────────────────
  type Op =
    | { kind: 'move'; origin: Pt; downPx: Pt; hit: Extract<Hit, { kind: 'comp' }>; moved: boolean; selection: Selection; wasSelected: boolean; extend: boolean }
    | { kind: 'seg'; wire: number; seg: number; horizontal: boolean; origin: Pt; downPx: Pt; moved: boolean }
    | { kind: 'pin'; pin: Extract<Hit, { kind: 'pin' }>; downPx: Pt; moved: boolean }
    | { kind: 'marquee'; a: Pt; downPx: Pt; moved: boolean; extend: boolean; touch: boolean }
    | { kind: 'pan'; last: Pt };
  let op: Op | null = null;
  const pointers = new Map<number, Pt>();
  let pinch: { d0: number; c0: Pt; zoom0: number; world0: Pt } | null = null;
  let spaceDown = $state(false);
  let panning = $state(false);

  let hover = $state.raw<Hit | undefined>(undefined);
  let marquee = $state.raw<Box | null>(null);
  let cursorS = $state.raw<Pt | null>(null);
  let ghostPx = $state.raw<Pt | null>(null);
  let placingRot = $state<Rot>(0);
  let placingFlip = $state(false);
  let touchLast = false;

  interface Draft {
    pts: Pt[];
    /** Axis to route the first segment along (from the start pin). */
    first: Axis;
    swap: boolean;
  }
  let draft = $state.raw<Draft | null>(null);

  const eventPoint = (ev: { clientX: number; clientY: number }): Pt => {
    const r = board!.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };
  const gridAt = (ev: { clientX: number; clientY: number }): Pt => {
    const [sx, sy] = eventPoint(ev);
    return toGrid(bench.view, sx, sy);
  };
  const snapPt = (g: Pt): Pt => [Math.round(g[0]), Math.round(g[1])];

  function hitAt(g: Pt, options: { points?: boolean } = {}): Hit | undefined {
    const k = touchLast ? 1.6 : 1;
    return hitTest(bench.shown, layout, g[0], g[1], {
      pinRadius: Math.max(0.45, (10 * k) / pxPerGrid),
      wireTolerance: Math.max(0.3, (6 * k) / pxPerGrid),
      points: options.points,
    });
  }

  // ── Placing ──────────────────────────────────────────────────────────────
  const ghost = $derived.by(() => {
    const type = bench.placing;
    const def = type ? getDef(type) : undefined;
    if (!type || !def) return undefined;
    const params = withDefaults(def, undefined);
    const b = boundsOf(def, params);
    return { type, def, params, pins: pinsOf(def, params), anchor: [Math.round((b.x0 + b.x1) / 2), Math.round((b.y0 + b.y1) / 2)] as Pt };
  });

  /** Origin of the part being placed when the pointer is at grid point s: the part is centred on it. */
  function placeOrigin(s: Pt): Pt {
    const a = ghost?.anchor ?? [0, 0];
    // The anchor turns with the part.
    let [ax, ay] = placingFlip ? [-a[0], a[1]] : a;
    for (let r = 0; r < placingRot; r += 90) [ax, ay] = [-ay, ax];
    return [s[0] - ax, s[1] - ay];
  }

  $effect(() => {
    // A new part to place starts upright.
    void bench.placing;
    placingRot = 0;
    placingFlip = false;
  });

  export function placeAtCentre(type: string): void {
    const [gx, gy] = toGrid(bench.view, width / 2, height / 2);
    const def = getDef(type);
    if (!def) return;
    const b = boundsOf(def, withDefaults(def, undefined));
    const s = snapPt([gx, gy]);
    const x = s[0] - Math.round((b.x0 + b.x1) / 2);
    const y = s[1] - Math.round((b.y0 + b.y1) / 2);
    // Parts placed from the keyboard step aside from whatever is already in the middle.
    const [ox, oy] = freeOffset(bench.circuit, { components: [{ id: '_', type, x, y }], wires: [] }, 0, 0);
    bench.placePart(type, x + ox, y + oy);
  }

  function placeHere(s: Pt): void {
    const type = bench.placing;
    if (!type) return;
    const [x, y] = placeOrigin(s);
    // Rotation and flip chosen while placing come with the part.
    bench.placePart(type, x, y, { rot: placingRot || undefined, flip: placingFlip || undefined });
  }

  // ── Wire drawing ─────────────────────────────────────────────────────────
  function startDraft(at: Pt, first: Axis = 'h'): void {
    draft = { pts: [at], first, swap: false };
    bench.wireDrafting = true;
  }
  function cancelDraft(): void {
    draft = null;
    bench.wireDrafting = false;
  }

  const obstacles = $derived(layout.comps.map((l) => l.box));

  /** The route from the draft's last point to `to`. */
  function draftRoute(d: Draft, to: Pt): Pt[] {
    const last = d.pts[d.pts.length - 1]!;
    const prev = d.pts.length > 1 ? lastAxis(d.pts) : d.first;
    // After a horizontal run go vertical, and the other way round; the first run follows the start pin.
    const natural: Axis = d.pts.length > 1 ? (prev === 'h' ? 'v' : 'h') : d.first;
    const first: Axis = d.swap ? (natural === 'h' ? 'v' : 'h') : natural;
    return autoRoute(last, to, { first, obstacles });
  }

  /** Finish the draft at `to`: wire ends on a pin or wire, or continues from there in the open. */
  function draftClick(to: Pt, terminal: boolean): void {
    const d = draft;
    if (!d) return;
    const route = draftRoute(d, to);
    const full = [...d.pts, ...route.slice(1)];
    const last = d.pts[d.pts.length - 1]!;
    if (route.length < 2 && d.pts.length < 2) return; // a click on the start point
    if (terminal || (to[0] === last[0] && to[1] === last[1])) {
      cancelDraft();
      if (full.length >= 2) bench.addWirePath(full);
    } else {
      draft = { ...d, pts: full, swap: false };
    }
  }

  function finishDraftHere(): void {
    const d = draft;
    if (!d) return;
    const to = cursorS ?? d.pts[d.pts.length - 1]!;
    draftClick(to, true);
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────
  function onPointerDown(ev: PointerEvent): void {
    touchLast = ev.pointerType === 'touch';
    board?.focus({ preventScroll: true });
    pointers.set(ev.pointerId, eventPoint(ev));
    if (pointers.size === 2) {
      startPinch();
      return;
    }
    if (pointers.size > 2) return;

    if (ev.button === 1 || (ev.button === 0 && spaceDown)) {
      ev.preventDefault();
      beginPan(ev);
      return;
    }
    if (ev.button === 2) {
      cancelAll();
      return;
    }
    if (ev.button !== 0) return;

    const g = gridAt(ev);
    const target = ev.target as Element | null;
    // Choosing a probe point.
    if (bench.pick) {
      const hit = hitAt(g, { points: true });
      const ref = probeFromHit(hit);
      if (ref && (!bench.pick.pinsOnly || hit?.kind === 'pin')) {
        const p = bench.pick;
        bench.cancelPick();
        p.onpick(ref);
      }
      return;
    }
    // Placing a part.
    if (bench.placing) {
      placeHere(snapPt(g));
      if (!ev.shiftKey) bench.placing = null;
      return;
    }
    // A running switch or button handles its own clicks.
    if (bench.engine && !ev.shiftKey && target?.closest?.('.comp.act')) return;

    const hit = hitAt(g);
    const s: Pt = hit && (hit.kind === 'pin' || hit.kind === 'wire') ? [hit.x, hit.y] : snapPt(g);
    const downPx = eventPoint(ev);

    if (draft) {
      // Click while drawing: add a corner, or finish on a pin or wire.
      const terminal = hit?.kind === 'pin' || hit?.kind === 'wire';
      draftClick(s, terminal);
      return;
    }
    if (bench.tool === 'wire') {
      if (hit?.kind === 'pin') {
        const l = layout.byId.get(hit.comp);
        startDraft(s, l ? pinAxis(l, hit) : 'h');
      } else startDraft(s);
      return;
    }

    board?.setPointerCapture(ev.pointerId);
    if (hit?.kind === 'pin') {
      op = { kind: 'pin', pin: hit, downPx, moved: false };
    } else if (hit?.kind === 'comp') {
      const wasSelected = sel.ids.has(hit.id);
      let selection = sel;
      if (ev.shiftKey) {
        const ids = new Set(sel.ids);
        if (wasSelected) ids.delete(hit.id);
        else ids.add(hit.id);
        selection = { ids, wires: sel.wires };
      } else if (!wasSelected) selection = { ids: new Set([hit.id]), wires: new Set() };
      bench.select(selection);
      op = { kind: 'move', origin: snapPt(g), downPx, hit, moved: false, selection, wasSelected, extend: ev.shiftKey };
    } else if (hit?.kind === 'wire') {
      if (ev.shiftKey) {
        board?.releasePointerCapture(ev.pointerId);
        startDraft([hit.x, hit.y]);
        return;
      }
      bench.select({ ids: new Set(), wires: new Set([hit.wire]) });
      const w = bench.circuit.wires[hit.wire];
      const a = w?.points[hit.seg];
      const b = w?.points[hit.seg + 1];
      op = { kind: 'seg', wire: hit.wire, seg: hit.seg, horizontal: !!a && !!b && a[1] === b[1], origin: g, downPx, moved: false };
    } else {
      const extend = ev.shiftKey;
      if (!extend) bench.clearSelection();
      const [wx, wy] = toWorld(bench.view, downPx[0], downPx[1]);
      op = { kind: 'marquee', a: [wx, wy], downPx, moved: false, extend, touch: ev.pointerType === 'touch' };
    }
  }

  function onPointerMove(ev: PointerEvent): void {
    touchLast = ev.pointerType === 'touch';
    const p = eventPoint(ev);
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, p);
    if (pinch && pointers.size >= 2) {
      updatePinch();
      return;
    }
    const g = gridAt(ev);
    bench.cursor = snapPt(g);
    ghostPx = p;

    if (!op) {
      const h = bench.placing ? undefined : hitAt(g, { points: !!bench.pick });
      hover = h;
      const s = h && (h.kind === 'pin' || h.kind === 'wire') && (draft || bench.tool === 'wire') ? ([h.x, h.y] as Pt) : snapPt(g);
      cursorS = s;
      return;
    }

    if (op.kind === 'pan') {
      const dx = p[0] - op.last[0];
      const dy = p[1] - op.last[1];
      op.last = p;
      bench.view = panBy(bench.view, dx, dy);
      return;
    }
    const dist = Math.hypot(p[0] - op.downPx[0], p[1] - op.downPx[1]);
    if (!op.moved && dist < (op.kind === 'marquee' && op.touch ? 6 : 4)) return;

    if (op.kind === 'marquee') {
      if (op.touch) {
        // One finger on the background pans.
        op = { kind: 'pan', last: p };
        bench.clearSelection();
        return;
      }
      op.moved = true;
      const [wx, wy] = toWorld(bench.view, p[0], p[1]);
      marquee = { x0: Math.min(op.a[0], wx), y0: Math.min(op.a[1], wy), x1: Math.max(op.a[0], wx), y1: Math.max(op.a[1], wy) };
      return;
    }
    if (op.kind === 'pin') {
      // Dragging from a pin starts a wire.
      const { pin } = op;
      op = null;
      board?.releasePointerCapture(ev.pointerId);
      const l = layout.byId.get(pin.comp);
      startDraft([pin.x, pin.y], l ? pinAxis(l, pin) : 'h');
      dragWire = true;
      cursorS = snapPt(g);
      return;
    }
    if (op.kind === 'move') {
      if (!op.moved) {
        op.moved = true;
        bench.interrupt();
      }
      const s = snapPt(g);
      const dx = s[0] - op.origin[0];
      const dy = s[1] - op.origin[1];
      const next = dx || dy ? moveSelection(bench.circuit, op.selection, dx, dy) : bench.circuit;
      bench.draft = next === bench.circuit ? null : next;
      return;
    }
    if (op.kind === 'seg') {
      if (!op.moved) {
        op.moved = true;
        bench.interrupt();
      }
      const d = Math.round(op.horizontal ? g[1] - op.origin[1] : g[0] - op.origin[0]);
      bench.draft = d ? moveSegment(bench.circuit, op.wire, op.seg, d).circuit : null;
    }
  }

  /** The pointer went down on a pin and dragged: releasing ends the wire there. */
  let dragWire = false;

  function onPointerUp(ev: PointerEvent): void {
    pointers.delete(ev.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      op = null;
      return;
    }
    try {
      board?.releasePointerCapture(ev.pointerId);
    } catch {
      /* not captured */
    }
    if (dragWire && draft) {
      dragWire = false;
      const g = gridAt(ev);
      const hit = hitAt(g);
      const s: Pt = hit && (hit.kind === 'pin' || hit.kind === 'wire') ? [hit.x, hit.y] : snapPt(g);
      const start = draft.pts[0]!;
      // Released where it started: stay in click-click mode; anywhere else the wire ends there.
      if (s[0] !== start[0] || s[1] !== start[1]) draftClick(s, true);
      return;
    }
    dragWire = false;
    const o = op;
    op = null;
    panning = false;
    if (!o) return;
    switch (o.kind) {
      case 'move': {
        if (o.moved) {
          const next = bench.draft;
          if (next) bench.commit(next);
          else bench.draft = null;
        } else if (!o.extend) {
          // A click on part of a group selects just that part; on a switch (with an engine) it is handled by the schematic.
          bench.select({ ids: new Set([o.hit.id]), wires: new Set() });
        }
        break;
      }
      case 'seg': {
        if (o.moved && bench.draft) {
          const d = Math.round(o.horizontal ? gridAt(ev)[1] - o.origin[1] : gridAt(ev)[0] - o.origin[0]);
          const r = moveSegment(bench.circuit, o.wire, o.seg, d);
          bench.commit(r.circuit, { keepWires: true });
          bench.select({ ids: new Set(), wires: r.wire >= 0 ? new Set([r.wire]) : new Set() });
        } else bench.draft = null;
        break;
      }
      case 'pin': {
        // A click on a pin starts a wire that follows the pointer until the next click.
        const l = layout.byId.get(o.pin.comp);
        startDraft([o.pin.x, o.pin.y], l ? pinAxis(l, o.pin) : 'h');
        cursorS = [o.pin.x, o.pin.y];
        break;
      }
      case 'marquee': {
        if (o.moved && marquee) {
          const box = { x0: marquee.x0 / G, y0: marquee.y0 / G, x1: marquee.x1 / G, y1: marquee.y1 / G };
          const found = selectInBox(bench.circuit, box);
          bench.select(o.extend ? { ids: new Set([...sel.ids, ...found.ids]), wires: new Set([...sel.wires, ...found.wires]) } : found);
        }
        marquee = null;
        break;
      }
    }
  }

  function onPointerCancel(ev: PointerEvent): void {
    pointers.delete(ev.pointerId);
    pinch = null;
    op = null;
    dragWire = false;
    panning = false;
    marquee = null;
    bench.draft = null;
  }

  function onDoubleClick(): void {
    if (draft) finishDraftHere();
  }

  function onLeave(): void {
    hover = undefined;
    cursorS = null;
    ghostPx = null;
    bench.cursor = null;
  }

  function beginPan(ev: PointerEvent): void {
    panning = true;
    board?.setPointerCapture(ev.pointerId);
    op = { kind: 'pan', last: eventPoint(ev) };
  }

  // Two fingers: pan and zoom together.
  function startPinch(): void {
    op = null;
    marquee = null;
    bench.draft = null;
    const [a, b] = [...pointers.values()] as [Pt, Pt];
    const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), c0: c, zoom0: bench.view.zoom, world0: toWorld(bench.view, c[0], c[1]) };
  }
  function updatePinch(): void {
    if (!pinch) return;
    const [a, b] = [...pointers.values()] as [Pt, Pt];
    const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinch.zoom0 * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d0)));
    bench.view = { zoom, x: pinch.world0[0] - c[0] / zoom, y: pinch.world0[1] - c[1] / zoom };
  }

  function onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const p = eventPoint(ev);
    if (!ev.ctrlKey && Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
      bench.view = panBy(bench.view, -ev.deltaX, 0);
      return;
    }
    const unit = ev.deltaMode === 1 ? 16 : 1;
    bench.view = zoomAt(bench.view, p[0], p[1], Math.exp(-ev.deltaY * unit * (ev.ctrlKey ? 0.01 : 0.0015)));
  }

  function cancelAll(): boolean {
    let did = false;
    if (bench.pick) {
      bench.cancelPick();
      did = true;
    } else if (bench.placing) {
      bench.placing = null;
      did = true;
    } else if (draft) {
      cancelDraft();
      did = true;
    } else if (bench.tool === 'wire') {
      bench.tool = 'select';
      did = true;
    } else if (op) {
      op = null;
      bench.draft = null;
      marquee = null;
      did = true;
    } else if (bench.selection.ids.size || bench.selection.wires.size) {
      bench.clearSelection();
      did = true;
    }
    return did;
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  const typing = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.tagName) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
  };

  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || typing(ev.target)) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    const el = ev.target as HTMLElement | null;
    const onButton = !!el?.closest?.('button, a, summary, [role="slider"], [role="radio"], [role="switch"]');
    const onNative = !!el?.closest?.('[role="slider"], [role="radio"], [role="switch"]');
    const eat = () => ev.preventDefault();

    if (mod) {
      if (key === 'z') (eat(), ev.shiftKey ? bench.redo() : bench.undo());
      else if (key === 'y') (eat(), bench.redo());
      else if (key === 'd') (eat(), bench.duplicateSelected());
      else if (key === 'a') (eat(), bench.selectEverything());
      else if (key === 'c') (eat(), bench.copySelected());
      else if (key === 'x') (eat(), bench.cutSelected());
      else if (key === 'v') (eat(), bench.pasteClipboard());
      else if (key === 'Enter') (eat(), bench.toggleRun());
      return;
    }
    if (ev.altKey) return;

    switch (key) {
      case 'Escape':
        if (cancelAll()) eat();
        return;
      case 'Delete':
      case 'Backspace':
        eat();
        bench.deleteSelected();
        return;
      case 'r':
        eat();
        if (bench.placing) placingRot = ((placingRot + 90) % 360) as Rot;
        else bench.rotateSelected();
        return;
      case 'f':
        eat();
        if (bench.placing) placingFlip = !placingFlip;
        else bench.mirrorSelected(ev.shiftKey ? 'y' : 'x');
        return;
      case 'w':
        eat();
        bench.tool = bench.tool === 'wire' ? 'select' : 'wire';
        if (bench.tool === 'select') cancelDraft();
        bench.placing = null;
        return;
      case 'v':
        eat();
        bench.tool = 'select';
        cancelDraft();
        return;
      case 'Enter':
        if (draft) (eat(), finishDraftHere());
        return;
      case 'Tab':
        if (draft) {
          eat();
          draft = { ...draft, swap: !draft.swap };
        }
        return;
      case ' ':
        if (onButton) return;
        eat();
        spaceDown = true;
        return;
      case '+':
      case '=':
        eat();
        bench.zoomBy(1.25);
        return;
      case '-':
      case '_':
        eat();
        bench.zoomBy(1 / 1.25);
        return;
      case '0':
        eat();
        bench.fit();
        return;
      case '?':
        eat();
        onhelp?.();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (onNative) return;
        eat();
        const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
        const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
        const n = ev.shiftKey ? 5 : 1;
        if (bench.selection.ids.size || bench.selection.wires.size) bench.moveSelected(dx * n, dy * n, 'nudge');
        else bench.view = panBy(bench.view, -dx * 60 * n, -dy * 60 * n);
        return;
      }
    }
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (ev.key === ' ') spaceDown = false;
  }

  // ── Drag and drop from the palette, and JSON files ──────────────────────
  function onDragOver(ev: DragEvent): void {
    if (ev.dataTransfer?.types.includes('application/x-dc-part') || ev.dataTransfer?.types.includes('Files')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      ghostPx = eventPoint(ev);
    }
  }
  async function onDrop(ev: DragEvent): Promise<void> {
    ev.preventDefault();
    const type = ev.dataTransfer?.getData('application/x-dc-part');
    if (type && getDef(type)) {
      const def = getDef(type)!;
      const b = boundsOf(def, withDefaults(def, undefined));
      const s = snapPt(gridAt(ev));
      bench.placePart(type, s[0] - Math.round((b.x0 + b.x1) / 2), s[1] - Math.round((b.y0 + b.y1) / 2));
      bench.placing = null;
      board?.focus({ preventScroll: true });
      return;
    }
    const file = ev.dataTransfer?.files?.[0];
    if (file) {
      try {
        bench.importText(await file.text());
        bench.say(`Opened ${file.name}`);
      } catch (e) {
        bench.say(e instanceof Error ? e.message : String(e), 'error');
      }
    }
  }

  // ── Wiring it up ─────────────────────────────────────────────────────────
  onMount(() => {
    const el = board!;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      bench.resized(width, height);
    });
    ro.observe(el);
    el.addEventListener('wheel', onWheel, { passive: false });
    const off = bench.onFrame((dt) => schematic?.frame(dt));
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
      off();
    };
  });

  // Marker colours: the tokens, resolved where they are drawn.
  let scheme = $state<Record<string, string>>({});
  $effect(() => {
    void bench.markers;
    const el = board;
    if (!el) return;
    untrack(() => {
      const probe = document.createElement('span');
      el.appendChild(probe);
      const next: Record<string, string> = {};
      for (const m of bench.markers) {
        probe.style.color = `var(${m.colour})`;
        next[m.colour] = getComputedStyle(probe).color;
      }
      probe.remove();
      scheme = next;
    });
  });

  // ── Drawing helpers ──────────────────────────────────────────────────────
  const boxPx = (b: Box, m = 0) => ({ x: b.x0 * G - m, y: b.y0 * G - m, w: (b.x1 - b.x0) * G + 2 * m, h: (b.y1 - b.y0) * G + 2 * m });

  const selectedComps = $derived(layout.comps.filter((l) => sel.ids.has(l.c.id)));
  const hoverComp = $derived(hover?.kind === 'comp' ? layout.byId.get(hover.id) : hover?.kind === 'pin' ? layout.byId.get(hover.comp) : undefined);
  const pinShown = $derived.by(() => {
    if (bench.tool === 'wire' || draft) return layout.comps;
    const s = new Set<string>();
    for (const l of selectedComps) s.add(l.c.id);
    if (hoverComp) s.add(hoverComp.c.id);
    return layout.comps.filter((l) => s.has(l.c.id));
  });
  const previewPath = $derived.by(() => {
    const d = draft;
    if (!d) return '';
    const to = cursorS ?? d.pts[d.pts.length - 1]!;
    const last = d.pts[d.pts.length - 1]!;
    const route = draftRoute(d, to);
    const pts = d.pts.length > 1 || route.length > 1 ? [...d.pts, ...route.slice(1)] : [last];
    return roundedPath(pts);
  });
  const draftDots = $derived(draft ? draft.pts : []);
  const markerPoints = $derived(
    bench.markers.flatMap((m) => {
      const p = probePoint(m.ref, layout);
      return p ? [{ ...m, x: p[0] * G, y: p[1] * G }] : [];
    }),
  );

  const hint = $derived.by(() => {
    if (bench.pick) return `Click a ${bench.pick.pinsOnly ? 'component pin' : 'pin or wire'} to attach ${bench.pick.label}`;
    if (bench.placing) return 'Click to place · R rotates · Shift keeps placing · Esc cancels';
    if (draft) return 'Click to turn a corner · click a pin or wire to finish · Esc cancels';
    if (bench.tool === 'wire') return 'Wire tool: click a pin or any point to start a wire';
    return '';
  });

  const cursorStyle = $derived(panning ? 'grabbing' : spaceDown ? 'grab' : bench.pick ? 'crosshair' : bench.placing || draft || bench.tool === 'wire' ? 'crosshair' : hover?.kind === 'comp' ? 'move' : hover?.kind === 'wire' ? 'pointer' : hover?.kind === 'pin' ? 'crosshair' : 'default');
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="board"
  bind:this={board}
  tabindex="0"
  role="application"
  aria-label="Circuit canvas. Arrow keys move the selection; R rotates, F flips, W draws wires, Delete removes."
  style:cursor={cursorStyle}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerCancel}
  onpointerleave={onLeave}
  ondblclick={onDoubleClick}
  oncontextmenu={(ev) => ev.preventDefault()}
  ondragover={onDragOver}
  ondrop={onDrop}
>
  <svg class="grid" aria-hidden="true" viewBox="{vb.x0} {vb.y0} {vb.x1 - vb.x0} {vb.y1 - vb.y0}" preserveAspectRatio="none">
    <defs>
      <pattern id="bench-dots" width={G} height={G} patternUnits="userSpaceOnUse">
        <circle cx="0" cy="0" r={pxPerGrid > 9 ? 0.9 : 0.6} class="dot" />
      </pattern>
      <pattern id="bench-major" width={G * 5} height={G * 5} patternUnits="userSpaceOnUse">
        <path d="M0 0H{G * 5}M0 0V{G * 5}" class="major" />
      </pattern>
    </defs>
    {#if pxPerGrid >= 6}<rect x={vb.x0} y={vb.y0} width={vb.x1 - vb.x0} height={vb.y1 - vb.y0} fill="url(#bench-dots)" />{/if}
    <rect x={vb.x0} y={vb.y0} width={vb.x1 - vb.x0} height={vb.y1 - vb.y0} fill="url(#bench-major)" />
  </svg>

  <Schematic
    bind:this={schematic}
    circuit={bench.shown}
    engine={bench.engine}
    mode={bench.mode}
    showCurrent={bench.showCurrent && bench.engine?.kind === 'analog'}
    running={bench.sim === 'running'}
    interactive={!!bench.engine && !bench.draft}
    live={false}
    fill
    viewBox={vb}
    label="Circuit on the bench"
    onparam={(id, key, value) => bench.syncParam(id, key, value)}
  />

  <svg class="overlay sch" viewBox="{vb.x0} {vb.y0} {vb.x1 - vb.x0} {vb.y1 - vb.y0}" preserveAspectRatio="none" aria-hidden="true">
    {#each bench.selection.wires as wi (wi)}
      {@const w = bench.shown.wires[wi]}
      {#if w}<path class="sel-wire" d={roundedPath(w.points as Pt[])} />{/if}
    {/each}
    {#if hover?.kind === 'wire' && (bench.pick || bench.tool === 'wire' || draft)}
      {@const w = bench.shown.wires[hover.wire]}
      {#if w}<path class="hover-wire" d={roundedPath(w.points as Pt[])} />{/if}
    {/if}
    {#each selectedComps as l (l.c.id)}
      {@const b = boxPx(l.box, 4)}
      <rect class="sel" x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
    {/each}
    {#if hoverComp && !bench.placing && !selectedComps.includes(hoverComp) && !bench.pick}
      {@const b = boxPx(hoverComp.box, 3)}
      <rect class="hover-box" x={b.x} y={b.y} width={b.w} height={b.h} rx="4" />
    {/if}

    {#each pinShown as l (l.c.id)}
      {#each l.pins as p (p.pin)}
        <circle class="pin" cx={p.x * G} cy={p.y * G} r="3" />
      {/each}
    {/each}
    {#if hover?.kind === 'pin' || (hover?.kind === 'wire' && (bench.pick || bench.tool === 'wire' || draft))}
      <circle class="pin-hover" class:pick={!!bench.pick} cx={hover.x * G} cy={hover.y * G} r="7" />
    {/if}

    {#if draft}
      <path class="draft" d={previewPath} />
      {#each draftDots as p, i (i)}<circle class="draft-dot" cx={p[0] * G} cy={p[1] * G} r="3.2" />{/each}
      {#if cursorS}<circle class="draft-dot end" cx={cursorS[0] * G} cy={cursorS[1] * G} r="3.6" />{/if}
    {:else if bench.tool === 'wire' && cursorS && !bench.placing}
      <circle class="draft-dot end" cx={cursorS[0] * G} cy={cursorS[1] * G} r="3.6" />
    {/if}

    {#if marquee}
      <rect class="marquee" x={marquee.x0} y={marquee.y0} width={marquee.x1 - marquee.x0} height={marquee.y1 - marquee.y0} />
    {/if}

    {#if ghost && ghostPx}
      {@const gw = toWorld(bench.view, ghostPx[0], ghostPx[1])}
      {@const s = snapPt([gw[0] / G, gw[1] / G])}
      {@const o = placeOrigin(s)}
      {@const Sym = symbolFor(ghost.type)}
      <g class="ghost" transform={componentTransform({ x: o[0], y: o[1], rot: placingRot, flip: placingFlip })}>
        <Sym id="" type={ghost.type} def={ghost.def} params={ghost.params} pins={ghost.pins} state={{}} rot={placingRot} flip={placingFlip} uid="ghost" />
      </g>
    {/if}

    {#each markerPoints as m, i (i)}
      <g class="marker" transform="translate({m.x} {m.y})" style:--mc={scheme[m.colour] ?? 'currentColor'}>
        <path d="M0 0 L9 -12" />
        <circle r="3.4" />
        <g transform="translate(9 -12)">
          <rect x="-1" y="-8" width={Math.max(13, m.label.length * 6.4 + 7)} height="15" rx="3.5" />
          <text x={(Math.max(13, m.label.length * 6.4 + 7) - 2) / 2} y="0.5">{m.label}</text>
        </g>
      </g>
    {/each}
  </svg>

  {#if hint}
    <div class="banner ui" role="status">
      <span>{hint}</span>
      {#if bench.pick}
        <button type="button" onclick={() => bench.cancelPick()}>Cancel</button>
      {/if}
    </div>
  {/if}

  {#if bench.empty && !bench.placing && !draft}
    <div class="empty ui">
      <div class="card">
        <h2>An empty bench</h2>
        <p>Pick a part from the palette and click to place it. Drag from a pin to wire it up. Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run.</p>
        {#if EXAMPLES.length}
          <p class="or">or start from an example</p>
          <div class="chips">
            {#each EXAMPLES.slice(0, 6) as ex (ex.key)}
              <button type="button" onclick={() => bench.load(ex.circuit)}>{ex.title}</button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="zoom ui" role="group" aria-label="View">
    <button type="button" onclick={() => bench.zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out (−)"><Glyph name="minus" size={16} /></button>
    <span class="pct num">{Math.round((bench.view.zoom / 1.5) * 100)}%</span>
    <button type="button" onclick={() => bench.zoomBy(1.25)} aria-label="Zoom in" title="Zoom in (+)"><Glyph name="plus" size={16} /></button>
    <button type="button" onclick={() => bench.fit()} aria-label="Fit circuit to view" title="Fit to view (0)"><Glyph name="fit" size={16} /></button>
  </div>
</div>

<style>
  .board {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background: var(--bg);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }
  .board:focus-visible {
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--focus) 55%, transparent);
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
  .major {
    stroke: var(--grid-major);
    stroke-width: 1;
    fill: none;
  }

  /* Overlay: selection, pins, wire draft, ghost, probe flags. */
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
  .sel-wire,
  .hover-wire {
    fill: none;
    stroke: var(--_edit);
    stroke-width: 7;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.32;
  }
  .hover-wire {
    stroke: var(--copper);
    opacity: 0.4;
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
  .pin-hover.pick {
    stroke: var(--copper);
    fill: color-mix(in srgb, var(--copper) 22%, transparent);
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
  .draft-dot.end {
    fill: var(--panel);
    stroke: var(--_edit);
    stroke-width: 1.6;
  }
  .marquee {
    fill: color-mix(in srgb, var(--_edit) 10%, transparent);
    stroke: var(--_edit);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .ghost {
    opacity: 0.6;
  }
  .marker path {
    stroke: var(--mc);
    stroke-width: 1.4;
    fill: none;
  }
  .marker circle {
    fill: var(--mc);
    stroke: var(--panel);
    stroke-width: 1.4;
  }
  .marker rect {
    fill: var(--mc);
  }
  .marker text {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    fill: var(--on-accent, #fff);
    text-anchor: middle;
    dominant-baseline: central;
  }

  .banner {
    position: absolute;
    left: 50%;
    top: 0.75rem;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: calc(100% - 1.5rem);
    padding: 0.4rem 0.4rem 0.4rem 0.85rem;
    border-radius: 999px;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-lg);
    font-size: 0.8rem;
    color: var(--ink-2);
    pointer-events: none;
  }
  .banner:not(:has(button)) {
    padding-right: 0.85rem;
  }
  .banner button {
    pointer-events: auto;
    border: 1px solid var(--line-strong);
    background: var(--pn);
    color: var(--fg);
    border-radius: 999px;
    padding: 0.15rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }
  .banner button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }

  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    padding: 1rem;
  }
  .card {
    max-width: 30rem;
    padding: 1.4rem 1.6rem 1.5rem;
    text-align: center;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
  }
  .card h2 {
    margin: 0 0 0.4rem;
    font-family: var(--font-display);
    font-size: 1.25rem;
    letter-spacing: -0.01em;
  }
  .card p {
    margin: 0 0 0.6rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .card .or {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
    margin: 0.9rem 0 0.5rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }
  .chips button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 999px;
    padding: 0.25rem 0.8rem;
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .chips button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.75em;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--pn);
  }

  .zoom {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.1rem;
    padding: 0.2rem;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 9px;
    box-shadow: var(--shadow);
  }
  .zoom button {
    display: inline-grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
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
  .pct {
    min-width: 2.9rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
  }
</style>
