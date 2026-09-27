<!--
  Interactive matrix heatmap (WebGPU, falling back to WebGL2). Square cells, optional row/column
  labels, hover tooltip, highlight, and a table view for accessibility on small matrices.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { createHeatmapRenderer, type HeatmapRenderer } from './heatmap';
  import { colormapLUT, colorAt, type RampName } from './colormap';
  import { theme } from '$lib/state/theme.svelte';

  let {
    values,
    rows,
    cols,
    ramp = 'sequential',
    range,
    log = false,
    rowLabels,
    colLabels,
    rowTitle,
    colTitle,
    maxCell = 28,
    highlight = null,
    onhover,
    tooltip,
    format = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(2) : v.toPrecision(3)),
    label = 'Heatmap',
  }: {
    values: Float32Array;
    rows: number;
    cols: number;
    ramp?: RampName;
    /** [min, max] in value space; defaults to the data range (symmetric for diverging). */
    range?: [number, number];
    log?: boolean;
    rowLabels?: string[];
    colLabels?: string[];
    rowTitle?: string;
    colTitle?: string;
    maxCell?: number;
    highlight?: { row: number; col: number } | null;
    onhover?: (cell: { row: number; col: number; value: number } | null) => void;
    tooltip?: Snippet<[{ row: number; col: number; value: number }]>;
    format?: (v: number) => string;
    label?: string;
  } = $props();

  let wrap: HTMLDivElement;
  let canvasHost: HTMLDivElement;
  let width = $state(0);
  let renderer = $state<HeatmapRenderer | null>(null);
  let failed = $state(false);
  let hover = $state<{ row: number; col: number; value: number; x: number; y: number } | null>(null);
  let showTable = $state(false);

  const labelW = $derived(rowLabels ? Math.min(90, 8 + Math.max(...rowLabels.map((l) => l.length)) * 7.2) : 0);
  const longCols = $derived(!!colLabels && Math.max(...colLabels.map((l) => l.length)) > 2);
  const labelH = $derived(!colLabels ? 0 : longCols ? Math.min(70, 10 + Math.max(...colLabels.map((l) => l.length)) * 6.5) : 16);
  const cell = $derived(Math.max(1, Math.min(maxCell, (width - labelW) / Math.max(1, cols))));
  const plotW = $derived(Math.floor(cell * cols));
  const plotH = $derived(Math.floor(cell * rows));

  const valueRange = $derived.by((): [number, number] => {
    if (range) return range;
    let lo = Infinity, hi = -Infinity;
    for (const v of values) {
      if (!Number.isFinite(v) || (log && v <= 0)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!Number.isFinite(lo)) return [0, 1];
    if (ramp === 'diverging') {
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      return [-m, m];
    }
    return [lo, hi];
  });

  // Show every k-th label so they never overlap.
  const labelStride = (n: number) => Math.max(1, Math.ceil(13 / Math.max(cell, 0.01)));

  function rgb(css: string): [number, number, number] {
    const probe = document.createElement('span');
    probe.style.color = css;
    wrap.appendChild(probe);
    const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ['0', '0', '0'];
    probe.remove();
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }

  onMount(() => {
    let r: HeatmapRenderer | null = null;
    createHeatmapRenderer(() => {
      canvasHost.replaceChildren();
      const c = document.createElement('canvas');
      c.setAttribute('aria-hidden', 'true');
      canvasHost.appendChild(c);
      return c;
    }).then((res) => {
      r = res;
      if (res) renderer = res;
      else failed = true;
    });
    return () => r?.destroy();
  });

  $effect(() => {
    renderer?.setData(values, rows, cols);
    draw();
  });

  let colors: { surface: [number, number, number]; ink: [number, number, number] } = { surface: [255, 255, 255], ink: [0, 0, 0] };
  $effect(() => {
    void theme.resolved;
    colors = { surface: rgb('var(--chart-surface)'), ink: rgb('var(--ink)') };
    renderer?.setColormap(colormapLUT(ramp, theme.resolved));
    draw();
  });

  $effect(() => {
    void [plotW, plotH, valueRange, log, highlight, hover];
    draw();
  });

  function draw() {
    if (!renderer || plotW < 1 || plotH < 1) return;
    const dpr = devicePixelRatio || 1;
    const [lo, hi] = valueRange;
    const h = hover ?? highlight;
    const cssCanvas = canvasHost.firstElementChild as HTMLCanvasElement | null;
    if (cssCanvas) {
      cssCanvas.style.width = `${plotW}px`;
      cssCanvas.style.height = `${plotH}px`;
    }
    renderer.render(
      {
        rows,
        cols,
        vmin: log ? Math.log(Math.max(lo, 1e-30)) : lo,
        vmax: log ? Math.log(Math.max(hi, 1e-30)) : hi,
        log,
        hiRow: h ? h.row : -1,
        hiCol: h ? h.col : -1,
        gap: cell >= 10 ? 2 * dpr : cell >= 5 ? 1 * dpr : 0,
        surface: colors.surface,
        ink: colors.ink,
      },
      Math.round(plotW * dpr),
      Math.round(plotH * dpr),
    );
  }

  function onMove(e: PointerEvent) {
    const rect = canvasHost.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / cell);
    const row = Math.floor((e.clientY - rect.top) / cell);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return onLeave();
    const value = values[row * cols + col]!;
    hover = { row, col, value, x: e.clientX - rect.left, y: e.clientY - rect.top };
    onhover?.({ row, col, value });
  }
  function onLeave() {
    hover = null;
    onhover?.(null);
  }
</script>

<div class="heatmap ui" bind:this={wrap} bind:clientWidth={width}>
  {#if colTitle || rowTitle}
    <div class="col-title" style:padding-left="{labelW}px" style:width="{labelW + plotW}px">
      {#if rowTitle}<span class="rt">rows: {rowTitle} ↓</span>{/if}
      {#if colTitle}<span>columns: {colTitle}</span>{/if}
    </div>
  {/if}
  <div class="grid" style:grid-template-columns="{labelW}px {plotW}px" style:grid-template-rows="{labelH}px {plotH}px">
    <div class="corner"></div>
    <div class="col-labels">
      {#if colLabels}
        {#each colLabels as l, j (j)}
          {#if j % labelStride(cols) === 0 || hover?.col === j}
            <span class="cl" class:rot={longCols} class:on={hover?.col === j || highlight?.col === j} style:left="{(j + 0.5) * cell}px">{l}</span>
          {/if}
        {/each}
      {/if}
    </div>
    <div class="row-labels">
      {#if rowLabels}
        {#each rowLabels as l, i (i)}
          {#if i % labelStride(rows) === 0 || hover?.row === i}
            <span class="rl" class:on={hover?.row === i || highlight?.row === i} style:top="{(i + 0.5) * cell}px">{l}</span>
          {/if}
        {/each}
      {/if}
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="plot" onpointermove={onMove} onpointerleave={onLeave} role="img" aria-label={label}>
      <div class="canvas-host" bind:this={canvasHost}></div>
      {#if failed}<p class="fail">This browser supports neither WebGPU nor WebGL2.</p>{/if}
      {#if hover}
        <div class="tip" style:left="{hover.x}px" style:top="{hover.y}px" class:flip={hover.x > plotW * 0.6}>
          {#if tooltip}{@render tooltip(hover)}{:else}
            <div>{rowLabels?.[hover.row] ?? hover.row} · {colLabels?.[hover.col] ?? hover.col}</div>
            <div class="v num">{format(hover.value)}</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  <div class="footer">
    <div class="scale" style:margin-left="{labelW}px">
      <span class="num">{format(valueRange[0])}</span>
      <span class="bar" style:background="linear-gradient(to right, {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => colorAt(ramp, theme.resolved, t)).join(',')})"></span>
      <span class="num">{format(valueRange[1])}</span>
      {#if log}<span class="note">log scale</span>{/if}
    </div>
    {#if rows * cols <= 2500}
      <button class="table-btn" onclick={() => (showTable = !showTable)}>{showTable ? 'Hide' : 'Show'} table</button>
    {/if}
  </div>
  {#if showTable}
    <div class="table-wrap">
      <table>
        <thead><tr><th></th>{#each { length: cols } as _, j (j)}<th>{colLabels?.[j] ?? j}</th>{/each}</tr></thead>
        <tbody>
          {#each { length: rows } as _, i (i)}
            <tr><th>{rowLabels?.[i] ?? i}</th>{#each { length: cols } as _, j (j)}<td class="num">{format(values[i * cols + j]!)}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .heatmap {
    width: 100%;
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .col-title {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--ink-3);
    margin-bottom: 0.3rem;
  }
  .grid {
    display: grid;
  }
  .corner {
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0 6px 4px 0;
    color: var(--ink-3);
  }
  .col-labels,
  .row-labels {
    position: relative;
    font-family: var(--font-mono);
  }
  .cl {
    position: absolute;
    bottom: 2px;
    transform: translateX(-50%);
    white-space: pre;
  }
  .cl.rot {
    transform-origin: left bottom;
    transform: translateX(-0.35em) rotate(-55deg);
  }
  .rl {
    position: absolute;
    right: 6px;
    transform: translateY(-50%);
    white-space: pre;
  }
  .on {
    color: var(--ink);
    font-weight: 700;
  }
  .plot {
    position: relative;
    cursor: crosshair;
    touch-action: none;
  }
  .canvas-host :global(canvas) {
    display: block;
    border-radius: 3px;
  }
  .tip {
    position: absolute;
    transform: translate(12px, 12px);
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    border-radius: 6px;
    padding: 0.35rem 0.55rem;
    font-size: 0.78rem;
    color: var(--ink);
    white-space: nowrap;
    z-index: 5;
  }
  .tip.flip {
    transform: translate(calc(-100% - 12px), 12px);
  }
  .v {
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .fail {
    font-size: 0.85rem;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .bar {
    width: 120px;
    height: 8px;
    border-radius: 4px;
  }
  .note {
    color: var(--ink-3);
  }
  .table-btn {
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.75rem;
  }
  .table-wrap {
    max-height: 20rem;
    overflow: auto;
    margin-top: 0.5rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.72rem;
  }
  th,
  td {
    padding: 0.15rem 0.35rem;
    border: 1px solid var(--rule);
    text-align: right;
  }
</style>
