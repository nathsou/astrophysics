<!--
  The law of large numbers and the central limit theorem: averages of n draws from a skewed
  distribution concentrate around the mean (spread ∝ 1/√n) and become Gaussian in shape.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  type Dist = { label: string; mean: number; sd: number; draw: (r: () => number) => number };
  const DISTS: Record<string, Dist> = {
    uniform: { label: 'Uniform(0, 1)', mean: 0.5, sd: Math.sqrt(1 / 12), draw: (r) => r() },
    exponential: { label: 'Exponential(1)', mean: 1, sd: 1, draw: (r) => -Math.log(1 - r()) },
    bernoulli: { label: 'Bernoulli(0.1)', mean: 0.1, sd: Math.sqrt(0.09), draw: (r) => (r() < 0.1 ? 1 : 0) },
    surprisal: {
      // Surprisal (bits) of a token under a Zipf-like model: mostly small, occasionally large.
      label: 'Token surprisal',
      mean: 0,
      sd: 1,
      draw: (r) => -Math.log2(1 / (1 + Math.floor(1 / (r() + 1e-9) ** 1.2))),
    },
  };
  // Estimate the surprisal distribution's mean and sd once, by simulation.
  {
    const r = mulberry32(99);
    const xs = Array.from({ length: 200_000 }, () => DISTS.surprisal!.draw(r));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    DISTS.surprisal!.mean = m;
    DISTS.surprisal!.sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  }

  let key = $state<keyof typeof DISTS>('exponential');
  let n = $state(1);
  const TRIALS = 4000;
  const d = $derived(DISTS[key]!);

  const means = $derived.by(() => {
    const r = mulberry32(12345 + n);
    return Float64Array.from({ length: TRIALS }, () => {
      let s = 0;
      for (let i = 0; i < n; i++) s += d.draw(r);
      return s / n;
    });
  });
  const se = $derived(d.sd / Math.sqrt(n));
  const lo = $derived(d.mean - 4.5 * se), hi = $derived(d.mean + 4.5 * se);
  const BINS = 45;
  const hist = $derived.by(() => {
    const c = new Array<number>(BINS).fill(0);
    const w = (hi - lo) / BINS;
    for (const m of means) {
      const b = Math.floor((m - lo) / w);
      if (b >= 0 && b < BINS) c[b]!++;
    }
    return c.map((k) => k / TRIALS / w); // density
  });
  const gauss = (x: number) => Math.exp(-0.5 * ((x - d.mean) / se) ** 2) / (se * Math.sqrt(2 * Math.PI));
  const ymax = $derived(Math.max(gauss(d.mean), ...hist) * 1.15);
  const empSd = $derived(Math.sqrt(means.reduce((a, m) => a + (m - d.mean) ** 2, 0) / TRIALS));
</script>

<Widget
  title="Averages become predictable, and Gaussian"
  subtitle="Each bar chart shows 4,000 averages of n independent draws. As n grows, the averages close in on the true mean (dashed), with spread σ/√n, and their shape approaches the normal curve whatever the original distribution was."
  onreset={() => {
    key = 'exponential';
    n = 1;
  }}
>
  {#snippet controls()}
    <Segmented label="Distribution" size="sm" options={Object.entries(DISTS).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={key} />
    <div class="ctl"><Slider label="draws per average n" min={1} max={256} step={1} log value={n} oninput={(v) => (n = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <Legend items={[{ label: n === 1 ? 'Single draws (n = 1)' : `Averages of ${n} draws`, color: 'var(--series-1)' }, { label: 'Normal curve N(μ, σ²/n)', color: 'var(--series-2)' }]} />
  <Plot label="Histogram of sample means with the normal approximation" height={240} x={{ domain: [lo, hi], label: 'average of n draws', ticks: 6 }} y={{ domain: [0, ymax], label: 'density', ticks: 4 }}>
    {#snippet marks({ sx, sy })}
      {#each hist as h, i (i)}
        {@const x0 = lo + ((hi - lo) * i) / BINS}
        {@const x1 = lo + ((hi - lo) * (i + 1)) / BINS}
        <rect x={sx(x0) + 1} width={Math.max(0.5, sx(x1) - sx(x0) - 2)} y={sy(h)} height={Math.max(0, sy(0) - sy(h))} fill="var(--series-1)" opacity="0.8" rx="1.5" />
      {/each}
      <path class="line" stroke="var(--series-2)" d={'M' + Array.from({ length: 121 }, (_, i) => lo + ((hi - lo) * i) / 120).map((x) => `${sx(x)},${sy(gauss(x))}`).join('L')} />
      <line x1={sx(d.mean)} x2={sx(d.mean)} y1={sy(0)} y2={sy(ymax)} stroke="var(--ink-2)" stroke-dasharray="4 4" />
    {/snippet}
  </Plot>
  <p class="note ui num">
    True mean μ = {d.mean.toFixed(3)}, single-draw σ = {d.sd.toFixed(3)}. Predicted spread of the averages σ/√n = <strong>{se.toFixed(4)}</strong>; measured {empSd.toFixed(4)}.
    {#if key === 'bernoulli' && n < 30}With a rare event (p = 0.1) and small n, the averages can only take a few values, and the normal curve is a poor fit.{/if}
    {#if key === 'surprisal'}Per-token losses look like this: mostly small, occasionally huge. The loss of a batch of n tokens is their average, so its noise falls like 1/√n.{/if}
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
