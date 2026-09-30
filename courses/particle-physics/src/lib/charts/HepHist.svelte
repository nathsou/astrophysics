<!--
  A particle-physics histogram: step outlines, optional filled areas, optional Poisson error bars, log axes, and
  labelled markers (for resonances and thresholds). Built on Plot.

    <HepHist label="…" series={[{ edges, counts, label: 'data', errors: true }]} x={{ type: 'log', domain: [0.3, 300], label: 'm [GeV]' }} y={{ type: 'log', domain: [1, 1e4], label: 'events' }} markers={[{ x: 91.19, label: 'Z' }]} />

  `edges` has n + 1 entries for n counts. Series with `fill` are drawn as filled areas (stacked backgrounds are the
  caller's business: pass cumulative counts).
-->
<script lang="ts">
  import Plot from './Plot.svelte';
  import type { AxisSpec } from './scales';

  export interface HistSeries {
    edges: ArrayLike<number>;
    counts: ArrayLike<number>;
    label?: string;
    color?: string;
    fill?: boolean;
    /** Draw √N error bars on the bin centres. */
    errors?: boolean;
    /** Draw points rather than a step outline. */
    points?: boolean;
  }
  export interface HistMarker {
    x: number;
    label: string;
    color?: string;
    /** Vertical position as a fraction of the plot height (0 = bottom), to avoid overlapping labels. */
    at?: number;
  }

  let {
    series,
    x,
    y,
    markers = [],
    height = 320,
    label,
    legend = true,
  }: {
    series: HistSeries[];
    x: AxisSpec;
    y: AxisSpec;
    markers?: HistMarker[];
    height?: number;
    label: string;
    legend?: boolean;
  } = $props();

  const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
  const colour = (s: HistSeries, i: number) => s.color ?? COLORS[i % COLORS.length]!;
  const floor = $derived(y.type === 'log' ? y.domain[0] * 0.999 : 0);

  function binOf(s: HistSeries, v: number): number {
    const n = s.counts.length;
    if (v < s.edges[0]! || v >= s.edges[n]!) return -1;
    let a = 0, b = n;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (s.edges[m]! <= v) a = m;
      else b = m;
    }
    return a;
  }
  const fmtX = (v: number) => Number(v.toPrecision(3)).toString();

  function step(s: HistSeries, sx: (v: number) => number, sy: (v: number) => number, close: boolean): string {
    const n = s.counts.length;
    const clamp = (c: number) => (y.type === 'log' ? Math.max(c, floor) : c);
    let d = '';
    for (let i = 0; i < n; i++) {
      const x0 = sx(s.edges[i]!);
      const x1 = sx(s.edges[i + 1]!);
      const yy = sy(clamp(s.counts[i]!));
      d += i === 0 ? `M${x0},${close ? sy(floor) : yy}L${x0},${yy}` : `L${x0},${yy}`;
      d += `L${x1},${yy}`;
    }
    if (close) d += `L${sx(s.edges[n]!)},${sy(floor)}Z`;
    return d;
  }
</script>

<Plot {x} {y} {height} {label} crosshair={true}>
  {#snippet tooltip({ x: xv })}
    {@const s0 = series[0]}
    {#if s0}
      {@const k = binOf(s0, xv)}
      {#if k >= 0}
        <strong>{fmtX(s0.edges[k]!)} – {fmtX(s0.edges[k + 1]!)}</strong><br />{Number(s0.counts[k]).toLocaleString('en-GB')} {s0.label ? '' : 'events'}
      {/if}
    {/if}
  {/snippet}
  {#snippet marks({ sx, sy, height: h })}
    {#each series as s, i}
      {#if s.fill}
        <path d={step(s, sx, sy, true)} fill={colour(s, i)} fill-opacity="0.3" stroke={colour(s, i)} stroke-width="1.2" />
      {:else if s.points}
        {#each Array.from(s.counts) as c, k}
          {#if c > 0 || y.type !== 'log'}
            {@const cx = sx((s.edges[k]! + s.edges[k + 1]!) / 2)}
            <circle {cx} cy={sy(Math.max(c, floor))} r="2.2" fill={colour(s, i)} />
            {#if s.errors && c > 0}
              <line x1={cx} x2={cx} y1={sy(Math.max(c - Math.sqrt(c), floor))} y2={sy(c + Math.sqrt(c))} stroke={colour(s, i)} stroke-width="1" />
            {/if}
          {/if}
        {/each}
      {:else}
        <path d={step(s, sx, sy, false)} fill="none" stroke={colour(s, i)} stroke-width="1.4" />
        {#if s.errors}
          {#each Array.from(s.counts) as c, k}
            {#if c > 0}
              {@const cx = sx((s.edges[k]! + s.edges[k + 1]!) / 2)}
              <line x1={cx} x2={cx} y1={sy(Math.max(c - Math.sqrt(c), floor))} y2={sy(c + Math.sqrt(c))} stroke={colour(s, i)} stroke-width="1" />
            {/if}
          {/each}
        {/if}
      {/if}
    {/each}
    {#each markers as m}
      <line x1={sx(m.x)} x2={sx(m.x)} y1="0" y2={h} stroke={m.color ?? 'var(--mute)'} stroke-dasharray="3 3" stroke-width="1" opacity="0.7" />
      <text x={sx(m.x) + 3} y={12 + (1 - (m.at ?? 1)) * (h - 24)} class="marker" fill={m.color ?? 'var(--ink-2)'}>{m.label}</text>
    {/each}
  {/snippet}
</Plot>
{#if legend && series.some((s) => s.label)}
  <ul class="legend ui">
    {#each series as s, i}{#if s.label}<li><span class="sw" style:background={colour(s, i)}></span>{s.label}</li>{/if}{/each}
  </ul>
{/if}

<style>
  .marker {
    font-size: 11px;
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .legend {
    list-style: none;
    padding: 0;
    margin: 0.3rem 0 0;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 0.8rem;
    height: 0.25rem;
    margin-right: 0.35rem;
    vertical-align: middle;
    border-radius: 2px;
  }
</style>
