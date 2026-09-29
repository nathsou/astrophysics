<!--
  The bootstrap: resample the observed data with replacement many times, recompute the statistic each time, and
  read its uncertainty off the spread. Here the data are 200 per-token losses (skewed, like real ones) and the
  statistic is their mean or median.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  const data = (() => {
    const rng = mulberry32(4);
    // Losses in bits: mostly small, occasionally large (a surprising token).
    return Array.from({ length: 200 }, () => (rng() < 0.8 ? -Math.log2(0.3 + 0.7 * rng()) : 2 + 10 * rng() ** 2));
  })();
  let stat = $state<'mean' | 'median'>('mean');
  const f = (xs: number[]) => {
    if (stat === 'mean') return xs.reduce((a, b) => a + b, 0) / xs.length;
    const s = [...xs].sort((a, b) => a - b);
    return (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2;
  };
  const boot = $derived.by(() => {
    const rng = mulberry32(9);
    const out = Array.from({ length: 2000 }, () => f(Array.from({ length: data.length }, () => data[Math.floor(rng() * data.length)]!)));
    return out.sort((a, b) => a - b);
  });
  const est = $derived(f(data));
  const ci = $derived([boot[49]!, boot[1949]!]);
  const lo = $derived(boot[0]!), hi = $derived(boot.at(-1)!);
  const hist = $derived.by(() => {
    const h = new Array<number>(40).fill(0);
    for (const v of boot) h[Math.min(39, Math.floor(((v - lo) / (hi - lo)) * 40))]!++;
    return h;
  });
  const hmax = $derived(Math.max(...hist));
  const se = $derived.by(() => {
    const m = data.reduce((a, b) => a + b, 0) / data.length;
    return Math.sqrt(data.reduce((a, b) => a + (b - m) ** 2, 0) / (data.length - 1) / data.length);
  });
</script>

<Widget
  title="The bootstrap"
  subtitle="200 per-token losses, most small and a few large. Resample them with replacement 2,000 times and recompute the statistic: the spread of the results estimates its uncertainty, with no formula needed."
  onreset={() => (stat = 'mean')}
>
  {#snippet controls()}
    <Segmented label="Statistic" size="sm" options={[{ value: 'mean', label: 'Mean' }, { value: 'median', label: 'Median' }]} bind:value={stat} />
  {/snippet}

  <div class="hist" role="img" aria-label="Bootstrap distribution">
    {#each hist as c, i (i)}
      {@const x = lo + ((i + 0.5) / 40) * (hi - lo)}
      <div class="bar" class:in={x >= ci[0]! && x <= ci[1]!} style:height="{(c / hmax) * 100}%"></div>
    {/each}
  </div>
  <div class="axis ui"><span class="num">{lo.toFixed(3)}</span><span class="num">{hi.toFixed(3)} bits</span></div>
  <p class="note ui">
    Observed {stat}: <strong class="num">{est.toFixed(3)}</strong> bits. Bootstrap 95% interval (the middle 95% of resamples, shaded):
    <strong class="num">{ci[0]!.toFixed(3)}–{ci[1]!.toFixed(3)}</strong>.
    {#if stat === 'mean'}The formula σ/√n gives ±<span class="num">{(1.96 * se).toFixed(3)}</span>, nearly the same.{:else}There is no simple formula for the median’s standard error; the bootstrap does not need one.{/if}
  </p>
</Widget>

<style>
  .hist {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 130px;
    border-bottom: 1px solid var(--rule);
  }
  .bar {
    flex: 1;
    background: var(--ink-3);
    opacity: 0.5;
    border-radius: 2px 2px 0 0;
  }
  .bar.in {
    background: var(--series-1);
    opacity: 0.85;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
