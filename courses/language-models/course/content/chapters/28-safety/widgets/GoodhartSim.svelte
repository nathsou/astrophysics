<!--
  Goodhart's law, simulated. Candidates have a true value; we can only measure a proxy = true value + error.
  Picking the best of n by the proxy helps when errors are light-tailed; when a few errors are huge, strong
  selection finds them instead. Uses the learner's selectByProxy().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(t: number[], p: number[], k: number): number {
    const chosen = p.map((_, i) => i).sort((a, b) => p[b]! - p[a]!).slice(0, k);
    return chosen.reduce((s, i) => s + t[i]!, 0) / chosen.length;
  }
  const select = $derived(impl.get('safety.select', reference));
  const mine = $derived(impl.isMine('safety.select'));

  let noise = $state(1);
  const NS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const TRIALS = 150;

  const curves = $derived.by(() => {
    const rng = mulberry32(28);
    const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
    // Student-t with 2 degrees of freedom: mostly small errors, occasionally enormous ones.
    const heavy = () => gauss() / Math.sqrt((gauss() ** 2 + gauss() ** 2) / 2);
    const run = (err: () => number) =>
      NS.map((n) => {
        let total = 0;
        for (let t = 0; t < TRIALS; t++) {
          const tv = Array.from({ length: n }, gauss);
          const pv = tv.map((v) => v + noise * err());
          try {
            total += select(tv, pv, 1);
          } catch {
            total += reference(tv, pv, 1);
          }
        }
        return [n, total / TRIALS] as [number, number];
      });
    const best = NS.map((n) => {
      let total = 0;
      for (let t = 0; t < TRIALS; t++) total += Math.max(...Array.from({ length: n }, gauss));
      return [n, total / TRIALS] as [number, number];
    });
    return { light: run(gauss), heavy: run(heavy), best };
  });
  const lo = $derived(Math.min(-0.5, ...curves.heavy.map((c) => c[1])));
  const hi = $derived(Math.max(...curves.best.map((c) => c[1])) + 0.2);
</script>

<Widget
  title="Optimising a proxy"
  subtitle="Each candidate has a true value (normal, mean 0) and a measured proxy: the true value plus an error. Pick the best of n by the proxy, and plot the true value of what you picked, as n — the optimisation pressure — grows."
  onreset={() => (noise = 1)}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Size of the proxy’s errors" min={0.1} max={3} step={0.05} value={noise} oninput={(v) => (noise = v)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your selectByProxy().</p>{/if}
  <Legend items={[{ label: 'picked by the true value (ideal)', color: 'var(--ink-3)', dashed: true }, { label: 'proxy with normal errors', color: 'var(--series-1)' }, { label: 'proxy with heavy-tailed errors', color: 'var(--critical)' }]} />
  <Plot label="True value of the selected candidate against n" height={250} x={{ domain: [1, 4096], type: 'log', label: 'candidates n (best of n by the proxy)', ticks: 6 }} y={{ domain: [lo, hi], label: 'true value of the pick', ticks: 5 }}>
    {#snippet marks({ sx, sy })}
      <line x1={sx(1)} x2={sx(4096)} y1={sy(0)} y2={sy(0)} stroke="var(--rule)" />
      <path class="line" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="4 3" d={'M' + curves.best.map(([n, v]) => `${sx(n)},${sy(v)}`).join('L')} />
      <path class="line" stroke="var(--series-1)" stroke-width="2" d={'M' + curves.light.map(([n, v]) => `${sx(n)},${sy(v)}`).join('L')} />
      <path class="line" stroke="var(--critical)" stroke-width="2" d={'M' + curves.heavy.map(([n, v]) => `${sx(n)},${sy(v)}`).join('L')} />
    {/snippet}
  </Plot>
  <p class="note ui">With normal errors, more selection always helps, if less than it should. With heavy-tailed errors — a reward model that is badly wrong about a few strange outputs — the pick becomes whichever candidate the proxy overrates most, and its true value falls back towards average.</p>
</Widget>

<style>
  .sl {
    flex: 1 1 14rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
