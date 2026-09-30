<!--
  A row of digital and analogue traces on a shared time axis, with rows of decoded boxes underneath: what a logic analyser shows.
  It draws Signals (protocols.ts) and Annotations (the bench's decoder type). SVG, sized to its container, so it is
  readable at 360 px.

    <TraceView t0={0} t1={2e-3} channels={[{ name: 'TX', signal }]} decoded={[{ name: 'UART', notes }]} />
-->
<script lang="ts">
  import { levelAt, type Signal } from './protocols';
  import type { DecodedRow, TraceChannel } from './trace';

  let {
    channels,
    decoded = [],
    t0 = 0,
    t1,
    label = 'Logic analyser trace',
    rowHeight = 30,
    cursor,
  }: { channels: TraceChannel[]; decoded?: DecodedRow[]; t0?: number; t1: number; label?: string; rowHeight?: number; cursor?: number } = $props();

  let width = $state(600);
  const LABEL_W = 58;
  const AXIS_H = 20;
  const NOTE_H = 24;
  const rows = $derived(channels.length);
  const height = $derived(rows * rowHeight + decoded.length * NOTE_H + AXIS_H + 8);
  const x0 = LABEL_W;
  const x1 = $derived(Math.max(x0 + 40, width - 16));
  const X = (t: number) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);

  function fmtTime(t: number): string {
    const a = Math.abs(t);
    if (a === 0) return '0';
    if (a >= 1) return `${+t.toPrecision(3)} s`;
    if (a >= 1e-3) return `${+(t * 1e3).toPrecision(3)} ms`;
    if (a >= 1e-6) return `${+(t * 1e6).toPrecision(3)} µs`;
    return `${+(t * 1e9).toPrecision(3)} ns`;
  }
  /** Round tick spacing to 1, 2 or 5 × 10^n. */
  const ticks = $derived.by(() => {
    const span = t1 - t0;
    const target = Math.max(2, Math.floor((x1 - x0) / 90));
    const raw = span / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
    const out: number[] = [];
    for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-15; t += step) out.push(+t.toPrecision(12));
    return out;
  });

  /** A digital signal as an SVG path: high at the top of its row, low at the bottom, X and Z in between. */
  function digitalPath(s: Signal, top: number): { high: string; line: string } {
    const yH = top + 5;
    const yL = top + rowHeight - 8;
    const yM = (yH + yL) / 2;
    const yOf = (v: number) => (v === 1 ? yH : v === 0 ? yL : yM);
    let d = '';
    let fill = '';
    let prevY: number | undefined;
    const pts: [number, number][] = [];
    // Start at t0 with the level then.
    pts.push([t0, levelAt(s, t0)]);
    for (let i = 0; i < s.t.length; i++) if (s.t[i]! > t0 && s.t[i]! < t1) pts.push([s.t[i]!, s.v[i]!]);
    pts.push([t1, levelAt(s, t1)]);
    for (let i = 0; i < pts.length; i++) {
      const [t, v] = pts[i]!;
      const x = X(t);
      const y = yOf(v);
      if (i === 0) d += `M${x.toFixed(1)} ${y}`;
      else {
        if (prevY !== undefined && prevY !== y) d += `L${x.toFixed(1)} ${prevY}`;
        d += `L${x.toFixed(1)} ${y}`;
      }
      prevY = y;
    }
    // Shade the high spans.
    for (let i = 0; i + 1 < pts.length; i++) {
      if (pts[i]![1] === 1) {
        const a = X(pts[i]![0]);
        const b = X(pts[i + 1]![0]);
        fill += `M${a.toFixed(1)} ${yL} V${yH} H${b.toFixed(1)} V${yL} Z`;
      }
    }
    return { high: fill, line: d };
  }

  function analogPath(a: NonNullable<TraceChannel['analog']>, top: number): string {
    const yTop = top + 4;
    const yBot = top + rowHeight - 6;
    let d = '';
    let started = false;
    for (let i = 0; i < a.t.length; i++) {
      const t = a.t[i]!;
      if (t < t0 || t > t1) continue;
      const y = yBot - ((a.v[i]! - a.min) / (a.max - a.min)) * (yBot - yTop);
      d += `${started ? 'L' : 'M'}${X(t).toFixed(1)} ${Math.max(yTop, Math.min(yBot, y)).toFixed(1)}`;
      started = true;
    }
    return d;
  }
  const paths = $derived(channels.map((c, i) => (c.signal ? digitalPath(c.signal, i * rowHeight + 2) : undefined)));
  const analogPaths = $derived(channels.map((c, i) => (c.analog ? analogPath(c.analog, i * rowHeight + 2) : undefined)));
  const summary = $derived(
    decoded
      .map((r) => `${r.name}: ${r.notes.filter((n) => n.t1 >= t0 && n.t0 <= t1).map((n) => n.text).join(', ') || 'nothing'}`)
      .join('. '),
  );
  const boxes = $derived(decoded.map((r) => r.notes.filter((n) => n.t1 >= t0 && n.t0 <= t1)));
</script>

<div class="tv" bind:clientWidth={width}>
  <svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="{label}. {summary}">
    {#each ticks as t (t)}
      <line class="grid" x1={X(t)} x2={X(t)} y1="0" y2={rows * rowHeight + decoded.length * NOTE_H + 4} />
      <text class="tick" x={X(t)} y={height - 6} text-anchor="middle">{fmtTime(t - t0)}</text>
    {/each}
    {#each channels as c, i (c.name)}
      {@const top = i * rowHeight + 2}
      <text class="name" x="6" y={top + rowHeight / 2 + 1} dominant-baseline="middle">{c.name}</text>
      {#if paths[i]}
        <path class="hi" d={paths[i]!.high} style="--tone: var(--series-{c.tone ?? 5})" />
        <path class="wave" d={paths[i]!.line} style="--tone: var(--series-{c.tone ?? 5})" />
      {:else if analogPaths[i]}
        <path class="analog" d={analogPaths[i]!} style="--tone: var(--series-{c.tone ?? 1})" />
        <text class="unit" x={x1 - 2} y={top + 9} text-anchor="end">{c.analog!.max}{c.analog!.unit ?? ''}</text>
      {/if}
    {/each}
    {#each decoded as r, k (r.name)}
      {@const top = rows * rowHeight + k * NOTE_H + 4}
      <text class="name dec" x="6" y={top + NOTE_H / 2 - 1} dominant-baseline="middle">{r.name}</text>
      {#each boxes[k]! as n, j (j)}
        {@const a = Math.max(x0, X(n.t0))}
        {@const b = Math.min(x1, X(n.t1))}
        {#if b - a >= 2}
          <g>
            <title>{n.text}{n.error ? ' (error)' : ''}</title>
            <rect class="box" class:err={n.error} x={a} y={top} width={b - a} height={NOTE_H - 4} rx="3" />
            {#if b - a > n.text.length * 6.4 + 6}
              <text class="bt" x={(a + b) / 2} y={top + (NOTE_H - 4) / 2 + 0.5} text-anchor="middle" dominant-baseline="middle">{n.text}</text>
            {/if}
          </g>
        {/if}
      {/each}
    {/each}
    {#if cursor !== undefined && cursor >= t0 && cursor <= t1}
      <line class="cursor" x1={X(cursor)} x2={X(cursor)} y1="0" y2={height - AXIS_H} />
    {/if}
    <line class="axis" x1={x0} x2={x1} y1={rows * rowHeight + decoded.length * NOTE_H + 4} y2={rows * rowHeight + decoded.length * NOTE_H + 4} />
  </svg>
</div>

<style>
  .tv {
    min-width: 0;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    overflow: hidden;
  }
  svg {
    display: block;
    width: 100%;
    max-width: 100%;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--line-strong);
  }
  .tick {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--mute);
  }
  .name {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 600;
    fill: var(--fg);
  }
  .name.dec {
    fill: var(--mute);
    font-weight: 500;
  }
  .wave {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2.2;
    stroke-linejoin: round;
  }
  .hi {
    fill: color-mix(in srgb, var(--tone) 16%, transparent);
    stroke: none;
  }
  .analog {
    fill: none;
    stroke: var(--tone);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .unit {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--mute);
  }
  .box {
    fill: color-mix(in srgb, var(--copper) 20%, var(--panel));
    stroke: var(--copper);
    stroke-width: 1;
  }
  .box.err {
    fill: color-mix(in srgb, var(--sig-x) 22%, var(--panel));
    stroke: var(--sig-x);
  }
  .bt {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    fill: var(--fg);
  }
  .cursor {
    stroke: var(--sig-current);
    stroke-dasharray: 4 3;
  }
</style>
