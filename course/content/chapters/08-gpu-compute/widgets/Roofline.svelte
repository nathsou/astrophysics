<!--
  The roofline model: attainable FLOP/s = min(peak, intensity × bandwidth). Uses the reader's
  measured bandwidth and best matmul as the ceilings, and places each kernel by its intensity.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { params } from '$lib/state/params.svelte';
  import { bench, VARIANTS } from '../bench.svelte';

  // Reference numbers (Apple M4 Pro, measured with this page) until the reader runs the benchmark.
  const REF = { bandwidth: 125, peak: 1870, saxpy: 21, points: { naive: 243, tiled: 623, blocked: 1871 } as Record<string, number> };
  const live = $derived(bench.status === 'done');
  const bw = $derived(live ? bench.bandwidth : REF.bandwidth);
  const peak = $derived(live ? bench.peak : REF.peak);
  const I = $derived(params.get('roofline.intensity', 1));
  const attainable = (i: number) => Math.min(peak, i * bw);
  const ridge = $derived(peak / bw);

  const points = $derived([
    { label: '2x + y', intensity: 2 / 12, gflops: live ? bench.saxpy : REF.saxpy },
    ...VARIANTS.map((v) => ({ label: v.label.split(' ')[0]!, intensity: v.intensity, gflops: live ? (bench.best(v.key)?.gflops ?? 0) : REF.points[v.key]! })),
  ]);
  const xs = [1 / 16, 64];
  const ymin = $derived(Math.max(1, (bw * xs[0]!) / 2));
</script>

<Widget
  title="The roofline: is a kernel limited by memory or by arithmetic?"
  subtitle="Arithmetic intensity is FLOPs per byte moved from memory. Below the ridge point, bandwidth caps performance; above it, arithmetic does. Drag the slider to move along the roof."
  onreset={() => params.set('roofline.intensity', 1)}
>
  {#snippet controls()}
    <label class="slider ui">
      <span>intensity <strong class="num">{I < 1 ? I.toFixed(2) : I.toFixed(1)}</strong> FLOP/byte</span>
      <input type="range" min={Math.log2(1 / 16)} max={Math.log2(64)} step="0.05" value={Math.log2(I)} oninput={(e) => params.set('roofline.intensity', 2 ** Number(e.currentTarget.value))} />
    </label>
    {#if !live}<Button onclick={() => bench.run()} disabled={bench.status === 'running'}>{bench.status === 'running' ? 'Measuring…' : 'Use my GPU'}</Button>{/if}
  {/snippet}

  <Legend
    items={[
      { label: 'Roof: min(peak, intensity × bandwidth)', color: 'var(--ink-2)' },
      { label: 'Measured kernels', color: 'var(--series-1)', dot: true },
      { label: 'Your intensity', color: 'var(--series-2)', dot: true },
    ]}
  />
  <Plot
    label="Roofline plot of attainable GFLOP/s against arithmetic intensity"
    height={300}
    x={{ type: 'log', domain: [xs[0]!, xs[1]!], label: 'arithmetic intensity (FLOP / byte, log scale)', tickValues: [1 / 16, 1 / 4, 1, 4, 16, 64], format: (v) => (v < 1 ? `1/${Math.round(1 / v)}` : String(v)) }}
    y={{ type: 'log', domain: [ymin, peak * 2.5], label: 'GFLOP/s (log scale)', format: (v) => (v >= 1000 ? `${v / 1000}k` : String(v)) }}
  >
    {#snippet marks({ sx, sy })}
      <path class="roof" d="M{sx(xs[0]!)},{sy(attainable(xs[0]!))} L{sx(ridge)},{sy(peak)} L{sx(xs[1]!)},{sy(peak)}" />
      <line class="ridge" x1={sx(ridge)} x2={sx(ridge)} y1={sy(ymin)} y2={sy(peak)} />
      <text class="lab" x={sx(ridge) + 6} y={sy(ymin) - 6}>ridge {ridge.toFixed(1)} FLOP/B</text>
      <text class="lab" x={sx(xs[0]!) + 8} y={sy(attainable(xs[0]! * 2)) - 10}>{bw.toFixed(0)} GB/s</text>
      <text class="lab" x={sx(xs[1]!) - 8} y={sy(peak) - 8} text-anchor="end">best measured {peak.toFixed(0)} GFLOP/s</text>
      {#each points as p (p.label)}
        {#if p.gflops > 0}
          <circle cx={sx(p.intensity)} cy={sy(p.gflops)} r="5" fill="var(--series-1)" stroke="var(--chart-surface)" stroke-width="2" />
          <text class="plab" x={sx(p.intensity) + 8} y={sy(p.gflops) + 14}>{p.label}</text>
        {/if}
      {/each}
      <circle cx={sx(I)} cy={sy(attainable(I))} r="6" fill="var(--series-2)" stroke="var(--chart-surface)" stroke-width="2" />
    {/snippet}
    {#snippet tooltip({ x })}
      <div class="num">intensity {x < 1 ? x.toFixed(3) : x.toFixed(1)} → at most {attainable(x).toFixed(0)} GFLOP/s ({x < ridge ? 'memory-bound' : 'compute-bound'})</div>
    {/snippet}
  </Plot>
  <p class="readout ui">
    At <strong>{I < 1 ? I.toFixed(2) : I.toFixed(1)}</strong> FLOP/byte a kernel can reach at most <strong>{attainable(I).toFixed(0)} GFLOP/s</strong> —
    {#if I < ridge}memory-bound: only {((attainable(I) / peak) * 100).toFixed(0)}% of the arithmetic is usable, and a faster ALU would not help.{:else}compute-bound: memory keeps up, so only better arithmetic can help.{/if}
    {#if !live}<span class="muted"> (Roof from an Apple M4 Pro; press “Use my GPU” to measure yours.)</span>{/if}
  </p>
  <p class="aside ui">
    Why is the naïve matmul <em>above</em> the roof? Its intensity counts every load the kernel issues, 8 bytes per multiply–add. But neighbouring threads read the same rows and columns, and the GPU’s caches serve most of those repeats, so far fewer bytes actually come from memory. Tiling does deliberately, and much better, what the cache does by accident.
  </p>
</Widget>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78rem;
    color: var(--ink-2);
    flex: 0 1 16rem;
  }
  .roof {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 2;
  }
  .ridge {
    stroke: var(--ink-3);
    stroke-dasharray: 3 3;
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .plab {
    font-size: 11px;
    fill: var(--ink);
    font-weight: 600;
  }
  .readout {
    font-size: 0.84rem;
    margin: 0.6rem 0 0;
  }
  .muted {
    color: var(--ink-3);
  }
  .aside {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
