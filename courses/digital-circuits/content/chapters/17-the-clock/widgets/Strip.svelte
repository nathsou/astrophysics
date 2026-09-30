<!--
  A small static timing diagram in SVG: rows of digital waveforms on a shared time axis, shaded bands (the
  aperture around a clock edge), and marks on the axis (✓ ✗ ?). It draws whatever it is given; the engine runs
  live in the widgets that use it.

    <Strip rows={[{ name: 'CLK', segs, }]} from={0} to={80} bands={[…]} marks={[…]} />

  HIGH is a line at the top with a light fill, LOW a line at the bottom, X (2) a hatched red band, as in the
  bench's timing diagrams. Colour is never the only cue: marks carry a symbol and a title.
-->
<script lang="ts">
  import { ticks } from '$lib/bench/waves';
  import type { Segments } from './clocking';

  export interface BusSpan {
    from: number;
    to: number;
    label: string;
    /** 'bad': a value that should not appear (drawn in the failure colour). */
    tone?: 'ok' | 'bad' | 'x';
  }
  export interface Row {
    name: string;
    segs?: Segments;
    /** A bus row: labelled boxes instead of a waveform. */
    bus?: BusSpan[];
    /** Draw this row a little dimmer (a copy of another signal). */
    dim?: boolean;
  }
  export interface Band {
    from: number;
    to: number;
    tone: 'setup' | 'hold' | 'bad';
  }
  export interface Mark {
    t: number;
    symbol: string;
    tone: 'ok' | 'bad';
    title: string;
  }

  let {
    rows,
    from,
    to,
    bands = [],
    marks = [],
    label,
    unit = 'ns',
    rowHeight = 30,
  }: { rows: Row[]; from: number; to: number; bands?: Band[]; marks?: Mark[]; label: string; unit?: string; rowHeight?: number } = $props();

  const uid = $props.id();
  let width = $state(640);
  const NAMES = $derived(Math.max(46, 12 + 7.4 * Math.max(0, ...rows.map((r) => r.name.length))));
  const left = $derived(NAMES);
  const right = 10;
  const bodyH = $derived(rows.length * rowHeight);
  const height = $derived(bodyH + 34);
  const x = (t: number) => left + ((t - from) / (to - from)) * (width - left - right);
  const clampT = (t: number) => Math.max(from, Math.min(to, t));

  function path(segs: Segments, top: number, bottom: number): string {
    const hi = top + 4;
    const lo = bottom - 4;
    const mid = (hi + lo) / 2;
    const level = (v: number) => (v === 1 ? hi : v === 0 ? lo : mid);
    let d = '';
    let prev: number | undefined;
    for (const [a, b, v] of segs) {
      if (b <= from || a >= to) continue;
      const xa = x(clampT(a));
      const xb = x(clampT(b));
      const y = level(v);
      if (prev === undefined) d += `M${xa.toFixed(1)} ${y}`;
      else if (prev !== y) d += `L${xa.toFixed(1)} ${prev}L${xa.toFixed(1)} ${y}`;
      d += `L${xb.toFixed(1)} ${y}`;
      prev = y;
    }
    return d;
  }
  const spans = (segs: Segments, value: number) => segs.filter(([a, b, v]) => v === value && b > from && a < to);
  const tickList = $derived(ticks(from, to, Math.max(3, Math.floor((width - left - right) / 80))));
</script>

<div class="strip" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label={label}>
    <defs>
      <pattern id="hatch-{uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="var(--sig-x)" fill-opacity="0.12" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--sig-x)" stroke-width="1.6" />
      </pattern>
    </defs>
    {#each tickList as t (t)}
      <line class="grid" x1={x(t)} x2={x(t)} y1="2" y2={bodyH + 4} />
      <text class="tick" x={x(t)} y={bodyH + 16} text-anchor="middle">{+t.toFixed(3)}</text>
    {/each}
    <text class="tick unit" x={width - right} y={bodyH + 30} text-anchor="end">{unit}</text>
    {#each bands as b, i (i)}
      <rect class="band {b.tone}" x={x(clampT(b.from))} y="2" width={Math.max(1.5, x(clampT(b.to)) - x(clampT(b.from)))} height={bodyH + 2} />
    {/each}
    {#each rows as r, i (r.name)}
      {@const top = i * rowHeight + 6}
      {@const bottom = top + rowHeight - 6}
      <text class="name" x="4" y={(top + bottom) / 2 + 1} dominant-baseline="middle">{r.name}</text>
      {#if r.bus}
        {#each r.bus as b, k (k)}
          {@const xa = x(clampT(b.from))}
          {@const xb = x(clampT(b.to))}
          {#if b.to > from && b.from < to}
            <g>
              <title>{r.name} = {b.label}</title>
              <rect class="busbox {b.tone ?? 'ok'}" x={xa + 0.5} y={top + 4} width={Math.max(1, xb - xa - 1)} height={bottom - top - 8} rx="3" />
              {#if xb - xa > 4 + 6.5 * b.label.length}
                <text class="buslabel {b.tone ?? 'ok'}" x={(xa + xb) / 2} y={(top + bottom) / 2 + 0.5} text-anchor="middle" dominant-baseline="middle">{b.label}</text>
              {/if}
            </g>
          {/if}
        {/each}
      {:else}
      {#each spans(r.segs ?? [], 1) as [a, b] (a)}
        <rect class="hi-fill" x={x(clampT(a))} y={top + 4} width={Math.max(0, x(clampT(b)) - x(clampT(a)))} height={bottom - top - 8} />
      {/each}
      {#each spans(r.segs ?? [], 2) as [a, b] (a)}
        <rect class="xband" x={x(clampT(a))} y={top + 4} width={Math.max(1.5, x(clampT(b)) - x(clampT(a)))} height={bottom - top - 8} fill="url(#hatch-{uid})" />
      {/each}
      <path class="wave" class:dim={r.dim} d={path(r.segs ?? [], top, bottom)} />
      {#each spans(r.segs ?? [], 1) as [a, b] (a)}
        <line class="hi-line" class:dim={r.dim} x1={x(clampT(a))} x2={x(clampT(b))} y1={top + 4} y2={top + 4} />
      {/each}
      {/if}
    {/each}
    {#each marks as m (m.t)}
      {#if m.t >= from && m.t <= to}
        <g>
          <title>{m.title}</title>
          <line class="mark {m.tone}" x1={x(m.t)} x2={x(m.t)} y1="2" y2={bodyH + 4} />
          <text class="badge {m.tone}" x={x(m.t)} y={bodyH + 28} text-anchor="middle">{m.symbol}</text>
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .strip {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
    max-width: 100%;
    font-family: var(--font-mono);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-size: 10px;
  }
  .name {
    fill: var(--fg);
    font-size: 11px;
    font-weight: 600;
  }
  .wave {
    fill: none;
    stroke: var(--sig-low);
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
  .wave.dim {
    opacity: 0.6;
  }
  .busbox {
    fill: var(--panel);
    stroke: var(--sig-low);
    stroke-width: 1.4;
  }
  .busbox.bad {
    fill: var(--bad-soft);
    stroke: var(--bad);
  }
  .busbox.x {
    fill: var(--bad-soft);
    stroke: var(--sig-x);
    stroke-dasharray: 3 2;
  }
  .buslabel {
    font-size: 10.5px;
    font-weight: 600;
    fill: var(--fg);
  }
  .buslabel.bad {
    fill: var(--bad);
  }
  .hi-line {
    stroke: var(--sig-high);
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .hi-line.dim {
    opacity: 0.7;
  }
  .hi-fill {
    fill: var(--sig-high-glow);
  }
  .band {
    stroke: none;
  }
  .band.setup {
    fill: var(--maybe-soft);
  }
  .band.hold {
    fill: var(--maybe-soft);
  }
  .band.bad {
    fill: var(--bad-soft);
  }
  .mark {
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .mark.ok {
    stroke: var(--ok);
  }
  .mark.bad {
    stroke: var(--bad);
  }
  .badge {
    font-size: 13px;
    font-weight: 700;
  }
  .badge.ok {
    fill: var(--ok);
  }
  .badge.bad {
    fill: var(--bad);
  }
</style>
