<!--
  The window onto a chamber: the WebGL2 (or Canvas 2D) picture of droplets or bubbles, and an overlay for what is not
  physics: the lead plate, the source needle, fiducial marks, the scale bar, the field symbol, the scanning tools, the
  selected track and its fitted circles. Used by CloudChamber, BubbleChamber and ScanTable.

  Mouse: click a track to select it; with a tool active click points (the ruler needs two, the circle and the angle
  three); drag to pan and Ctrl+wheel or the buttons to zoom. Keyboard: Tab to the picture, arrow keys move a
  crosshair (Shift: ten times faster), Enter places a point or selects the track nearest the crosshair, + and − zoom,
  Backspace removes the last point, Escape cancels.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Track } from '$lib/hep/chamber';
  import type { Pt } from '$lib/hep/chamber';
  import { DropletField, fitView, pickTrack, screenToWorld, worldToScreen, zoomAt, type ChamberKind, type View } from './droplets';
  import { createRenderer, GLInitError, type Renderer } from './renderer';
  import { POINTS_NEEDED, TOOL_HELP, makeMeasurement, niceLength, type Measurement, type ToolName } from './tools';
  import { selectionInfo, type SelectionInfo } from './info';
  import type { MediumName } from '$lib/hep/chamber';

  interface Props {
    kind?: ChamberKind;
    worldW: number;
    worldH: number;
    field: DropletField;
    clock: () => number;
    grow?: number;
    hold?: number;
    drift?: number;
    mist?: boolean;
    gain?: number;
    animated?: boolean;
    bField?: number;
    medium?: MediumName;
    plates?: { y0: number; y1: number }[];
    source?: { x: number; y: number } | undefined;
    tracks?: Track[];
    eligible?: (t: Track) => boolean;
    labels?: { letter: string; trackId: number }[];
    showNeutrals?: boolean;
    selected?: number | null;
    tool?: ToolName;
    measurements?: Measurement[];
    zoomable?: boolean;
    fiducials?: boolean;
    snap?: boolean;
    ariaLabel: string;
    forceCanvas?: boolean;
    /** Called when the reader clicks a track (or null for empty space). */
    onpick?: (t: Track | null) => void;
    /** Report which renderer is in use. */
    backend?: string;
    /** Show the ruler and protractor guide (scan mode of the cloud chamber). */
    maxHeight?: string;
  }

  let {
    kind = 'cloud',
    worldW,
    worldH,
    field,
    clock,
    grow = 0.14,
    hold = 0.6,
    drift = 0,
    mist = true,
    gain = 1,
    animated = false,
    bField = 0,
    medium = 'air+alcohol vapour',
    plates = [],
    source = undefined,
    tracks = [],
    eligible,
    labels = [],
    showNeutrals = false,
    selected = $bindable(null),
    tool = 'none',
    measurements = $bindable([]),
    zoomable = false,
    fiducials = false,
    snap = true,
    ariaLabel,
    forceCanvas = false,
    onpick,
    backend = $bindable(''),
    maxHeight = '70vh',
  }: Props = $props();

  let stage = $state<HTMLDivElement | undefined>();
  let glCanvas = $state<HTMLCanvasElement | undefined>();
  let ov = $state<HTMLCanvasElement | undefined>();
  let canvasKey = $state(0);
  let useCanvas2d = $state(false);
  let W = $state(600);
  let H = $state(400);
  let dpr = 1;
  let renderer: Renderer | null = null;
  let raf = 0;
  let dirtyGL = true;
  let dirtyOv = true;
  let lastVersion = -1;

  // View: zoom relative to the fit, and the centre of the window in world coordinates.
  let zoom = $state(1);
  let centre = $state({ x: 0, y: 0 });
  const fit = $derived(fitView(worldW, worldH, W, H));
  const view = $derived<View>({ cx: centre.x, cy: centre.y, scale: fit.scale * zoom });

  // Interaction state
  let pending = $state<Pt[]>([]);
  let cursor = $state<Pt | null>(null);
  let hover = $state<Pt | null>(null);
  let focused = $state(false);
  let nextId = 1;
  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;

  const uid = $props.id();
  const trackMap = $derived(new Map(tracks.map((t) => [t.id, t] as const)));
  const selTrack = $derived(selected !== null ? (trackMap.get(selected) ?? null) : null);
  const selInfo = $derived<SelectionInfo | null>(selTrack ? selectionInfo(selTrack, bField, medium, kind) : null);

  function setupRenderer() {
    renderer?.destroy();
    renderer = null;
    if (!glCanvas) return;
    try {
      renderer = createRenderer(glCanvas, kind, forceCanvas || useCanvas2d);
    } catch (e) {
      if (e instanceof GLInitError) {
        // The canvas now holds a dead WebGL context: replace it and draw with Canvas 2D.
        useCanvas2d = true;
        canvasKey++;
        return;
      }
      renderer = null;
    }
    if (renderer) {
      backend = renderer.backend;
      renderer.resize(W, H, dpr);
    }
    dirtyGL = true;
  }

  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]!.contentRect;
      if (r.width < 10) return;
      W = Math.round(r.width);
      H = Math.round(r.height);
    });
    ro.observe(stage!);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!renderer) return;
      if (animated || dirtyGL || field.version !== lastVersion) {
        renderer.render(field, view, { now: clock(), grow, hold, drift, mist: mist && !reduced, gain });
        lastVersion = field.version;
        dirtyGL = false;
      }
      if (animated || dirtyOv) {
        drawOverlay();
        dirtyOv = false;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer?.destroy();
      renderer = null;
    };
  });

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // (Re)create the renderer when the canvas element exists or is replaced.
  $effect(() => {
    void canvasKey;
    if (glCanvas) untrack(() => setupRenderer());
  });
  // Size changes
  $effect(() => {
    void W;
    void H;
    if (ov) {
      ov.width = Math.round(W * dpr);
      ov.height = Math.round(H * dpr);
    }
    renderer?.resize(W, H, dpr);
    dirtyGL = dirtyOv = true;
  });
  // Anything that changes the overlay or the picture asks for a redraw.
  $effect(() => {
    void [view.cx, view.cy, view.scale, selected, tool, pending, hover, cursor, focused, measurements, showNeutrals, labels, plates, bField, tracks, source, selInfo, fiducials];
    dirtyOv = true;
    dirtyGL = true;
  });

  // ───────────── overlay drawing ─────────────
  const TEAL = '#5fd4e8';
  const AMBER = '#ffb23e';
  const INK = 'rgba(214,224,236,0.92)';

  function sx(x: number, y: number): [number, number] {
    return worldToScreen(view, W, H, x, y);
  }

  function drawOverlay() {
    if (!ov) return;
    const c = ov.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.font = '11px ui-monospace, "JetBrains Mono Variable", monospace';

    // Lead plates
    for (const p of plates) {
      const [, ya] = sx(0, p.y1);
      const [, yb] = sx(0, p.y0);
      const h = Math.max(2, yb - ya);
      const g = c.createLinearGradient(0, ya, 0, yb);
      g.addColorStop(0, '#6d7781');
      g.addColorStop(0.15, '#3a424b');
      g.addColorStop(0.85, '#2a3037');
      g.addColorStop(1, '#151a1f');
      c.fillStyle = g;
      c.fillRect(0, ya, W, h);
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, ya + 0.5);
      c.lineTo(W, ya + 0.5);
      c.stroke();
      c.fillStyle = 'rgba(220,228,238,0.85)';
      c.textAlign = 'right';
      if (h > 9) c.fillText(`lead plate, ${(p.y1 - p.y0).toFixed(0)} mm`, W - 8, ya + h / 2 + 4);
      else c.fillText(`lead plate, ${(p.y1 - p.y0).toFixed(0)} mm`, W - 8, ya - 5);
      c.textAlign = 'left';
    }

    // Source needle
    if (source) {
      const [x, y] = sx(source.x, source.y);
      c.fillStyle = '#8b97a6';
      c.beginPath();
      c.arc(x, y, 3.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8b97a6';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x - 3, y + 2);
      c.lineTo(x - 26, y + 20);
      c.stroke();
      c.fillStyle = 'rgba(200,210,224,0.7)';
      c.fillText('source', x + 8, y + 15);
    }

    // Fiducial marks on a 100 mm grid (or 50 mm for small worlds)
    if (fiducials) {
      const step = worldW > 500 ? 100 : 50;
      c.strokeStyle = 'rgba(220,230,245,0.42)';
      c.lineWidth = 1;
      for (let gx = -Math.floor(worldW / 2 / step) * step; gx <= worldW / 2; gx += step) {
        for (let gy = -Math.floor(worldH / 2 / step) * step; gy <= worldH / 2; gy += step) {
          const [x, y] = sx(gx, gy);
          if (x < 4 || y < 4 || x > W - 4 || y > H - 4) continue;
          c.beginPath();
          c.moveTo(x - 4, y);
          c.lineTo(x + 4, y);
          c.moveTo(x, y - 4);
          c.lineTo(x, y + 4);
          c.stroke();
        }
      }
    }

    // Neutral paths (dashed): only what the reader asked to see
    if (showNeutrals) {
      c.setLineDash([5, 5]);
      c.strokeStyle = 'rgba(255,190,110,0.85)';
      c.lineWidth = 1.3;
      for (const t of tracks) {
        if (!t.neutral || t.length < 1.5) continue;
        if (t.pdg === 22 && t.end === 'exit') continue;
        const a = t.points[0]!;
        const b = t.points[t.points.length - 1]!;
        const [x1, y1] = sx(a.x, a.y);
        const [x2, y2] = sx(b.x, b.y);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        c.fillStyle = 'rgba(255,190,110,0.95)';
        c.fillText(t.symbol, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 5);
      }
      c.setLineDash([]);
    }

    // Track labels
    for (const l of labels) {
      const t = trackMap.get(l.trackId);
      if (!t) continue;
      const vis = t.points.filter((p) => p.visible);
      if (!vis.length) continue;
      const p = vis[Math.floor(vis.length * 0.35)]!;
      const [x, y] = sx(p.x, p.y);
      c.fillStyle = 'rgba(8,14,20,0.82)';
      c.strokeStyle = AMBER;
      c.lineWidth = 1.2;
      c.beginPath();
      c.roundRect(x + 7, y - 20, 18, 17, 4);
      c.fill();
      c.stroke();
      c.fillStyle = AMBER;
      c.font = 'bold 12px ui-monospace, monospace';
      c.textAlign = 'center';
      c.fillText(l.letter, x + 16, y - 7);
      c.textAlign = 'left';
      c.font = '11px ui-monospace, monospace';
    }

    // The selected track and its fitted circles
    if (selTrack) {
      const t = selTrack;
      c.strokeStyle = TEAL;
      c.lineWidth = 1;
      c.globalAlpha = 0.55;
      c.beginPath();
      let pen = false;
      for (const p of t.points) {
        if (!p.visible) {
          pen = false;
          continue;
        }
        const [x, y] = sx(p.x, p.y);
        if (!pen) {
          c.moveTo(x, y);
          pen = true;
        } else c.lineTo(x, y);
      }
      c.stroke();
      c.globalAlpha = 1;
      // fitted circles
      if (selInfo) {
        c.setLineDash([4, 4]);
        c.strokeStyle = 'rgba(95,212,232,0.7)';
        for (const s of selInfo.segments) {
          if (!s.centre || !s.R) continue;
          const [x, y] = sx(s.centre.x, s.centre.y);
          if (s.R * view.scale > 4000) continue;
          c.beginPath();
          c.arc(x, y, s.R * view.scale, 0, Math.PI * 2);
          c.stroke();
          c.beginPath();
          c.moveTo(x - 4, y);
          c.lineTo(x + 4, y);
          c.moveTo(x, y - 4);
          c.lineTo(x, y + 4);
          c.stroke();
        }
        c.setLineDash([]);
        // ends ① and ②
        for (const [i, e] of [selInfo.end1, selInfo.end2].entries()) {
          const [x, y] = sx(e.x, e.y);
          c.fillStyle = TEAL;
          c.beginPath();
          c.arc(x, y, 3, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = INK;
          c.fillText(i === 0 ? '①' : '②', x + 6, y - 6);
        }
      }
    }

    // Measurements and the tool being used
    c.lineWidth = 1.6;
    for (const m of measurements) drawMeasurement(c, m.tool, m.points, m);
    if (tool !== 'none') {
      const preview = pending.length && (hover ?? cursor) ? [...pending, (hover ?? cursor)!] : pending;
      if (pending.length) drawMeasurement(c, tool, preview, null);
      if (pending.length === 0 && (cursor && focused)) drawCross(c, cursor);
    }
    const aim = hover ?? (focused ? cursor : null);
    if (aim) drawCross(c, aim);

    // Scale bar and field symbol
    const L = niceLength(100 / view.scale);
    const barPx = L * view.scale;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(12, H - 14);
    c.lineTo(12 + barPx, H - 14);
    c.moveTo(12, H - 18);
    c.lineTo(12, H - 10);
    c.moveTo(12 + barPx, H - 18);
    c.lineTo(12 + barPx, H - 10);
    c.stroke();
    c.fillStyle = INK;
    c.fillText(`${L} mm`, 12, H - 22);

    if (bField !== 0) {
      const cx = W - 22;
      const cy = 24;
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(cx, cy, 9, 0, Math.PI * 2);
      c.stroke();
      if (bField > 0) {
        c.fillStyle = INK;
        c.beginPath();
        c.arc(cx, cy, 2.6, 0, Math.PI * 2);
        c.fill();
      } else {
        c.beginPath();
        c.moveTo(cx - 5, cy - 5);
        c.lineTo(cx + 5, cy + 5);
        c.moveTo(cx + 5, cy - 5);
        c.lineTo(cx - 5, cy + 5);
        c.stroke();
      }
      c.textAlign = 'right';
      c.fillText(`B = ${Math.abs(bField).toFixed(bField % 1 ? 2 : 1)} T, ${bField > 0 ? 'out of the page' : 'into the page'}`, cx - 14, cy + 4);
      c.textAlign = 'left';
    }
  }

  function drawCross(c: CanvasRenderingContext2D, p: Pt) {
    const [x, y] = sx(p.x, p.y);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 9, y);
    c.lineTo(x - 3, y);
    c.moveTo(x + 3, y);
    c.lineTo(x + 9, y);
    c.moveTo(x, y - 9);
    c.lineTo(x, y - 3);
    c.moveTo(x, y + 3);
    c.lineTo(x, y + 9);
    c.stroke();
  }

  function dot(c: CanvasRenderingContext2D, p: Pt, label = '') {
    const [x, y] = sx(p.x, p.y);
    c.fillStyle = AMBER;
    c.beginPath();
    c.arc(x, y, 3.5, 0, Math.PI * 2);
    c.fill();
    if (label) {
      c.fillStyle = INK;
      c.fillText(label, x + 6, y - 6);
    }
  }

  function tag(c: CanvasRenderingContext2D, x: number, y: number, text: string) {
    const w = c.measureText(text).width + 10;
    c.fillStyle = 'rgba(6,12,18,0.85)';
    c.beginPath();
    c.roundRect(x - 2, y - 13, w, 18, 4);
    c.fill();
    c.fillStyle = AMBER;
    c.fillText(text, x + 3, y);
  }

  function drawMeasurement(c: CanvasRenderingContext2D, tl: ToolName, pts: Pt[], m: Measurement | null) {
    c.strokeStyle = AMBER;
    c.lineWidth = 1.5;
    if (tl === 'ruler' && pts.length >= 2) {
      const [x1, y1] = sx(pts[0]!.x, pts[0]!.y);
      const [x2, y2] = sx(pts[1]!.x, pts[1]!.y);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      // ticks perpendicular
      const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
        c.beginPath();
        c.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
        c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        c.stroke();
      }
      const L = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      tag(c, (x1 + x2) / 2 + 6, (y1 + y2) / 2 - 8, `${L.toFixed(1)} mm`);
    } else if (tl === 'circle' && pts.length >= 3) {
      const mm = makeMeasurement('circle', pts, bField, 0);
      if (mm?.centre) {
        const [cx, cy] = sx(mm.centre.x, mm.centre.y);
        const r = mm.value * view.scale;
        if (r < 6000) {
          c.setLineDash([5, 4]);
          c.globalAlpha = 0.85;
          c.beginPath();
          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.stroke();
          c.globalAlpha = 1;
          c.setLineDash([]);
          c.beginPath();
          c.moveTo(cx - 5, cy);
          c.lineTo(cx + 5, cy);
          c.moveTo(cx, cy - 5);
          c.lineTo(cx, cy + 5);
          c.stroke();
        }
        const [px, py] = sx(pts[1]!.x, pts[1]!.y);
        tag(c, px + 10, py + 18, `R = ${mm.value.toFixed(0)} mm`);
      }
    } else if (tl === 'angle' && pts.length >= 2) {
      const [vx, vy] = sx(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = sx(pts[i]!.x, pts[i]!.y);
        c.beginPath();
        c.moveTo(vx, vy);
        c.lineTo(x, y);
        c.stroke();
      }
      if (pts.length >= 3) {
        const [ax, ay] = sx(pts[1]!.x, pts[1]!.y);
        const [bx, by] = sx(pts[2]!.x, pts[2]!.y);
        const a1 = Math.atan2(ay - vy, ax - vx);
        const a2 = Math.atan2(by - vy, bx - vx);
        let d = a2 - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        c.beginPath();
        c.arc(vx, vy, 26, a1, a1 + d, d < 0);
        c.stroke();
        const am = a1 + d / 2;
        const ang = makeMeasurement('angle', pts, 0, 0)!.value;
        tag(c, vx + Math.cos(am) * 34, vy + Math.sin(am) * 34, `${ang.toFixed(1)}°`);
      }
    }
    pts.forEach((p, i) => dot(c, p, tl === 'angle' && i === 0 ? 'vertex' : ''));
    void m;
  }

  // ───────────── pointer and keyboard ─────────────
  function local(e: PointerEvent | MouseEvent): [number, number] {
    const r = ov!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function worldAt(sxp: number, syp: number, doSnap: boolean): Pt {
    const [x, y] = screenToWorld(view, W, H, sxp, syp);
    if (doSnap && snap) {
      const n = field.nearest(x, y, 8 / view.scale);
      if (n) return { x: n.x, y: n.y };
    }
    return { x, y };
  }

  function addPoint(p: Pt) {
    if (tool === 'none') return;
    pending = [...pending, p];
    if (pending.length >= POINTS_NEEDED[tool]) {
      const m = makeMeasurement(tool, pending, bField, nextId++);
      if (m) {
        // which track do the points lie on?
        const hit = pickTrack(tracks, pending[Math.floor(pending.length / 2)]!.x, pending[Math.floor(pending.length / 2)]!.y, 10 / view.scale, eligible);
        m.track = hit ? hit.track.id : null;
        measurements = [...measurements, m];
      }
      pending = [];
    }
  }

  function pickAt(p: Pt) {
    const hit = pickTrack(tracks, p.x, p.y, 9 / view.scale, eligible);
    selected = hit ? hit.track.id : null;
    onpick?.(hit ? hit.track : null);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    ov!.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    drag = { x, y, cx: centre.x, cy: centre.y, moved: false };
  }
  function onPointerMove(e: PointerEvent) {
    const [x, y] = local(e);
    if (drag) {
      const dx = x - drag.x;
      const dy = y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5 && zoomable && zoom > 1 && tool === 'none') drag.moved = true;
      if (drag.moved) {
        centre = { x: drag.cx - dx / view.scale, y: drag.cy + dy / view.scale };
        return;
      }
    }
    hover = tool !== 'none' ? worldAt(x, y, true) : null;
  }
  function onPointerUp(e: PointerEvent) {
    const d = drag;
    drag = null;
    if (!d || d.moved) return;
    const [x, y] = local(e);
    if (tool !== 'none') addPoint(worldAt(x, y, true));
    else pickAt(worldAt(x, y, false));
    ov!.focus({ preventScroll: true });
  }
  function onPointerLeave() {
    hover = null;
  }
  function onWheel(e: WheelEvent) {
    if (!zoomable || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const [x, y] = local(e);
    zoomTo(Math.exp(-e.deltaY * 0.0015), x, y);
  }

  function clampCentre() {
    const hw = worldW / 2;
    const hh = worldH / 2;
    centre = { x: Math.max(-hw, Math.min(hw, centre.x)), y: Math.max(-hh, Math.min(hh, centre.y)) };
  }
  function zoomTo(factor: number, px = W / 2, py = H / 2) {
    const v = zoomAt(view, factor, px, py, W, H, fit.scale, fit.scale * 14);
    zoom = v.scale / fit.scale;
    centre = zoom <= 1.0001 ? { x: 0, y: 0 } : { x: v.cx, y: v.cy };
    if (zoom > 1.0001) clampCentre();
  }
  export function zoomBy(f: number) {
    zoomTo(f);
  }
  export function resetView() {
    zoom = 1;
    centre = { x: 0, y: 0 };
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = (e.shiftKey ? 12 : 2) / view.scale;
    const c = cursor ?? { x: centre.x, y: centre.y };
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        cursor = { x: c.x - step, y: c.y };
        break;
      case 'ArrowRight':
        cursor = { x: c.x + step, y: c.y };
        break;
      case 'ArrowUp':
        cursor = { x: c.x, y: c.y + step };
        break;
      case 'ArrowDown':
        cursor = { x: c.x, y: c.y - step };
        break;
      case 'Enter':
      case ' ': {
        const p = cursor ?? c;
        cursor = p;
        if (tool !== 'none') {
          const n = snap ? field.nearest(p.x, p.y, 8 / view.scale) : null;
          addPoint(n ? { x: n.x, y: n.y } : p);
        } else pickAt(p);
        break;
      }
      case 'Backspace':
        pending = pending.slice(0, -1);
        break;
      case 'Escape':
        pending = [];
        break;
      case '+':
      case '=':
        if (zoomable) zoomTo(1.4);
        break;
      case '-':
        if (zoomable) zoomTo(1 / 1.4);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      if (cursor) hover = null;
    }
  }

  const hintText = $derived(tool === 'none' ? 'Click a track to select it.' : `${TOOL_HELP[tool]} (${pending.length} of ${POINTS_NEEDED[tool]} points placed)`);
</script>

<div class="stage screen" bind:this={stage} style:aspect-ratio="{worldW} / {worldH}" style:max-height={maxHeight}>
  {#key canvasKey}
    <canvas class="gl" bind:this={glCanvas} aria-hidden="true"></canvas>
  {/key}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <canvas
    class="overlay"
    bind:this={ov}
    tabindex="0"
    role="application"
    aria-label={ariaLabel}
    aria-describedby="{uid}-hint"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerLeave}
    onwheel={onWheel}
    onkeydown={onKeyDown}
    onfocus={() => {
      focused = true;
      cursor ??= { x: centre.x, y: centre.y };
    }}
    onblur={() => (focused = false)}
  ></canvas>
  {#if zoomable}
    <div class="zoom ui" role="group" aria-label="Zoom">
      <button type="button" onclick={() => zoomBy(1.5)} aria-label="Zoom in" title="Zoom in">+</button>
      <button type="button" onclick={() => zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out">−</button>
      <button type="button" onclick={resetView} aria-label="Fit the whole picture" title="Fit the whole picture">⤢</button>
    </div>
  {/if}
</div>
<p class="hint ui" id="{uid}-hint" aria-live="polite">
  {hintText}
  <span class="kbd">Keyboard: arrow keys move a crosshair (Shift for bigger steps), Enter places a point or selects the nearest track{zoomable ? ', + and − zoom' : ''}.</span>
</p>

<style>
  .stage {
    position: relative;
    width: 100%;
    background: #03070b;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.03), inset 0 0 40px rgb(0 0 0 / 0.6);
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .overlay {
    touch-action: pan-y;
    cursor: crosshair;
    outline: none;
  }
  .overlay:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .zoom {
    position: absolute;
    right: 8px;
    bottom: 8px;
    display: flex;
    gap: 4px;
  }
  .zoom button {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: rgb(8 14 22 / 0.85);
    color: var(--fg);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
  }
  .zoom button:hover {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .hint {
    margin: 0.35rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .kbd {
    display: block;
    opacity: 0.85;
  }
</style>
