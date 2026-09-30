<!--
  The η–φ "lego" plot: calorimeter transverse energy as bars over the (η, φ) plane, jets as circles of radius 0.4, leptons
  and photons as poles, and the missing pT as a dotted line. An orthographic orbit camera (drag or arrow keys to turn it).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Camera } from './camera.ts';
  import { drawLego, legoCamera, legoModel, pickLego, type LegoPolygons } from './draw2d.ts';
  import type { RenderOptions } from './glData.ts';
  import type { DisplayScene } from './scene.ts';

  let {
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
  const cam = new Camera({ ortho: true });
  let raf = 0;
  let dpr = 1;
  let ready = false;
  let polys: LegoPolygons | null = null;
  let hoverId: number | null = null;
  const model = $derived(legoModel(scene));

  function resetCam(): void {
    cam.azimuth = 0.62;
    cam.elevation = 0.62;
    if (ready) legoCamera(cam, cam.width, cam.height);
  }
  resetCam();

  export function rotate(dAz: number, dEl: number): void {
    cam.orbit(dAz, dEl);
    request();
  }
  export function zoom(f: number): void {
    cam.fov = Math.max(0.15, Math.min(2.2, cam.fov * f));
    request();
  }
  export function reset(): void {
    resetCam();
    request();
  }

  function request(): void {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw(): void {
    raf = 0;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !ready) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cam.update();
    polys = drawLego(ctx, scene, model, cam, options, states);
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (!wrap || !canvas) return;
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const az = cam.azimuth, el = cam.elevation;
      ready = true;
      legoCamera(cam, r.width, r.height);
      cam.azimuth = az;
      cam.elevation = el;
      request();
    });
    if (wrap) ro.observe(wrap);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0015));
    };
    canvas?.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas?.removeEventListener('wheel', wheel);
      if (raf) cancelAnimationFrame(raf);
    };
  });

  $effect(() => {
    scene;
    options;
    states;
    request();
  });

  let down: { x: number; y: number } | null = null;
  let last: { x: number; y: number } | null = null;
  let moved = false;
  function local(e: { clientX: number; clientY: number }) {
    const r = canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pickAt(x: number, y: number): number | null {
    const id = pickLego(polys, x, y);
    return id >= 0 ? id : null;
  }
  function onDown(e: PointerEvent): void {
    canvas!.setPointerCapture(e.pointerId);
    down = last = local(e);
    moved = false;
  }
  function onMove(e: PointerEvent): void {
    const p = local(e);
    if (down && e.buttons) {
      if (!moved && Math.hypot(p.x - down.x, p.y - down.y) > 4) moved = true;
      if (moved && last) {
        cam.orbit(-(p.x - last.x) * 0.008, (p.y - last.y) * 0.008);
        request();
      }
      last = p;
      return;
    }
    if (e.pointerType === 'touch') return;
    const id = pickAt(p.x, p.y);
    if (id !== hoverId) {
      hoverId = id;
      onhover?.(id, e.clientX, e.clientY);
    } else if (id !== null) onhover?.(id, e.clientX, e.clientY);
  }
  function onUp(e: PointerEvent): void {
    if (down && !moved) {
      const p = local(e);
      onselect?.(pickAt(p.x, p.y));
    }
    down = last = null;
  }
  function onLeave(): void {
    if (hoverId !== null) {
      hoverId = null;
      onhover?.(null, 0, 0);
    }
  }
  function onKey(e: KeyboardEvent): void {
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': cam.orbit(0.08, 0); break;
      case 'ArrowRight': cam.orbit(-0.08, 0); break;
      case 'ArrowUp': cam.orbit(0, 0.08); break;
      case 'ArrowDown': cam.orbit(0, -0.08); break;
      case '+': case '=': zoom(0.85); break;
      case '-': case '_': zoom(1 / 0.85); break;
      case '0': resetCam(); break;
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

<div class="lego screen" bind:this={wrap} style="height:{height}px">
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
  .lego {
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
