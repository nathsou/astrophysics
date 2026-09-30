<!--
  The 3D view: a WebGL2 canvas with an orbit camera (mouse, touch and keyboard). Drawing is done by EventGL (gl.ts);
  picking by ScenePicker. Calls `onfail` if WebGL2 is unavailable or the context is lost so the parent can fall back to the
  2D views. Exports rotate(), zoom() and reset() for the buttons in the panel header.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Camera } from './camera.ts';
  import { EventGL } from './gl.ts';
  import { ScenePicker } from './scenePick.ts';
  import type { DisplayScene } from './scene.ts';
  import type { RenderOptions } from './glData.ts';
  import { outerRadius } from './geometry.ts';

  let {
    scene,
    options,
    states,
    height = 380,
    autoRotate = false,
    onhover,
    onselect,
    oncycle,
    onfail,
    label,
    description,
  }: {
    scene: DisplayScene;
    options: RenderOptions;
    /** Highlight state per object id, or null for no selection. */
    states: Uint8Array | null;
    height?: number;
    autoRotate?: boolean;
    onhover?: (id: number | null, clientX: number, clientY: number) => void;
    onselect?: (id: number | null) => void;
    /** `[` and `]`: step the selection through the objects. */
    oncycle?: (dir: 1 | -1) => void;
    onfail?: (message: string) => void;
    label: string;
    description?: string;
  } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let wrap = $state<HTMLDivElement>();
  let gl: EventGL | null = $state(null);
  let failed = $state<string | null>(null);

  const cam = new Camera();
  let raf = 0;
  let lastT = 0;
  let hoverRaf = 0;
  let hoverAt: { x: number; y: number; cx: number; cy: number } | null = null;
  let hoverId: number | null = null;
  let picker: ScenePicker | null = null;
  const proj = (x: number, y: number, z: number, _s: number, out: Float64Array) => cam.project(x, y, z, out);

  function resetCamera(): void {
    const g = scene.geometry;
    cam.azimuth = 1.05;
    cam.elevation = 0.32;
    cam.target = [0, 0, 0];
    // A narrow view needs to stand further back to show the same detector.
    const aspect = cam.width / cam.height;
    cam.distance = Math.max(g.hcal.rOut * 3.6, (g.muon[0]?.r ?? 0) * 2.3) * Math.max(1, 1.35 / aspect);
    cam.fov = (36 * Math.PI) / 180;
  }
  resetCamera();

  export function rotate(dAz: number, dEl: number): void {
    cam.orbit(dAz, dEl);
    request();
  }
  export function zoom(factor: number): void {
    cam.zoom(factor, 400, outerRadius(scene.geometry) * 8);
    request();
  }
  export function reset(): void {
    resetCamera();
    request();
  }

  function request(): void {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(t: number): void {
    raf = 0;
    if (!gl) return;
    if (autoRotate) {
      const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016;
      cam.orbit(dt * 0.18, 0);
    }
    lastT = autoRotate ? t : 0;
    cam.fitClip(outerRadius(scene.geometry) * 1.4);
    cam.update();
    gl.render(cam);
    if (autoRotate) request();
  }

  function fail(msg: string): void {
    failed = msg;
    onfail?.(msg);
  }

  function setup(): void {
    if (!canvas) return;
    try {
      const g = new EventGL(canvas);
      gl = g;
      const r = wrap!.getBoundingClientRect();
      g.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
      cam.resize(r.width, r.height);
      resetCamera();
      g.setScene(scene, options);
      g.setHighlight(states);
      request();
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }

  onMount(() => {
    setup();
    const ro = new ResizeObserver(() => {
      if (!wrap || !gl) return;
      const r = wrap.getBoundingClientRect();
      gl.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
      cam.resize(r.width, r.height);
      request();
    });
    if (wrap) ro.observe(wrap);
    const lost = (e: Event) => {
      e.preventDefault();
      gl = null;
      fail('the graphics context was lost');
    };
    const restored = () => {
      failed = null;
      setup();
    };
    canvas?.addEventListener('webglcontextlost', lost);
    canvas?.addEventListener('webglcontextrestored', restored);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.zoom(Math.exp(e.deltaY * 0.0012), 400, outerRadius(scene.geometry) * 8);
      request();
    };
    canvas?.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas?.removeEventListener('webglcontextlost', lost);
      canvas?.removeEventListener('webglcontextrestored', restored);
      canvas?.removeEventListener('wheel', wheel);
      if (raf) cancelAnimationFrame(raf);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      raf = 0;
      hoverRaf = 0;
      gl?.dispose();
      gl = null;
    };
  });

  // New scene or options: rebuild the instance buffers.
  $effect(() => {
    const s = scene, o = options;
    picker = new ScenePicker(s);
    if (gl) {
      gl.setScene(s, o);
      gl.setHighlight(states);
      request();
    }
  });
  $effect(() => {
    const st = states;
    if (gl) {
      gl.setHighlight(st);
      request();
    }
  });
  $effect(() => {
    if (autoRotate) request();
    else lastT = 0;
  });

  // ── Pointer and keyboard ──
  const pointers = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number } | null = null;
  let moved = false;
  let pinch = 0;
  let mode: 'orbit' | 'pan' = 'orbit';

  function local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pickAt(x: number, y: number): number | null {
    if (!picker) return null;
    cam.update();
    const r = picker.pick(proj, x, y, { showTruth: options.showTruth, showReco: options.showReco, showHits: options.showHits, showCalo: options.showCalo });
    return r ? r.id : null;
  }
  function onDown(e: PointerEvent): void {
    canvas!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      down = p;
      moved = false;
      mode = e.shiftKey || e.button === 2 || e.button === 1 ? 'pan' : 'orbit';
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
          if (mode === 'pan') cam.pan(p.x - prev.x, p.y - prev.y);
          else cam.orbit(-(p.x - prev.x) * 0.008, (p.y - prev.y) * 0.008);
          request();
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch > 0 && d > 0) {
          cam.zoom(pinch / d, 400, outerRadius(scene.geometry) * 8);
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
      const id = pickAt(p.x, p.y);
      onselect?.(id);
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
    const step = e.shiftKey ? 0.2 : 0.08;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': cam.orbit(step, 0); break;
      case 'ArrowRight': cam.orbit(-step, 0); break;
      case 'ArrowUp': cam.orbit(0, step); break;
      case 'ArrowDown': cam.orbit(0, -step); break;
      case '+': case '=': cam.zoom(0.85, 400, outerRadius(scene.geometry) * 8); break;
      case '-': case '_': cam.zoom(1 / 0.85, 400, outerRadius(scene.geometry) * 8); break;
      case '0': resetCamera(); break;
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

<div class="glview screen" bind:this={wrap} style="height:{height}px">
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
    ondblclick={() => {
      resetCamera();
      request();
    }}
    oncontextmenu={(e) => e.preventDefault()}
    class:hidden={!!failed}
  ></canvas>
  {#if failed}
    <div class="fail ui">
      <p><strong>The 3D view is not available.</strong> This browser could not start WebGL 2 ({failed}). The flat views below show the same event.</p>
    </div>
  {/if}
</div>

<style>
  .glview {
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
  .hidden {
    visibility: hidden;
  }
  .fail {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    color: var(--fg);
    font-size: 0.86rem;
    text-align: center;
  }
  .fail p {
    max-width: 28rem;
    margin: 0;
  }
</style>
