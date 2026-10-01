<!--
  A line plot on the shared Plot frame: several lines (optionally dashed, each with a legend label), shaded bands, points with error bars,
  and labelled vertical and horizontal markers. The tooltip lists every line at the cursor. Colour is never the only cue: give lines a `dash`.

    <LinePlot lines={[{ x, y, label: 'ν_μ', dash: '' }]} x={{ type: 'log', domain: [1, 1e5], label: 'L/E [km/GeV]' }} y={{ domain: [0, 1] }} label="…" />
-->
<script lang="ts" module>
  export interface Line {
    x: number[];
    y: number[];
    label: string;
    color?: string;
    dash?: string;
    width?: number;
    /** Fill the area under the line (down to the axis). */
    fill?: boolean;
  }
  export interface Band {
    x: number[];
    lo: number[];
    hi: number[];
    color?: string;
    label?: string;
    opacity?: number;
  }
  export interface Mark {
    value: number;
    label?: string;
    color?: string;
    dash?: string;
  }
  export interface Point {
    x: number;
    y: number;
    yerr?: number;
    xerr?: number;
    label?: string;
    color?: string;
  }
</script>

<script lang="ts">
  import Plot from '$lib/charts/Plot.svelte';
  import type { AxisSpec } from '$lib/charts/scales';

  let {
    lines = [],
    bands = [],
    points = [],
    vmarks = [],
    hmarks = [],
    x,
    y,
    height = 300,
    label,
    legend = true,
    format = (v: number) => (Math.abs(v) >= 100 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(2) : Number(v.toPrecision(3)).toString()),
    margin,
  }: {
    lines?: Line[];
    bands?: Band[];
    points?: Point[];
    vmarks?: Mark[];
    hmarks?: Mark[];
    x: AxisSpec;
    y: AxisSpec;
    height?: number;
    label: string;
    legend?: boolean;
    format?: (v: number) => string;
    margin?: { top: number; right: number; bottom: number; left: number };
  } = $props();

  const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
  const colour = (l: { color?: string }, i: number) => l.color ?? COLORS[i % COLORS.length]!;
  const DASHES = ['', '6 3', '2 3', '8 3 2 3'];
  const dashOf = (l: Line, i: number) => (l.dash !== undefined ? l.dash : DASHES[i % DASHES.length]!);

  function path(xs: number[], ys: number[], sx: (v: number) => number, sy: (v: number) => number, logY: boolean): string {
    let d = '';
    let pen = false;
    for (let i = 0; i < xs.length; i++) {
      const yy = ys[i]!;
      if (!Number.isFinite(yy) || (logY && yy <= 0)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(xs[i]!).toFixed(1)},${sy(yy).toFixed(1)}`;
      pen = true;
    }
    return d;
  }
  function areaPath(xs: number[], lo: number[], hi: number[], sx: (v: number) => number, sy: (v: number) => number): string {
    if (!xs.length) return '';
    let d = '';
    for (let i = 0; i < xs.length; i++) d += `${i ? 'L' : 'M'}${sx(xs[i]!).toFixed(1)},${sy(hi[i]!).toFixed(1)}`;
    for (let i = xs.length - 1; i >= 0; i--) d += `L${sx(xs[i]!).toFixed(1)},${sy(lo[i]!).toFixed(1)}`;
    return d + 'Z';
  }
  function nearest(xs: number[], v: number): number {
    let a = 0, b = xs.length - 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (xs[m]! <= v) a = m;
      else b = m;
    }
    return Math.abs(xs[a]! - v) <= Math.abs(xs[b]! - v) ? a : b;
  }
</script>

<Plot {x} {y} {height} {label} {margin}>
  {#snippet tooltip({ x: xv })}
    <strong>{format(xv)}</strong>
    {#each lines as l, i}
      {#if l.x.length}
        <br /><span class="sw" style:background={colour(l, i)}></span>{l.label}: {format(l.y[nearest(l.x, xv)]!)}
      {/if}
    {/each}
  {/snippet}
  {#snippet marks({ sx, sy, height: h, width: w })}
    {#each bands as b}
      <path d={areaPath(b.x, b.lo, b.hi, sx, sy)} fill={b.color ?? 'var(--series-8)'} fill-opacity={b.opacity ?? 0.25} stroke="none" />
    {/each}
    {#each lines as l, i}
      {#if l.fill}
        <path d={path(l.x, l.y, sx, sy, y.type === 'log') + `L${sx(l.x[l.x.length - 1] ?? 0)},${h}L${sx(l.x[0] ?? 0)},${h}Z`} fill={colour(l, i)} fill-opacity="0.2" stroke="none" />
      {/if}
      <path d={path(l.x, l.y, sx, sy, y.type === 'log')} fill="none" stroke={colour(l, i)} stroke-width={l.width ?? 2} stroke-dasharray={dashOf(l, i)} stroke-linejoin="round" />
    {/each}
    {#each hmarks as m}
      <line x1="0" x2={w} y1={sy(m.value)} y2={sy(m.value)} stroke={m.color ?? 'var(--mute)'} stroke-dasharray={m.dash ?? '4 3'} stroke-width="1.2" />
      {#if m.label}<text x={w - 4} y={sy(m.value) - 4} text-anchor="end" class="mk" fill={m.color ?? 'var(--ink-2)'}>{m.label}</text>{/if}
    {/each}
    {#each vmarks as m}
      <line x1={sx(m.value)} x2={sx(m.value)} y1="0" y2={h} stroke={m.color ?? 'var(--mute)'} stroke-dasharray={m.dash ?? '4 3'} stroke-width="1.2" />
      {#if m.label}<text x={sx(m.value) + (sx(m.value) > w * 0.7 ? -4 : 4)} y="12" text-anchor={sx(m.value) > w * 0.7 ? 'end' : 'start'} class="mk" fill={m.color ?? 'var(--ink-2)'}>{m.label}</text>{/if}
    {/each}
    {#each points as p}
      {#if p.yerr}<line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y - p.yerr)} y2={sy(p.y + p.yerr)} stroke={p.color ?? 'var(--series-1)'} stroke-width="1.5" />{/if}
      {#if p.xerr}<line x1={sx(p.x - p.xerr)} x2={sx(p.x + p.xerr)} y1={sy(p.y)} y2={sy(p.y)} stroke={p.color ?? 'var(--series-1)'} stroke-width="1.5" />{/if}
      <circle cx={sx(p.x)} cy={sy(p.y)} r="3" fill={p.color ?? 'var(--series-1)'} />
    {/each}
  {/snippet}
</Plot>
{#if legend && (lines.some((l) => l.label) || bands.some((b) => b.label))}
  <ul class="legend ui">
    {#each lines as l, i}
      {#if l.label}
        <li>
          <svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke={colour(l, i)} stroke-width="2.5" stroke-dasharray={dashOf(l, i)} /></svg>{l.label}
        </li>
      {/if}
    {/each}
    {#each bands as b}{#if b.label}<li><span class="sw" style:background={b.color ?? 'var(--series-8)'} style:opacity="0.5"></span>{b.label}</li>{/if}{/each}
  </ul>
{/if}

<style>
  .mk {
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
    gap: 0.4rem 1rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sw {
    display: inline-block;
    width: 0.8rem;
    height: 0.4rem;
    margin-right: 0.3rem;
    border-radius: 2px;
  }
</style>
