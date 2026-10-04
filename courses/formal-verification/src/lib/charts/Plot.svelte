<!--
  A small 2D plotting frame: scales, recessive grid and axes, crosshair and tooltip.
  Marks are drawn by the caller through the `marks` snippet, which receives the scales.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { makeScale, ticksFor, type AxisSpec, type PlotCtx } from './scales';

  let {
    x,
    y,
    height = 300,
    marks,
    tooltip,
    onpointer,
    crosshair = true,
    label,
    margin = { top: 12, right: 16, bottom: 42, left: 56 },
  }: {
    x: AxisSpec;
    y: AxisSpec;
    height?: number;
    marks: Snippet<[PlotCtx]>;
    /** Rendered at the pointer; receives the data-space pointer position. */
    tooltip?: Snippet<[{ x: number; y: number; ctx: PlotCtx }]>;
    onpointer?: (p: { x: number; y: number } | null) => void;
    crosshair?: boolean;
    /** Accessible description of the chart. */
    label: string;
    margin?: { top: number; right: number; bottom: number; left: number };
  } = $props();

  let width = $state(600);
  const iw = $derived(Math.max(10, width - margin.left - margin.right));
  const ih = $derived(Math.max(10, height - margin.top - margin.bottom));
  const sx = $derived(makeScale(x, [0, iw]));
  const sy = $derived(makeScale(y, [ih, 0]));
  const ctx = $derived({ sx, sy, width: iw, height: ih });
  const xt = $derived(ticksFor(x, sx));
  const yt = $derived(ticksFor(y, sy));

  let ptr = $state<{ px: number; py: number } | null>(null);
  const clipId = $props.id();

  function move(e: PointerEvent) {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = Math.min(iw, Math.max(0, e.clientX - r.left));
    const py = Math.min(ih, Math.max(0, e.clientY - r.top));
    ptr = { px, py };
    onpointer?.({ x: sx.invert(px), y: sy.invert(py) });
  }
  function leave() {
    ptr = null;
    onpointer?.(null);
  }
</script>

<div class="plot ui" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label={label}>
    <defs><clipPath id="clip-{clipId}"><rect width={iw} height={ih} /></clipPath></defs>
    <g transform="translate({margin.left},{margin.top})">
      {#each yt as t (t.value)}
        <line class="grid" x1="0" x2={iw} y1={sy(t.value)} y2={sy(t.value)} />
        <text class="tick" x="-8" y={sy(t.value)} dy="0.32em" text-anchor="end">{t.label}</text>
      {/each}
      {#each xt as t (t.value)}
        <line class="grid" y1="0" y2={ih} x1={sx(t.value)} x2={sx(t.value)} />
        <text class="tick" y={ih + 16} x={sx(t.value)} text-anchor="middle">{t.label}</text>
      {/each}
      <line class="axis" x1="0" x2={iw} y1={ih} y2={ih} />
      {#if x.label}<text class="axis-label" x={iw / 2} y={ih + 34} text-anchor="middle">{x.label}</text>{/if}
      {#if y.label}<text class="axis-label" transform="translate({-margin.left + 14},{ih / 2}) rotate(-90)" text-anchor="middle">{y.label}</text>{/if}
      <g clip-path="url(#clip-{clipId})">
        {@render marks(ctx)}
      </g>
      {#if ptr && crosshair}
        <line class="crosshair" x1={ptr.px} x2={ptr.px} y1="0" y2={ih} />
      {/if}
      <rect class="hit" width={iw} height={ih} onpointermove={move} onpointerleave={leave} role="presentation" />
    </g>
  </svg>
  {#if ptr && tooltip}
    <div class="tip" style:left="{ptr.px + margin.left}px" style:top="{ptr.py + margin.top}px" class:flip={ptr.px > iw * 0.6}>
      {@render tooltip({ x: sx.invert(ptr.px), y: sy.invert(ptr.py), ctx })}
    </div>
  {/if}
</div>

<style>
  .plot {
    position: relative;
    width: 100%;
    min-width: 0;
    background: var(--chart-surface);
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .axis {
    stroke: var(--axis);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .tick {
    fill: var(--ink-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .axis-label {
    fill: var(--ink-2);
    font-size: 12px;
  }
  .crosshair {
    stroke: var(--ink-3);
    stroke-width: 1;
    pointer-events: none;
  }
  .hit {
    fill: transparent;
    cursor: crosshair;
    touch-action: none;
  }
  .tip {
    position: absolute;
    transform: translate(14px, -50%);
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
    color: var(--ink);
    white-space: nowrap;
    z-index: 5;
  }
  .tip.flip {
    transform: translate(calc(-100% - 14px), -50%);
  }
  .plot :global(.line) {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .plot :global(.dot) {
    stroke: var(--chart-surface);
    stroke-width: 2;
  }
</style>
