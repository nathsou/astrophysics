<!--
  A pannable, zoomable SVG canvas for big chip views. Content is drawn in "content pixels" inside the group
  the snippet renders into; the viewBox always equals the container, so lines stay crisp at every zoom.

    <PanZoom width={900} height={1200} {children}>  children({ k, toContent })

  Drag pans, the wheel zooms (with Ctrl or ⌘ when `wheel="modifier"`, as inside a chapter, so the page still
  scrolls), two fingers pinch, the keyboard pans (arrows), zooms (+ −) and refits (0). `focus(rect)` zooms to
  a rectangle of the content (a macrocell, a row group).
-->
<script lang="ts" module>
  export interface View {
    k: number;
    tx: number;
    ty: number;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import Icon from '../../components/ui/Icon.svelte';

  let {
    width,
    height,
    children,
    overlay,
    wheel = 'always',
    minK = 0.05,
    maxK = 14,
    label = 'Chip view',
    ondown,
    showControls = true,
    view = $bindable(),
    onkey,
    onfocuschange,
    onpoint,
  }: {
    width: number;
    height: number;
    children: Snippet<[{ k: number; toContent: (e: { clientX: number; clientY: number }) => { x: number; y: number } }]>;
    overlay?: Snippet<[{ w: number; h: number }]>;
    wheel?: 'always' | 'modifier';
    minK?: number;
    maxK?: number;
    label?: string;
    /** A click that was not a drag, in content coordinates. */
    ondown?: (p: { x: number; y: number }, ev: PointerEvent) => void;
    showControls?: boolean;
    view?: View;
    /** Keyboard handler of the content; return true when it used the key (Shift+arrows always pan). */
    onkey?: (ev: KeyboardEvent) => boolean | void;
    onfocuschange?: (focused: boolean) => void;
    /** The pointer over the content (content pixels), or null when it leaves. */
    onpoint?: (p: { x: number; y: number } | null, ev: PointerEvent | null) => void;
  } = $props();

  let box: HTMLDivElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let w = $state(600);
  let h = $state(400);
  let k = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let fitted = $state(false);
  let userMoved = false;

  const clampK = (v: number) => Math.max(minK, Math.min(maxK, v));

  export function fit(pad = 12) {
    const kk = clampK(Math.min((w - 2 * pad) / width, (h - 2 * pad) / height));
    k = kk;
    tx = (w - width * kk) / 2;
    ty = Math.max(pad, (h - height * kk) / 2);
    userMoved = false;
  }

  /** Zoom so the rectangle (content pixels) fills the view. */
  export function focus(r: { x: number; y: number; w: number; h: number }, pad = 24) {
    const kk = clampK(Math.min((w - 2 * pad) / r.w, (h - 2 * pad) / r.h));
    k = kk;
    tx = (w - r.w * kk) / 2 - r.x * kk;
    ty = (h - r.h * kk) / 2 - r.y * kk;
    userMoved = true;
  }

  export function zoomBy(f: number, cx = w / 2, cy = h / 2) {
    const nk = clampK(k * f);
    const r = nk / k;
    tx = cx - (cx - tx) * r;
    ty = cy - (cy - ty) * r;
    k = nk;
    userMoved = true;
  }

  /** Pan (only as far as needed) so a content point is inside the view. */
  export function ensureVisible(x: number, y: number, pad = 40) {
    const sx = x * k + tx;
    const sy = y * k + ty;
    if (sx < pad) tx += pad - sx;
    else if (sx > w - pad) tx -= sx - (w - pad);
    if (sy < pad) ty += pad - sy;
    else if (sy > h - pad) ty -= sy - (h - pad);
    userMoved = true;
  }

  export function toContent(e: { clientX: number; clientY: number }) {
    const r = svg!.getBoundingClientRect();
    return { x: (e.clientX - r.left - tx) / k, y: (e.clientY - r.top - ty) / k };
  }

  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => {
      const r = box!.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      w = r.width;
      h = r.height;
      if (!userMoved) untrack(() => fit());
      fitted = true;
    });
    ro.observe(box);
    return () => ro.disconnect();
  });
  $effect(() => {
    void width;
    void height;
    if (fitted && !userMoved) untrack(() => fit());
  });
  $effect(() => {
    if (view) untrack(() => ((view!.k = k), (view!.tx = tx), (view!.ty = ty)));
  });

  // ── Pointer: pan, pinch, click ───────────────────────────────────────────
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number; id: number } | null = null;
  let moved = false;
  let pinch: { d: number; k: number } | null = null;

  function down(ev: PointerEvent) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) {
      downAt = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), k };
      moved = true;
    }
  }
  function move(ev: PointerEvent) {
    const p = pointers.get(ev.pointerId);
    if (!p) {
      if (onpoint && svg) onpoint(toContent(ev), ev);
      return;
    }
    if (!moved && onpoint) onpoint(toContent(ev), ev);
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    if (pointers.size === 2 && pinch) {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const r = svg!.getBoundingClientRect();
      const cx = (a!.x + b!.x) / 2 - r.left;
      const cy = (a!.y + b!.y) / 2 - r.top;
      const target = clampK(pinch.k * (d / pinch.d));
      zoomBy(target / k, cx, cy);
      return;
    }
    if (downAt && !moved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) {
      moved = true;
      try {
        (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
      } catch {
        /* the pointer is gone */
      }
    }
    if (moved && pointers.size === 1) {
      tx += dx;
      ty += dy;
      userMoved = true;
    }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  }
  function up(ev: PointerEvent) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (downAt && downAt.id === ev.pointerId) {
      if (!moved && ondown) ondown(toContent(ev), ev);
      downAt = null;
    }
  }
  function onwheel(ev: WheelEvent) {
    if (wheel === 'modifier' && !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const r = svg!.getBoundingClientRect();
    zoomBy(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016)), ev.clientX - r.left, ev.clientY - r.top);
  }
  function key(ev: KeyboardEvent) {
    if (!ev.shiftKey && onkey?.(ev)) return;
    const step = 60;
    switch (ev.key) {
      case 'ArrowLeft':
        tx += step;
        break;
      case 'ArrowRight':
        tx -= step;
        break;
      case 'ArrowUp':
        ty += step;
        break;
      case 'ArrowDown':
        ty -= step;
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
        fit();
        break;
      default:
        return;
    }
    userMoved = ev.key !== '0';
    ev.preventDefault();
  }
  $effect(() => {
    if (!svg) return;
    svg.addEventListener('wheel', onwheel, { passive: false });
    return () => svg?.removeEventListener('wheel', onwheel);
  });
</script>

<div class="pz" bind:this={box}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svg}
    viewBox="0 0 {w} {h}"
    width={w}
    height={h}
    role="application"
    aria-label="{label}. Drag to pan, scroll or plus and minus to zoom, 0 to fit."
    tabindex="0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onpointerleave={() => onpoint?.(null, null)}
    onkeydown={key}
    onfocus={() => onfocuschange?.(true)}
    onblur={() => onfocuschange?.(false)}
  >
    <g transform="translate({tx} {ty}) scale({k})">
      {@render children({ k, toContent })}
    </g>
  </svg>
  {@render overlay?.({ w, h })}
  {#if showControls}
    <div class="ctl" role="group" aria-label="Zoom">
      <button type="button" onclick={() => zoomBy(1.4)} aria-label="Zoom in" title="Zoom in (+)">+</button>
      <button type="button" onclick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out (−)">−</button>
      <button type="button" onclick={() => fit()} aria-label="Fit to view" title="Fit to view (0)"><Icon name="fullscreen" size={13} /></button>
    </div>
  {/if}
</div>

<style>
  .pz {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 12rem;
    overflow: hidden;
    touch-action: none;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;
  }
  svg:active {
    cursor: grabbing;
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
</style>
