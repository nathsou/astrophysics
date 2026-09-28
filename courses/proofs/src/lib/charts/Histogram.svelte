<!-- A compact histogram of a large array of values, drawn as SVG columns. -->
<script lang="ts">
  let {
    values,
    bins = 40,
    range,
    height = 90,
    color = 'var(--series-1)',
    label,
    mark,
    xLabel,
  }: {
    values: ArrayLike<number>;
    bins?: number;
    /** [lo, hi]; defaults to the data range. Values outside are clamped into the end bins. */
    range?: [number, number];
    height?: number;
    color?: string;
    label: string;
    /** Shade values beyond ±mark (e.g. saturated tanh units). */
    mark?: number;
    xLabel?: string;
  } = $props();

  let width = $state(300);
  const r = $derived.by((): [number, number] => {
    if (range) return range;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return Number.isFinite(lo) && hi > lo ? [lo, hi] : [lo - 1 || -1, hi + 1 || 1];
  });
  const counts = $derived.by(() => {
    const c = new Array<number>(bins).fill(0);
    const [lo, hi] = r;
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (!Number.isFinite(v)) continue;
      c[Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))]!++;
    }
    return c;
  });
  const max = $derived(Math.max(1, ...counts));
  const bw = $derived(width / bins);
  const centre = (i: number) => r[0] + ((i + 0.5) / bins) * (r[1] - r[0]);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
</script>

<div class="hist ui" bind:clientWidth={width}>
  <svg {width} height={height + 16} role="img" aria-label={label}>
    {#each counts as c, i (i)}
      {@const hgt = (c / max) * height}
      <rect
        x={i * bw + 0.5}
        y={height - hgt}
        width={Math.max(0.5, bw - 1)}
        height={hgt}
        fill={mark !== undefined && Math.abs(centre(i)) > mark ? 'var(--series-8)' : color}
        rx="1"
      ><title>{fmt(r[0] + (i / bins) * (r[1] - r[0]))} to {fmt(r[0] + ((i + 1) / bins) * (r[1] - r[0]))}: {c}</title></rect>
    {/each}
    <line x1="0" x2={width} y1={height + 0.5} y2={height + 0.5} class="axis" />
    <text x="0" y={height + 13} class="t">{fmt(r[0])}</text>
    <text x={width / 2} y={height + 13} class="t" text-anchor="middle">{xLabel ?? ''}</text>
    <text x={width} y={height + 13} class="t" text-anchor="end">{fmt(r[1])}</text>
  </svg>
</div>

<style>
  .hist {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .axis {
    stroke: var(--axis);
  }
  .t {
    font-size: 10px;
    fill: var(--ink-3);
  }
</style>
