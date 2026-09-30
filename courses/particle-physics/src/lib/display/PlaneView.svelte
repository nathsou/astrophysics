<!--
  The transverse (r–φ) and longitudinal (r–z) views: a 2D canvas with pan and zoom, the same encodings as the 3D view
  (muons thick, electrons medium, hadrons thin, photons wavy, neutrinos dotted), and the same picking. Exports zoom(),
  reset() and setExtent() for the panel buttons.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { View2D } from './camera.ts';
  import { drawPlane, fitPlane, planeProjector, type PlaneMode } from './draw2d.ts';
  import type { RenderOptions } from './glData.ts';
  import type { DisplayScene } from './scene.ts';
  import { ScenePicker } from './scenePick.ts';

  let {
    mode,
    scene,
    options,
    states,
    height = 340,
    onhover,
    onselect,
    oncycle,
    label,
    description,
  }: {
    mode: PlaneMode;
    scene: DisplayScene;
    options: RenderOptions;
    states: Uint8Array | null;
    height?: number;
    onhover?: (id: number | null, clientX: number, clientY: number) => void;
    onselect?: (id: number | null) => void;
    oncycle?: (dir: 1 | -1) => void;
    label: string;
    description?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let wrap = $state<HTMLDivElement>();
  const view = new View2D();
  // With muons the whole detector is shown, otherwise the calorimeters fill the view.
  const autoExtent = (s: DisplayScene): 'all' | 'calo' => (s.muonHits.count > 0 || s.objects.some((o) => o.cat === 'object' && o.kind === 'muon') ? 'all' : 'calo');
  let extent: 'all' | 'calo' | 'tracker' = autoExtent(scene);
  let raf = 0;
  let dpr = 1;
  let ready = false;
  let picker: ScenePicker | null = null;
  let hoverId: number | null = null;
  let hoverRaf = 0;
  let hoverAt: { x: number; y: number; cx: number; cy: number } | null = null;
  const proj = planeProjector(mode, view);

  export function setExtent(e: 'all' | 'calo' | 'tracker'): void {
    extent = e;
    fitPlane(mode, view, scene, e);
    request();
  }
  export function zoom(f: number): void {
    view.zoomAt(view.width / 2, view.height / 2, f);
    request();
  }
  export function reset(): void {
    setExtent(autoExtent(scene));
  }

  function request(): void {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw(): void {
    raf = 0;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !ready) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlane(ctx, scene, mode, view, options, states);
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (!wrap || !canvas) return;
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      view.resize(r.width, r.height);
      if (!ready) {
        ready = true;
        fitPlane(mode, view, scene, extent);
      } else fitPlane(mode, view, scene, extent);
      request();
    });
    if (wrap) ro.observe(wrap);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas!.getBoundingClientRect();
      view.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      request();
    };
    canvas?.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas?.removeEventListener('wheel', wheel);
      if (raf) cancelAnimationFrame(raf);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
    };
  });

  let lastScene: DisplayScene | null = null;
  $effect(() => {
    const s = scene;
    picker = new ScenePicker(s);
    if (ready && lastScene !== s) {
      extent = autoExtent(s);
      fitPlane(mode, view, s, extent);
    }
    lastScene = s;
    options;
    states;
    request();
  });

  const pointers = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number } | null = null;
  let moved = false;
  let pinch = 0;

  function local(e: { clientX: number; clientY: number }) {
    const r = canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pickAt(x: number, y: number): number | null {
    const r = picker?.pick(proj, x, y, { showTruth: options.showTruth, showReco: options.showReco, showHits: options.showHits, showCalo: options.showCalo });
    return r ? r.id : null;
  }
  function onDown(e: PointerEvent): void {
    canvas!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      down = p;
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      moved = true;
    }
  }
  function onMove(e: PointerEvent): void {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (prev) {
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        if (!moved && down && Math.hypot(p.x - down.x, p.y - down.y) > 4) moved = true;
        if (moved) {
          view.pan(p.x - prev.x, p.y - prev.y);
          request();
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0 && d > 0) {
          view.zoomAt((a!.x + b!.x) / 2, (a!.y + b!.y) / 2, d / pinch);
          request();
        }
        pinch = d;
      }
      return;
    }
    if (e.pointerType === 'touch') return;
    hoverAt = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY };
    if (!hoverRaf)
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        if (!hoverAt) return;
        const id = pickAt(hoverAt.x, hoverAt.y);
        if (id !== hoverId) {
          hoverId = id;
          onhover?.(id, hoverAt.cx, hoverAt.cy);
        } else if (id !== null) onhover?.(id, hoverAt.cx, hoverAt.cy);
      });
  }
  function onUp(e: PointerEvent): void {
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (wasSingle && !moved && down) {
      const p = local(e);
      onselect?.(pickAt(p.x, p.y));
    }
    if (pointers.size === 0) down = null;
  }
  function onLeave(): void {
    hoverAt = null;
    if (hoverId !== null) {
      hoverId = null;
      onhover?.(null, 0, 0);
    }
  }
  function onKey(e: KeyboardEvent): void {
    const step = 40;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': view.pan(step, 0); break;
      case 'ArrowRight': view.pan(-step, 0); break;
      case 'ArrowUp': view.pan(0, step); break;
      case 'ArrowDown': view.pan(0, -step); break;
      case '+': case '=': view.zoomAt(view.width / 2, view.height / 2, 1.25); break;
      case '-': case '_': view.zoomAt(view.width / 2, view.height / 2, 0.8); break;
      case '0': reset(); break;
      case '[': oncycle?.(-1); break;
      case ']': oncycle?.(1); break;
      case 'Escape': onselect?.(null); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      request();
    }
  }
</script>

<div class="plane screen" bind:this={wrap} style="height:{height}px">
  <canvas
    bind:this={canvas}
    tabindex="0"
    role="application"
    aria-label={label}
    aria-description={description}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onpointerleave={onLeave}
    onkeydown={onKey}
    ondblclick={reset}
  ></canvas>
</div>

<style>
  .plane {
    position: relative;
    width: 100%;
    background: #05080d;
    overflow: hidden;
    border-radius: 6px;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: pan-y;
    cursor: grab;
    outline-offset: -2px;
  }
  canvas:active {
    cursor: grabbing;
  }
  canvas:focus-visible {
    outline: 2px solid var(--focus);
  }
</style>
