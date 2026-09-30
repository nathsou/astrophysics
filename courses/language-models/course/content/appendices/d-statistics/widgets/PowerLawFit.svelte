<!--
  Fitting a power law, as Chapter 17 does: y = a·x^(−b) is a straight line on log–log axes, so ordinary least
  squares on (log x, log y) estimates the exponent. With noise and few points, the estimate wobbles; the grey lines
  are fits to other noisy draws of the same law.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';

  const TRUE_B = 0.3, TRUE_A = 20;
  let noise = $state(0.05);
  let points = $state(6);
  const fit = (xs: number[], ys: number[]) => {
    const lx = xs.map(Math.log10), ly = ys.map(Math.log10);
    const mx = lx.reduce((a, b) => a + b, 0) / lx.length, my = ly.reduce((a, b) => a + b, 0) / ly.length;
    const sxy = lx.reduce((a, x, i) => a + (x - mx) * (ly[i]! - my), 0), sxx = lx.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = sxy / sxx;
    return { b: -slope, a: 10 ** (my - slope * mx) };
  };
  const draws = $derived.by(() => {
    const rng = mulberry32(17);
    const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
    const xs = Array.from({ length: points }, (_, i) => 10 ** (6 + (3 * i) / Math.max(1, points - 1)));
    return Array.from({ length: 30 }, () => {
      const ys = xs.map((x) => TRUE_A * x ** -TRUE_B * 10 ** (noise * gauss()));
      return { xs, ys, ...fit(xs, ys) };
    });
  });
  const bs = $derived(draws.map((d) => d.b).sort((a, b) => a - b));
  const first = $derived(draws[0]!);
</script>

<Widget
  title="Fitting a power law"
  subtitle="Measurements of a loss that truly falls as 20 · x^(−0.3), with multiplicative noise. A straight-line fit on log–log axes estimates the exponent; the grey lines are the fits to 29 other sets of measurements."
  onreset={() => {
    noise = 0.05;
    points = 6;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Noise (log₁₀ scale)" min={0} max={0.2} step={0.005} value={noise} oninput={(v) => (noise = v)} format={(v) => v.toFixed(3)} /></div>
    <div class="sl"><Slider label="Measurements" min={3} max={20} step={1} value={points} oninput={(v) => (points = v)} format={(v) => v.toFixed(0)} /></div>
  {/snippet}

  <Plot label="Power-law fits" height={240} x={{ domain: [1e6, 1e9], type: 'log', label: 'x (e.g. parameters)', ticks: 4 }} y={{ domain: [0.03, 0.5], type: 'log', label: 'y (e.g. loss above its floor)', ticks: 4 }}>
    {#snippet marks({ sx, sy })}
      {#each draws.slice(1) as d, i (i)}
        <line x1={sx(1e6)} x2={sx(1e9)} y1={sy(d.a * 1e6 ** -d.b)} y2={sy(d.a * 1e9 ** -d.b)} stroke="var(--ink-3)" stroke-width="0.8" opacity="0.5" />
      {/each}
      <line x1={sx(1e6)} x2={sx(1e9)} y1={sy(first.a * 1e6 ** -first.b)} y2={sy(first.a * 1e9 ** -first.b)} stroke="var(--series-1)" stroke-width="2" />
      {#each first.xs as x, i (i)}<circle cx={sx(x)} cy={sy(first.ys[i]!)} r="3.5" fill="var(--series-1)" />{/each}
    {/snippet}
  </Plot>
  <p class="note ui">
    This fit: exponent <strong class="num">{first.b.toFixed(3)}</strong> (true 0.300). Across the 30 draws the exponent ranges
    <strong class="num">{bs[0]!.toFixed(3)}–{bs.at(-1)!.toFixed(3)}</strong>. Extrapolating a factor of 100 beyond the data multiplies an exponent error of δ into a factor of 100^δ in the prediction.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
