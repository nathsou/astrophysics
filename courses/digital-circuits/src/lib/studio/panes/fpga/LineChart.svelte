<!--
  A small line (or bar) chart of one series, with an optional marker that follows the replay and can be dragged.
  Axes are labelled with their end values only: these charts show the shape of the annealing schedule or of the
  router's convergence next to the scrubber, not exact readings (the report has the numbers).
-->
<script lang="ts">
  let {
    values,
    label,
    unit = '',
    log = false,
    bars = false,
    marker,
    onscrub,
    height = 54,
    colour = 'var(--copper)',
    xlabel,
  }: {
    values: number[];
    label: string;
    unit?: string;
    log?: boolean;
    bars?: boolean;
    /** Position 0…1 along the x axis. */
    marker?: number;
    onscrub?: (pos: number) => void;
    height?: number;
    colour?: string;
    xlabel?: string;
  } = $props();

  const W = 240;
  const PAD = { l: 4, r: 4, t: 5, b: 5 };
  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;

  // A logarithmic axis cannot show zero (the annealer's final quench at temperature 0): it sits at the smallest positive value.
  const minPos = $derived(Math.min(...values.filter((v) => v > 0), Infinity));
  const ys = $derived(values.map((v) => (log ? Math.log10(v > 0 ? v : Number.isFinite(minPos) ? minPos : 1e-9) : v)));
  const lo = $derived(Math.min(0, ...ys.filter(Number.isFinite)));
  const hi = $derived(Math.max(...ys.filter(Number.isFinite), lo + 1e-9));
  const x = (i: number) => PAD.l + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - ((v - (log ? Math.min(...ys) : lo)) / Math.max(1e-9, hi - (log ? Math.min(...ys) : lo)))) * (height - PAD.t - PAD.b);
  const path = $derived(ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '));
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-GB') : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1));
  const barW = $derived(Math.max(1.5, (W - PAD.l - PAD.r) / Math.max(1, values.length) - 1.5));

  function scrub(ev: PointerEvent) {
    if (!onscrub || !svg) return;
    const r = svg.getBoundingClientRect();
    onscrub(Math.max(0, Math.min(1, ((ev.clientX - r.left) / r.width) * W > PAD.l ? (((ev.clientX - r.left) / r.width) * W - PAD.l) / (W - PAD.l - PAD.r) : 0)));
  }
</script>

<figure class="lc">
  <figcaption class="ui"><span>{label}{unit ? ` (${unit})` : ''}</span><span class="ends">{values.length ? `${fmt(values[0]!)} → ${fmt(values.at(-1)!)}` : ''}</span></figcaption>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {height}"
    preserveAspectRatio="none"
    style:height="{height}px"
    role="img"
    aria-label="{label}: from {values.length ? fmt(values[0]!) : '—'} to {values.length ? fmt(values.at(-1)!) : '—'} over {values.length} steps"
    onpointerdown={(ev) => {
      dragging = true;
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
      scrub(ev);
    }}
    onpointermove={(ev) => dragging && scrub(ev)}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
    class:scrub={!!onscrub}
  >
    <line x1={PAD.l} x2={W - PAD.r} y1={height - PAD.b} y2={height - PAD.b} class="axis" />
    {#if bars}
      {#each values as v, i (i)}
        <rect x={x(i) - barW / 2} y={y(ys[i]!)} width={barW} height={Math.max(0.5, height - PAD.b - y(ys[i]!))} fill={colour} opacity="0.75" />
      {/each}
    {:else if values.length}
      <path d={path} fill="none" stroke={colour} stroke-width="1.6" vector-effect="non-scaling-stroke" />
    {/if}
    {#if marker !== undefined}
      <line x1={PAD.l + marker * (W - PAD.l - PAD.r)} x2={PAD.l + marker * (W - PAD.l - PAD.r)} y1="0" y2={height} class="mark" vector-effect="non-scaling-stroke" />
    {/if}
  </svg>
  {#if xlabel}<span class="x ui">{xlabel}</span>{/if}
</figure>

<style>
  .lc {
    margin: 0;
    min-width: 0;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.68rem;
    color: var(--ink-2);
  }
  .ends {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  svg {
    display: block;
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 5px;
    touch-action: none;
  }
  svg.scrub {
    cursor: ew-resize;
  }
  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .mark {
    stroke: var(--phosphor);
    stroke-width: 1.5;
  }
  .x {
    font-size: 0.62rem;
    color: var(--mute);
  }
</style>
